import { useRef, useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import QRCode from "qrcode";

export type EventIdDisplayMode = "text" | "qrcode" | "hidden";

interface QuoteCanvasProps {
  quote: string;
  author: string;
  font: string;
  background: string;
  nostrEventId?: string;
  eventIdDisplayMode?: EventIdDisplayMode;
}

export const QuoteCanvas = ({
  quote,
  author,
  font,
  background,
  nostrEventId,
  eventIdDisplayMode = "qrcode"
}: QuoteCanvasProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [canvasUrl, setCanvasUrl] = useState<string>("");

  useEffect(() => {
    const renderCanvas = async () => {
      if (!canvasRef.current) return;

      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      // Set canvas size
      canvas.width = 1200;
      canvas.height = 630;

      // Clear canvas
      ctx.fillStyle = background;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

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
  }, [quote, author, font, background, nostrEventId, eventIdDisplayMode]);

  return (
    <Card className="p-4 glass-card animate-fadeIn">
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
