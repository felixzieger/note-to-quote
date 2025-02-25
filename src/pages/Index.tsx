
import { useState } from "react";
import { NostrInput } from "@/components/NostrInput";
import { QuoteCanvas } from "@/components/QuoteCanvas";
import { StyleControls } from "@/components/StyleControls";

const Index = () => {
  const [quoteData, setQuoteData] = useState<{ content: string; author: string } | null>(null);
  const [font, setFont] = useState("Inter");
  const [background, setBackground] = useState("#FFFFFF");

  return (
    <div className="min-h-screen py-8 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-background to-secondary">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="text-center space-y-2 animate-fadeIn">
          <h1 className="text-4xl font-serif font-semibold tracking-tight">
            Nostr Quote Images
          </h1>
          <p className="text-lg text-muted-foreground">
            Transform Nostr events into beautiful, shareable quote images
          </p>
        </div>

        <div className="grid gap-8 md:grid-cols-[2fr,1fr]">
          <div className="space-y-8">
            <NostrInput onEventSubmit={setQuoteData} />
            {quoteData && (
              <QuoteCanvas
                quote={quoteData.content}
                author={quoteData.author}
                font={font}
                background={background}
              />
            )}
          </div>
          <div>
            <StyleControls
              font={font}
              onFontChange={setFont}
              background={background}
              onBackgroundChange={setBackground}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;
