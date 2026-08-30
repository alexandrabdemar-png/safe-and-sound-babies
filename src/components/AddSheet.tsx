import { useNavigate } from "@tanstack/react-router";
import { Package, Sparkles, Utensils, ArrowRight } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { BottleIcon } from "@/components/BottleIcon";
import { CategoryBadge } from "@/components/CategoryBadge";
import illoProduct from "@/assets/hd-stroller.png";
import illoMoment from "@/assets/hd-moment.png";
import illoBottle from "@/assets/hd-breastmilk.png";
import illoFirstFood from "@/assets/hd-babyfood.png";

export const addOptions = [
  {
    to: "/products/new",
    icon: Package,
    illustration: illoProduct,
    title: "A product to watch",
    blurb: "Track replacements and recalls on baby gear.",
  },
  {
    to: "/moments/new",
    icon: Sparkles,
    illustration: illoMoment,
    title: "A new moment",
    blurb: "First smile, first tooth, first steps — log it when it happens.",
  },
  {
    to: "/bottles/new",
    icon: BottleIcon,
    illustration: illoBottle,
    title: "A bottle",
    blurb: "Log formula or breastmilk and get reminded before it expires.",
  },
  {
    to: "/first-foods",
    icon: Utensils,
    illustration: illoFirstFood,
    title: "A first food",
    blurb: "Record a new food and note any allergen reactions.",
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
          </SheetHeader>

          <div className="mt-5 space-y-3">
            {addOptions.map(({ to, icon: Icon, illustration, title, blurb }) => (
              <button
                key={to}
                type="button"
                onClick={() => {
                  onOpenChange(false);
                  navigate({ to });
                }}
                className="flex w-full items-center gap-4 rounded-3xl border border-border/60 bg-card p-4 text-left transition-all hover:border-primary/40 hover:shadow-md"
              >
                <CategoryBadge icon={Icon} illustration={illustration} className="h-12 w-12" />
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
