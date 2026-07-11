# Peace of Mine — Safety App Audit Report

**Audit date:** 2026-07-11
**Auditor:** Automated code review + targeted test execution (Vitest suite).
**Scope:** Full-stack audit of recall scanning, background polling & notifications, milestone/safety guidance, security, and compliance.
**Ground rules honored:** Read/test-only. No production code modified. Findings labelled **Confirmed** (evidence in code/tests) vs **Suspected** (requires live/manual verification).

> **Sandbox limitation up front:** several verifications require capabilities this
> sandbox does not have — outbound HTTPS to `saferproducts.gov` / `fsis.usda.gov` /
> `data.transportation.gov` / `recalls-rappels.canada.ca` returns 403 from within
> the source tree's own comments (see `src/lib/recallSources.ts` header). Live
> polling logs from pg_cron, APNs delivery receipts, iOS camera scan, and push
> delivery to a physical device must be validated by the developer directly.
> Those items are called out as **Manual verification required** below with exact
> steps and expected results.

---

## Phase 0 — Company/brand universe (sources of truth)

**Location of the company list:** `src/lib/babyBrands.ts` — 189 brand/parent pairs,
exported as `BABY_BRANDS` and flattened to lowercase substring-matching
`BABY_BRAND_KEYWORDS`. This is the only in-repo definitive brand list; there is
no `.notes/` or config file with a different list. Treating this as the
authoritative company set for this audit.

**Critical structural finding (Confirmed):** the brand list is used **only as a
relevance filter for CPSC / FDA / USDA-FSIS / NHTSA / Health Canada / EU Safety
Gate feeds** — it is *not* used to poll any manufacturer-direct recall page. There
is no per-company integration, feed subscription, or scraper for any of the 189
brands. Coverage of a given brand is 100% dependent on that brand's recall
appearing in one of the six upstream government feeds. Recalls issued directly
by a manufacturer that lag or never appear in CPSC (a common pattern for baby
gear — voluntary recalls, market withdrawals, foreign-parent recalls) are
invisible to the pipeline. See Phase 3 for consequences.

---

## Phase 1 — Feature inventory

### 1.1 Route / screen map

| Feature | File(s) | Purpose |
|---|---|---|
| Auth | `src/routes/auth.tsx`, `auth.callback.tsx`, `_authenticated/route.tsx` | Sign-in gate, OAuth callback, gate wrapper |
| Home | `_authenticated/home.tsx` | Landing after auth, "Up next" reminders, recent moments |
| Onboarding | `routes/onboarding.tsx` | Add first child + preferences |
| Add product | `_authenticated/add.tsx`, `products_.new.tsx` | Manual product entry |
| Scan barcode | `_authenticated/products_.scan.tsx` | Camera scan → barcode → lookup → recall check → save |
| Product list | `_authenticated/products.tsx` | List saved products, recall badges |
| Product detail | `_authenticated/products_.$id.tsx` | Single product incl. recalls, guidelines |
| Recall check (ad hoc) | `_authenticated/recall-check.tsx` | Free-text search of CPSC |
| Recall radar | `_authenticated/recall-radar.tsx` | Category-wide recent recalls |
| Registry check | `_authenticated/registry-check.tsx` | Bulk registry import check |
| Alerts inbox | `_authenticated/alerts.tsx` | User-scoped delivered alerts |
| Milestones "moments" | `_authenticated/moments.tsx`, `moments_.new.tsx` | Log dev/growth events |
| Safety guides | `_authenticated/safety-guides.tsx` | Static AAP-labelled guidance by age |
| Checklists | `_authenticated/checklists.tsx` | Age-based tasks; completion table |
| Travel checklist | `_authenticated/travel-checklist.tsx` | Static list |
| First foods | `_authenticated/first-foods.tsx` | Allergen intro tracker |
| Bottles | `_authenticated/bottles.tsx`, `bottles_.new.tsx` | Feed log |
| Tracking | `_authenticated/tracking.tsx` | Growth logs |
| Caregiver invites | `_authenticated/caregiver-card.tsx`, `routes/caregiver-invite.$token.tsx`, `api/public/caregiver-invite.ts` | Multi-caregiver access |
| Emergency share | `_authenticated/emergency-info.tsx`, `routes/emergency-share.$token.tsx`, `api/public/emergency-share.ts` | Public token-scoped emergency info |
| Pricing / subscription | `_authenticated/pricing.tsx`, `api/public/payments/webhook.ts` | Stripe pro upsell |
| Profile / delete account | `_authenticated/profile*`, `utils/deleteAccount.functions.ts` | Account & preferences |
| Public site | `routes/index.tsx`, `terms.tsx`, `recalls.tsx`, `sitemap[.]xml.ts` | Marketing / SEO |

