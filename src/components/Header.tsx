import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Logo } from "@/components/Logo";
import { isNativeApp } from "@/lib/isNativeApp";

export function Header() {
  // Inside the iPhone/iPad app this is not a website: no marketing nav
  // ("Pricing", "Sign in", "Get started"). The nav only appeared at
  // tablet width and up, so App Review on iPad saw a website header inside
  // the app (Guidelines 3.1.1 / 4.2). Checked after mount to keep the
  // server-rendered HTML identical.
  const [inApp, setInApp] = useState(false);
  useEffect(() => setInApp(isNativeApp()), []);

  if (inApp) {
    return (
      <header className="sticky top-0 z-50 w-full border-b border-border/50 bg-background/95 backdrop-blur-sm pt-[env(safe-area-inset-top)]">
        <div className="mx-auto flex h-14 max-w-7xl items-center px-4 sm:px-6 lg:px-8">
          <Link to="/" aria-label="Peace of Mine home" className="flex min-w-0 shrink items-center">
            <Logo />
          </Link>
        </div>
      </header>
    );
  }

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/50 bg-background/95 backdrop-blur-sm">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
        {/*
          min-w-0 on every flex child below: without it, Safari (unlike
          Chromium) won't shrink a flex item below its own content's
          natural width by default, so on a narrow phone screen this row
          can end up wider than the viewport — which doesn't just clip
          this header, it drags the whole page's scrollable width wider,
          making every unrelated section below appear cut off at the
          screen edge too.
        */}
        <Link to="/" className="flex min-w-0 shrink items-center">
          <Logo />
        </Link>

        <nav className="hidden min-w-0 items-center gap-7 md:flex">
          <Link
            to="/pricing"
            className="font-body text-sm text-muted-foreground transition-colors duration-150 hover:text-foreground"
          >
            Pricing
          </Link>
          <Link
            to="/auth"
            className="font-body text-sm text-muted-foreground transition-colors duration-150 hover:text-foreground"
          >
            Sign in
          </Link>
        </nav>

        <Link
          to="/auth"
          className="inline-flex min-w-0 shrink-0 items-center justify-center rounded-full bg-primary px-5 py-2.5 font-body text-sm font-medium text-primary-foreground transition-all duration-150 hover:bg-[#234E4A]"
        >
          Get started
        </Link>
      </div>
    </header>
  );
}
