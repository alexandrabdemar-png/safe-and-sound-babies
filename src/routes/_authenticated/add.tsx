import { createFileRoute, redirect } from "@tanstack/react-router";

// Quick-add is now a bottom sheet opened from the tab bar's "+" button.
// Old /add deep links land on Home instead of a duplicate list page.
export const Route = createFileRoute("/_authenticated/add")({
  ssr: false,
  beforeLoad: () => {
    throw redirect({ to: "/home" });
  },
});