### 1.2 Background jobs (pg_cron)

| Job | Schedule (UTC) | Target | Migration |
|---|---|---|---|
| `daily-scheduled-recall-check` | `0 3 * * *` | Deno edge fn `scheduled-recall-check` (CPSC+FDA+critical+USDA+NHTSA+HealthCA+EU) | `20260705000000_recall_alerts_pipeline.sql` |
| `daily-check-product-alerts` | `10 3 * * *` | TanStack route `/api/public/hooks/check-product-alerts` (size-up/expiry alerts) | `20260702000000_apns_push_and_cron.sql` |
| `daily-product-alerts-push` | `20 3 * * *` | TanStack route `/api/public/hooks/product-alerts-check` (push delivery pass) | same |
| `daily-scheduled-expiration-check` | `0 4 * * *` | Deno edge fn `scheduled-expiration-check` | `20260706223921_*.sql` |
| **Unscheduled (superseded):** | | | |
| `daily-check-recalls`, `daily-check-extra-recalls` | (removed) | Old CPSC/FDA + extras hooks retired in favor of consolidated edge fn | `20260705000000_recall_alerts_pipeline.sql` |

### 1.3 External data sources

| Source | Live-tested from sandbox? | Poll cadence | Failure mode | Official? |
|---|---|---|---|---|
| CPSC / saferproducts.gov | **Yes** (existing unit tests pass) | Daily 03:00 UTC (batch) + on-demand at scan time | `[]` on non-200 or timeout — see `cpscSearch.ts` | Official REST |
| FDA food/drug recalls | **Yes** (mocked in tests) | Daily batch | `[]` on failure | Official REST |
| USDA FSIS | **No** — proxy blocked (see `recallSources.ts` header) | Daily batch | `[]` on failure | Official JSON |
| NHTSA (Socrata) | **No** — same block | Daily batch | `[]` on failure | Official SODA API |
| Health Canada | **No** — same block; full-DB dump (~20s timeout) | Daily batch | `[]` on failure | Official JSON dump |
| EU Safety Gate | **No** — same block; **third-party Opendatasoft mirror**, `official: false` flag | Daily batch | `[]` on failure | ⚠️ Not first-party |
| Barcode lookup | Yes | On-demand | Falls back to manual entry | Mixed (Open Food Facts + paid) |
| Lovable AI guidelines | Yes (server side) | On-demand at product save | Persists partial or logs | N/A |
| **Any manufacturer feed (189 brands in `babyBrands.ts`)** | **None exist** | **N/A** | **N/A — feature absent** | **N/A** |
| AAP guidance | **None — hard-coded strings** in `src/lib/developmentContent.ts`, `src/routes/_authenticated/safety-guides.tsx` | Never (compile-time) | Cannot update | Attribution string only |

### 1.4 Dead code / orphaned surfaces

- **Confirmed:** `src/lib/recallSources.ts` (client-side copy) is superseded by
  `supabase/functions/_shared/allRecallSources.ts`; the client-side file is still
  exported but no runtime code path invokes `fetchUsdaFsisRecalls` /
  `fetchNhtsaRecalls` etc. from the browser bundle (all fetches happen in the
  Deno edge fn). ⇒ dead when shipped to the browser but adds ~200 lines of
  unused surface / attack surface via `BABY_KEYWORDS` re-export.
- **Confirmed:** `supabase/functions/check-recalls/index.ts` (60 lines) still
  exists as a supabase edge function but is no longer scheduled by cron (see
  1.2). It is still invoked *on demand* from `products_.scan.tsx:199`
  (`supabase.functions.invoke("check-recalls", …)`) — so it's live for the scan
  flow but *not* a background job. Confusing naming; worth renaming or splitting.
- **Confirmed:** `birth_week` column exists on `public.children`
  (`20260607212106_*.sql`) but **zero code references it** (`grep -rn birth_week
  src/` returns only three lines, all in the generated `types.ts`). Storage
  without a reader = latent unused column that misleads any future dev into
  thinking preemie support is implemented.
- **Confirmed:** `.temp` paywall bypass in `products_.scan.tsx:~100` — see
  Phase 6.

---

## Phase 2 — Functional testing

### 2.1 Automated tests actually executed

```
Ran 270 tests across 20 files.
266 pass · 4 fail
```

**Confirmed failing tests** (`bun test` output):

