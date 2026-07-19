import { Link } from "@tanstack/react-router";
import { Logo } from "@/components/Logo";

export function Footer() {
  return (
    <footer className="w-full border-t border-border/60 bg-background py-10">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center justify-between gap-6 md:flex-row">
          {/* Brand mark */}
          <div className="flex items-center">
            <Logo />
          </div>

          <div className="flex items-center gap-5">
            <Link
              to="/recall-search"
              className="font-body text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              Recall Search
            </Link>
            <span className="text-border">·</span>
            <Link
              to="/terms"
              className="font-body text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              Terms &amp; Conditions
            </Link>
            <span className="text-border">·</span>
            <p className="font-body text-sm text-muted-foreground">
              For the little things that matter.
            </p>
          </div>

          <p className="font-body text-xs text-muted-foreground">
            &copy; {new Date().getFullYear()} Peace of Mine.
          </p>
        </div>
      </div>
    </footer>
  );
}
