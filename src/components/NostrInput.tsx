import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { fetchNostrEvent } from "@/utils/nostrFetcher";
import { Shuffle, X, Plus } from "lucide-react";

interface NostrInputProps {
  onEventSubmit: (event: { content: string; author: string; eventId?: string; profilePicture?: string }) => void;
  defaultRelay?: string;
}

// Default relays that will be pre-filled
const DEFAULT_RELAYS = [
  "wss://relay.damus.io",
  "wss://relay.nostr.band",
  "wss://nos.lol",
];

export function NostrInput({ onEventSubmit, defaultRelay }: NostrInputProps) {
  const [input, setInput] = useState("");
  const [relays, setRelays] = useState<string[]>([]);
  const [newRelay, setNewRelay] = useState("");
  const [loading, setLoading] = useState(false);
  const [showRelayInput, setShowRelayInput] = useState(false);

  // Initialize relays with URL parameter if present
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlRelay = params.get('r');

    if (urlRelay) {
      let relayUrl = urlRelay;

      // If URL doesn't start with any protocol, prepend wss://
      if (!relayUrl.startsWith('wss://') && !relayUrl.startsWith('ws://')) {
        relayUrl = `wss://${relayUrl}`;
      }

      // Convert ws:// to wss:// for security
      if (relayUrl.startsWith('ws://')) {
        relayUrl = `wss://${relayUrl.slice(5)}`;
      }

      setRelays([relayUrl, ...DEFAULT_RELAYS]);
    } else if (defaultRelay) {
      setRelays([defaultRelay, ...DEFAULT_RELAYS]);
    } else {
      setRelays(DEFAULT_RELAYS);
    }
  }, [defaultRelay]);

  // Example Nostr events
  const exampleEvents = [
    "nevent1qvzqqqqqqyqzqfd5x2fgkjaaxhq5nu4rs67fdp5gvzwdryl2qdp9rz9p0epdhd7lzm0ayv",
    "nevent1qvzqqqqqqyqzpjlww29nn7c69qwumgng5pcu4zh3f3vk97wrp5htm9nk0c82pzh0cw2ks2",
    "nevent1qvzqqqqqqyqzpkz95vv6stffy80vwg2fwsk0gx2f6c2hhcqxutghmp0sae9lzu7fwndnwx",
    "nevent1qvzqqqqqqyqzpps6e6kafn5jvxtugpvlyk8grxzp0h2aqxeqnewewe45w93vu55u8rc6fz",
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
      const result = await fetchNostrEvent(eventId, false, relays[0]);

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

  const handleAddRelay = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && newRelay.trim()) {
      e.preventDefault();
      let relayUrl = newRelay.trim();

      // If URL doesn't start with any protocol, prepend wss://
      if (!relayUrl.startsWith('wss://') && !relayUrl.startsWith('ws://')) {
        relayUrl = `wss://${relayUrl}`;
      }

      // Convert ws:// to wss:// for security
      if (relayUrl.startsWith('ws://')) {
        relayUrl = `wss://${relayUrl.slice(5)}`;
      }

      if (!relays.includes(relayUrl)) {
        setRelays([...relays, relayUrl]);
        setShowRelayInput(false);
      }
      setNewRelay("");
    } else if (e.key === 'Escape') {
      setShowRelayInput(false);
      setNewRelay("");
    }
  };

  const removeRelay = (relayToRemove: string) => {
    setRelays(relays.filter(relay => relay !== relayToRemove));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    setLoading(true);
    try {
      const eventId = extractEventId(input.trim());
      // Use the first relay as primary, others as fallback
      const result = await fetchNostrEvent(eventId, false, relays[0]);

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
        <div className="flex flex-col gap-2">
          <div className="flex gap-2">
            <div className="flex-1">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="note1..., nevent1..., https://..."
              />
            </div>
            <Button type="submit" disabled={loading}>
              {loading ? "Loading..." : "Generate"}
            </Button>
          </div>

          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              {relays.map((relay, index) => (
                <div
                  key={index}
                  className="flex items-center gap-1 bg-muted px-2 py-1 rounded-md text-sm text-muted-foreground"
                >
                  <span className="max-w-[200px] truncate">{relay}</span>
                  <button
                    type="button"
                    onClick={() => removeRelay(relay)}
                    className="text-muted-foreground/50 hover:text-muted-foreground"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => setShowRelayInput(true)}
                className="h-7 w-7 rounded-md bg-muted flex items-center justify-center text-muted-foreground/50 hover:text-muted-foreground"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>

            {showRelayInput && (
              <div className="animate-in fade-in slide-in-from-top-1">
                <Input
                  value={newRelay}
                  onChange={(e) => setNewRelay(e.target.value)}
                  onKeyDown={handleAddRelay}
                  placeholder="Add relay (wss://...) - Press Enter to add, Esc to cancel"
                  className="text-sm"
                  autoFocus
                />
              </div>
            )}
          </div>
        </div>
      </form>
    </Card>
  );
}
