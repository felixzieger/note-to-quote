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
)
from datetime import timedelta
import time
import base64

# Dictionary to track processed event IDs with their timestamps
processed_events = {}

BROADCAST_RELAYS = [
    "wss://relay.damus.io",
    "wss://relay.nostr.band",
    "wss://nos.lol",
    "wss://nostr.mom",
    "wss://relay.nostr.bg",
    "wss://nostr.bitcoiner.social",
    "wss://relay.snort.social",
    "wss://purplepag.es",
]


async def get_parent_note(client: Client, event: Event) -> str:
    """Fetch the parent note of the given event."""
    # Get the reply_to event ID from the event's tags
    for tag in event.tags().to_vec():
        if tag.as_vec()[0] == "e":  # 'e' tag indicates a reply
            parent_id = EventId.parse(tag.as_vec()[1])
            # Create a filter to fetch the parent event
            filter = Filter().ids([parent_id])
            events = await client.fetch_events(
                filter=filter, timeout=timedelta(seconds=5)
            )
            if events.len() > 0:
                return events.to_vec()[0].content()
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


async def generate_quote_picture(text: str, event_id: str) -> str:
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
            # Navigate to the website with timeout
            await page.goto(
                "https://note-to-quote.vercel.app/?r=strfry.felixzieger.de",
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


async def handle_event(event: Event, client: Client, keys: Keys):
    event_id = event.id().to_bech32()

    # Skip if we've already processed this event
    if event_id in processed_events:
        return

    # Skip if the event was created by our own public key
    if event.author().to_bech32() == keys.public_key().to_bech32():
        return

    # Check if the event mentions our public key
    if keys.public_key().to_bech32() in event.content():
        print(f"{event_id}: Processing event")

        # Create events directory if it doesn't exist
        events_dir = Path("events")
        events_dir.mkdir(exist_ok=True)

        # Check if we've already saved this event
        event_file = events_dir / f"reply_to_{event_id}.json"
        if event_file.exists():
            print(f"{event_id}: Reply to event already saved, skipping...")
            processed_events[event_id] = time.time()
            return

        # Get the parent note
        parent_content = await get_parent_note(client, event)
        if not parent_content:
            print(f"{event_id}: No parent note found")
            processed_events[event_id] = time.time()
            return

        try:
            # Get the parent event ID from the event's tags
            parent_id = None
            for tag in event.tags().to_vec():
                if tag.as_vec()[0] == "e":  # 'e' tag indicates a reply
                    parent_id = tag.as_vec()[1]
                    break

            if not parent_id:
                print(f"{event_id}: No parent event ID found in tags")
                return

            # Generate quote picture using the parent event ID
            image_url = await generate_quote_picture(parent_content, parent_id)
            if not image_url:
                print(f"{event_id}: Failed to generate quote picture")
                return

            # Create a reply event with the quote picture
            reply_content = image_url
        except Exception as e:
            if "Event not found" in str(e):
                reply_content = "Sorry, I couldn't find the event you want to quote"
            else:
                print(f"{event_id}: Failed to generate quote picture: {e}")
                return

        builder = EventBuilder.text_note(reply_content)

        # Add reference to the original event
        builder = builder.text_note_reply(content=reply_content, reply_to=event)

        # Create reply to the event and store it locally
        reply_event = await client.sign_event_builder(builder=builder)
        reply_event_json = reply_event.as_json()

        # Save reply event JSON to file using its ID as filename
        with open(event_file, "w") as f:
            json.dump(reply_event_json, f, indent=2)
        print(f"{event_id}: Saved reply locally")

        # Send the reply
        output = await client.send_event_builder(builder)
        print(f"{event_id}: Replied to event on {output.success}")

        # Mark this event as processed with current timestamp
        processed_events[event_id] = time.time()


async def run_bot():
    # Read secret key from environment variable
    secret_key = os.getenv("BOT_SECRET_KEY")
    if not secret_key:
        raise ValueError("BOT_SECRET_KEY environment variable is not set")

    # Create keys from secret key
    keys = Keys.parse(secret_key=secret_key)
    signer = NostrSigner.keys(keys=keys)
    client = Client(signer=signer)

    # Verify public key matches
    expected_pubkey = os.getenv("BOT_PUBLIC_KEY")
    if expected_pubkey and expected_pubkey != keys.public_key().to_bech32():
        raise ValueError(
            "BOT_PUBLIC_KEY does not match the public key derived from BOT_SECRET_KEY"
        )

    # Connect to relay(s)
    # This will be our only write relay for the beginning
    await client.add_relay("wss://strfry.felixzieger.de")

    # Broadcast metadata to many relays
    for relay in BROADCAST_RELAYS:
        await client.add_relay(relay)
    await client.connect()

    # Update metadata using Metadata class
    metadata_content = (
        Metadata()
        .set_name("Note to Quote Bot")
        .set_display_name("Note to Quote")
        .set_about(
            "I turn Nostr notes into beautiful quote images. Mention me in a reply to a note to get a quote image!"
        )
        .set_website("https://note-to-quote.vercel.app")
        .set_nip05("_@note-to-quote.vercel.app")
        .set_picture("https://note-to-quote.vercel.app/me.png")
        .set_custom_field("bot", JsonValue.BOOL(True))
    )

    # Build metadata event with content
    metadata_builder = EventBuilder.metadata(metadata_content)
    metadata_output = await client.send_event_builder(metadata_builder)
    print(f"Updated metadata: {metadata_output.success}")

    for relay in BROADCAST_RELAYS:
        await client.remove_relay(relay)
        await client.add_read_relay(relay)

    print("Bot is running and listening for mentions...")

    current_time = int(time.time())
    five_minutes_ago = Timestamp.from_secs(current_time - (5 * 60))

    filter = (
        Filter()
        .kinds([Kind.from_std(KindStandard.TEXT_NOTE)])
        .since(five_minutes_ago)
        .pubkey(keys.public_key())
    )

    await client.subscribe(filter)

    while True:
        try:

            events = await client.fetch_events(
                filter=filter, timeout=timedelta(seconds=10)
            )
            for event in events.to_vec():
                await handle_event(event, client, keys)

            await asyncio.sleep(10)
        except Exception as e:
            print(f"Error: {e}")
            await asyncio.sleep(10)  # Wait a bit before retrying


def main():
    asyncio.run(run_bot())


if __name__ == "__main__":
    main()
