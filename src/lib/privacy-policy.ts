export const PRIVACY_POLICY_UPDATED = "June 11, 2026";

export const PRIVACY_POLICY = `Peace of Mine — Privacy Policy
Last updated: ${PRIVACY_POLICY_UPDATED}

We built Peace of Mine for parents who want to keep their children safe. This policy explains exactly what information we collect, why we need it, and how it is protected. Plain language only — no legalese.

──────────────────────────────────────
1. WHAT INFORMATION WE COLLECT
──────────────────────────────────────

About your child
• Name and date of birth — used to calculate age-appropriate product safety guidelines and predict clothing/diaper size-ups.
• Height and weight — used to generate size-up predictions and track growth milestones over time.
• Milestone notes — optional free-text notes you write about your child's development.

About your baby products
• Product name, brand, category, and barcode — used to match your products against the U.S. Consumer Product Safety Commission (CPSC) recall database and to surface expiry / size-up alerts.
• Manufacturer expiry date and purchase date — used to send you timely safety reminders.

About your account
• Email address — used to identify your account and send safety alert notifications.
• Subscription status — used to determine which features you have access to.

What we do NOT collect
• We do not collect your home address, phone number, or payment card details. Payment is processed entirely by Stripe; we never see or store your card number.
• We do not use advertising trackers or third-party analytics SDKs inside the app.

──────────────────────────────────────
2. WHY WE COLLECT IT (PURPOSES)
──────────────────────────────────────

Safety alerts — When the CPSC issues a recall, we automatically compare it against the products you have added. If there is a match, we alert you so you can act quickly. This is the core reason the app exists.

Size-up predictions — We use your child's measurements and age to predict when they are likely to outgrow a clothing size or diaper size, and remind you before you run out.

Milestone tracking — We store the growth measurements you record so you can see a history chart over time.

Bottle feeding logs — If you use the bottle-tracking feature, we store the times and amounts you record so you can spot feeding patterns.

App improvements — Aggregate, non-identifiable statistics (total number of users, total products tracked, total recalls flagged) help us understand whether the app is working. No individual data is included in these statistics.

──────────────────────────────────────
3. WHO CAN SEE YOUR DATA
──────────────────────────────────────

You — Only you can read your child's profile, measurements, and product list. Every database query is enforced by Supabase Row-Level Security, which means our own server code cannot return your rows to a different user.

Our team — Human team members (admins) can see only aggregate statistics: for example, "the app has 500 users and 1,200 products." Admins cannot query individual profiles, children's names, dates of birth, measurements, or product lists. This restriction is enforced at the database permission level, not just by policy.

Trusted processors — We share limited data with:
  • Supabase (database hosting, EU/US data centres) — stores your encrypted data.
  • Stripe (payment processing) — receives your email and payment details when you subscribe; Stripe's privacy policy applies to that data.
  • Lovable (app hosting platform) — hosts the application servers; does not have access to your database rows.

We do not sell, rent, or share your personal data with advertisers, data brokers, or any other third parties.

──────────────────────────────────────
4. HOW LONG WE KEEP YOUR DATA
──────────────────────────────────────

Your data is kept for as long as your account is active. If you delete your account (see Section 5), all of your personal data is permanently deleted from our database within 30 days.

Anonymised aggregate statistics (counts only, no personal data) may be retained indefinitely.

──────────────────────────────────────
5. HOW TO DELETE YOUR DATA
──────────────────────────────────────

You have full control over your data:

• Delete a child — Go to Profile → tap the trash icon next to the child's name. This permanently deletes that child's profile, all measurements, milestones, and associated product alerts.

• Delete your account and all data — Email us at privacy@peaceofmineapp.com with the subject line "Delete my account". We will permanently delete your account and all associated data within 30 days and confirm by email when complete.

• Export your data — Pro subscribers can download a complete JSON export of all their data at any time from the Profile page. Use this before requesting deletion if you want a copy.

──────────────────────────────────────
6. SECURITY
──────────────────────────────────────

• All data is transmitted over HTTPS. No unencrypted connections are used.
• Your database rows are protected by Row-Level Security; only your authenticated session can access them.
• Service keys that bypass RLS are used only for trusted system operations (recall syncing, alert generation, and Stripe webhook processing) and are never exposed to client code or human operators.
• Error logs are sanitised before storage; email addresses and tokens are stripped from log entries.

──────────────────────────────────────
7. CHILDREN'S PRIVACY
──────────────────────────────────────

Peace of Mine is an app for parents and caregivers to track their own children's data. The account holder must be 18 years of age or older. We do not knowingly collect personal information directly from children under 13.

──────────────────────────────────────
8. CHANGES TO THIS POLICY
──────────────────────────────────────

If we make a material change to this policy we will notify you via the email address on your account at least 14 days before the change takes effect.

──────────────────────────────────────
9. CONTACT
──────────────────────────────────────

Questions about this policy or your data? We are happy to help.

  Email: privacy@peaceofmineapp.com

We aim to respond within 48 hours.`;