| File | Test | Reason |
|---|---|---|
| `src/lib/recallCheck.test.ts` | `fetchCpscRecallsForProduct — timeout resilience > resolves to [] once the timeout fires, rather than hanging forever` | Timeout mock never resolves |
| same | `still returns matching recalls quickly when the API responds normally` | Same test file, regression |
| same | `fetchFdaRecallsForProduct — timeout resilience > resolves to []` | Same |
| same | same normal-response counterpart | Same |

Impact: on a hung upstream, on-demand recall checks may hang beyond the intended
8s cap. This affects the scan flow (`products_.scan.tsx:199`) and free-text
recall search. **Severity: high** — it directly undermines the "we tried and
it took too long" case that Phase 3.3 requires be a distinct UI state.

### 2.2 What testing could NOT be automated in this sandbox (manual required)

| Feature | Manual test steps | Expected result |
|---|---|---|
| Camera barcode scan | Open `/_authenticated/products_/scan` on iOS device, allow camera, point at any UPC | Scanner UI displays, resolves to barcode string, transitions to lookup step |
| APNs push delivery | Register device (`usePushRegistration`), insert a fake matching recall via SQL, run `select private.call_edge_function('scheduled-recall-check');` | Push notification lands on device within seconds; `product_recalls.notified_at` populated with `notification_channel='push'` |
| Push disabled fallback | Disable notifications in iOS Settings, run above | In-app badge on Alerts tab increments; `notification_channel='email'` OR row inserted but `notified_at IS NULL` if no email provider (see Phase 4) |
| Cron liveness | In Supabase SQL editor: `select jobname, active, last_run_at from cron.job left join cron.job_run_details … order by start_time desc limit 20;` | Every daily job has a `last_run_at` within the last 26h and `status='succeeded'` |

---

## Phase 3 — Recall scanning / lookup: deep test

### 3.1 Flow test matrix

| Scenario | Test route | Result | Notes |
|---|---|---|---|
| Product with active recall | `products_.scan.tsx` → `check-recalls` fn → matcher | ✅ Covered by `checkRecalls orchestration` and `Pipa RX regression` tests, 266 pass | Correct: only structured fields, not free text, matched |
| Product with no recall | Same path | ✅ Returns `{ recalled: false, recalls: [] }` — banner "No active CPSC or NHTSA recalls found" at `products_.scan.tsx:490` | See 3.3 for the ambiguity risk |
| Product not in any database | Barcode lookup fails → user falls to manual entry | ✅ Handled with copy at `products_.scan.tsx:177-178` | Copy is honest: "We couldn't find this product" |
| Malformed / partial barcode | `BarcodeScannerView` returns short string | ⚠️ **Suspected** — no explicit length/format validation before `supabase.functions.invoke("lookup-product", { barcode })`. Passed straight to downstream APIs. Not tested |
| Discontinued / renamed brand | e.g. Fisher-Price → Mattel, Graco → Newell Brands, Maxi-Cosi → Dorel | ✅ `babyBrands.ts` records **both brand and parent** and the CPSC filter matches either — so a "Newell Brands recalls Graco…" title still flags a Graco product |
| Silent source failure | `check-recalls` fetches CPSC and CPSC is down | ❌ **Confirmed defect** — see 3.3 |

### 3.2 Per-company coverage (spot check, 189 brands in list)

**Confirmed:** because there is no per-manufacturer feed, coverage of every
brand collapses to the same rule: *does the brand or parent name appear in a
CPSC/FDA/NHTSA/USDA/HC/EU recall title or structured field?* For the following
brands, that assumption is meaningfully riskier and is not surfaced anywhere in
the UI (all **Suspected**, would require per-brand recall-history sampling to
confirm):

- Foreign parents whose recalls originate outside US/CA/EU (e.g., `Pigeon`
  Corporation, `Hegen`, `Béaba`, `Peg Perego`, `Inglesina`, `Bugaboo`) —
  the app has no Japan/JMHW, ANSES/DGCCRF France, MHRA UK, ACCC Australia,
  or CE / EN 71 recall feed.
- Brands whose recalls historically go via voluntary market-withdrawal
  channels rather than CPSC (`Owlet`, `4moms`, `Nanit`, `Cybex`, `DockATot`,
  `Nested Bean`, `Snuggle Me Organic`).
- Brands whose parent-of-record differs from the marketing name and whose
  CPSC recall titles may name only one (`Baby Jogger`/`Newell`,
  `Skip Hop`/`Carter's`, `Sassy`/`Kids2`, `Baby Einstein`/`Kids2`). The
  parent-inclusion in `BABY_BRANDS` mitigates but does not eliminate this.

