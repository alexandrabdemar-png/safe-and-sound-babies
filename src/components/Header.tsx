import { Link } from "@tanstack/react-router";
import { Logo } from "@/components/Logo";

export function Header() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/50 bg-background/95 backdrop-blur-sm">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link to="/" className="flex items-center">
          <Logo />
        </Link>

        <nav className="hidden items-center gap-7 md:flex">
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
          className="inline-flex items-center justify-center rounded-full bg-primary px-5 py-2.5 font-body text-sm font-medium text-primary-foreground transition-all duration-150 hover:bg-[#234E4A]"
        >
          Get started
        </Link>
      </div>
    </header>
  );
}
