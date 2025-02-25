import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { fetchNostrEvent } from "@/utils/nostrFetcher";
import { Shuffle } from "lucide-react";

interface NostrInputProps {
  onEventSubmit: (event: { content: string; author: string; eventId?: string; profilePicture?: string }) => void;
}

export function NostrInput({ onEventSubmit }: NostrInputProps) {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  // Example Nostr events
  const exampleEvents = [
    "nevent1qvzqqqqqqyqzqfd5x2fgkjaaxhq5nu4rs67fdp5gvzwdryl2qdp9rz9p0epdhd7lzm0ayv",
    "nevent1qvzqqqqqqyqzpjlww29nn7c69qwumgng5pcu4zh3f3vk97wrp5htm9nk0c82pzh0cw2ks2",
    "nevent1qvzqqqqqqyqzpkz95vv6stffy80vwg2fwsk0gx2f6c2hhcqxutghmp0sae9lzu7fwndnwx",
    "nevent1qvzqqqqqqyqzqdfvde2q6ewvu3junfu57syj2wv50378jmwqe8s2jww8syulmvchnkt9uv"
  ];

  // Function to handle shuffle and auto-generate
  const handleShuffle = async () => {
    const randomEvent = exampleEvents[Math.floor(Math.random() * exampleEvents.length)];

    // Instead of trying to manually trigger the form submission after setting state,
    // we'll directly call the logic from handleSubmit with the random event
    setInput(randomEvent);
    setLoading(true);

    try {
      const eventId = extractEventId(randomEvent.trim());
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
    if (!input.trim()) return;

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
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-foreground">Enter Nostr Event</h3>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleShuffle}
            className="text-muted-foreground hover:text-foreground"
            title="Try a random example"
          >
            <Shuffle className="h-4 w-4 mr-1" />
            <span className="text-xs">Random Note</span>
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">
          Paste a Nostr event ID or URL to generate a beautiful quote image
        </p>
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="note1..., nevent1..., https://..."
            className="flex-1"
          />
          <Button type="submit" disabled={loading}>
            {loading ? "Loading..." : "Generate"}
          </Button>
        </div>
      </form>
    </Card>
  );
}
