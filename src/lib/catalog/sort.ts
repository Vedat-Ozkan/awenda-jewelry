// Phase 5 step 4: sold-out designs render after in-stock ones within
// whatever sort (newest/price) the caller already applied. Archived designs
// count as sold out too, regardless of total_qty — the phase file: "Archived
// designs are included [in public_designs] and are sold-out by definition —
// treat the same." Pure and stable (each group keeps its incoming order), so
// it's unit-testable without a DB.
export interface StockStatus {
  status: "active" | "archived";
  total_qty: number;
}

export function isSoldOut(design: StockStatus): boolean {
  return design.status === "archived" || design.total_qty <= 0;
}

export function sortForCatalog<T extends StockStatus>(designs: T[]): T[] {
  const inStock = designs.filter((d) => !isSoldOut(d));
  const soldOut = designs.filter((d) => isSoldOut(d));
  return [...inStock, ...soldOut];
}
