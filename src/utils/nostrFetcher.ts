import { SimplePool, nip19, type Event } from 'nostr-tools';

export interface NostrFetchResult {
    success: boolean;
    event?: Event;
    profile?: {
        name: string;
        displayName?: string;
        picture?: string;
    };
    error?: string;
    debug?: {
        hexId: string;
        relaysQueried: string[];
        relaysResponded?: string[];
    };
}

export async function fetchNostrEvent(
    eventId: string,
    debug = false,
    customRelay?: string
): Promise<NostrFetchResult> {
    try {
        // Create a connection pool to Nostr relays
        const pool = new SimplePool();
        const defaultRelays = [
            "wss://relay.damus.io",
            "wss://relay.nostr.band",
            "wss://nos.lol",
            "wss://nostr.mom",
            "wss://relay.nostr.bg",
            "wss://nostr.bitcoiner.social",
            "wss://relay.snort.social",
            "wss://purplepag.es"
        ];

        // If customRelay is provided, use it as the first relay
        const relays = customRelay
            ? [customRelay, ...defaultRelays]
            : defaultRelays;

        // Handle different Nostr ID formats
        let hexId: string;

        if (eventId.startsWith('note1')) {
            try {
                const { data } = nip19.decode(eventId);
                hexId = data as string;
            } catch (error) {
                return {
                    success: false,
                    error: "Invalid note1 format",
                    debug: { hexId: "decode_failed", relaysQueried: relays }
                };
            }
        } else if (eventId.startsWith('nevent1')) {
            try {
                const { data } = nip19.decode(eventId);
                if (typeof data === 'object' && 'id' in data) {
                    hexId = data.id as string;

                    // If the nevent1 includes specific relays, use those instead
                    if (data.relays && Array.isArray(data.relays) && data.relays.length > 0) {
                        if (debug) console.log(`Using relays from nevent1: ${data.relays.join(', ')}`);
                        relays.unshift(...data.relays); // Add these relays to the beginning of our list
                    }
                } else {
                    return {
                        success: false,
                        error: "Invalid nevent1 format",
                        debug: { hexId: "decode_failed", relaysQueried: relays }
                    };
                }
            } catch (error) {
                return {
                    success: false,
                    error: "Failed to decode nevent1",
                    debug: { hexId: "decode_failed", relaysQueried: relays }
                };
            }
        } else {
            // Assume it's already in hex format
            hexId = eventId;
        }

        if (debug) console.log(`Fetching event with hex ID: ${hexId}`);
        if (debug) console.log(`Querying relays: ${relays.join(', ')}`);

        // Track which relays responded
        const respondedRelays: string[] = [];

        // Set up a subscription to track which relays respond
        if (debug) {
            pool.subscribeMany(
                relays,
                [{ ids: [hexId] }],
                {
                    onevent(event, relay) {
                        if (event.id === hexId) {
                            respondedRelays.push(relay);
                            console.log(`Received event from relay: ${relay}`);
                        }
                    }
                }
            );
        }

        // Fetch the event from relays with a timeout
        const event = await Promise.race([
            pool.get(relays, { ids: [hexId] }),
            new Promise<null>((resolve) => setTimeout(() => resolve(null), 5000)) // 5 second timeout
        ]);

        if (!event) {
            pool.close(relays);
            return {
                success: false,
                error: "Event not found on any relay or timeout occurred",
                debug: {
                    hexId,
                    relaysQueried: relays,
                    relaysResponded: respondedRelays
                }
            };
        }

        // Get author's profile
        const profileEvent = await pool.get(relays, {
            kinds: [0],
            authors: [event.pubkey],
        });

        let profile = {
            name: event.pubkey.slice(0, 8) + "..."
        };

        if (profileEvent) {
            try {
                const profileData = JSON.parse(profileEvent.content);
                profile = {
                    name: profileData.name || profile.name,
                    displayName: profileData.display_name,
                    picture: profileData.picture
                };
            } catch (e) {
                // If profile parsing fails, use the default
                if (debug) console.log("Failed to parse profile data:", e);
            }
        }

        // Close the pool when done
        pool.close(relays);

        return {
            success: true,
            event,
            profile,
            debug: {
                hexId,
                relaysQueried: relays,
                relaysResponded: respondedRelays
            }
        };

    } catch (error) {
        console.error("Error in fetchNostrEvent:", error);
        return {
            success: false,
            error: error instanceof Error ? error.message : "Unknown error fetching Nostr event"
        };
    }
} 