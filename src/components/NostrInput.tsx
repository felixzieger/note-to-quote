
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";

interface NostrInputProps {
  onEventSubmit: (event: { content: string; author: string }) => void;
}

export const NostrInput = ({ onEventSubmit }: NostrInputProps) => {
  const [eventId, setEventId] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Placeholder for actual Nostr event fetching
      // This would be replaced with actual Nostr implementation
      setTimeout(() => {
        onEventSubmit({
          content: "The best way to predict the future is to create it.",
          author: "Satoshi Nakamoto",
        });
        toast.success("Event loaded successfully!");
      }, 1000);
    } catch (error) {
      toast.error("Failed to load Nostr event");
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
            placeholder="Enter event ID..."
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
