import { SUPPORT_EMAIL } from "@/lib/constants";

export const PRIVACY_POLICY_UPDATED = "August 18, 2026";

export const PRIVACY_POLICY = `Peace of Mine — Privacy Policy
Last updated: ${PRIVACY_POLICY_UPDATED}

We built Peace of Mine for parents who want to keep their children safe. This policy explains exactly what information we collect, why we need it, and how it is protected. Plain language only — no legalese.

──────────────────────────────────────
1. WHAT INFORMATION WE COLLECT
──────────────────────────────────────

About your child
• Name — used to personalize the app and label the moments and products you log.
• Milestones you log (e.g. rolling, sitting, crawling, first steps) — used to time safety reminders to the developmental stage your child has actually reached, not a stored birthdate. We do not collect or store your child's date of birth, height, or weight.
• Milestone notes — optional free-text notes you write about your child's development.
• Emergency and medical info (optional) — if you fill out the Emergency Info card, we store allergies, medications, blood type, and the name/phone number of your pediatrician and an emergency contact. This is stored only for your own quick reference (and on a shareable link you explicitly choose to create) — we do not use it for any other purpose.
• Food and allergen notes (optional) — if you use the Starting Solids tracker, we store which foods you've introduced, whether you've flagged one as an allergen, and any reaction notes you write.

About your baby products
• Product name, brand, category, and barcode — used to match your products against the U.S. Consumer Product Safety Commission (CPSC) recall database and to surface expiration / replacement alerts.
• Manufacturer expiration date and purchase date — used to send you timely safety reminders.

About your account
• Email address — used to identify your account and send safety alert notifications.
• Subscription status — used to determine which features you have access to.
• Push notification identifiers (optional) — if you enable notifications, we store a device token (iOS) or browser push subscription (web) so we can deliver safety alerts to that device. Turning notifications off removes this.
• Home safety profile (optional) — details like whether your home has stairs, pets, a pool, or a car, used only to tailor which safety suggestions we show you.

What we do NOT collect
• We do not collect your own home address or payment card details. Payment is processed entirely by Stripe; we never see or store your card number.
• We do not use advertising trackers or third-party analytics SDKs inside the app.

──────────────────────────────────────
2. WHY WE COLLECT IT (PURPOSES)
──────────────────────────────────────

Safety alerts — When the CPSC issues a recall, we compare it against the products you have added. If there is a match, we send you an alert. This is the core reason the app exists.

Milestone-based guidance — We use the milestones you log (not a stored birthdate) to time babyproofing and gear-check reminders to the developmental stage your child has actually reached.

Replacement reminders — For products like car seats, we use the product's own added date and the manufacturer's stated replacement interval — not any information about your child — to remind you when it may be time to replace it.

Bottle feeding logs — If you use the bottle-tracking feature, we store the times and amounts you record so you can spot feeding patterns.

App improvements — Aggregate, non-identifiable statistics (total number of users, total products tracked, total recalls flagged) help us understand whether the app is working. No individual data is included in these statistics.

──────────────────────────────────────
3. WHO CAN SEE YOUR DATA
──────────────────────────────────────

You — Only you can read your child's profile, milestones, and product list. Every database query is enforced by Supabase Row-Level Security, which means our own server code cannot return your rows to a different user.

Our team — Human team members (admins) can see only aggregate statistics: for example, "the app has 500 users and 1,200 products." Admins cannot query individual profiles, children's names, milestones, or product lists. This restriction is enforced at the database permission level, not just by policy.

Trusted processors — We share limited data with:
  • Supabase (database hosting, EU/US data centres) — stores your encrypted data.
  • Stripe (payment processing) — receives your email and payment details when you subscribe; Stripe's privacy policy applies to that data.
  • Lovable (app hosting platform) — hosts the application servers, and its AI Gateway relays product-search text to an AI model (see below) on our behalf; does not have access to your database rows.
  • Google — if you search for a product, your search text is sent through Lovable's AI Gateway to Google's Gemini model to help find matching products. If you choose "Sign in with Google," Google shares your account email/profile with us per Google's own privacy policy.
  • Anthropic — for Pro subscribers, a product's name and category (never your child's data) are sent to Anthropic's Claude model to look up safety guidelines for that product.
  • Apple — if you choose "Sign in with Apple," or if you use the app on iOS with notifications enabled, Apple shares your account email (Sign in with Apple) or delivers push notifications (Apple Push Notification service) on our behalf.
  • Your browser's push service (e.g. Google, Mozilla, or Microsoft, depending on your browser) — if you enable notifications on the web, delivers the notification on our behalf; it only ever sees an encrypted payload, not its contents.

We do not sell, rent, or share your personal data with advertisers, data brokers, or any other third parties.

──────────────────────────────────────
4. HOW LONG WE KEEP YOUR DATA
──────────────────────────────────────

Your data is kept for as long as your account is active. If you delete your account (see Section 5), all of your personal data is permanently deleted from our database immediately.

Anonymised aggregate statistics (counts only, no personal data) may be retained indefinitely.

──────────────────────────────────────
5. HOW TO DELETE YOUR DATA
──────────────────────────────────────

You have full control over your data:

• Delete a child — Go to Profile → tap the trash icon next to the child's name. This permanently deletes that child's profile, all milestones, and associated product alerts.

• Delete your account and all data — Go to Profile → Our Privacy Promise → Delete my account. This immediately and permanently deletes your account and all associated data — no email required. If you'd rather request deletion by email instead, you can also write to ${SUPPORT_EMAIL} with the subject line "Delete my account".

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

If we make a material change to this policy we will show a notice in the app at least 14 days before the change takes effect.

──────────────────────────────────────
9. CONTACT
──────────────────────────────────────

Questions about this policy or your data? We are happy to help.

  Email: ${SUPPORT_EMAIL}

We aim to respond within 48 hours.`;