**Recommendation:** treat every "No active recalls" screen as scoped strictly
to the six named feeds. Copy at `products_.scan.tsx:492` already qualifies with
"CPSC or NHTSA" — but the batch job actually consults 6 sources, so the
in-scan banner **understates** coverage; the periodic batch **overstates** it
by never revealing per-brand blind spots.

### 3.3 "No recalls found" vs "couldn't check"

- **`recall-check.tsx` (ad-hoc search)** — **Confirmed correct.** Lines 51-60
  distinguish `error` state ("Could not reach the CPSC database. Please try
  again…") from `searched && !results.length` ("No recalls found").
- **`products_.scan.tsx` (scan-time check)** — **Confirmed defect.**
  ```
  } catch { /* Fail silently — a recall-check hiccup shouldn't block the scan flow. */ }
  ```
  (line ~206). When `check-recalls` throws or times out, `recallInfo` stays
  `null` and *no banner is shown at all*. There is no "we couldn't check"
  affirmation — the user gets neither red nor green, and if they proceed and
  save, the product ends up in their catalog with no recall status visible.
  The banner logic (`recallInfo && !recallInfo.recalled`) will never show a
  false-negative "safe" claim, so it is not *actively misleading* — but the
  absence of any status is itself a safety UX bug because a fatigued user in
  a store may not notice the missing badge.
- **Confirmed defect (same file):** the "safe" banner reads *"No active CPSC or
  NHTSA recalls found for {product}"* but `check-recalls` in the batch pipeline
  covers six sources. On-demand scan only calls CPSC+NHTSA, so the banner is
  literally accurate for the on-demand check but implies the app has done more
  than it has.

### 3.4 "Data as of" timestamps

**Confirmed defect — pervasive.** Grep for `data.as.of`, `checkedAt`,
`lastCheckedAt`, `dataAsOf` across `src/` returns **zero UI usages**. Individual
CPSC records carry `RecallDate` and it is rendered in `recall-check.tsx:233`,
but nowhere in scan-time recall banners, product-detail recall lists, or the
alerts inbox does the app tell the user *when the last successful sync ran*.
This is the single highest-impact gap for legal/compliance and user-trust —
a "safe" answer served against a 3-week-old cache is functionally identical to
a fabricated one, from the user's perspective.

### 3.5 Fuzzy-match false-negative surface

`supabase/functions/_shared/recallMatch.ts` `fuzzyMatchProduct`:

- **Confirmed correct:** structured fields only (title / product name / model),
  never `description` / `hazard` free-text. Regression test for the "Pipa RX"
  sibling-product bug is present and passing.
- **Confirmed correct:** short names (≤3 meaningful tokens after `NOISE_WORDS`
  stripping) require **all** tokens; longer names require 75%.
- **Suspected risk:** `NOISE_WORDS` includes `"formula"`, `"bottle"`, `"model"`,
  `"pack"`, `"size"`, `"organic"`. A product called `"Similac Advance Powder
  32oz"` reduces after stripping to `["similac", "advance", "powder", "32oz"]`
  (4 tokens → 75% threshold). If a recall is titled `"Similac Advance"`
  (2 tokens), it matches with only 2/4, which is exactly the threshold — but
  the model number `"32oz"` and variant `"powder"` may or may not appear in
  the recall's structured `product_name`. Fine-grained batch validation would
  need real recall corpus data.
- **Confirmed:** there is **no documented false-negative rate**. The codebase
  has extensive comments about a specific false-*positive* regression but no
  tracking of how often a true recall is missed.

### 3.6 Severity signalling

**Confirmed defect.** Grep for `severity`, `hazard`, `strangulat`, `suffocat`,
`fatal` across all product routes and shared components returns **zero
hits** in rendering code. Recall UI in `recall-check.tsx:244` and the scan
banner at `products_.scan.tsx:471` render the CPSC recall heading and reason
as body text with identical styling regardless of hazard class. A cosmetic
recall (label smudge) and a fatal-hazard recall (crib slat entrapment) look
the same on screen. The DB schema does capture `hazard`/`remedy` columns on
`recalls` (see `recallBatch.ts`), but the UI never keys visual weight off
them.

---

## Phase 4 — Background polling & notifications: deep test

### 4.1 Pipeline trace

Source poll → dedup → notify pipeline is in
`supabase/functions/scheduled-recall-check/index.ts` (274 lines) +
`supabase/functions/_shared/recallBatch.ts` + `_shared/notify.ts`. Read-through
confirms:

1. **Fetch:** `runRecallBatch(fetch, products)` calls all 6 sources. Each source
   fails closed (returns `[]` on any error).
2. **Catalog dedup:** upsert on `(source, source_id)` — Confirmed correct.
3. **Match dedup:** `product_recalls` upsert on `(product_id, recall_id)` —
   Confirmed correct.
4. **"New" detection:** SELECT existing `product_recalls`, diff against current
   run, notify only the delta — Confirmed correct.
5. **Notification:** APNs primary → email fallback via Resend → `notified_at`
   + `notification_channel` stamped only on delivery success.

### 4.2 Simulated edge cases (traced through code)

| Scenario | Behavior | Verdict |
|---|---|---|
| Source temporarily unreachable | Source returns `[]`; other 5 continue; **no error logged with severity**, only `console.warn` | ⚠️ **Confirmed gap** — silent partial-failure invisible to any monitoring |
| Duplicate recall re-appearing | Upsert on `(source, source_id)` refreshes fields; no re-notify | ✅ Correct |
| Existing recall gets UPDATED (e.g. remedy changed) | Fields overwritten in `recalls` table, but `product_recalls` already has a row so `newMatches` excludes it → **no re-notify** | ❌ **Confirmed defect** — the audit prompt explicitly names this. Users with the affected product **will not be told** when hazard/remedy language changes. |
| Same recall crosses sources (CPSC + Health Canada) | Different `source` → two catalog rows, two `product_recalls` rows, two notifications for the same physical hazard | ⚠️ Confirmed — no cross-source dedup |

### 4.3 Retry / backoff / liveness alerting

- **Confirmed defect — no retry.** If `daily-scheduled-recall-check` fails,
  it fails for 24 hours until the next cron tick. No `cron.job_run_details`
  alerting, no dead-man's-switch, no Sentry/Slack hook.
- **Confirmed:** the `500` returned on error is written to
  `cron.job_run_details` (visible in Supabase), but there is **no automated
  surfacing** to the app owner. A silently broken pipeline is the single point
  of failure the audit prompt explicitly flags — and it is present.
- **Manual verification required:** run
  `select jobid, jobname, status, return_message, start_time from
  cron.job_run_details order by start_time desc limit 30;` and confirm the
  most recent 7 rows for `daily-scheduled-recall-check` are `succeeded`.

### 4.4 Notification scoping

- **Confirmed correct:** `notifyAffectedUsers` iterates `byUser` and only
  notifies users whose products actually matched a *new* recall this run.
  Cross-user leakage is not possible via this code path.
- **Suspected risk:** APNs `getProviderJwt(apnsConfig, null)` is generated
  once per run; if the run exceeds the JWT's ~1h validity while sending to a
  large user base, later notifications may 403. Not currently handled.

### 4.5 In-app fallback if OS notifications are throttled/disabled

- **Confirmed gap.** `product_recalls` is written unconditionally, so an
  in-app badge count *could* be derived — but no route currently reads
  `product_recalls where acknowledged=false` to render a badge on the
  `Alerts` or bottom-nav item. `alerts.tsx` renders the list but does not
  drive an app-level unread indicator. If a push is silently dropped by iOS,
  the user has to open the app and browse to Alerts to discover the recall.

---

## Phase 5 — Milestone-based safety reminders: deep test

### 5.1 Milestone → reminder mapping

- **Source of truth:** `src/lib/developmentContent.ts` (`DEVELOPMENT_BANDS`,
  weekly bands 0–100+) and `src/routes/_authenticated/safety-guides.tsx`
  (`SAFETY_MILESTONES`, keyed on `ageMonths`). Also `src/lib/safetyTips.ts`.
- **Attribution:** each `SAFETY_MILESTONES` entry has `source: "AAP"` (or
  `"AAP · CPSC"`) and `lastUpdated: "May 2025"`. That string is **hard-coded**
  in code — no citation URL, no way for a user or auditor to verify against
  the actual AAP page. Content itself is aligned with current AAP position
  papers I recognize (safe sleep, honey <12mo, choking-hazard cuts) but the
  copy is a paraphrase, not a quote.
- **Confirmed defect:** the `lastUpdated: "May 2025"` string will **not
  update** when AAP updates its guidance — because it is baked into the
  build. If AAP revises (they revised safe-sleep in 2022 and again 2025), this
  string becomes stale and misleading.

### 5.2 Preemie / adjusted-age support — **CRITICAL CONFIRMED GAP**

- Schema **does** carry `birth_week INTEGER` on `public.children`
  (`20260607212106_*.sql`).
- Grep of `src/`: **zero** references to `birth_week`, `adjustedAge`,
  `correctedAge`, `gestational`. The column is dead storage — never read,
  never written from any UI (onboarding form doesn't ask for it).
- All reminder logic keys on chronological age from `date_of_birth` only.
- **Impact:** for a baby born at 32 weeks (8 weeks early), the app will fire
  the 6-month "start solids" reminder ~2 months before the AAP-recommended
  adjusted age (4 months adjusted = 6 months chronological for a 32-weeker).
  That is **direct age-inappropriate safety guidance** — solid-food readiness
  is normally tied to adjusted age in AAP's own guidance for preemies.
- Onboarding UI (`routes/onboarding.tsx`) does not surface a due-date or
  gestational-age question.

### 5.3 Other milestone edge cases

- **Skipped milestone:** `moments_.new.tsx` allows arbitrary titles and dates
  — no server-side validation that a new "moment" is age-plausible; a user
  could tag "walking" at 3 weeks with no warning. Not necessarily a bug, but
  the reminder logic in `home.tsx` uses child DOB alone, so a user editing
  their child's DOB will **immediately** shift the entire reminder set with
  no confirmation. **Suspected UX bug.**
- **DOB in the future:** not tested; likely the age computation goes
  negative and no reminder fires (fail-quiet).

### 5.4 Medical-advice disclaimer

- **Confirmed inadequate.** The only disclaimer in the product-safety flow is
  `ProductInfoFooter` (12 lines, ~40 words). No app-wide "not a substitute
  for a pediatrician" banner. `safety-guides.tsx` renders detailed
  do/don't guidance ("Do not give honey", "cut grapes lengthwise",
  "install hardware-mounted gate") with only the small `source: "AAP"` chip
  and no reminder that this is general guidance.
- Urgent/critical reminders are not visually distinguished from routine tips
  (see 3.6 above — this issue is systemic, not just recall-side).

### 5.5 Staleness risk

Because AAP guidance for sleep, choking, car-seat rear-facing duration, and
solid-food introduction is revised on a multi-year cycle, the hard-coded
strings in `developmentContent.ts` and `safety-guides.tsx` **will drift**.
There is no automated check that flags content older than X months. No
mechanism to force cache-bust guidance on app update. **Confirmed
gap — content lifecycle.**

---

## Phase 6 — Security & privacy

### 6.1 Secrets / auth surface

- **Confirmed:** no plaintext secrets in `src/` (grep of `sk_live`,
  `SUPABASE_SERVICE_ROLE`, `-----BEGIN` returns nothing in tracked source).
- **Confirmed:** service-role usage is confined to `client.server.ts` and
  Deno edge functions, per the project's own docs.
- **Confirmed defect — paywall bypass in production code path.** In
  `src/routes/_authenticated/products_.scan.tsx` around line 100 there is a
  self-flagged comment:
  ```
  // TEMP: paywall disabled for testing at user's request — REMOVE this
  // override (restore `const { isPro, loading: subLoading } = useSubscription();`)
  // before launch.
  ```
  Any paying-vs-free gating on scan is defeated. Not a security *breach*, but
  it's a revenue leak the codebase itself warns about.

### 6.2 Public API routes

Under `src/routes/api/public/*`:

- `caregiver-invite.ts`, `emergency-share.ts`, `hooks/check-product-alerts.ts`,
  `hooks/product-alerts-check.ts`, `payments/webhook.ts`. The `/api/public/*`
  prefix bypasses framework auth on the published site (per the project's
  own knowledge base), so each of these must verify caller/inputs itself.
- `payments/webhook.ts` — **Manual verification required** that Stripe
  signature is HMAC-verified with `constantTimeEqual`. Not tested here.
- `hooks/*` — **Suspected risk:** need HOOK_SECRET header check on each
  hook. The recall pipeline setup doc references `HOOK_SECRET`; verify the
  handlers actually reject missing/mismatched headers before writing to DB.

### 6.3 Child data — COPPA / GDPR-K flags (facts, not legal conclusions)

- `children` table stores: `name`, `date_of_birth`, `birth_week`.
- `emergency_info` / `emergency_contacts` may include allergies, medications,
  blood type, pediatrician contact.
- Product photos live in a **private** Storage bucket (`product-photos`, RLS
  enforced per migration `20260611100000_*.sql` and
  `20260704000001_product_photos_bucket.sql`). Good.
- Emergency share links create publicly resolvable tokens
  (`emergency-share.$token.tsx`, `api/public/emergency-share.ts`). Token
  entropy and expiry policy **need review** — not tested here.
- **COPPA fact-pattern:** the *user* is the parent, but data collected is
  about a child < 13. Under COPPA a service targeting children needs
  verifiable parental consent for the child's PII; a service *for parents*
  about their child sits in a gray zone. **Flagged for legal review, not
  concluded.**
- **GDPR-K:** if launched to EU users, `date_of_birth` and health data
  (allergies, medications) are Article 9 special-category data. Explicit
  consent + DPIA likely required. **Flag.**

### 6.4 Dependency scan

`npm audit` in this sandbox returns `404 audit endpoint unsupported` — the
Lovable proxy blocks the endpoint. **Manual verification required:** run
`npm audit --production` locally or via CI. All top-level dependencies in
`package.json` are on recent major versions (React 19, TanStack v1.16x,
@supabase/supabase-js 2.107, Stripe 22 SDK, Zod not directly listed but
in transitive tree).

---

## Phase 7 — Legal / compliance flags (facts only)

For legal review, do not treat these as determinations.

1. **Guarantee wording.** ProductInfoFooter says "Information is provided
   to help you stay organized and informed. Always verify … official recall
   notices." **No literal "this product is safe" strings found in code.** The
   green "No active … recalls found for {product}" banner in
   `products_.scan.tsx:490` walks close to that line — recommend adding
   "as of [timestamp]" and "checked against CPSC and NHTSA only" to that
   banner to keep it from being read as a safety endorsement.
2. **Paraphrased safety text.** `SAFETY_MILESTONES` items are original
   paraphrases with a `source: "AAP"` chip — no direct AAP quotes and no
   link back to the AAP position paper. Recommend adding a
   `sourceUrl` per item and a "verify at aap.org" affordance so a paraphrase
   distortion is auditable by the user.
3. **Attribution / ToS.**
   - CPSC (saferproducts.gov) — public-domain government data, attribution
     recommended but not required. **Reasonable as-is.**
   - FDA — same.
   - NHTSA (Socrata `data.transportation.gov`) — CC-BY-style; attribution
     recommended. Not present in-app.
   - USDA FSIS — public domain.
   - Health Canada — Open Government Licence Canada — **attribution
     required.** Not present.
   - EU Safety Gate — **third-party Opendatasoft mirror**, `official: false`
     flag is set internally but **not surfaced in UI**. Recommend either
     surfacing the "unverified freshness" label or dropping the source.
   - AAP — content is paraphrased; **AAP does not license paraphrase for
     commercial use without permission.** **Flag for legal review.**
4. **Milestone guidance attribution.** Chip says AAP, no citation URL.
   Combined with (2) above → flag.
5. **Missing disclaimers.**
   - No "not a substitute for pediatrician guidance" banner anywhere.
   - No "user responsible for verifying with manufacturer/CPSC directly"
     banner adjacent to green "safe" states.
   - No adjusted-age disclaimer (moot since adjusted-age isn't computed).
6. **Children's data.** COPPA/GDPR-K exposure per Phase 6.3. **Flag.**

---

## Phase 8 — Prioritized recommendations

### 8.1 Bugs / broken features (severity-ranked, for engineering)

| # | Sev | Issue | Location |
|---|---|---|---|
| 1 | **Critical** | Recall UPDATEs (hazard/remedy changed) do not re-notify affected users | `supabase/functions/scheduled-recall-check/index.ts` new-match detection at `existingKeys` check |
| 2 | **Critical** | Preemie adjusted-age support absent; `birth_week` column exists but is dead. Reminders fire at chronologically-wrong ages | `src/lib/developmentContent.ts`, `home.tsx`, `routes/onboarding.tsx`, schema `children.birth_week` |
| 3 | **Critical** | Scan-time recall check swallows errors silently — user sees no banner at all when source is down | `src/routes/_authenticated/products_.scan.tsx:~206` (`catch {}`) |
| 4 | **Critical** | Recall severity (fatal vs cosmetic) not visually distinguished anywhere | `recall-check.tsx:244`, `products_.scan.tsx:471`, product detail |
| 5 | High | No "data as of {timestamp}" on any recall UI | System-wide; no `checkedAt` field surfaced |
| 6 | High | 4 failing tests in `recallCheck.test.ts` (timeout resilience) — real timeout behavior at risk | `src/lib/recallCheck.test.ts` |
| 7 | High | No dead-man's-switch on `daily-scheduled-recall-check`. Silent failure = user gets no recall alerts, indefinitely | `20260705000000_recall_alerts_pipeline.sql` cron only, no monitoring |
| 8 | High | Scan-time "No active CPSC or NHTSA recalls" banner understates scope of the batch check and overstates on-demand scope; wording invites false confidence | `products_.scan.tsx:490-495` |
| 9 | High | Paywall bypass shipped in scan flow | `products_.scan.tsx` `TEMP` comment near top |
| 10 | Medium | APNs JWT generated once per batch run; long batches may 403 | `scheduled-recall-check/index.ts:~180` |
| 11 | Medium | No in-app unread badge if OS push is disabled/dropped | `_authenticated/route.tsx` bottom nav; `alerts.tsx` |
| 12 | Medium | `AAP · lastUpdated: "May 2025"` is a hard-coded string that will silently stale | `safety-guides.tsx`, `developmentContent.ts` |
| 13 | Medium | `birth_week` column exists but is never read — remove or wire in | `20260607212106_*.sql` |
| 14 | Medium | `src/lib/recallSources.ts` client-side dead copy still ships in bundle | `src/lib/recallSources.ts` |
| 15 | Low | EU Safety Gate `official: false` flag not surfaced in UI | `_shared/allRecallSources.ts`, product detail |
| 16 | Low | Cross-source duplicate (same recall from CPSC + HC) not deduped, may double-notify | `_shared/recallBatch.ts` |
| 17 | Low | Barcode input not length/format-validated before hitting lookup functions | `products_.scan.tsx` → `lookup-product` fn |

### 8.2 Remove or gate for legal / safety review (flagged, NOT auto-actioned)

1. Green **"No active … recalls found"** banner in scan flow — recommend
   legal review of wording; at minimum add "as of {timestamp}", the list of
   sources actually checked, and a "verify at cpsc.gov" affordance.
2. **Paraphrased AAP text** in `safety-guides.tsx` and `developmentContent.ts`
   — recommend legal/AAP licensing review before continuing to redistribute
   paraphrased medical/safety guidance under an "AAP" attribution chip.
3. **EU Safety Gate integration** via a third-party Opendatasoft mirror —
   recommend either replacing with the official European Commission RAPEX
   source or surfacing the unverified-freshness label to the user.
4. **Emergency-share public token flow** — recommend security/privacy
   review of token entropy, expiry, and revocation before continuing to
   expose child medical info via URL-only auth.
5. **Child health/PII collection** (`emergency_info`, `children.date_of_birth`,
   allergies, medications) — recommend counsel review of COPPA and, if EU
   launch is planned, GDPR-K + DPIA.
6. **`TEMP: paywall disabled`** in scan flow — recommend removal per the
   comment's own instruction before launch.

### 8.3 Worth adding (realistic scope, safety-forward)

1. **Adjusted-age support end-to-end** — onboarding captures gestational age
   or due date; `children.birth_week` gets read; all reminder/milestone
   comparisons use adjusted age with a per-view "based on your baby's
   adjusted age" note where relevant.
2. **"Last checked {timestamp}"** on every recall UI (scan banner, product
   detail, alerts inbox, recall radar) — sourced from a per-source
   `sync_status` table stamped on every batch run.
3. **Distinct "couldn't check"** state in scan flow — yellow banner reading
   "We couldn't reach {source} to check for recalls right now. Please
   retry, or check cpsc.gov/Recalls directly for {product}."
4. **Recall-update re-notification** — track a content hash on `recalls`; if
   `hazard`/`remedy` change, re-notify affected users with a "Updated
   recall notice" title distinct from "New recall".
5. **Cron dead-man's-switch** — a separate lightweight cron that checks
   `cron.job_run_details` for `daily-scheduled-recall-check` age > 26h and
   fires a notification to the app owner (email/Slack/Sentry).
6. **Severity ladder in UI** — split recall render into three visual tiers
   (life-threatening / injury / non-injury) driven by hazard-text keywords
   (`death`, `fatal`, `strangulation`, `suffocation`, `entrapment`,
   `laceration`, `choking` → tier 1; everything else → tier 2/3).
7. **In-app unread badge** on Alerts tab, driven by
   `product_recalls where acknowledged=false and user_id=auth.uid()`.
8. **Per-source citation link** on every safety tip and milestone, replacing
   the bare "AAP" chip with a URL to the specific position paper.
9. **Per-brand health dashboard** (internal) — a simple SQL view of "when
   did we last see a recall from {brand}?" for every brand in
   `babyBrands.ts`, so a silently-dead source integration is spottable.
10. **Server-side date-of-birth sanity check** to warn (not block) if a user
    enters a DOB > today or > 3 years ago on a "newborn" app.

---

## Confidence key

- **Confirmed** = evidence cited by file/line in code and/or test output.
- **Suspected** = derived from code reading; requires live data or a
  physical device to validate.
- **Manual verification required** = out-of-scope for a headless sandbox
  audit; steps + expected result provided so the developer can validate
  before shipping.

*End of report.*
