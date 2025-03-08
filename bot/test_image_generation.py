import asyncio
from main import generate_quote_picture


async def test_image_generation():
    event_id = (
        "nevent1qvzqqqqqqyqzpkz95vv6stffy80vwg2fwsk0gx2f6c2hhcqxutghmp0sae9lzu7fwndnwx"
    )
    print(f"Testing image generation for event ID: {event_id}")

    # We don't need the text parameter since the website only uses the event ID
    image_path = await generate_quote_picture("", event_id)

    if image_path:
        print(f"Success! Image saved to: {image_path}")
    else:
        print("Failed to generate image")


if __name__ == "__main__":
    asyncio.run(test_image_generation())
