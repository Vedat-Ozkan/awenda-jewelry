"use client";

import Image from "next/image";
import { useState } from "react";

export interface GalleryImage {
  full: string;
  thumb: string;
}

// Product page gallery (Phase 5 step 5, Nazzar/Mejuri reference: gallery
// left / details right; next/image wiring from step 9). Click a thumbnail
// to swap the main image; with a single image the thumbnail row is
// skipped. Main image uses `fill` + the aspect-square box (source photos
// vary from the 1024px-long-edge cap, so a fixed width/height would
// distort or letterbox some of them) and `priority` — it's the page's LCP
// element. Thumbnails are fixed 64x64, so plain width/height is fine there.
export function Gallery({ images, alt }: { images: GalleryImage[]; alt: string }) {
  const [active, setActive] = useState(0);

  if (images.length === 0) {
    return <div className="aspect-square rounded-lg bg-ivory" />;
  }

  const current = images[active] ?? images[0];

  return (
    <div>
      <div className="relative aspect-square overflow-hidden rounded-lg bg-ivory">
        <Image
          src={current.full}
          alt={alt}
          fill
          sizes="(min-width: 768px) 50vw, 100vw"
          priority
          className="object-cover"
        />
      </div>
      {images.length > 1 && (
        <div className="mt-2 flex gap-2">
          {images.map((image, i) => (
            <button
              key={image.thumb + i}
              type="button"
              onClick={() => setActive(i)}
              aria-current={i === active}
              className={`h-16 w-16 overflow-hidden rounded ${i === active ? "ring-2 ring-gold" : ""}`}
            >
              <Image src={image.thumb} alt="" width={64} height={64} className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
