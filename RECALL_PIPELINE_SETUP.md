# Recall pipeline setup checklist

Five things need to happen outside the code before daily recall checks and
push notifications actually run. Do them in order — each step needs the one
before it.

## ☑ Step 0 — Publish the app so it has a web address

Done — the project's web address is:

```
https://peace-of-mine.lovable.app
```

(This is already filled into Step 2 below. If you rename the project again
later, the address changes too — come back and update Step 2 with the new one.)

## ☐ Step 1 — Set a secret password for the app

Where: Lovable's project settings — look for a "Secrets" or "Environment
Variables" panel (this is Lovable's own settings, not a separate service).

- [ ] Add a variable named `HOOK_SECRET`
- [ ] Set it to any long random string (like a strong Wi-Fi password) — you
      can generate one at <https://1password.com/password-generator/> or
      just mash the keyboard for 30+ characters
- [ ] Save it somewhere private — you'll type this exact value again in Step 2

## ☐ Step 2 — Tell the database your app's address + that password

Where: Supabase Dashboard → SQL Editor.

- [ ] Run this, replacing only the second placeholder with the **exact same**
      password from Step 1 (the URL is already filled in):

  ```sql
  select vault.create_secret('https://peace-of-mine.lovable.app', 'app_base_url');
  select vault.create_secret('YOUR-REAL-HOOK-SECRET', 'hook_secret');
  ```

- [ ] If you already ran this once with placeholder/example text instead of
      real values, clean it up first:

  ```sql
  delete from vault.secrets where name = 'app_base_url';
  delete from vault.secrets where name = 'hook_secret';
  ```

  ...then re-run the `create_secret` block above with your real values.

⚠️ Don't paste your actual password into a chat, doc, or anywhere public —
type it straight into the Supabase SQL editor.

## ☐ Step 3 — Make sure the daily alarm clock is switched on

Where: Supabase Dashboard → Database → Extensions.

- [ ] Confirm `pg_cron` is enabled (the migration tries to turn it on
      automatically — this is just the manual backup if that failed)
- [ ] Confirm `pg_net` is enabled (needed to make outbound web requests —
      this one should already be on from an earlier migration)

Once Steps 1–3 are done: recall checks and in-app alerts run automatically,
every day. Nothing else is needed for that part.

## ☐ Step 4 — Apple push notifications (optional — only needed for phone alerts, not in-app ones)

Requires an Apple Developer account ($99/year if you don't have one).

- [ ] Go to the Apple Developer site → Certificates, Identifiers & Profiles → Keys
- [ ] Click "+", name it anything, check "Apple Push Notifications service (APNs)", create it
- [ ] Download the `.p8` key file **now** — Apple only lets you download it once
- [ ] Note the **Key ID** shown on that page
- [ ] Note your **Team ID** (Apple Developer account → Membership page)

Back in Lovable's Secrets/Environment Variables panel (same place as Step 1),
add three more:

- [ ] `APNS_KEY_ID` = the Key ID from above
- [ ] `APNS_TEAM_ID` = your Team ID from above
- [ ] `APNS_KEY_P8` = paste the **entire contents** of the downloaded `.p8` file

Optional: if you're testing through TestFlight rather than the live App
Store, also add `APNS_ENVIRONMENT` = `sandbox`.

- [ ] Redeploy the app so it picks up the new environment variables

## Done?

- Steps 1–3 → in-app size-up/replacement alerts are live
- Step 4 too → push for size-up/replacement reminders is live
- Step 5 below → recall detection + recall notifications are live (this
  moved to its own pipeline, see why below)

If something isn't working, the most common culprits are: `HOOK_SECRET`
not matching exactly between Step 1 and Step 2, or forgetting to redeploy
after adding new environment variables.

## ☐ Step 5 — Recall detection (its own Supabase Edge Function)

Recall checking used to be two of the jobs covered by Steps 1–3. It's now a
single Supabase Edge Function (`scheduled-recall-check`) instead, so it
needs its own deploy + its own secrets — it runs on Supabase's infrastructure,
not inside this app, which matters for where you paste the Apple push keys
below (a different place than Step 4, even though it's the same three values).

1. **Deploy the function** (via the Supabase CLI, or ask Lovable to deploy it
   — see the message earlier in this session for exact wording):
   ```
   supabase functions deploy scheduled-recall-check
   ```

2. **Tell the database how to call it** — Supabase Dashboard → SQL Editor:
   ```sql
   select vault.create_secret('https://<your-project-ref>.supabase.co/functions/v1', 'edge_functions_base_url');
   select vault.create_secret('<service role key — Project Settings > API>', 'edge_functions_service_key');
   ```
   Find `<your-project-ref>` in your Supabase project URL. The service role
   key is a secret — never share it or commit it; paste it directly into the
   SQL editor.

3. **(Optional) Push notifications for recalls** — same three Apple values
   as Step 4, but set as **Supabase Edge Function secrets** this time (Supabase
   Dashboard → Edge Functions → scheduled-recall-check → Secrets, or via the
   CLI: `supabase secrets set APNS_KEY_ID=... APNS_TEAM_ID=... APNS_KEY_P8=...`).
   Setting them in Lovable's own panel (Step 4) does NOT cover this function —
   it runs on Supabase, not inside the app.

4. **(Optional) Email fallback for users with no push token set up** — set
   `RESEND_API_KEY` (from a [Resend](https://resend.com) account) and
   `NOTIFY_FROM_EMAIL` (a verified sending address) the same way as the Apple
   keys above. Nobody has configured or tested this yet — it's new. Without
   it, affected users with no device token just don't get notified until
   they set up push (the recall match itself is still recorded either way,
   so nothing is lost, it's only delivery that's skipped).

Without step 5, recalls are no longer checked or notified at all — the two
hooks that used to do this were removed. Steps 1–3 remain required for the
unrelated size-up/replacement reminders, which are unaffected by this change.
