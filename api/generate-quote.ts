import { createCanvas, loadImage, registerFont } from 'canvas';
import QRCode from 'qrcode';
import type { VercelRequest, VercelResponse } from '@vercel/node';

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

export default async function handler(req: VercelRequest, res: VercelResponse) {
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

    // Create canvas with the same dimensions as in the component
    const canvas = createCanvas(1000, 1000);
    const ctx = canvas.getContext('2d');

    // Handle background
    if (backgroundType === 'profile' && authorProfilePicture) {
      try {
        // Load profile picture
        const img = await loadImage(authorProfilePicture);
        
        // Draw profile picture as background
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        
        // Add a semi-transparent overlay to improve text readability
        ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      } catch (error) {
        console.error('Error loading profile picture:', error);
        
        // Fallback to a simple gradient if loading fails
        const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
        gradient.addColorStop(0, '#f3e7e9');
        gradient.addColorStop(0.5, '#e3eeff');
        gradient.addColorStop(1, '#f3e7e9');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
    } else {
      // Use solid color background
      ctx.fillStyle = background;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    // Check if content is too long
    const isContentTooLong = quote.length > MAX_QUOTE_LENGTH;

    // If content is too long, show message
    if (isContentTooLong) {
      ctx.font = `600 36px ${font}`;
      ctx.fillStyle = '#1A1A1A';
      ctx.textAlign = 'center';
      ctx.fillText('This note is too long for a quote', canvas.width / 2, canvas.height / 2 - 20);

      // Add a smaller explanation
      ctx.font = `400 24px ${font}`;
      ctx.fillText(`Content exceeds ${MAX_QUOTE_LENGTH} characters`, canvas.width / 2, canvas.height / 2 + 30);

      // Still show author
      ctx.font = `400 32px ${font}`;
      ctx.fillText(`- ${author}`, canvas.width / 2, canvas.height / 2 + 100);
    } else {
      // Draw quote
      ctx.font = `600 48px ${font}`;
      ctx.fillStyle = '#1A1A1A';
      ctx.textAlign = 'center';

      // Word wrap logic
      const words = quote.split(' ');
      const lines = [];
      let currentLine = words[0];

      for (let i = 1; i < words.length; i++) {
        const word = words[i];
        const width = ctx.measureText(currentLine + ' ' + word).width;
        if (width < canvas.width - 100) {
          currentLine += ' ' + word;
        } else {
          lines.push(currentLine);
          currentLine = word;
        }
      }
      lines.push(currentLine);

      // Draw text
      lines.forEach((line, i) => {
        ctx.fillText(line, canvas.width / 2, canvas.height / 2 - (lines.length - 1) * 30 + i * 60);
      });

      // Draw author
      ctx.font = `400 32px ${font}`;
      ctx.fillText(`- ${author}`, canvas.width / 2, canvas.height / 2 + lines.length * 40);
    }

    // Draw Nostr event ID based on display mode
    if (nostrEventId && eventIdDisplayMode !== 'hidden') {
      if (eventIdDisplayMode === 'text') {
        // Draw as text (subtle, low contrast at bottom)
        ctx.font = `300 14px ${font}`;
        ctx.fillStyle = 'rgba(0, 0, 0, 0.2)'; // Very low contrast
        ctx.textAlign = 'center';
        ctx.fillText(nostrEventId, canvas.width / 2, canvas.height - 20);
      } else if (eventIdDisplayMode === 'qrcode') {
        try {
          // Create a temporary canvas for the QR code
          const qrCanvas = createCanvas(100, 100);

          // Create nosta.me URL for the Nostr event
          const njumpUrl = `https://nosta.me/${nostrEventId}`;

          // Generate QR code
          await QRCode.toCanvas(qrCanvas, njumpUrl, {
            width: 100,
            margin: 1,
            color: {
              dark: '#00000080', // Semi-transparent black
              light: '#FFFFFF00'  // Transparent white
            }
          });

          // Draw the QR code onto the main canvas
          ctx.drawImage(qrCanvas, canvas.width - 120, canvas.height - 120, 100, 100);
        } catch (error) {
          console.error('Error generating QR code:', error);

          // Fallback to text if QR code generation fails
          ctx.font = `300 14px ${font}`;
          ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
          ctx.textAlign = 'center';
          ctx.fillText(nostrEventId, canvas.width / 2, canvas.height - 20);
        }
      }
    }

    // Convert canvas to buffer
    const buffer = canvas.toBuffer('image/png');

    // Set response headers
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=86400'); // Cache for 24 hours
    
    // Send the image
    return res.status(200).send(buffer);
  } catch (error) {
    console.error('Error generating quote image:', error);
    return res.status(500).json({ 
      error: 'Failed to generate image',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
} 