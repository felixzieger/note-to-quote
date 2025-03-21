import asyncio
import os
import json
import aiohttp
import tempfile
from pathlib import Path
from playwright.async_api import async_playwright
from nostr_sdk import (
    Keys,
    Client,
    EventBuilder,
    NostrSigner,
    Filter,
    Kind,
    KindStandard,
    Event,
    Timestamp,
    EventId,
    Metadata,
    JsonValue,
    RelayMetadata,
    Tag,
    PublicKey,
)
from datetime import timedelta
import time
import base64

# Dictionary to track processed event IDs with their timestamps
processed_events = {}

WRITE_RELAYS = [
    "wss://strfry.felixzieger.de",
    "wss://relay.damus.io",
    "wss://nos.lol",
    "wss://nostr.mom",
]

READ_RELAYS = [
    "wss://relay.nostr.band",
    "wss://relay.nostr.bg",
    "wss://nostr.bitcoiner.social",
    "wss://relay.snort.social",
    "wss://purplepag.es",
]


async def get_parent_note(client: Client, event: Event) -> str:
    """Fetch the parent note of the given event.
    
    If the event has an e-tag, fetch that parent event.
    If no parent is found (this is the root of a conversation), return this event's content.
    """
    # Get the reply_to event ID from the event's tags
    has_e_tag = False
    for tag in event.tags().to_vec():
        if tag.as_vec()[0] == "e":  # 'e' tag indicates a reply
            has_e_tag = True
            parent_id = EventId.parse(tag.as_vec()[1])
            # Create a filter to fetch the parent event
            filter = Filter().ids([parent_id])
            events = await client.fetch_events(
                filter=filter, timeout=timedelta(seconds=5)
            )
            if events.len() > 0:
                return events.to_vec()[0].content()
    
    # If no e-tag was found or parent event couldn't be fetched,
    # this is the root of a conversation, so return this event's content
    if not has_e_tag:
        return event.content()
    
    return None


async def upload_to_imgbb(image_path: str) -> str:
    """Upload an image to imgBB and return the URL."""
    # Read the image file
    with open(image_path, "rb") as f:
        image_data = f.read()

    # Convert to base64
    base64_image = base64.b64encode(image_data).decode("utf-8")

    # Prepare the form data
    form_data = aiohttp.FormData()
    form_data.add_field("image", base64_image)

    # Get the API key from environment variable
    api_key = os.getenv("IMGBB_API_KEY")
    if not api_key:
        raise ValueError("IMGBB_API_KEY environment variable is not set")

    # Upload to imgBB
    async with aiohttp.ClientSession() as session:
        async with session.post(
            "https://api.imgbb.com/1/upload", data=form_data, params={"key": api_key}
        ) as response:
            if response.status != 200:
                raise Exception(f"Failed to upload image: {await response.text()}")

            result = await response.json()
            if not result.get("success"):
                raise Exception(
                    f"imgBB API error: {result.get('error', {}).get('message', 'Unknown error')}"
                )

            return result["data"]["url"]


async def get_parent_relay(event: Event) -> str:
    """Extract a relay URL from the parent event's tags."""
    for tag in event.tags().to_vec():
        if tag.as_vec()[0] == "r":  # 'r' tag indicates a relay
            return tag.as_vec()[1]
    # If no relay found in tags, return a default relay
    print("No relay found in tags, returning default relay")
    return "relay.damus.io"


