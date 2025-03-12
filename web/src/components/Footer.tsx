import React from "react";
import { ExternalLink } from "lucide-react";

export const Footer: React.FC = () => {
    return (
        <footer className="mt-12 py-6 border-t border-border">
            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex flex-col md:flex-row justify-center items-center gap-4 md:gap-8">
                    <div className="text-sm text-muted-foreground">
                        <a
                            href="https://nosta.me/npub1z8wzhl5u4d5s6cd4k2jml4r4ymum3exyewz4gpk2n0qr5tt9dsjs497l04"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-medium text-primary hover:underline inline-flex items-center"
                        >
                            Nostr Bot
                            <ExternalLink className="ml-1 h-3 w-3" />
                        </a>
                    </div>
                    <div className="text-sm text-muted-foreground">
                        <a
                            href="https://github.com/felixzieger/note-to-quote"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-medium text-primary hover:underline inline-flex items-center"
                        >
                            Source
                            <ExternalLink className="ml-1 h-3 w-3" />
                        </a>
                    </div>
                    <div className="text-sm text-muted-foreground">
                        <a
                            href="lightning:me@felixzieger.de"
                            className="font-medium text-primary hover:underline inline-flex items-center"
                        >
                            ⚡ Zap
                            <ExternalLink className="ml-1 h-3 w-3" />
                        </a>
                    </div>
                </div>
            </div>
        </footer>
    );
};

export default Footer; 
