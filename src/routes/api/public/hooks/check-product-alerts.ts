import { createFileRoute } from "@tanstack/react-router";
import { hookUnauthorizedResponse } from "@/lib/hookAuth";


/**
 * Daily product alerts job (in-app).
 *
 * For each tracked product, generates dedup'd alert rows for:
 *  - active CPSC recall matches
 *  - predicted replacement within 14/7 days
 *  - overdue replacement (interval passed since added_at)
 *
 * Alerts are written to public.product_alerts. The unique index on
 * (product_id, alert_type) ensures we never insert the same alert twice.
 */
export const Route = createFileRoute("/api/public/hooks/check-product-alerts")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const unauthorized = hookUnauthorizedResponse(request);
        if (unauthorized) return unauthorized;



        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const today = new Date();
        const todayStr = today.toISOString().slice(0, 10);

        type ProductRow = {
          id: string;
          user_id: string;
          child_id: string | null;
          name: string;
          added_at: string | null;
          predicted_replacement_date: string | null;
          recalled: boolean;
          product_guidelines: { replacement_interval_months: number | null } | null;
        };

        const { data: products, error } = await supabaseAdmin
          .from("products")
          .select(
            "id, user_id, child_id, name, added_at, predicted_replacement_date, recalled, product_guidelines(replacement_interval_months)",
          );
        if (error) {
          return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }

        type Insert = {
          user_id: string;
          product_id: string;
          child_id: string | null;
          alert_type: string;
          title: string;
          body: string;
        };
        const toInsert: Insert[] = [];

        function daysFromToday(iso: string): number {
          return Math.round((new Date(iso).getTime() - today.getTime()) / 86_400_000);
        }

        for (const raw of (products ?? []) as unknown[]) {
          const p = raw as ProductRow;

          // 1. Recalls
          if (p.recalled) {
            toInsert.push({
              user_id: p.user_id,
              product_id: p.id,
              child_id: p.child_id,
              alert_type: "recall",
              title: `Active recall on ${p.name}`,
              body: `${p.name} has an active CPSC recall — tap to review the recall notice.`,
            });
          }

          // 2. Replacement windows
          if (p.predicted_replacement_date) {
            const d = daysFromToday(p.predicted_replacement_date);
            const bucket = d <= 7 ? 7 : d <= 14 ? 14 : null;
            if (bucket && d >= 0) {
              toInsert.push({
                user_id: p.user_id,
                product_id: p.id,
                child_id: p.child_id,
                alert_type: `replace_${bucket}d`,
                title: `${p.name} may need a replacement check`,
                body: `Based on the information you've entered, this item may be approaching its typical replacement window around ${new Date(p.predicted_replacement_date).toLocaleDateString(undefined, { month: "long", year: "numeric" })} — worth reviewing against the manufacturer's guidance to see if it's time to inspect or replace it.`,
              });
            }
          }

          // 3. Overdue replacement
          const interval = p.product_guidelines?.replacement_interval_months ?? null;
          if (interval && p.added_at) {
            const overdueAt = new Date(p.added_at);
            overdueAt.setMonth(overdueAt.getMonth() + Math.ceil(interval));
            if (overdueAt < today) {
              toInsert.push({
                user_id: p.user_id,
                product_id: p.id,
                child_id: p.child_id,
                alert_type: "replace_overdue",
                title: `${p.name} may be past its replacement window`,
                body: `Based on the manufacturer's typical interval, this item may be past its general replacement window (around ${overdueAt.toLocaleDateString(undefined, { month: "long", year: "numeric" })}) — worth reviewing the manufacturer's guidance to confirm.`,
              });
            }
          }
        }

        let inserted = 0;
        if (toInsert.length > 0) {
          // ignoreDuplicates handles dedup via the unique index
          const { data, error: insErr } = await supabaseAdmin
            .from("product_alerts")
            .upsert(toInsert as never, {
              onConflict: "product_id,alert_type",
              ignoreDuplicates: true,
            })
            .select("id");
          if (insErr) {
            return new Response(JSON.stringify({ error: insErr.message }), {
              status: 500,
              headers: { "Content-Type": "application/json" },
            });
          }
          inserted = data?.length ?? 0;
        }

        return new Response(
          JSON.stringify({ ok: true, evaluated: products?.length ?? 0, inserted, date: todayStr }),
          { headers: { "Content-Type": "application/json" } },
        );
      },
    },
  },
});
