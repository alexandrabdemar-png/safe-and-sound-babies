# Recall pipeline setup checklist

Four things need to happen outside the code before daily recall checks and
push notifications actually run. Do them in order — each step needs the one
before it.

## ☐ Step 1 — Set a secret password for the app

Where: your hosting platform's environment variable settings (wherever this
app is deployed).

- [ ] Add a variable named `HOOK_SECRET`
- [ ] Set it to any long random string (like a strong Wi-Fi password) — you
      can generate one at <https://1password.com/password-generator/> or
      just mash the keyboard for 30+ characters
- [ ] Save it somewhere private — you'll type this exact value again in Step 2

## ☐ Step 2 — Tell the database your app's address + that password

Where: Supabase Dashboard → SQL Editor.

- [ ] Run this, replacing the two placeholders with your **real** app URL
      and the **exact same** password from Step 1:

  ```sql
  select vault.create_secret('https://YOUR-REAL-APP-URL', 'app_base_url');
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

Back in your hosting platform's environment variables (same place as Step 1),
add three more:

- [ ] `APNS_KEY_ID` = the Key ID from above
- [ ] `APNS_TEAM_ID` = your Team ID from above
- [ ] `APNS_KEY_P8` = paste the **entire contents** of the downloaded `.p8` file

Optional: if you're testing through TestFlight rather than the live App
Store, also add `APNS_ENVIRONMENT` = `sandbox`.

- [ ] Redeploy the app so it picks up the new environment variables

## Done?

- Steps 1–3 → daily recall sync + in-app alerts are live
- Step 4 too → push notifications to phones are live

If something isn't working, the most common culprits are: `HOOK_SECRET`
not matching exactly between Step 1 and Step 2, or forgetting to redeploy
after adding new environment variables.
