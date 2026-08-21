import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { Package } from "lucide-react";
import { CategoryBadge } from "./CategoryBadge";

describe("CategoryBadge", () => {
  it("renders the illustration image when one is provided, not the fallback icon", () => {
    const html = renderToStaticMarkup(
      <CategoryBadge icon={Package} illustration="/hd-carseat.png" />,
    );
    expect(html).toContain('<img src="/hd-carseat.png"');
    expect(html).not.toContain("lucide-package");
  });

  it("falls back to the plain icon when no illustration is provided", () => {
    const html = renderToStaticMarkup(<CategoryBadge icon={Package} />);
    expect(html).not.toContain("<img");
    expect(html).toContain("lucide-package");
  });

  it("applies a custom size className instead of the default", () => {
    const html = renderToStaticMarkup(<CategoryBadge icon={Package} className="h-14 w-14" />);
    expect(html).toContain("h-14 w-14");
    expect(html).not.toContain("h-9 w-9");
  });
});
