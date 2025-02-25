import type { VercelRequest, VercelResponse } from '@vercel/node';
import sharp from 'sharp';
import * as QRCode from 'qrcode';

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

        // Create SVG for the text content
        let svgContent = '';

        if (isContentTooLong) {
            // SVG for "content too long" message
            svgContent = `
        <svg width="1000" height="1000">
          <style>
            .title { font: bold 36px ${font || 'Arial'}; fill: #1A1A1A; text-anchor: middle; }
            .subtitle { font: 24px ${font || 'Arial'}; fill: #1A1A1A; text-anchor: middle; }
            .author { font: 32px ${font || 'Arial'}; fill: #1A1A1A; text-anchor: middle; }
          </style>
          <text x="500" y="480" class="title">This note is too long for a quote</text>
          <text x="500" y="530" class="subtitle">Content exceeds ${MAX_QUOTE_LENGTH} characters</text>
          <text x="500" y="600" class="author">- ${author}</text>
        </svg>
      `;
        } else {
            // Word wrap for the quote
            const words = quote.split(' ');
            const lines = [];
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

            // Create SVG with wrapped text
            const lineHeight = 60;
            const startY = 500 - (lines.length * lineHeight / 2);

            let linesHTML = '';
            lines.forEach((line, i) => {
                linesHTML += `<text x="500" y="${startY + i * lineHeight}" class="quote">${line}</text>`;
            });

            svgContent = `
        <svg width="1000" height="1000">
          <style>
            .quote { font: bold 48px ${font || 'Arial'}; fill: #1A1A1A; text-anchor: middle; }
            .author { font: 32px ${font || 'Arial'}; fill: #1A1A1A; text-anchor: middle; }
          </style>
          ${linesHTML}
          <text x="500" y="${startY + lines.length * lineHeight + 40}" class="author">- ${author}</text>
        </svg>
      `;
        }

        // Add QR code if needed
        let compositeOperations = [{ input: Buffer.from(svgContent), top: 0, left: 0 }];

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
            // Add text reference as SVG
            const eventIdSvg = `
        <svg width="1000" height="1000">
          <style>
            .eventId { font: 14px ${font || 'Arial'}; fill: rgba(0,0,0,0.2); text-anchor: middle; }
          </style>
          <text x="500" y="980" class="eventId">${nostrEventId}</text>
        </svg>
      `;
            compositeOperations.push({ input: Buffer.from(eventIdSvg), top: 0, left: 0 });
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

// Use ES module export
export default handler; 