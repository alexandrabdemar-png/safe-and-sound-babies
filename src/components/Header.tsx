import { Link } from "@tanstack/react-router";
import { Logo } from "@/components/Logo";

export function Header() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link to="/" className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm shadow-primary/20">
            <Logo className="h-5 w-5" />
          </div>
          <div className="flex flex-col">
            <span className="font-display text-xl font-semibold leading-none tracking-tight text-foreground">
              Safe & Sound
            </span>
            <span className="mt-0.5 font-body text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Baby Safety
            </span>
          </div>
        </Link>

        <nav className="hidden items-center gap-8 md:flex">
          <Link
            to="/how-it-works"
            className="font-body text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            How it works
          </Link>
          <Link
            to="/features"
            className="font-body text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            Features
          </Link>
          <Link
            to="/pricing"
            className="font-body text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            Pricing
          </Link>
          <Link
            to="/for-parents"
            className="font-body text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            For parents
          </Link>
          <Link
            to="/auth"
            className="font-body text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            Sign in
          </Link>
        </nav>

        <Link
          to="/auth"
          className="inline-flex items-center justify-center rounded-full bg-primary px-6 py-3 font-body text-sm font-semibold text-primary-foreground transition-all hover:bg-primary/90 hover:shadow-lg hover:shadow-primary/20"
        >
          Get started free
        </Link>
      </div>
    </header>
  );
}
