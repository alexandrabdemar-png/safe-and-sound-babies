## What we're building

Turn Safe & Sound from a passive tracker into a proactive guide. Parents enter their child's basics + the gear they own; the app generates time-based reminders ("approaching infant car seat max height", "lower the crib mattress", "babyproof lower cabinets", etc.).

## 1. Child profile — add measurements

Birthdate already exists on `children`. Add:

- `height_cm` (optional, numeric)
- `weight_kg` (optional, numeric)
- `measurements_updated_at` (timestamp, used to nudge re-measure every ~4 weeks)

Edit screens:
- Onboarding "Add child" step — optional Height / Weight inputs (cm/kg with lb/in toggle)
- Child profile page — same fields, plus an "Update measurements" CTA

## 2. Product categories — launch 10

Replace the current mixed list with exactly these 10, in this order:

1. Car seat
2. Crib
3. Bassinet
4. Stroller
5. High chair
6. Swing
7. Bouncer
8. Activity center
9. Sleep sack
10. Baby gate

What this means for existing code:
- Remove from the "products" picker: Pacifier, Formula, Breast milk, Swaddle, Toothbrush, Pack 'n Play, Carrier  
  (Pacifier / Toothbrush / Swaddle still get replacement logic if a user has legacy records — we keep the rules, just hide them from new-product UI)
- Bottle flow (formula / breastmilk freshness) is unchanged — that's its own surface
- Add Sleep sack (replaces Swaddle in product UI, similar size-up logic), Bassinet, Stroller, High chair, Activity center, Baby gate (re-added)
- Generate icons/assets for the new categories that don't have them yet

## 3. Predictive guidance engine

A single `insights` derivation that runs on the client (and a nightly cron for push-ready alerts later) which combines:

- Child age (from birthdate)
- Child height/weight (if provided)
- Products owned + their category + purchase date
- General age-based milestones (babyproofing, mattress lowering, etc.)

### Rule catalog (v1)

Age-based (no product needed):
- 4 mo → "Begin babyproofing — outlet covers, cabinet locks, anchor furniture"
- 6 mo → "Lower the crib mattress to the middle setting"
- 8 mo → "Babyproof lower cabinets — Peyton is likely pulling to stand soon"
- 9 mo → "Install baby gates at stairs"
- 12 mo → "Lower the crib mattress to the lowest setting"
- 15 mo → "Most pediatricians recommend front-facing car seat after 2 — keep rear-facing for now"

Product + age:
- Car seat + age ≥ 9 mo OR height ≥ 75 cm (29.5") → "Approaching maximum height for infant car seat. Start researching convertible seats."
- Car seat + age ≥ 12 mo → "Check infant car seat weight limit — typical max is 30-35 lb"
- Bassinet + age ≥ 4 mo → "Most bassinets are outgrown by 4-6 months. Plan crib transition."
- Sleep sack + last size-up > 90 days OR weight crossing band threshold → "Sleep sack likely needs sizing up in ~4 weeks"
- Swing + age ≥ 6 mo → "Most babies outgrow the swing around 6 months"
- Bouncer + age ≥ 6 mo OR weight ≥ 9 kg (20 lb) → "Approaching bouncer weight limit"
- High chair + age ≥ 6 mo + no high chair owned → "Time to think about a high chair — solids usually start ~6 mo"
- Baby gate + age ≥ 7 mo + no gate owned → "Crawling is around the corner — install gates at stairs"
- Activity center + age 4-10 mo + none owned → "Activity centers are great between 4-10 months"

Stale-measurement nudge:
- `measurements_updated_at` > 30 days → soft prompt on home: "Update Peyton's height & weight for better recommendations"

### Where insights show up

- **Home screen** — top "Up next" card surfacing the 1-3 most urgent insights
- **Insights page** (already exists) — full list grouped by urgency: Now / Soon / Heads-up
- Each insight: title, body, "Mark as done" / "Snooze 1 week" / "Not relevant" actions stored in a new `insight_dismissals` table so we don't re-nag

## 4. Data changes

```text
children:
  + height_cm           numeric null
  + weight_kg           numeric null
  + measurements_updated_at  timestamptz null

insight_dismissals (new):
  user_id, child_id, rule_id, action ('done'|'snoozed'|'dismissed'), until timestamptz
```

RLS: standard "own rows only" for both, GRANTs to authenticated + service_role.

## 5. Files we'll touch

New:
- `src/lib/insights.ts` — rule engine + helpers (`evaluateInsights(child, products): Insight[]`)
- `supabase/migrations/<ts>_child_measurements_insights.sql`
- `src/assets/cat-bassinet.png`, `cat-stroller.png`, `cat-highchair.png`, `cat-activitycenter.png`, `cat-sleepsack.png`, `cat-gate.png` (regenerate)

Edit:
- `src/routes/onboarding.tsx` — add height/weight inputs to child step + update category showcase
- `src/routes/_authenticated/profile.tsx` (or child edit) — measurements editor
- `src/routes/_authenticated/products.new.tsx` + `products.scan.tsx` — new category list
- `src/routes/_authenticated/insights.tsx` — render rule output, dismissal actions
- `src/routes/_authenticated/home.tsx` — top "Up next" card
- `src/routes/index.tsx` — landing category showcase to the new 10

## Out of scope for this pass

- Push notifications (alerts are in-app only for now; rules are already structured so we can wire a nightly cron later)
- Imperial/metric global setting (we'll show both inline)
- Per-product custom thresholds
