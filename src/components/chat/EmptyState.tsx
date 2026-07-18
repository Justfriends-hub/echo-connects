import React from "react";
import { MessageCircle } from "lucide-react";

export function EmptyState() {
  return (
    /* Integrated hardware accelerated multi-axis linear fade loops 
      to mimic dynamic, smooth backdrops found in WhatsApp & Telegram web desktop client apps.
    */
    <div className="flex flex-col items-center justify-center h-full w-full chat-bg text-muted-foreground select-none relative overflow-hidden px-6 motion-safe:animate-in motion-safe:fade-in duration-500">
      {/* Decorative Blur Ambient Elements */}
      <div
        aria-hidden="true"
        className="absolute top-1/4 left-1/3 w-72 h-72 bg-primary/5 rounded-full filter blur-3xl opacity-40 mix-blend-normal pointer-events-none motion-safe:animate-pulse"
        style={{ animationDuration: "8s" }}
      />
      <div
        aria-hidden="true"
        className="absolute bottom-1/4 right-1/3 w-80 h-80 bg-emerald-500/5 rounded-full filter blur-3xl opacity-30 mix-blend-normal pointer-events-none motion-safe:animate-pulse"
        style={{ animationDuration: "12s" }}
      />

      {/* Main Structural Content Grid Group Wrapper */}
      <div className="flex flex-col items-center text-center max-w-sm relative z-10 transform-gpu motion-safe:animate-in motion-safe:slide-in-from-bottom-4 duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]">
        {/* Elastic Icon Well */}
        <div className="w-20 h-20 rounded-full bg-gradient-to-b from-primary/10 to-primary/5 border border-primary/10 shadow-sm flex items-center justify-center mb-5">
          <MessageCircle
            className="w-9 h-9 text-primary/60"
            aria-hidden="true"
          />
        </div>

        {/* Typography Stack */}
        <h2 className="text-base font-bold text-foreground/80 tracking-tight leading-snug">
          Select a chat to start messaging
        </h2>

        <p className="text-xs mt-1.5 text-muted-foreground/80 leading-relaxed font-normal px-2">
          Choose from your existing conversations stream, or tap the composer
          box to initialize a new communication line.
        </p>
      </div>

      {/* Sleek Encryption/Brand Bottom Footer Badge Signature */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-1.5 opacity-70 text-[10px] font-bold tracking-widest text-muted-foreground/70 uppercase">
        <svg
          aria-hidden="true"
          className="w-3 h-3 text-muted-foreground/60"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
          />
        </svg>
        End-to-End Encrypted
      </div>
    </div>
  );
}
