import asyncio
import os
from nostr_sdk import (
    Keys,
    Client,
    EventBuilder,
    NostrSigner,
    EventId,
    Filter,
    Timestamp,
)
from datetime import timedelta


async def post_test_event(bot_pubkey: str):
    # Generate keys for the test user
    keys = Keys.generate()
    signer = NostrSigner.keys(keys)
    client = Client(signer)

    # Connect to relay
    await client.add_relay("wss://strfry.felixzieger.de")
    await client.connect()

    # Create and send the original note
    original_content = "This is a test note that will be quoted."
    original_builder = EventBuilder.text_note(original_content)
    original_output = await client.send_event_builder(original_builder)
    print(f"Posted original note: {original_output.id.to_bech32()}")
    print(f"Sent to: {original_output.success}")
    print(f"Failed to send to: {original_output.failed}")

    # Fetch the event we just sent
    filter = Filter().ids([original_output.id])
    events = await client.fetch_events(filter=filter, timeout=timedelta(seconds=5))
    if events.len() == 0:
        print("Failed to fetch the original event")
        return
    original_event = events.to_vec()[0]

    # Create and send a reply that mentions the bot
    reply_content = f"Hello @{bot_pubkey}! Please quote the note above."
    reply_builder = EventBuilder.text_note_reply(
        content=reply_content, reply_to=original_event
    )
    reply_output = await client.send_event_builder(reply_builder)
    print(f"Posted reply: {reply_output.id.to_bech32()}")
    print(f"Sent to: {reply_output.success}")
    print(f"Failed to send to: {reply_output.failed}")


if __name__ == "__main__":
    # Read bot's public key from environment variable
    bot_pubkey = os.getenv("BOT_PUBLIC_KEY")
    if not bot_pubkey:
        raise ValueError("BOT_PUBLIC_KEY environment variable is not set")

    asyncio.run(post_test_event(bot_pubkey))
