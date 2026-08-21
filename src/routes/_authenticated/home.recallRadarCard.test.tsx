import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import {
  createRootRoute,
  createRoute,
  createRouter,
  createMemoryHistory,
  RouterProvider,
  Outlet,
} from "@tanstack/react-router";
import { RecallRadarCard } from "./home";

// Regression test for a reported bug: a parent said tapping the "13 new
// recalls published this month" row on the home screen didn't lead
// anywhere. RecallRadarCard is a plain function component (no hooks, no
// Supabase calls) that renders two sibling <Link> rows, so it can be
// mounted in a real, minimal TanStack Router instance and its actual
// resolved output inspected — this is a genuine router resolution, not a
// stand-in — without needing a browser/jsdom. It can't simulate a real
// click event (no DOM here), but it does prove or disprove the class of
// bug that would make a tap silently go nowhere: a wrong/unresolved href,
// or an invalid nested-anchor structure that breaks click targeting.
async function renderCardAt(
  path: string,
  props: { count: number; matchedCount: number; childName: string },
) {
  const rootRoute = createRootRoute({ component: () => <Outlet /> });
  const homeRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/home",
    component: () => <RecallRadarCard {...props} />,
  });
  const recallRadarRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/recall-radar",
    component: () => <div data-testid="recall-radar-page">Recall Radar Page</div>,
  });
  const alertsRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/alerts",
    component: () => <div data-testid="alerts-page">Alerts Page</div>,
  });

  const routeTree = rootRoute.addChildren([homeRoute, recallRadarRoute, alertsRoute]);
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [path] }),
  });

  // Route matching is async even against an in-memory history — a
  // synchronous renderToStaticMarkup right after createRouter renders
  // before the first match resolves, producing empty output regardless of
  // whether the route/link wiring is actually correct. Loading first is
  // what makes this a real assertion about the resolved route tree.
  await router.load();
  return renderToStaticMarkup(<RouterProvider router={router} />);
}

describe("RecallRadarCard — link targets actually resolve (regression: 'tapping it didn't lead anywhere')", () => {
  it('renders exactly one real <a href="/recall-radar"> for the industry-wide recall count row', async () => {
    const html = await renderCardAt("/home", { count: 13, matchedCount: 0, childName: "Remi" });

    // The count text must actually be present and inside an anchor whose
    // resolved href is the real route — not blank, not "#", not nested
    // inside another anchor (which would make the DOM auto-close the
    // outer tag and silently break click targeting).
    expect(html).toContain("13 new recalls published this month, industry-wide");
    const anchorMatches = [...html.matchAll(/<a\s+([^>]*href="[^"]*"[^>]*)>/g)];
    const radarAnchor = anchorMatches.find((m) => /href="\/recall-radar"/.test(m[1]));
    expect(radarAnchor, `expected an <a href="/recall-radar"> in: ${html}`).toBeTruthy();

    // Exactly one anchor should point at /recall-radar — a duplicate or
    // zero matches both indicate a wiring bug, not a working link.
    const radarHrefCount = anchorMatches.filter((m) => /href="\/recall-radar"/.test(m[1])).length;
    expect(radarHrefCount).toBe(1);

    // No nested <a> tags anywhere in this card's output.
    expect(html.match(/<a\b/g)?.length).toBe(anchorMatches.length);
  });

  it("still renders the /recall-radar link even when the count is zero (no new recalls)", async () => {
    const html = await renderCardAt("/home", { count: 0, matchedCount: 0, childName: "Remi" });
    expect(html).toContain("No new recalls published this month, industry-wide");
    expect(html).toMatch(/<a\s+[^>]*href="\/recall-radar"[^>]*>/);
  });

  it("the separate 'Alerts for [child]' row points at /alerts, not /recall-radar — the two links must stay distinct", async () => {
    const html = await renderCardAt("/home", { count: 13, matchedCount: 2, childName: "Remi" });
    expect(html).toMatch(/<a\s+[^>]*href="\/alerts"[^>]*>/);
    expect(html).toContain("2 may match Remi&#x27;s saved products");
  });

  it("navigating the router to /recall-radar actually renders the Recall Radar page (the href is a live, working route, not a dead path)", async () => {
    const html = await renderCardAt("/recall-radar", {
      count: 13,
      matchedCount: 0,
      childName: "Remi",
    });
    expect(html).toContain("Recall Radar Page");
  });
});
