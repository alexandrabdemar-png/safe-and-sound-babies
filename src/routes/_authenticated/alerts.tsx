import { createFileRoute } from "@tanstack/react-router";
import { BottomNav } from "@/components/BottomNav";
import { Bell } from "lucide-react";

export const Route = createFileRoute("/_authenticated/alerts")({
  component: AlertsPage,
  head: () => ({ meta: [{ title: "Alerts — Safe & Sound" }] }),
});

function AlertsPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background pb-28">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-6 text-center">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-sand/50 text-accent">
          <Bell className="h-6 w-6" />
        </div>
        <h1 className="font-display text-3xl font-semibold tracking-tight">Alerts</h1>
        <p className="mt-2 max-w-xs font-body text-sm text-muted-foreground">
          Quiet, kind reminders will show up here when something needs your attention.
        </p>
      </div>
      <BottomNav />
    </div>
  );
}
