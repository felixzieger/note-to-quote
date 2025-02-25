import React from "react";
import { ExternalLink } from "lucide-react";

export const Footer: React.FC = () => {
    return (
        <footer className="mt-12 py-6 border-t border-border">
            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                    <div className="text-sm text-muted-foreground">
                        Created by{" "}
                        <a
                            href="https://nosta.me/npub1we8qkts8j9znh3ma0dpa77ys2zm4rrulp6r5zuqn2pp6pn3jfamsy7c6je"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-medium text-primary hover:underline inline-flex items-center"
                        >
                            Felix
                            <ExternalLink className="ml-1 h-3 w-3" />
                        </a>
                    </div>
                    <div className="text-sm text-muted-foreground">
                        <a
                            href="lightning:me@felixzieger.de"
                            className="font-medium text-primary hover:underline inline-flex items-center"
                        >
                            ⚡ Zap me
                            <ExternalLink className="ml-1 h-3 w-3" />
                        </a>
                    </div>
                </div>
            </div>
        </footer>
    );
};

export default Footer; 