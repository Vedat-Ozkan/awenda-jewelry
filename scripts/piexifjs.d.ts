// piexifjs ships no type declarations. Minimal surface for what
// scripts/make-fixtures.ts uses (esModuleInterop gives us a default import
// off its CommonJS `module.exports`).
declare module "piexifjs" {
  interface Piexif {
    ImageIFD: { Orientation: number };
    dump(exifDict: Record<string, Record<number, unknown>>): string;
    insert(exifBytes: string, jpegBinaryString: string): string;
  }
  const piexif: Piexif;
  export default piexif;
}
