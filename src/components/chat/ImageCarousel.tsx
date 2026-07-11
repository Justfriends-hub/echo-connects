import React, { useState } from "react";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { cn } from "@/lib/utils";
import { ImageIcon } from "lucide-react";

interface ImageCarouselProps {
  images: string[];
  className?: string;
}

export function ImageCarousel({ images, className }: ImageCarouselProps) {
  const [loaded, setLoaded] = useState<Record<number, boolean>>({});

  if (!images || images.length === 0) return null;

  const handleLoad = (index: number) => {
    setLoaded((prev) => ({ ...prev, [index]: true }));
  };

  // ─── Single Image Render View ──────────────────────────────────────────────
  if (images.length === 1) {
    return (
      <div
        className={cn(
          "max-w-[280px] sm:max-w-sm rounded-2xl overflow-hidden border border-border/30 shadow-sm",
          "bg-muted/30 transition-all duration-300 ease-out hover:brightness-95 transform active:scale-[0.99] cursor-pointer",
          className,
        )}
      >
        <AspectRatio ratio={4 / 3} className="bg-muted/40 relative">
          <div
            className={cn(
              "absolute inset-0 flex items-center justify-center text-muted-foreground/40 transition-opacity duration-300",
              loaded[0] ? "opacity-0" : "opacity-100 animate-pulse",
            )}
          >
            <ImageIcon className="w-6 h-6" />
          </div>
          <img
            src={images[0]}
            alt="Shared media"
            loading="lazy"
            onLoad={() => handleLoad(0)}
            className={cn(
              "w-full h-full object-cover transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]",
              loaded[0]
                ? "opacity-100 scale-100 blur-0"
                : "opacity-0 scale-95 blur-md",
            )}
          />
        </AspectRatio>
      </div>
    );
  }

  // ─── Messenger Multi-Image Grid Assembly (2 to 4+ Images) ─────────────────
  const displayCount = Math.min(images.length, 4);
  const remainingCount = images.length - 4;

  return (
    <div
      className={cn(
        "w-full max-w-[280px] sm:max-w-sm rounded-2xl overflow-hidden border border-border/30 shadow-sm bg-muted/20 select-none",
        className,
      )}
    >
      <div
        className={cn(
          "grid gap-1 transition-all duration-300 ease-out p-0.5",
          displayCount === 2
            ? "grid-cols-2"
            : displayCount === 3
              ? "grid-cols-3"
              : "grid-cols-2",
        )}
      >
        {images.slice(0, displayCount).map((src, index) => {
          const isLastItem = index === 3 && remainingCount > 0;

          return (
            <div
              key={index}
              className={cn(
                "relative overflow-hidden rounded-xl bg-muted/40 group cursor-pointer transition-all duration-200 active:scale-[0.97]",
                displayCount === 3 && index === 0 ? "col-span-1" : "",
              )}
            >
              <AspectRatio ratio={displayCount === 2 ? 3 / 4 : 1}>
                {/* Embedded placeholder skeleton indicator */}
                <div
                  className={cn(
                    "absolute inset-0 flex items-center justify-center text-muted-foreground/30 transition-opacity duration-300",
                    loaded[index] ? "opacity-0" : "opacity-100",
                  )}
                >
                  <ImageIcon className="w-4 h-4" />
                </div>

                <img
                  src={src}
                  alt={`Shared link thumb ${index + 1}`}
                  loading="lazy"
                  onLoad={() => handleLoad(index)}
                  className={cn(
                    "w-full h-full object-cover transition-all duration-500 group-hover:scale-105 ease-[cubic-bezier(0.16,1,0.3,1)]",
                    loaded[index] ? "opacity-100 blur-0" : "opacity-0 blur-sm",
                    isLastItem ? "brightness-[0.4] group-hover:scale-100" : "",
                  )}
                />

                {/* Overlapping Counter Indicator Layer */}
                {isLastItem && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-white backdrop-blur-[2px] bg-black/20 pointer-events-none animate-in fade-in duration-300">
                    <span className="text-sm font-bold tracking-tight">
                      +{remainingCount + 1}
                    </span>
                    <span className="text-[9px] font-medium opacity-80 uppercase tracking-widest mt-0.5">
                      Photos
                    </span>
                  </div>
                )}
              </AspectRatio>
            </div>
          );
        })}
      </div>
    </div>
  );
}
