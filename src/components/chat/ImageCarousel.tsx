import React, { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { cn } from "@/lib/utils";
import { ImageIcon, X, ChevronLeft, ChevronRight } from "lucide-react";

interface ImageCarouselProps {
  images: string[];
  className?: string;
}

// ─── Full-screen Lightbox Viewer ─────────────────────────────────────────
// Self-managed portal target, matching the exact pattern already used by
// TextBar / ChatInput / ChatHeader elsewhere in this app — renders into
// document.body so it can never inherit a transform-scoped ancestor, and
// sits above everything regardless of where ImageCarousel is mounted
// (inside a message bubble, deep in a scrollable list).
function ImageLightbox({
  images,
  startIndex,
  onClose,
}: {
  images: string[];
  startIndex: number;
  onClose: () => void;
}) {
  const [index, setIndex] = useState(startIndex);
  const [portalEl, setPortalEl] = useState<HTMLDivElement | null>(null);
  const closeBtnRef = useRef<HTMLButtonElement | null>(null);
  const touchStartX = useRef<number | null>(null);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const id = "image-lightbox-portal";
    let el = document.getElementById(id) as HTMLDivElement | null;
    if (!el) {
      el = document.createElement("div");
      el.id = id;
      document.body.appendChild(el);
    }
    setPortalEl(el);
  }, []);

  const goPrev = useCallback(() => {
    setIndex((i) => (i - 1 + images.length) % images.length);
  }, [images.length]);

  const goNext = useCallback(() => {
    setIndex((i) => (i + 1) % images.length);
  }, [images.length]);

  // Lock body scroll while the lightbox is open, restore on close/unmount.
  useEffect(() => {
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = original;
    };
  }, []);

  // Keyboard: Escape closes, arrows navigate (only meaningful with >1 image).
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (images.length > 1 && e.key === "ArrowLeft") goPrev();
      if (images.length > 1 && e.key === "ArrowRight") goNext();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [images.length, goPrev, goNext, onClose]);

  // Send initial focus to the close button for keyboard/screen-reader users.
  useEffect(() => {
    closeBtnRef.current?.focus();
  }, []);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null || images.length <= 1) return;
    const delta = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(delta) > 50) {
      delta > 0 ? goPrev() : goNext();
    }
    touchStartX.current = null;
  };

  if (!portalEl) return null;

  const content = (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Image viewer"
      className="fixed inset-0 z-[999] flex items-center justify-center bg-black/90 backdrop-blur-sm motion-safe:animate-in motion-safe:fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Close */}
      <button
        ref={closeBtnRef}
        type="button"
        onClick={onClose}
        aria-label="Close image viewer"
        className="absolute top-4 right-4 z-10 inline-flex items-center justify-center w-11 h-11 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors duration-200 motion-safe:active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
        style={{
          top: "calc(env(safe-area-inset-top, 0px) + 1rem)",
          right: "calc(env(safe-area-inset-right, 0px) + 1rem)",
        }}
      >
        <X className="w-5 h-5" aria-hidden="true" />
      </button>

      {/* Prev / Next */}
      {images.length > 1 && (
        <>
          <button
            type="button"
            onClick={goPrev}
            aria-label="Previous image"
            className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 z-10 inline-flex items-center justify-center w-11 h-11 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors duration-200 motion-safe:active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
          >
            <ChevronLeft className="w-6 h-6" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={goNext}
            aria-label="Next image"
            className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 z-10 inline-flex items-center justify-center w-11 h-11 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors duration-200 motion-safe:active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
          >
            <ChevronRight className="w-6 h-6" aria-hidden="true" />
          </button>
        </>
      )}

      {/* Image — key forces a clean cross-fade on index change, transform/opacity only */}
      <img
        key={index}
        src={images[index]}
        alt={`Image ${index + 1} of ${images.length}`}
        className="max-h-[85vh] max-w-[92vw] object-contain rounded-lg shadow-2xl motion-safe:animate-in motion-safe:fade-in motion-safe:zoom-in-95 duration-200 select-none"
        draggable={false}
      />

      {/* Counter */}
      {images.length > 1 && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 text-xs font-semibold text-white/85 bg-black/40 backdrop-blur-sm px-3 py-1 rounded-full">
          {index + 1} / {images.length}
        </div>
      )}
    </div>
  );

  return createPortal(content, portalEl);
}