async def generate_quote_picture(text: str, event_id: str, relay_url: str) -> str:
    """Generate a quote picture using the note-to-quote website and upload it to imgBB."""
    # Create images directory if it doesn't exist
    images_dir = Path("images")
    images_dir.mkdir(exist_ok=True)

    # Define the output path for the image
    output_path = images_dir / f"quote_{event_id}.png"

    async with async_playwright() as p:
        try:
            # Launch browser with more verbose logging and visible window
            browser = await p.chromium.launch()
            context = await browser.new_context()
            page = await context.new_page()

            # Enable verbose logging and error detection
            error_message = None

            def handle_console(msg):
                nonlocal error_message
                if "Error fetching Nostr event" in msg.text:
                    error_message = "Event not found on any relay"
                # Only log other console messages if they're errors
                elif msg.type == "error":
                    print(f"Browser error: {msg.text}")

            page.on("console", handle_console)
            page.on("pageerror", lambda err: print(f"Browser error: {err}"))

            print(f"Navigating to website...")
            # Navigate to the website with relay parameter
            await page.goto(
                f"https://note-to-quote.vercel.app/?r={relay_url}",
                timeout=30000,
            )

            print(f"Waiting for page to load...")
            # Wait for the page to be fully loaded
            await page.wait_for_load_state("networkidle", timeout=30000)

            print(f"Looking for input field...")
            # Find the input field
            input_field = await page.query_selector("input")
            if not input_field:
                print("Error: No input field found")
                return None

            print(f"Filling in event ID...")
            # Fill in the event ID
            await input_field.fill(event_id)

            print(f"Clicking Generate button...")
            # Find and click the Generate button
            generate_button = await page.query_selector("button[type='submit']")
            if not generate_button:
                print("Error: No Generate button found")
                return None
            await generate_button.click()

            # Wait a bit for any animations or state changes
            await page.wait_for_timeout(2000)

            # Check if we detected an error
            if error_message:
                raise Exception(error_message)

            print(f"Waiting for canvas to appear...")
            try:
                # Wait for the canvas element to appear
                canvas = await page.wait_for_selector("canvas", timeout=30000)
                if not canvas:
                    print("Error: No canvas found")
                    return None
            except Exception as e:
                print(f"Error: Canvas not found after timeout")
                return None

            # Wait a bit for the canvas to be fully rendered
            await page.wait_for_timeout(1000)

            print(f"Getting image data from canvas...")
            # Get the image data from the canvas
            image_data = await page.evaluate(
                """() => {
                const canvas = document.querySelector('canvas.w-full');
                return canvas.toDataURL('image/png');
            }"""
            )

            if not image_data or not image_data.startswith("data:image/png"):
                print("Error: No valid image data found in canvas")
                return None

            print(f"Saving image...")
            # Extract the base64 data and save it
            # Remove the data:image/png;base64, prefix
            base64_data = image_data.split(",")[1]
            # Decode and save the image
            with open(output_path, "wb") as f:
                f.write(base64.b64decode(base64_data))
            print(f"Success: Image saved to {output_path}")

            # Upload to imgBB
            print(f"Uploading to imgBB...")
            imgbb_url = await upload_to_imgbb(str(output_path))
            print(f"Success: Image uploaded to {imgbb_url}")

            # Clean up the local file
            output_path.unlink()

            # Return the imgBB URL
            return imgbb_url

        except Exception as e:
            print(f"Error generating quote picture: {e}")
            if "Event not found" in str(e):
                raise Exception("Event not found")
            return None
        finally:
            # Always close the browser
            await browser.close()


async def get_user_relays(event: Event) -> tuple[list[str], list[str]]:
    """Extract write and read relays from the event tags."""
    write_relays = set()
    read_relays = set()

    # First add our default relays as fallback
    write_relays.update(WRITE_RELAYS)
    read_relays.update(READ_RELAYS)

    # Extract relays from event tags
    for tag in event.tags().to_vec():
        if tag.as_vec()[0] == "r":  # 'r' tag indicates a relay
            relay_url = tag.as_vec()[1]
            # If there's a marker for read/write, use it
            if len(tag.as_vec()) > 2:
                marker = tag.as_vec()[2]
                if marker == "write":
                    write_relays.add(relay_url)
                elif marker == "read":
                    read_relays.add(relay_url)
                # If no marker or "read+write", add to both
                else:
                    write_relays.add(relay_url)
                    read_relays.add(relay_url)
            else:
                # If no marker specified, assume it's both read and write
                write_relays.add(relay_url)
                read_relays.add(relay_url)

    return list(write_relays), list(read_relays)


async def handle_event(event: Event, keys: Keys):
    event_id = event.id().to_bech32()

    # Skip if we've already processed this event
    if event_id in processed_events:
        return

    # Skip if the event was created by our own public key
    if event.author().to_bech32() == keys.public_key().to_bech32():
        return

    print(f"{event_id}: Processing event")

    # Get user's relays
    users_write_relays, users_read_relays = await get_user_relays(event)

    # Create a new client for this specific interaction
    signer = NostrSigner.keys(keys=keys)
    reply_client = Client(signer=signer)

    # Connect to the user's relays
    for users_write_relay in users_write_relays:
        # The user is writing to us, so we need to read from their write relays
        await reply_client.add_read_relay(users_write_relay)
    for users_read_relay in users_read_relays:
        # The user is reading from us, so we need to write to their read relays
        await reply_client.add_write_relay(users_read_relay)

    await reply_client.connect()

    try:
        # Create events directory if it doesn't exist
        events_dir = Path("events")
        events_dir.mkdir(exist_ok=True)

        # Check if we've already saved this event
        event_file = events_dir / f"reply_to_{event_id}.json"
        if event_file.exists():
            print(f"{event_id}: Reply to event already saved, skipping...")
            processed_events[event_id] = time.time()
            return

        # Get the parent note (or this note if it's the root)
        parent_content = await get_parent_note(reply_client, event)
        if not parent_content:
            print(f"{event_id}: No parent note found and not a root note")
            processed_events[event_id] = time.time()
            return

        try:
            # Get the parent event ID from the event's tags
            parent_id = None
            has_e_tag = False
            for tag in event.tags().to_vec():
                if tag.as_vec()[0] == "e":  # 'e' tag indicates a reply
                    has_e_tag = True
                    parent_id = tag.as_vec()[1]
                    break

            # If no e-tag, this is the root note, so use this event's ID
            if not has_e_tag:
                parent_id = event.id().to_hex()
                print(f"{event_id}: This is a root note, using its own ID")
            elif not parent_id:
                print(f"{event_id}: No parent event ID found in tags")
                return

            # Get a relay URL from the event's tags
            relay_url = await get_parent_relay(event)
            # Remove wss:// prefix if present
            relay_url = relay_url.replace("wss://", "")

            # Generate quote picture using the parent event ID and relay
            image_url = await generate_quote_picture(
                parent_content, parent_id, relay_url
            )
            if not image_url:
                print(f"{event_id}: Failed to generate quote picture")
                return

            # Create a reply event with the quote picture and mention the requester
            requester_pubkey = event.author().to_bech32()
            reply_content = f"{requester_pubkey} \n\n{image_url}"
        except Exception as e:
            if "Event not found" in str(e):
                requester_pubkey = event.author().to_bech32()
                reply_content = f"{requester_pubkey} Sorry, I couldn't find the event you want to quote"
            else:
                print(f"{event_id}: Failed to generate quote picture: {e}")
                return
        builder = EventBuilder.text_note(reply_content)

        # Add reference to the original event
        builder = builder.text_note_reply(content=reply_content, reply_to=event)

        # Create reply to the event and store it locally
        reply_event = await reply_client.sign_event_builder(builder=builder)
        reply_event_json = reply_event.as_json()

        # Save reply event JSON to file using its ID as filename
        with open(event_file, "w") as f:
            json.dump(reply_event_json, f, indent=2)
        print(f"{event_id}: Saved reply locally")

        # Send the reply using the specific client
        output = await reply_client.send_event_builder(builder)
        print(f"{event_id}: Replied to event on {output.success}")

        # Mark this event as processed with current timestamp
        processed_events[event_id] = time.time()

    finally:
        # Clean up the client
        await reply_client.disconnect()
        await reply_client.shutdown()


