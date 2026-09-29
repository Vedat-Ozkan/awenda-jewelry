"use client";

import Image from "next/image";
import { useState } from "react";

export interface GalleryImage {
  full: string;
  thumb: string;
}

// Product page gallery (Phase 5 step 5; Silver Mist: photos sit in rounded
// "wells", thumbnails are small wells with an ink ring on the active one).
// Click a thumbnail to swap the main image; with a single image the thumbnail
// row is skipped. Main image uses `fill` + the aspect-square box (source
// photos vary from the 1024px-long-edge cap, so a fixed width/height would
// distort or letterbox some of them) and `priority` — it's the page's LCP
// element. Thumbnails are fixed 72x72, so plain width/height is fine there.
export function Gallery({ images, alt }: { images: GalleryImage[]; alt: string }) {
  const [active, setActive] = useState(0);

  if (images.length === 0) {
    return <div className="aspect-square rounded-3xl bg-well lg:rounded-[28px]" />;
  }

  const current = images[active] ?? images[0];

  return (
    <div className="flex flex-col gap-3">
      <div className="relative aspect-square overflow-hidden rounded-3xl bg-well lg:rounded-[28px]">
        <Image
          src={current.full}
          alt={alt}
          fill
          sizes="(min-width: 1360px) 760px, (min-width: 1024px) 55vw, 100vw"
          priority
          className="object-cover"
        />
      </div>
      {images.length > 1 && (
        <div className="flex gap-2.5 overflow-x-auto p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {images.map((image, i) => (
            <button
              key={image.thumb + i}
              type="button"
              onClick={() => setActive(i)}
              aria-current={i === active}
              aria-label={`${alt} ${i + 1}`}
              className={`size-[72px] shrink-0 overflow-hidden rounded-2xl bg-well ${
                i === active ? "ring-2 ring-ink ring-offset-2 ring-offset-page" : "opacity-80 hover:opacity-100"
              }`}
            >
              <Image src={image.thumb} alt="" width={72} height={72} className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
