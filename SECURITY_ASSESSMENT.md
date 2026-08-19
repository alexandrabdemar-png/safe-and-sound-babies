# Peace of Mine — Authorized Security Assessment

Scope: owner-authorized testing of the development/preview environment and the
project's own backend. Read-only probing plus non-destructive write attempts
(all write attempts were verified to have changed zero rows).

Legend: **Fixed** (this assessment) · **Verified OK** · **Accepted risk / open**

---

## 1. Authentication

| Check | Result |
| --- | --- |
| Email/password sign-up rejects weak passwords (8-char minimum, friendly errors) | Verified OK |
| Anonymous sign-ups disabled | Verified OK |
| Google OAuth goes through the managed broker, `redirect_uri` is a public same-origin URL | Verified OK |
| Protected pages gated by the `_authenticated` layout (client-side `getUser()` + redirect) | Verified OK |
| Server-side identity always re-derived from the bearer token, never trusted from the client | Verified OK |
| One-time terms acceptance persisted per user | Verified OK |

## 2. Authorization / IDOR — live two-account test

Executed against the live backend using a real signed-in session and another
account's record IDs (obtained out-of-band, as an attacker with a leaked ID would):

| Attempt on another user's child record | Result |
| --- | --- |
| Read child row | `[]` — no data |
| Read their milestones | `[]` |
| Read their emergency/medical info | `[]` |
| Rename their child (PATCH) | 0 rows changed |
| Delete their child (DELETE) | 0 rows changed |
| Insert a row owned by another `user_id` | 403 — row-level policy violation |

Row-count comparison confirmed scoping rather than coincidence: the signed-in
account saw 1 of 4 children, 11 of 17 products, 1 of 11 profiles.

Server-side privilege gates (previously client-only) re-verified: child creation,
milestone/moment logging and data export all enforce the Pro check on the server,
so a modified client cannot bypass them.

## 3. Database access model (RLS + grants)

- Every user-data table has RLS enabled with `auth.uid()`-scoped policies. **Verified OK**
- **Fixed:** the not-signed-in (`anon`) role still held full table privileges on
  every app table — read *and* write. Row-level policies were blocking all of it
  (confirmed by test), so no data was exposed, but it left an unnecessary door
  open with RLS as the only barrier. All `anon` privileges are now revoked on all
  29 app tables; anonymous REST reads/writes return `401` and signed-in access is
  unaffected (re-tested after the change).
- Privileged (service-role) access is confined to `*.server.ts` modules and
  loaded inside handlers, never reachable from browser bundles. **Verified OK**
- Two `SECURITY DEFINER` helper functions (`has_child_access`, `has_product_access`)
  remain callable by signed-in users by design — they are the access-check
  primitives used inside policies and only ever answer "may *you* see this?".
  **Accepted risk (documented in security memory).**

## 4. Public API endpoints

| Endpoint | Result |
| --- | --- |
| Recall/product-alert hooks | Reject missing or wrong credentials (`401`), constant-time secret comparison. **Verified OK** |
| Payments webhook | Forged signature and stale timestamp both rejected (`400`); HMAC compared against the signing secret. **Verified OK** |
| Emergency share link | Token is 32 random bytes, stored only as a SHA-256 hash; invalid, expired and revoked tokens all return "invalid or has expired". **Verified OK** |
| AI product search | **Fixed** — was callable without a session (credit-burn / abuse vector) and accepted unbounded text. Now requires an authenticated session and caps the query at 100 characters. |

Remaining: the share-link endpoint has no per-IP throttle. Guessing a 256-bit
token is not feasible, so this is a rate-limit hardening item, not an exposure.

## 5. Input validation

**Fixed** — unbounded free-text fields now have server-side caps, closing a
storage-abuse / oversized-payload vector:

- child name — 80 characters
- moment title — 120 characters, notes — 2000 characters, icon key — 40 characters
- product search query — 100 characters

Already verified OK: barcode input is digit-only, restricted to the four valid
GTIN lengths with mod-10 check-digit verification; catalog search escapes
`%`, `_` and `\` so query text cannot alter the database filter.

## 6. Data exposure & minimization

- Error messages returned to the client are sanitized; log statements route
  through a redacting helper so child names, emails and IDs are not written to
  logs. **Verified OK**
- Product photos are stored in a **private** bucket with owner-folder upload
  policies. **Verified OK**
- Child date of birth and measurements are no longer read by any app code; the
  prepared purge migration is safe to apply as the final data-minimization step.
  **Open (one migration away).**

## 7. Secrets

- No secrets in the repository; `.env` files are git-ignored and contain only
  publishable values. **Verified OK**
- Service-role key and push signing key are backend-only and never referenced
  from browser code. **Verified OK**

## 8. Account deletion

Deletion removes the user's own records, cascades related rows, and purges their
storage objects. **Verified OK.** Contributed catalog rows and shared recall
data intentionally survive (de-identified) and this is disclosed in the privacy
policy.

## 9. Notifications

In-app recall alerts are per-user and RLS-scoped; push payloads carry no child
names or medical details. **Verified OK.**

---

## Open items (ranked)

1. Apply the pending purge migration to drop stored child birth dates and
   measurements (data minimization — code no longer needs them).
2. Add a per-IP throttle to the emergency share-link endpoint (hardening).
3. Two environment values (`VITE_PAYMENTS_CLIENT_TOKEN`) are absent locally,
   which fails one consistency test; not a security exposure.

No critical or high-severity exposure was found: every cross-account read and
write attempt against live data failed, and no user data was reachable without a
valid session.
