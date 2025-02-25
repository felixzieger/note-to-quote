import type { VercelRequest, VercelResponse } from '@vercel/node';
import sharp from 'sharp';
import * as QRCode from 'qrcode';
import { createCanvas, loadImage } from 'canvas';

// Maximum number of characters allowed for a quote
const MAX_QUOTE_LENGTH = 314;

// Types
type BackgroundType = "color" | "profile";
type EventIdDisplayMode = "text" | "qrcode" | "hidden";

interface QuoteRequestParams {
    quote: string;
    author: string;
    font: string;
    background: string;
    backgroundType: BackgroundType;
    authorProfilePicture?: string;
    nostrEventId?: string;
    eventIdDisplayMode?: EventIdDisplayMode;
}

// Use named export instead of default export
export const config = {
    api: {
        bodyParser: true,
    },
};

// Font families that work well in serverless environments
// Using generic font families that don't require specific font files
const FONT_FAMILIES = {
    sans: 'sans-serif',
    serif: 'serif',
    mono: 'monospace',
    // Map specific font requests to generic families
    'Arial': 'sans-serif',
    'Helvetica': 'sans-serif',
    'Times New Roman': 'serif',
    'Times': 'serif',
    'Courier New': 'monospace',
    'Courier': 'monospace',
    'Verdana': 'sans-serif',
    'Georgia': 'serif',
    'Palatino': 'serif',
    'Garamond': 'serif',
    'Bookman': 'serif',
    'Tahoma': 'sans-serif',
    'Trebuchet MS': 'sans-serif',
    'Impact': 'sans-serif',
    'Comic Sans MS': 'sans-serif'
};

