import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { fetchNostrEvent } from "@/utils/nostrFetcher";

interface NostrInputProps {
  onEventSubmit: (event: { content: string; author: string; eventId?: string; profilePicture?: string }) => void;
}

export const NostrInput = ({ onEventSubmit }: NostrInputProps) => {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const extractEventId = (input: string): string => {
    // Check if input is a URL
    if (input.startsWith("http")) {
      try {
        // Try to find nevent1... format in the URL
        const neventMatch = input.match(/nevent1[a-zA-Z0-9]+/);
        if (neventMatch) {
          return neventMatch[0];
        }

        // Try to find note1... format in the URL
        const noteMatch = input.match(/note1[a-zA-Z0-9]+/);
        if (noteMatch) {
          return noteMatch[0];
        }

        // If no matches, return the original input
        return input;
      } catch (error) {
        return input;
      }
    }

    // If not a URL, return the input as is
    return input;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!input.trim()) {
      toast.error("Please enter a valid Nostr event ID or URL");
      return;
    }

    setLoading(true);

    try {
      // Extract event ID from input (which might be a URL)
      const eventId = extractEventId(input.trim());

      const result = await fetchNostrEvent(eventId);

      if (!result.success) {
        throw new Error(result.error || "Failed to fetch event");
      }

      if (!result.event) {
        throw new Error("Event data is missing");
      }

      const authorName = result.profile?.displayName || result.profile?.name || "Unknown";

      onEventSubmit({
        content: result.event.content,
        author: authorName,
        eventId: eventId,
        profilePicture: result.profile?.picture
      });

      toast.success("Event loaded successfully!");

    } catch (error) {
      console.error("Error fetching Nostr event:", error);
      toast.error(error instanceof Error ? error.message : "Failed to load Nostr event");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="p-6 glass-card animate-slideUp">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <h3 className="text-lg font-semibold text-foreground">Enter Nostr Event ID or URL</h3>
          <p className="text-sm text-muted-foreground">
            Paste a Nostr event ID or client URL to generate a beautiful quote image
          </p>
        </div>
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="note1..., nevent1..., or client URL"
            className="flex-1"
          />
          <Button type="submit" disabled={loading}>
            {loading ? "Loading..." : "Generate"}
          </Button>
        </div>
      </form>
    </Card>
  );
};
