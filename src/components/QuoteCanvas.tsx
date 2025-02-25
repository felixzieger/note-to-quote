import { useRef, useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import QRCode from "qrcode";

export type EventIdDisplayMode = "text" | "qrcode" | "hidden";
export type BackgroundType = "color" | "profile" | "generated";

// Maximum number of characters allowed for a quote
const MAX_QUOTE_LENGTH = 314;

interface QuoteCanvasProps {
  quote: string;
  author: string;
  font: string;
  background: string;
  backgroundType: BackgroundType;
  authorProfilePicture?: string;
  nostrEventId?: string;
  eventIdDisplayMode?: EventIdDisplayMode;
}

export const QuoteCanvas = ({
  quote,
  author,
  font,
  background,
  backgroundType = "color",
  authorProfilePicture,
  nostrEventId,
  eventIdDisplayMode = "qrcode"
}: QuoteCanvasProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [canvasUrl, setCanvasUrl] = useState<string>("");
  const [isContentTooLong, setIsContentTooLong] = useState(false);
  const [backgroundImage, setBackgroundImage] = useState<HTMLImageElement | null>(null);
  const [backgroundLoaded, setBackgroundLoaded] = useState(false);
  const [backgroundError, setBackgroundError] = useState(false);

  // Load profile picture if needed
  useEffect(() => {
    if (backgroundType === "profile" && authorProfilePicture) {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        setBackgroundImage(img);
        setBackgroundLoaded(true);
        setBackgroundError(false);
      };
      img.onerror = () => {
        console.error("Failed to load author profile picture");
        setBackgroundError(true);
        setBackgroundLoaded(false);
      };
      img.src = authorProfilePicture;
    } else {
      setBackgroundImage(null);
      setBackgroundLoaded(false);
    }
  }, [backgroundType, authorProfilePicture]);

  useEffect(() => {
    // Check if content is too long
    setIsContentTooLong(quote.length > MAX_QUOTE_LENGTH);

    const renderCanvas = async () => {
      if (!canvasRef.current) return;

      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      // Set canvas size
      canvas.width = 1000;
      canvas.height = 1000;

      // Clear canvas with background color or image
      if (backgroundType === "profile" && backgroundImage && backgroundLoaded) {
        // Draw profile picture as background with a semi-transparent overlay
        ctx.drawImage(backgroundImage, 0, 0, canvas.width, canvas.height);

        // Add a semi-transparent overlay to improve text readability
        ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      } else if (backgroundType === "generated") {
        // For now, just use a gradient as a placeholder for the generated background
        const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
        gradient.addColorStop(0, "#f3e7e9");
        gradient.addColorStop(0.5, "#e3eeff");
        gradient.addColorStop(1, "#f3e7e9");
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      } else {
        // Use solid color background
        ctx.fillStyle = background;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }

      // If content is too long, show message
      if (quote.length > MAX_QUOTE_LENGTH) {
        ctx.font = `600 36px ${font}`;
        ctx.fillStyle = "#1A1A1A";
        ctx.textAlign = "center";
        ctx.fillText("This note is too long for a quote", canvas.width / 2, canvas.height / 2 - 20);

        // Add a smaller explanation
        ctx.font = `400 24px ${font}`;
        ctx.fillText(`Content exceeds ${MAX_QUOTE_LENGTH} characters`, canvas.width / 2, canvas.height / 2 + 30);

        // Still show author
        ctx.font = `400 32px ${font}`;
        ctx.fillText(`- ${author}`, canvas.width / 2, canvas.height / 2 + 100);

        // Draw Nostr event ID based on display mode
        if (nostrEventId && eventIdDisplayMode !== "hidden") {
          if (eventIdDisplayMode === "text") {
            // Draw as text (subtle, low contrast at bottom)
            ctx.font = `300 14px ${font}`;
            ctx.fillStyle = "rgba(0, 0, 0, 0.2)"; // Very low contrast
            ctx.textAlign = "center";
            ctx.fillText(nostrEventId, canvas.width / 2, canvas.height - 20);
          } else if (eventIdDisplayMode === "qrcode") {
            try {
              // Create a temporary canvas for the QR code
              const qrCanvas = document.createElement("canvas");

              // Create njump.me URL for the Nostr event
              const njumpUrl = `https://njump.me/${nostrEventId}`;

              // Generate QR code on the temporary canvas
              await QRCode.toCanvas(qrCanvas, njumpUrl, {
                width: 100,
                margin: 1,
                color: {
                  dark: "#00000080", // Semi-transparent black in hex format
                  light: "#FFFFFF00"  // Transparent white in hex format
                }
              });

              // Draw the QR code onto the main canvas
              ctx.drawImage(qrCanvas, canvas.width - 120, canvas.height - 120, 100, 100);
            } catch (error) {
              console.error("Error generating QR code:", error);

              // Fallback to text if QR code generation fails
              ctx.font = `300 14px ${font}`;
              ctx.fillStyle = "rgba(0, 0, 0, 0.2)";
              ctx.textAlign = "center";
              ctx.fillText(nostrEventId, canvas.width / 2, canvas.height - 20);
            }
          }
        }

        // Set canvas URL after all drawing is complete
        setCanvasUrl(canvas.toDataURL());
        return;
      }

      // Draw quote
      ctx.font = `600 48px ${font}`;
      ctx.fillStyle = "#1A1A1A";
      ctx.textAlign = "center";

      // Word wrap logic
      const words = quote.split(" ");
      const lines = [];
      let currentLine = words[0];

      for (let i = 1; i < words.length; i++) {
        const word = words[i];
        const width = ctx.measureText(currentLine + " " + word).width;
        if (width < canvas.width - 100) {
          currentLine += " " + word;
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

      // Draw Nostr event ID based on display mode
      if (nostrEventId && eventIdDisplayMode !== "hidden") {
        if (eventIdDisplayMode === "text") {
          // Draw as text (subtle, low contrast at bottom)
          ctx.font = `300 14px ${font}`;
          ctx.fillStyle = "rgba(0, 0, 0, 0.2)"; // Very low contrast
          ctx.textAlign = "center";
          ctx.fillText(nostrEventId, canvas.width / 2, canvas.height - 20);
        } else if (eventIdDisplayMode === "qrcode") {
          try {
            // Create a temporary canvas for the QR code
            const qrCanvas = document.createElement("canvas");

            // Create njump.me URL for the Nostr event
            const njumpUrl = `https://njump.me/${nostrEventId}`;

            // Generate QR code on the temporary canvas
            await QRCode.toCanvas(qrCanvas, njumpUrl, {
              width: 100,
              margin: 1,
              color: {
                dark: "#00000080", // Semi-transparent black in hex format
                light: "#FFFFFF00"  // Transparent white in hex format
              }
            });

            // Draw the QR code onto the main canvas
            ctx.drawImage(qrCanvas, canvas.width - 120, canvas.height - 120, 100, 100);
          } catch (error) {
            console.error("Error generating QR code:", error);

            // Fallback to text if QR code generation fails
            ctx.font = `300 14px ${font}`;
            ctx.fillStyle = "rgba(0, 0, 0, 0.2)";
            ctx.textAlign = "center";
            ctx.fillText(nostrEventId, canvas.width / 2, canvas.height - 20);
          }
        }
      }

      // Set canvas URL after all drawing is complete
      setCanvasUrl(canvas.toDataURL());
    };

    renderCanvas();
  }, [quote, author, font, background, backgroundType, backgroundImage, backgroundLoaded, nostrEventId, eventIdDisplayMode]);

  return (
    <Card className="p-4 glass-card animate-fadeIn">
      {isContentTooLong && (
        <div className="mb-4 p-3 bg-yellow-50 text-yellow-800 rounded-md text-sm">
          <p className="font-medium">Note is too long for a quote</p>
          <p>The content exceeds {MAX_QUOTE_LENGTH} characters. The image will show a message instead of the full content.</p>
        </div>
      )}
      {backgroundType === "profile" && backgroundError && (
        <div className="mb-4 p-3 bg-yellow-50 text-yellow-800 rounded-md text-sm">
          <p className="font-medium">Could not load profile picture</p>
          <p>Using default background instead.</p>
        </div>
      )}
      <canvas ref={canvasRef} className="w-full max-w-[600px] mx-auto rounded-lg shadow-lg" />
      {canvasUrl && (
        <a
          href={canvasUrl}
          download={`quote-${author.replace(/\s+/g, '-').toLowerCase()}.png`}
          className="block mt-4 text-center text-sm font-medium text-primary hover:text-primary/80 smooth-transition"
        >
          Download Image
        </a>
      )}
    </Card>
  );
};
