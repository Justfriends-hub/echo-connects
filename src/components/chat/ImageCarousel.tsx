import React from 'react';
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from '@/components/ui/carousel';
import { AspectRatio } from '@/components/ui/aspect-ratio';
import { cn } from '@/lib/utils';

interface ImageCarouselProps {
  images: string[];
  className?: string;
}

export function ImageCarousel({ images, className }: ImageCarouselProps) {
  if (images.length === 0) return null;

  if (images.length === 1) {
    return (
      <div className={cn("max-w-sm rounded-lg overflow-hidden", className)}>
        <AspectRatio ratio={4 / 3}>
          <img
            src={images[0]}
            alt="Shared image"
            className="w-full h-full object-cover rounded-lg"
          />
        </AspectRatio>
      </div>
    );
  }

  return (
    <div className={cn("max-w-sm", className)}>
      <Carousel className="w-full">
        <CarouselContent>
          {images.map((src, index) => (
            <CarouselItem key={index}>
              <div className="rounded-lg overflow-hidden">
                <AspectRatio ratio={4 / 3}>
                  <img
                    src={src}
                    alt={`Image ${index + 1} of ${images.length}`}
                    className="w-full h-full object-cover"
                  />
                </AspectRatio>
              </div>
            </CarouselItem>
          ))}
        </CarouselContent>
        {images.length > 1 && (
          <>
            <CarouselPrevious className="left-2 bg-background/80 border-0 w-7 h-7" />
            <CarouselNext className="right-2 bg-background/80 border-0 w-7 h-7" />
          </>
        )}
      </Carousel>
      <p className="text-[10px] text-muted-foreground text-center mt-1">
        {images.length} images
      </p>
    </div>
  );
}
