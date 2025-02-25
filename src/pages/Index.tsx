import { useState } from "react";
import { NostrInput } from "@/components/NostrInput";
import { QuoteCanvas, EventIdDisplayMode, BackgroundType } from "@/components/QuoteCanvas";
import { StyleControls } from "@/components/StyleControls";
import Footer from "@/components/Footer";

const Index = () => {
  const [quoteData, setQuoteData] = useState<{ content: string; author: string; eventId?: string; profilePicture?: string } | null>(null);
  const [font, setFont] = useState("Playfair Display");
  const [background, setBackground] = useState("#FFFFFF");
  const [backgroundType, setBackgroundType] = useState<BackgroundType>("profile");
  const [eventIdDisplayMode, setEventIdDisplayMode] = useState<EventIdDisplayMode>("qrcode");

  return (
    <div className="min-h-screen py-8 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-background to-secondary">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="text-center space-y-2 animate-fadeIn">
          <h1 className="text-4xl font-serif font-semibold tracking-tight">
            Note to Quote
          </h1>
          <p className="text-lg text-muted-foreground">
            Turn Nostr events into pictures
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
                backgroundType={backgroundType}
                authorProfilePicture={quoteData.profilePicture}
                nostrEventId={quoteData.eventId}
                eventIdDisplayMode={eventIdDisplayMode}
              />
            )}
          </div>
          <div>
            <StyleControls
              font={font}
              onFontChange={setFont}
              background={background}
              onBackgroundChange={setBackground}
              backgroundType={backgroundType}
              onBackgroundTypeChange={setBackgroundType}
              eventIdDisplayMode={eventIdDisplayMode}
              onEventIdDisplayModeChange={setEventIdDisplayMode}
            />
          </div>
        </div>

        <Footer />
      </div>
    </div>
  );
};

export default Index;
