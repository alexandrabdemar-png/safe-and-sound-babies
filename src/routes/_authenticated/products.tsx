import { createFileRoute } from "@tanstack/react-router";
import { BottomNav } from "@/components/BottomNav";
import { Package } from "lucide-react";

export const Route = createFileRoute("/_authenticated/products")({
  component: () => <Stub title="Products" icon={Package} blurb="Your tracked baby gear lives here. Coming next." />,
  head: () => ({ meta: [{ title: "Products — Safe & Sound" }] }),
});

function Stub({ title, icon: Icon, blurb }: { title: string; icon: React.ComponentType<{ className?: string }>; blurb: string }) {
  return (
    <div className="flex min-h-screen flex-col bg-background pb-28">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-6 text-center">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-sand/50 text-accent">
          <Icon className="h-6 w-6" />
        </div>
        <h1 className="font-display text-3xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-2 max-w-xs font-body text-sm text-muted-foreground">{blurb}</p>
      </div>
      <BottomNav />
    </div>
  );
}
