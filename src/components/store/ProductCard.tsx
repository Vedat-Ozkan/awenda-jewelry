import Image from "next/image";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { isSoldOut } from "@/lib/catalog/sort";
import { resolvePhotoUrl } from "@/lib/supabase/storage";
import { Badge } from "./Badge";
import { Price } from "./Price";

// Grid tile size across breakpoints (CatalogGrid: 2 cols mobile, 3 cols from
// sm, 4 cols from md) — tells next/image how large the rendered box is so
// it doesn't request more than it needs to fill it.
const CARD_SIZES = "(min-width: 768px) 25vw, (min-width: 640px) 33vw, 50vw";

export interface ProductCardDesign {
  slug: string;
  name: string;
  price_cents: number;
  thumb_image_path: string | null;
  material?: string | null;
  total_qty: number;
  status: "active" | "archived";
}

// Grid card (Phase 5 step 3; the catalog page in a later step reuses this).
// `/p/[slug]` doesn't exist until step 5 — links 404 for now, same as the
// footer's policy links.
export function ProductCard({
  design,
  locale,
  soldOutLabel,
}: {
  design: ProductCardDesign;
  locale: Locale;
  soldOutLabel: string;
}) {
  // Phase 5 step 4: archived designs are sold-out by definition, regardless
  // of total_qty (DECISIONS.md).
  const soldOut = isSoldOut(design);
  const src = resolvePhotoUrl(design.thumb_image_path);

  return (
    <Link
      href={`/p/${design.slug}`}
      locale={locale}
      className="group flex flex-col gap-2 rounded-[20px] bg-white p-1.5 lg:gap-3 lg:rounded-3xl lg:p-2.5"
    >
      <div className="relative aspect-[10/11] overflow-hidden rounded-[15px] bg-well lg:rounded-[18px]">
        {src && (
          <Image
            src={src}
            alt={design.name}
            fill
            sizes={CARD_SIZES}
            className={`object-cover transition-transform duration-300 ${soldOut ? "opacity-60" : "group-hover:scale-[1.02]"}`}
          />
        )}
        {soldOut && (
          <span className="absolute left-2 top-2 lg:left-3 lg:top-3">
            <Badge>{soldOutLabel}</Badge>
          </span>
        )}
        {design.material && (
          <span className="absolute bottom-3 left-3 hidden lg:block">
            <Badge>{design.material}</Badge>
          </span>
        )}
      </div>
      <div className="flex flex-col gap-0.5 px-1.5 pb-2 lg:flex-row lg:justify-between lg:gap-3 lg:px-2 lg:pb-2.5">
        <span className="text-[15px] font-medium lg:text-base">{design.name}</span>
        {design.material && <span className="text-xs text-muted lg:hidden">{design.material}</span>}
        <span className="text-sm lg:text-base lg:font-medium">
          <Price cents={design.price_cents} locale={locale} />
        </span>
      </div>
    </Link>
  );
}
