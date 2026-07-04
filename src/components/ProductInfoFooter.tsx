// Small, unobtrusive disclaimer shown consistently across product-related
// screens (add/scan/list/detail) — makes clear this app organizes and
// surfaces information rather than guaranteeing it, without repeating a
// large legal block on every page.
export function ProductInfoFooter({ className = "" }: { className?: string }) {
  return (
    <p className={`font-body text-[11px] leading-relaxed text-muted-foreground/60 ${className}`}>
      Information is provided to help you stay organized and informed. Always verify your specific product details and follow manufacturer instructions and official recall notices.
    </p>
  );
}
