# Caregiver Card — archived, not launching with it

This was a live route at `/caregiver-card` (`src/routes/_authenticated/caregiver-card.tsx`):
a printable/shareable card for a babysitter or caregiver with the active
child's allergies, medications, pediatrician, bedtime/nap routines, and
feeding notes, pulled from the `children` and `emergency_contacts` tables.

Pulled out before launch (not deleted) — no other route linked to it at
the time of archiving, so removing it required no other changes anywhere
else in the app. It didn't have its own database table, so there's no
migration to worry about restoring either.

## To restore

1. `git mv archive/caregiver-card/caregiver-card.tsx src/routes/_authenticated/caregiver-card.tsx`
2. Delete this directory (`git rm -r archive/caregiver-card`).
3. Run a build (`npm run build` or `npm run dev`) so TanStack Start's
   router plugin regenerates `src/routeTree.gen.ts` to include the route
   again — don't hand-edit that file.
4. Decide where it should be linked from (it had no nav entry point when
   archived — profile.tsx and home.tsx are the two obvious candidates).
