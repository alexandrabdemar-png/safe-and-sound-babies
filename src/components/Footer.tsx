import { Link } from "@tanstack/react-router";
import { Droplets } from "lucide-react";

export function Footer() {
  return (
    <footer className="w-full border-t border-border/40 bg-background py-12">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center justify-between gap-6 md:flex-row">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary">
              <Droplets className="h-4 w-4 text-primary-foreground" />
            </div>
            <div className="flex flex-col">
              <span className="font-display text-base font-semibold leading-none text-foreground">
                Safe & Sound
              </span>
              <span className="mt-0.5 font-body text-[9px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                Baby Safety
              </span>
            </div>
          </div>

          <div className="flex items-center gap-6">
            <Link
              to="/terms"
              className="font-body text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              Terms & Conditions
            </Link>
            <span className="text-muted-foreground/40">|</span>
            <p className="font-body text-sm text-muted-foreground">
              For the little things that matter.
            </p>
          </div>

          <p className="font-body text-xs text-muted-foreground">
            &copy; {new Date().getFullYear()} Safe & Sound. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
