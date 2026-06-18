import { Link } from "@tanstack/react-router";
import { Logo } from "@/components/Logo";

export function Header() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/60 bg-background/90 backdrop-blur-md">
      <div className="mx-auto flex h-18 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link to="/" className="flex items-center">
          <Logo />
        </Link>

        <nav className="hidden items-center gap-7 md:flex">
          <Link
            to="/pricing"
            className="font-body text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            Pricing
          </Link>
          <Link
            to="/auth"
            className="font-body text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            Sign in
          </Link>
        </nav>

        <Link
          to="/auth"
          className="inline-flex items-center justify-center rounded-full bg-primary px-5 py-2.5 font-body text-sm font-medium text-primary-foreground transition-all hover:bg-primary/85"
          style={{ boxShadow: "0 2px 10px 0 rgba(60, 40, 20, 0.12)" }}
        >
          Get started
        </Link>
      </div>
    </header>
  );
}
