Most security findings were already addressed in prior turns (ownership check on `generate_milestones_for_child`, `HOOK_SECRET` auth on all three hook endpoints, `requireSupabaseAuth` on `createCheckoutSession` with server-derived `userId`, `requireProSubscription` gating in `guidelines.functions.ts`, `product_recalls` removed from realtime publication). Two items remain plus housekeeping.

## Remaining work

1. **Add the `HOOK_SECRET` secret** (runtime env var) so the updated hook handlers actually authenticate. Without this the cron endpoints return 401. Request via `secrets--add_secret` — the user pastes a long random token.
2. **Move Supabase extensions out of `public` schema** (Supabase linter `extension_in_public`). Migration:
   - `CREATE SCHEMA IF NOT EXISTS extensions;`
   - `ALTER EXTENSION <name> SET SCHEMA extensions;` for each extension currently in `public` (likely `pg_net` and/or `pg_cron` / `pgcrypto` — confirm via `read_query` on `pg_extension`).
3. **Mark resolved findings as fixed** via `security--manage_security_finding` for: `generate_milestones_no_ownership`, `check_recalls_no_auth`, `hooks_pubkey_as_secret`, `realtime_messages_no_rls`, `pro_gate_client_only`, `checkout_no_auth`, plus the new extension fix once applied.
4. **Ignore** the `subscriptions_no_write_policy` warn (informational — current design is correct: only service role writes subscriptions via Stripe webhook).
5. **Update security memory** noting: HOOK_SECRET pattern for hook endpoints, server-side Pro gating via `requireProSubscription`, server-derived userId in checkout.

## Not changing

- No new RLS on `realtime.messages` — `product_recalls` is no longer published to realtime, so the finding is moot.
- No code changes to already-patched files.

Confirm and I'll execute.