export function ImageCarousel({ images, className }: ImageCarouselProps) {
  const [loaded, setLoaded] = useState<Record<number, boolean>>({});
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  if (!images || images.length === 0) return null;

  const handleLoad = (index: number) => {
    setLoaded((prev) => ({ ...prev, [index]: true }));
  };

  // ─── Single Image Render View ──────────────────────────────────────────────
  if (images.length === 1) {
    return (
      <>
        <button
          type="button"
          onClick={() => setLightboxIndex(0)}
          aria-label="Open image"
          className={cn(
            "block w-full max-w-[280px] sm:max-w-sm rounded-2xl overflow-hidden border border-border/30 shadow-sm text-left",
            "bg-muted/30 transition-[filter] duration-300 ease-out hover:brightness-95",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
            className,
          )}
        >
          <AspectRatio ratio={4 / 3} className="bg-muted/40 relative">
            <div
              aria-hidden="true"
              className={cn(
                "absolute inset-0 flex items-center justify-center text-muted-foreground/40 transition-opacity duration-300",
                loaded[0]
                  ? "opacity-0"
                  : "opacity-100 motion-safe:animate-pulse",
              )}
            >
              <ImageIcon className="w-6 h-6" />
            </div>
            <img
              src={images[0]}
              alt="Shared image"
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
        </button>

        {lightboxIndex !== null && (
          <ImageLightbox
            images={images}
            startIndex={lightboxIndex}
            onClose={() => setLightboxIndex(null)}
          />
        )}
      </>
    );
  }

  // ─── Messenger Multi-Image Grid Assembly (2 to 4+ Images) ─────────────────
  const displayCount = Math.min(images.length, 4);
  const remainingCount = images.length - 4;

  return (
    <>
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
                ? "grid-cols-2 grid-rows-2"
                : "grid-cols-2",
          )}
        >
          {images.slice(0, displayCount).map((src, index) => {
            const isLastItem = index === 3 && remainingCount > 0;
            // Classic messenger 3-photo layout: one tall image on the left
            // spanning both rows, two stacked squares on the right.
            const isThreeUp = displayCount === 3;
            const spanClasses = isThreeUp
              ? index === 0
                ? "row-span-2"
                : "col-start-2"
              : "";
            const aspectRatio = isThreeUp
              ? index === 0
                ? 1 / 2
                : 1
              : displayCount === 2
                ? 3 / 4
                : 1;

            return (
              <button
                key={index}
                type="button"
                onClick={() => setLightboxIndex(index)}
                aria-label={
                  isLastItem
                    ? `View all ${images.length} images`
                    : `Open image ${index + 1} of ${images.length}`
                }
                className={cn(
                  "relative overflow-hidden rounded-xl bg-muted/40 group transition-[filter] duration-200 text-left",
                  "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-1",
                  spanClasses,
                )}
              >
                <AspectRatio ratio={aspectRatio}>
                  {/* Embedded placeholder skeleton indicator */}
                  <div
                    aria-hidden="true"
                    className={cn(
                      "absolute inset-0 flex items-center justify-center text-muted-foreground/30 transition-opacity duration-300",
                      loaded[index]
                        ? "opacity-0"
                        : "opacity-100 motion-safe:animate-pulse",
                    )}
                  >
                    <ImageIcon className="w-4 h-4" />
                  </div>

                  <img
                    src={src}
                    alt={`Shared image ${index + 1} of ${images.length}`}
                    loading="lazy"
                    onLoad={() => handleLoad(index)}
                    className={cn(
                      "w-full h-full object-cover transition-all duration-500 motion-safe:group-hover:scale-105 ease-[cubic-bezier(0.16,1,0.3,1)]",
                      loaded[index]
                        ? "opacity-100 blur-0"
                        : "opacity-0 blur-sm",
                      isLastItem
                        ? "brightness-[0.4] motion-safe:group-hover:scale-100"
                        : "",
                    )}
                  />

                  {/* Overlapping Counter Indicator Layer */}
                  {isLastItem && (
                    <div
                      className="absolute inset-0 flex flex-col items-center justify-center text-white backdrop-blur-[2px] bg-black/20 pointer-events-none motion-safe:animate-in motion-safe:fade-in duration-300"
                      aria-hidden="true"
                    >
                      <span className="text-sm font-bold tracking-tight">
                        +{remainingCount + 1}
                      </span>
                      <span className="text-[9px] font-medium opacity-80 uppercase tracking-widest mt-0.5">
                        Photos
                      </span>
                    </div>
                  )}
                </AspectRatio>
              </button>
            );
          })}
        </div>
      </div>

      {lightboxIndex !== null && (
        <ImageLightbox
          images={images}
          startIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
        />
      )}
    </>
  );
}
