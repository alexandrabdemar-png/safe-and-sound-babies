// Small, unobtrusive disclaimer shown consistently across product-related
// screens (add/scan/list/detail) — makes clear this app organizes and
// surfaces information rather than guaranteeing it, without repeating a
// large legal block on every page.
export function ProductInfoFooter({ className = "" }: { className?: string }) {
  return (
    <p className={`font-body text-[11px] leading-relaxed text-muted-foreground/60 ${className}`}>
      Information is provided to help you stay organized and informed. Always verify your specific product details and follow manufacturer instructions and official recall notices. Product details may come from Open Food Facts, Open Beauty Facts and Open Products Facts (data under ODbL), UPCitemdb, Go-UPC or Barcode Lookup.
    </p>
  );
}
