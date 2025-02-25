import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { fetchNostrEvent } from "@/utils/nostrFetcher";

interface NostrInputProps {
  onEventSubmit: (event: { content: string; author: string }) => void;
}

export const NostrInput = ({ onEventSubmit }: NostrInputProps) => {
  const [eventId, setEventId] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!eventId.trim()) {
      toast.error("Please enter a valid Nostr event ID");
      return;
    }

    setLoading(true);

    try {
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
          <h3 className="text-lg font-semibold text-foreground">Enter Nostr Event ID</h3>
          <p className="text-sm text-muted-foreground">
            Paste a Nostr event ID to generate a beautiful quote image
          </p>
        </div>
        <div className="flex gap-2">
          <Input
            value={eventId}
            onChange={(e) => setEventId(e.target.value)}
            placeholder="note1... or nevent1... or hex ID"
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
