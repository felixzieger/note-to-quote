
import { useRef, useEffect, useState } from "react";
import { Card } from "@/components/ui/card";

interface QuoteCanvasProps {
  quote: string;
  author: string;
  font: string;
  background: string;
}

export const QuoteCanvas = ({ quote, author, font, background }: QuoteCanvasProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [canvasUrl, setCanvasUrl] = useState<string>("");

  useEffect(() => {
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

    setCanvasUrl(canvas.toDataURL());
  }, [quote, author, font, background]);

  return (
    <Card className="p-4 glass-card animate-fadeIn">
      <canvas ref={canvasRef} className="w-full max-w-[600px] mx-auto rounded-lg shadow-lg" />
      {canvasUrl && (
        <a
          href={canvasUrl}
          download="quote.png"
          className="block mt-4 text-center text-sm font-medium text-primary hover:text-primary/80 smooth-transition"
        >
          Download Image
        </a>
      )}
    </Card>
  );
};