async def setup_metadata(keys: Keys):
    """Set up bot metadata and relay list using a dedicated client."""
    signer = NostrSigner.keys(keys=keys)
    metadata_client = Client(signer=signer)

    # Connect to all relays for metadata broadcast
    for relay in WRITE_RELAYS + READ_RELAYS:
        await metadata_client.add_relay(relay)
    await metadata_client.connect()

    # Get stage from environment
    stage = os.getenv("STAGE", "prod")
    
    # Set name and description based on stage
    bot_name = "[DEV] Note to Quote Bot" if stage == "dev" else "Note to Quote Bot"
    bot_description = (
        "[DEV] I turn Nostr notes into quote images. Mention me in a reply to get a quote image!" 
        if stage == "dev" 
        else "I turn Nostr notes into quote images. Mention me in a reply to get a quote image!"
    )

    # Update metadata using Metadata class
    metadata_content = (
        Metadata()
        .set_name(bot_name)
        .set_display_name(bot_name)
        .set_about(bot_description)
        .set_website("https://note-to-quote.vercel.app")
        .set_nip05("_@note-to-quote.vercel.app")
        .set_picture("https://note-to-quote.vercel.app/me.png")
        .set_custom_field("bot", JsonValue.BOOL(True))
        .set_lud16("fallingtree17238@getalby.com")
    )

    # Build metadata event with content
    metadata_builder = EventBuilder.metadata(metadata_content)
    metadata_output = await metadata_client.send_event_builder(metadata_builder)
    print(f"Updated metadata: {metadata_output.success}")

    # Create NIP-65 relay list event
    relays_dict = {}
    # Add write relays
    for relay in WRITE_RELAYS:
        relays_dict[relay] = RelayMetadata.WRITE
    # Add read-only relays
    for relay in READ_RELAYS:
        relays_dict[relay] = RelayMetadata.READ

    # Build and send relay list event
    relay_list_builder = EventBuilder.relay_list(relays_dict)
    relay_list_output = await metadata_client.send_event_builder(relay_list_builder)
    print(f"Updated relay list: {relay_list_output.success}")

    # Clean up
    await metadata_client.disconnect()
    await metadata_client.shutdown()


async def run_bot():
    secret_key = os.getenv("BOT_SECRET_KEY")
    if not secret_key:
        raise ValueError("BOT_SECRET_KEY environment variable is not set")

    keys = Keys.parse(secret_key=secret_key)

    await setup_metadata(keys)

    # Connect to relay(s)
    signer = NostrSigner.keys(keys=keys)
    client = Client(signer=signer)
    for relay in WRITE_RELAYS:
        await client.add_relay(relay)

    for relay in READ_RELAYS:
        await client.add_read_relay(relay)

    await client.connect()

    print("Bot is running and listening for mentions...")

    filter = (
        Filter()
        .kinds([Kind.from_std(KindStandard.TEXT_NOTE)])
        .pubkey(keys.public_key())
    )

    while True:
        try:
            current_time = int(time.time())
            two_minutes_ago = Timestamp.from_secs(current_time - (2 * 60))
            filter = filter.since(two_minutes_ago)

            events = await client.fetch_events(
                filter=filter, timeout=timedelta(seconds=10)
            )
            print(f"Received {events.len()} events")
            for event in events.to_vec():
                await handle_event(event, keys)

            await asyncio.sleep(10)
        except Exception as e:
            print(f"Error: {e}")
            await asyncio.sleep(10)  # Wait a bit before retrying


def main():
    asyncio.run(run_bot())


if __name__ == "__main__":
    main()
