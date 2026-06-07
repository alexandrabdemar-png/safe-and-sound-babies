import { createFileRoute } from "@tanstack/react-router";
import { BottomNav } from "@/components/BottomNav";
import { Plus } from "lucide-react";

export const Route = createFileRoute("/_authenticated/add")({
  component: AddPage,
  head: () => ({ meta: [{ title: "Add — Safe & Sound" }] }),
});

function AddPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background pb-28">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-6 text-center">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <Plus className="h-6 w-6" />
        </div>
        <h1 className="font-display text-3xl font-semibold tracking-tight">Add something</h1>
        <p className="mt-2 max-w-xs font-body text-sm text-muted-foreground">
          A quick way to log a new product, milestone, or reminder. Coming up next.
        </p>
      </div>
      <BottomNav />
    </div>
  );
}
