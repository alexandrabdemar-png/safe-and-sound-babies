import { ShieldAlert, Sparkles, Package, ClipboardList } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

const FEATURES = [
  {
    icon: ShieldAlert,
    title: "Recall Alerts",
    body: "We check the products you track against official recall databases and let you know if there's a match.",
  },
  {
    icon: Sparkles,
    title: "Moments",
    body: "Capture the milestones and everyday moments worth remembering.",
  },
  {
    icon: Package,
    title: "Tracking",
    body: "Keep every product, size, and replacement date in one place.",
  },
  {
    icon: ClipboardList,
    title: "Checklists",
    body: "Age-appropriate safety checklists so nothing slips through.",
  },
];

export function WelcomeIntroModal({ open, onDismiss }: { open: boolean; onDismiss: () => void }) {
  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onDismiss();
      }}
    >
      <DialogContent className="max-w-md rounded-3xl">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">Welcome to Peace of Mine</DialogTitle>
          <DialogDescription className="font-body text-sm">
            A quiet way to keep track of your little one's gear and safety — without the mental
            load. Here's a quick look at what you can do:
          </DialogDescription>
        </DialogHeader>

        <ul className="space-y-3 py-1">
          {FEATURES.map(({ icon: Icon, title, body }) => (
            <li key={title} className="flex gap-3">
              <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
                <Icon className="h-4 w-4" />
              </span>
              <div>
                <p className="font-body text-sm font-semibold text-foreground">{title}</p>
                <p className="font-body text-xs text-muted-foreground">{body}</p>
              </div>
            </li>
          ))}
        </ul>

        <DialogFooter>
          <Button
            type="button"
            className="w-full rounded-full bg-primary font-body text-sm font-semibold text-primary-foreground"
            onClick={onDismiss}
          >
            Got it, let's go
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
