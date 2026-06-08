## Goal
Make purchase → entitlement → feature unlock work end-to-end, then actually build every feature listed on the pricing page so Pro buys real value.

## Phase 1 — Fix the broken plumbing (blocking everything else)

### 1.1 Database migration
- `GRANT SELECT, INSERT, UPDATE, DELETE ON public.subscriptions TO authenticated`
- `GRANT ALL ON public.subscriptions TO service_role`
- Add `photo_url text` to `public.products` and `public.milestones`
- Create storage bucket `attachments` (private), with RLS policies allowing users to read/write only their own folder (`user_id/...`)
- Add `has_active_subscription(uuid, text)` SQL helper with end-of-period semantics

### 1.2 Webhook end-of-period fix (`src/routes/api/public/payments/webhook.ts`)
- On `customer.subscription.deleted`: set `status='canceled'`, leave `plan='pro'` and `current_period_end` intact (access through period end)
- On `customer.subscription.updated`: don't flip `plan` to `free` just because Stripe says `canceled` — only flip when `current_period_end < now()`

### 1.3 `useSubscription` hook
- Recognize `canceled` + future `current_period_end` as still Pro
- Subscribe to realtime changes on `subscriptions` filtered by `user_id`; re-run env-filtered query in the callback so the UI updates the moment the webhook lands

## Phase 2 — Entitlement UX

### 2.1 `useProGate` hook + `<UpgradePrompt>` modal
- `requirePro(reason)` → if Free, opens a modal explaining the locked feature with a "Go Pro" CTA → `/pricing`
- Replaces every direct `if (!isPro)` early-exit, gives consistent UX

### 2.2 Profile entry point
- Add an "Upgrade to Pro" / "Manage subscription" row in `profile.tsx` (with current plan badge)

### 2.3 Pricing return success
- `/pricing?checkout=success` shows a toast and waits for realtime to flip `isPro`

## Phase 3 — Build the Pro features

### 3.1 Barcode scanner (`src/components/BarcodeScanner.tsx`)
- Use `@zxing/browser` (already production-grade, MIT). Modal opens camera, decodes EAN/UPC, writes value into product form's `barcode` field and tries to prefill `name` via a public lookup (Open Food Facts as best-effort fallback; otherwise just barcode)
- Trigger button on `products/new` — Free users hit `requirePro("Barcode scanner")`

### 3.2 Photo attachments
- File input on `products/new` and `moments/new` that uploads to `attachments/{user_id}/{uuid}.jpg`, stores returned path in `photo_url`
- Render thumbnail on `products.tsx` cards and on moments list (`home.tsx`)
- Pro-gated via `requirePro`

### 3.3 Multi-child
- New `ChildrenManager` section in Profile: add / rename / delete children
- Free = 1 child cap enforced both in UI and via a `BEFORE INSERT` trigger that checks count + `has_active_subscription`
- Header `ChildSwitcher` dropdown (when >1 child); selected child stored in `localStorage`; home/products/alerts read from it

### 3.4 Export / backup
- Server fn `exportUserData` (auth middleware) returns a JSON bundle of children + products + milestones
- Profile button → triggers download as `safesound-export-{date}.json`; Free users hit `requirePro("Export your data")`

### 3.5 Advanced insights (`/_authenticated/insights.tsx`)
- New route, Pro-gated at the route level (Free users see upsell card)
- Charts via `recharts` (already installed by shadcn stack): milestones logged per month (bar), products tracked over time (line), category breakdown (donut), upcoming replacements timeline

## Phase 4 — Test plan in preview

You'll see an orange "test mode" banner across the top — that's correct.

1. **Reach pricing**: Profile → "Upgrade to Pro", or header link
2. **Pay**: click "Upgrade to Pro" → embedded Stripe form appears inline
   - Card: `4242 4242 4242 4242` · any future expiry · any 3-digit CVC · any ZIP
   - Decline test: `4000 0000 0000 0002`
   - 3D Secure: `4000 0025 0000 3155` (approve the popup)
3. **Verify entitlement unlocks**: page should flip to "You're on Pro" within ~1s (realtime). Navigate to `/products/new` → barcode scanner button no longer shows the upsell modal. Add a 2nd child in Profile → works. `/insights` route renders charts. Export button downloads JSON.
4. **Cancel mid-period**: click "Manage subscription" → opens Stripe Portal in new tab → cancel → return to app. Profile still shows Pro until `current_period_end` (you can see the date). Features still work.
5. **Simulate period end**: in Stripe Portal use "Cancel immediately" to test the Free downgrade path. Verify scanner/insights/export all re-lock and the gate modal appears.

## Technical notes
- `@zxing/browser` is Worker-safe (browser-only API)
- Storage bucket policies scope by first path segment = `auth.uid()::text`
- Multi-child trigger calls `has_active_subscription(NEW.user_id, current_setting('app.env', true))` — env is read from a per-row column we'll add, falling back to `'sandbox'`. Simpler: trigger checks count > 0 AND NOT EXISTS(SELECT 1 FROM subscriptions WHERE user_id=NEW.user_id AND plan='pro' AND status IN ('active','trialing','canceled') AND (current_period_end IS NULL OR current_period_end > now()))
- All new files use existing design tokens; no new colors introduced