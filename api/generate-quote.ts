import type { VercelRequest, VercelResponse } from '@vercel/node';
import sharp from 'sharp';
import * as QRCode from 'qrcode';
import { join } from 'path';

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

// Define the composite operation type to match Sharp's requirements
// Using the correct type for blend from Sharp's OverlayOptions
type Blend = 'over' | 'atop' | 'xor' | 'multiply' | 'screen' | 'overlay' | 'darken' | 'lighten' | 'color-dodge' | 'color-burn' | 'hard-light' | 'soft-light' | 'difference' | 'exclusion';

interface CompositeOperation {
    input: Buffer;
    top?: number;
    left?: number;
    gravity?: string;
    blend?: Blend;
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
            font = 'Arial', // Font is ignored in this implementation
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

        // Create text overlays using PNG buffers instead of SVG
        const compositeOperations: CompositeOperation[] = [];

        if (isContentTooLong) {
            // Create text overlays for "content too long" message
            const titleTextBuffer = await createTextImage("This note is too long for a quote", 36, true);
            const subtitleTextBuffer = await createTextImage(`Content exceeds ${MAX_QUOTE_LENGTH} characters`, 24, false);
            const authorTextBuffer = await createTextImage(`- ${author}`, 32, false);

            compositeOperations.push(
                { input: titleTextBuffer, top: 450, left: 0 },
                { input: subtitleTextBuffer, top: 500, left: 0 },
                { input: authorTextBuffer, top: 570, left: 0 }
            );
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

            // Create text overlays for each line
            for (let i = 0; i < lines.length; i++) {
                const lineTextBuffer = await createTextImage(lines[i], 48, true);
                compositeOperations.push({
                    input: lineTextBuffer,
                    top: startY + i * lineHeight - 24, // Adjust for text height
                    left: 0
                });
            }

            // Add author text
            const authorTextBuffer = await createTextImage(`- ${author}`, 32, false);
            compositeOperations.push({
                input: authorTextBuffer,
                top: startY + lines.length * lineHeight + 16,
                left: 0
            });
        }

        // Add QR code if needed
        if (nostrEventId && eventIdDisplayMode === 'qrcode') {
            try {
                // Generate QR code
                const njumpUrl = `https://nosta.me/${nostrEventId}`;
                const qrCodeDataUrl = await QRCode.toDataURL(njumpUrl, {
                    width: 100,
                    margin: 1,
                    color: {
                        dark: '#00000080', // Semi-transparent black
                        light: '#FFFFFF00'  // Transparent white
                    }
                });

                // Convert data URL to buffer
                const qrCodeBuffer = Buffer.from(qrCodeDataUrl.split(',')[1], 'base64');

                // Add QR code to composite operations
                compositeOperations.push({
                    input: qrCodeBuffer,
                    top: 880,
                    left: 880
                });
            } catch (error) {
                console.error('Error generating QR code:', error);
            }
        } else if (nostrEventId && eventIdDisplayMode === 'text') {
            // Add event ID as text
            const eventIdTextBuffer = await createTextImage(nostrEventId, 14, false, 'rgba(0,0,0,0.2)');
            compositeOperations.push({
                input: eventIdTextBuffer,
                top: 970,
                left: 0
            });
        }

        // Generate the final image
        const finalImage = await baseImage
            .composite(compositeOperations)
            .png()
            .toBuffer();

        // Set response headers
        res.setHeader('Content-Type', 'image/png');
        res.setHeader('Cache-Control', 'public, max-age=86400'); // Cache for 24 hours

        // Send the image
        return res.status(200).send(finalImage);
    } catch (error) {
        console.error('Error generating quote image:', error);
        return res.status(500).json({
            error: 'Failed to generate image',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}

// Helper function to create a text image
async function createTextImage(text: string, fontSize: number, isBold: boolean, color: string = '#1A1A1A'): Promise<Buffer> {
    // Create a PNG with text
    const textWidth = text.length * (fontSize * 0.6); // Approximate width based on font size
    const width = Math.max(1000, textWidth); // Ensure minimum width

    // Create a simple PNG with text
    const textSvg = `
    <svg width="${width}" height="${fontSize * 2}" xmlns="http://www.w3.org/2000/svg">
      <text 
        x="50%" 
        y="50%" 
        font-family="sans-serif" 
        font-size="${fontSize}px" 
        ${isBold ? 'font-weight="bold"' : ''} 
        fill="${color}" 
        text-anchor="middle" 
        dominant-baseline="middle"
      >${escapeXml(text)}</text>
    </svg>
  `;

    // Convert SVG to PNG
    return await sharp(Buffer.from(textSvg))
        .resize({ width: 1000, fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .png()
        .toBuffer();
}

// Helper function to escape XML special characters
function escapeXml(text: string): string {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

// Use ES module export
export default handler; 