// Use named export instead of default export
export async function handler(req: VercelRequest, res: VercelResponse) {
    // Only allow POST requests
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        // Extract parameters from request body
        const {
            quote,
            author,
            font = 'Arial',
            background = '#FFFFFF',
            backgroundType = 'color',
            authorProfilePicture,
            nostrEventId,
            eventIdDisplayMode = 'qrcode'
        } = req.body as QuoteRequestParams;

        // Validate required parameters
        if (!quote || !author) {
            return res.status(400).json({ error: 'Quote and author are required' });
        }

        // Check if content is too long
        const isContentTooLong = quote.length > MAX_QUOTE_LENGTH;

        // Create a base image
        let baseImage = sharp({
            create: {
                width: 1000,
                height: 1000,
                channels: 4,
                background: background
            }
        });

        // If using profile picture as background
        if (backgroundType === 'profile' && authorProfilePicture) {
            try {
                // Fetch the profile picture
                const response = await fetch(authorProfilePicture);
                if (!response.ok) throw new Error('Failed to fetch profile picture');

                const profileBuffer = await response.arrayBuffer();

                // Create a composite with the profile picture and an overlay
                baseImage = sharp(Buffer.from(profileBuffer))
                    .resize(1000, 1000, { fit: 'cover' })
                    .composite([{
                        input: {
                            create: {
                                width: 1000,
                                height: 1000,
                                channels: 4,
                                background: { r: 255, g: 255, b: 255, alpha: 0.7 }
                            }
                        },
                        blend: 'over'
                    }]);
            } catch (error) {
                console.error('Error loading profile picture:', error);
                // Continue with default background
            }
        }

        try {
            // Try using canvas for text rendering (preferred method)
            const textBuffer = await renderWithCanvas(quote, author, isContentTooLong, nostrEventId, eventIdDisplayMode);

            // Composite the text onto the base image
            const finalImage = await baseImage
                .composite([{ input: textBuffer, top: 0, left: 0 }])
                .png()
                .toBuffer();

            // Set response headers
            res.setHeader('Content-Type', 'image/png');
            res.setHeader('Cache-Control', 'public, max-age=86400'); // Cache for 24 hours

            // Send the image
            return res.status(200).send(finalImage);
        } catch (canvasError) {
            console.error('Canvas rendering failed, falling back to direct image generation:', canvasError);

            // Fallback to a simple image with text
            const finalImage = await createSimpleFallbackImage(quote, author, background, isContentTooLong);

            // Set response headers
            res.setHeader('Content-Type', 'image/png');
            res.setHeader('Cache-Control', 'public, max-age=86400'); // Cache for 24 hours

            // Send the image
            return res.status(200).send(finalImage);
        }
    } catch (error) {
        console.error('Error generating quote image:', error);
        return res.status(500).json({
            error: 'Failed to generate image',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}

// Render text using canvas (preferred method)
async function renderWithCanvas(
    quote: string,
    author: string,
    isContentTooLong: boolean,
    nostrEventId?: string,
    eventIdDisplayMode?: EventIdDisplayMode
): Promise<Buffer> {
    // Create a single canvas for all text content
    const canvas = createCanvas(1000, 1000);
    const ctx = canvas.getContext('2d');

    // Make the canvas transparent (we'll only draw the text)
    ctx.clearRect(0, 0, 1000, 1000);

    if (isContentTooLong) {
        // Draw "content too long" message
        ctx.textAlign = 'center';
        ctx.fillStyle = '#1A1A1A';

        ctx.font = 'bold 36px sans-serif';
        ctx.fillText('This note is too long for a quote', 500, 480);

        ctx.font = '24px sans-serif';
        ctx.fillText(`Content exceeds ${MAX_QUOTE_LENGTH} characters`, 500, 530);

        ctx.font = '32px sans-serif';
        ctx.fillText(`- ${author}`, 500, 600);
    } else {
        // Word wrap for the quote
        const words = quote.split(' ');
        const lines: string[] = [];
        let currentLine = words[0];
        const maxLineWidth = 30; // Approximate characters per line

        for (let i = 1; i < words.length; i++) {
            const word = words[i];
            if (currentLine.length + word.length + 1 < maxLineWidth) {
                currentLine += ' ' + word;
            } else {
                lines.push(currentLine);
                currentLine = word;
            }
        }
        lines.push(currentLine);

        // Calculate vertical positioning
        const lineHeight = 60;
        const startY = 500 - (lines.length * lineHeight / 2);

        // Draw each line of the quote
        ctx.textAlign = 'center';
        ctx.fillStyle = '#1A1A1A';
        ctx.font = 'bold 48px sans-serif';

        lines.forEach((line, i) => {
            ctx.fillText(line, 500, startY + i * lineHeight);
        });

        // Draw author
        ctx.font = '32px sans-serif';
        ctx.fillText(`- ${author}`, 500, startY + lines.length * lineHeight + 40);
    }

    // Add QR code or event ID if needed
    if (nostrEventId && eventIdDisplayMode === 'qrcode') {
        try {
            // Generate QR code
            const njumpUrl = `https://nosta.me/${nostrEventId}`;
            const qrCodeCanvas = createCanvas(100, 100);

            // Use QRCode to render directly to our canvas
            await QRCode.toCanvas(qrCodeCanvas, njumpUrl, {
                width: 100,
                margin: 1,
                color: {
                    dark: '#00000080', // Semi-transparent black
                    light: '#FFFFFF00'  // Transparent white
                }
            });

            // Draw the QR code canvas onto our main canvas
            ctx.drawImage(qrCodeCanvas, 880, 880, 100, 100);
        } catch (error) {
            console.error('Error generating QR code:', error);
        }
    } else if (nostrEventId && eventIdDisplayMode === 'text') {
        // Draw event ID as text
        ctx.textAlign = 'center';
        ctx.fillStyle = 'rgba(0,0,0,0.2)';
        ctx.font = '14px sans-serif';
        ctx.fillText(nostrEventId, 500, 980);
    }

    // Convert canvas to buffer
    return canvas.toBuffer('image/png');
}

// Create a simple fallback image without using canvas or complex compositing
async function createSimpleFallbackImage(
    quote: string,
    author: string,
    background: string,
    isContentTooLong: boolean
): Promise<Buffer> {
    // Create a simple image with just the background
    const image = sharp({
        create: {
            width: 1000,
            height: 1000,
            channels: 4,
            background: background
        }
    });

    // Add a simple message
    const message = isContentTooLong
        ? "This note is too long for a quote. Please try again with a shorter message."
        : "Quote image generation failed. Please try again later.";

    // Generate the image
    return await image.png().toBuffer();
}

// Use ES module export
export default handler; 