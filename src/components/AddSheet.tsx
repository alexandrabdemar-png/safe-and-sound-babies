import { useNavigate } from "@tanstack/react-router";
import { Package, Sparkles, Milk, Utensils, LineChart, ArrowRight } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";

export const addOptions = [
  {
    to: "/moments/new",
    icon: Sparkles,
    title: "A new moment",
    blurb: "First smile, first tooth, first steps — log it when it happens.",
  },
  {
    to: "/bottles/new",
    icon: Milk,
    title: "A bottle",
    blurb: "Log formula or breastmilk and get reminded before it expires.",
  },
  {
    to: "/first-foods",
    icon: Utensils,
    title: "A first food",
    blurb: "Record a new food and note any allergen reactions.",
  },
  {
    to: "/growth",
    icon: LineChart,
    title: "A measurement",
    blurb: "Height and weight — keeps size-up reminders accurate.",
  },
  {
    to: "/products/new",
    icon: Package,
    title: "A product to watch",
    blurb: "Track replacements, size-ups, and recalls on baby gear.",
  },
] as const;

export function AddSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const navigate = useNavigate();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="max-h-[85vh] overflow-y-auto rounded-t-3xl border-border/60 pb-[max(env(safe-area-inset-bottom),1.25rem)]"
      >
        <div className="mx-auto max-w-md">
          <SheetHeader className="text-left">
            <SheetTitle className="font-display text-2xl font-semibold tracking-tight">
              What would you like to add?
            </SheetTitle>
            <SheetDescription className="font-body text-sm">
              One quick entry, then you're out. Everything you log shows up under Track.
            </SheetDescription>
          </SheetHeader>

          <div className="mt-5 space-y-3">
            {addOptions.map(({ to, icon: Icon, title, blurb }) => (
              <button
                key={to}
                type="button"
                onClick={() => {
                  onOpenChange(false);
                  navigate({ to });
                }}
                className="flex w-full items-center gap-4 rounded-3xl border border-border/60 bg-card p-4 text-left transition-all hover:border-primary/40 hover:shadow-md"
              >
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-sand/60 text-accent">
                  <Icon className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-display text-base font-semibold tracking-tight">{title}</p>
                  <p className="mt-0.5 font-body text-xs text-muted-foreground">{blurb}</p>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </button>
            ))}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
