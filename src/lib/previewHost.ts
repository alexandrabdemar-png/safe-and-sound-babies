// Preview-only paywall bypass helper. Extracted from products_.scan.tsx so
// the host matcher can be unit-tested in isolation and so future callers
// (other pro-gated flows) can reuse it without duplicating the regex.
//
// Matches Lovable's preview / local-dev hosts:
//   • *.lovable.dev
//   • id-preview--*.lovable.app  (exact preview build subdomain shape)
//   • localhost / 127.0.0.1
//
// Does NOT match:
//   • peace-of-mine.lovable.app  (published production)
//   • any custom domain
//   • project--*.lovable.app     (published deployment aliases)
export const PREVIEW_HOST_REGEX =
  /(^|\.)lovable\.dev$|(^|\.)id-preview--.*\.lovable\.app$|^localhost$|^127\.0\.0\.1$/;

export function isPreviewHost(hostname: string | null | undefined): boolean {
  if (!hostname) return false;
  return PREVIEW_HOST_REGEX.test(hostname);
}
