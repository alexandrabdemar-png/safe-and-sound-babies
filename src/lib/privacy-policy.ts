import { SUPPORT_EMAIL } from "@/lib/constants";

export const PRIVACY_POLICY_UPDATED = "August 21, 2026";

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
• Product name, brand, category, and barcode — used to match your products against public recall databases (see Section 3) and to surface expiration / replacement alerts.
• Product photos (optional) — if you attach a photo to a product, the image file is stored in our private storage bucket. It is not public, and there is no public URL for it: only you, the account holder who uploaded it, can view it. (Caregivers you've shared a child with can currently see that child's product list but not an attached photo — we plan to extend photo access to caregivers, but it is not built yet.) Photos are deleted when you delete your account.
• Manufacturer expiration date and purchase date — used to send you timely safety reminders.

About your account
• Email address — used to identify your account and send safety alert notifications.
• Subscription status — used to determine which features you have access to.
• Push notification identifiers (optional) — if you enable notifications, we store a device token (iOS) or browser push subscription (web) so we can deliver safety alerts to that device. This is removed automatically if delivery ever fails permanently (for example, if you uninstall the app), or immediately when you delete your account. Turning off individual alert categories in the app's notification settings does not delete the stored token — it only stops that category of alert from being sent to it.
• Home safety profile (optional) — details like whether your home has stairs, pets, a pool, or a car, used only to tailor which safety suggestions we show you.
• Feedback and bug reports (optional) — if you use the in-app feedback form, the message you write is emailed to our support inbox together with your account email address and the app version. Because it becomes an email in our support inbox, it is not stored in your account record and is not removed by deleting your account (see Section 4).
• Caregiver invites (optional, Pro feature) — if you invite a co-parent, grandparent, or nanny to share access to a child's profile, we store the invitee's email address and send them an invite link. The link expires after 7 days if not accepted.

What we do NOT collect
• We do not collect your own home address or payment card details. Payment is processed entirely by Stripe (web) or Apple (Pro purchased from the iOS app); we never see or store your card number.
• We do not use advertising trackers or third-party analytics SDKs inside the app.

──────────────────────────────────────
2. WHY WE COLLECT IT (PURPOSES)
──────────────────────────────────────

Safety alerts — When a recall is published by any of the official sources listed in Section 3, we compare it against the products you have added. If there is a match, we send you an alert. This is the core reason the app exists.

Milestone-based guidance — We use the milestones you log (not a stored birthdate) to time babyproofing and gear-check reminders to the developmental stage your child has actually reached.

Replacement reminders — For products like car seats, we use the product's own added date and the manufacturer's stated replacement interval — not any information about your child — to remind you when it may be time to replace it.

Bottle feeding logs — If you use the bottle-tracking feature, we store the times and amounts you record so you can spot feeding patterns.

App improvements — Aggregate, non-identifiable statistics (total number of users, total products tracked, total recalls flagged) help us understand whether the app is working. No individual data is included in these statistics.

──────────────────────────────────────
3. WHO CAN SEE YOUR DATA
──────────────────────────────────────

You — Only you can read your child's profile, milestones, and product list. Every database query is enforced by Supabase Row-Level Security, which means our own server code cannot return your rows to a different user.

Caregivers you invite — If you use the Pro caregiver-sharing feature to invite a co-parent, grandparent, or nanny, that person can view and edit the profile, products, milestones, and alerts for the children you share with them, once they accept the emailed invite. You choose which children to share and can grant either edit or view-only access. Invite links expire after 7 days if unused.

Our team — Human team members (admins) can see only aggregate statistics: for example, "the app has 500 users and 1,200 products." Admins cannot query individual profiles, children's names, milestones, or product lists. This restriction is enforced at the database permission level, not just by policy.

Where recall data comes from — We read recall notices from public government sources: the U.S. Consumer Product Safety Commission (CPSC), the U.S. National Highway Traffic Safety Administration (NHTSA) and its recall dataset on data.transportation.gov, the USDA Food Safety and Inspection Service, Health Canada (recalls-rappels.canada.ca), and the EU Safety Gate (ec.europa.eu). We only read from these sources — nothing about you or your child is ever sent to them.

Where barcode lookups go — When you scan a barcode, the barcode number alone (never your name, your child's data, or your account email) is sent to third-party product-identification services to find the product's name and brand: Barcode Lookup, Barcode Spider, UPCitemdb, Go-UPC, Open Food Facts, and Open Beauty Facts. If a lookup succeeds, the resulting product name/brand/barcode is cached in our shared product catalog so future scans of the same item are faster. That cache entry contains no information about you and is not tied to your account.

Trusted processors — We share limited data with:
  • Resend (transactional email) — delivers caregiver invites, feedback emails, and safety-alert emails on our behalf; receives the recipient email address and message contents.
  • Supabase (database hosting, EU/US data centres) — stores your encrypted data.
  • Stripe (payment processing for purchases made on the web) — receives your email and payment details when you subscribe outside the iOS app; Stripe's privacy policy applies to that data.
  • Lovable (app hosting platform) — hosts the application servers, and its AI Gateway relays product-search text to an AI model (see below) on our behalf; does not have access to your database rows.
  • Google — if you search for a product, your search text is sent through Lovable's AI Gateway to Google's Gemini model to help find matching products. If you choose "Sign in with Google," Google shares your account email/profile with us per Google's own privacy policy.
  • Anthropic — for Pro subscribers, a product's name and category (never your child's data) are sent to Anthropic's Claude model to look up safety guidelines for that product.
  • Apple — if you choose "Sign in with Apple," or if you use the app on iOS with notifications enabled, Apple shares your account email (Sign in with Apple) or delivers push notifications (Apple Push Notification service) on our behalf. If you subscribe to Pro from the iOS app, Apple also processes that payment as the merchant of record: Apple, not us, collects your payment details, and Apple's own privacy policy applies to that transaction. We receive only your subscription status and an Apple-assigned transaction identifier — never your card details.
  • Your browser's push service (e.g. Google, Mozilla, or Microsoft, depending on your browser) — if you enable notifications on the web, delivers the notification on our behalf; it only ever sees an encrypted payload, not its contents.

We do not sell, rent, or share your personal data with advertisers, data brokers, or any other third parties.

──────────────────────────────────────
4. HOW LONG WE KEEP YOUR DATA
──────────────────────────────────────

Your data is kept for as long as your account is active. If you delete your account (see Section 5), your account, all of your children's profiles, milestones, products, medical/emergency info, food and bottle logs, caregiver grants and invites, subscription record, notification tokens, and uploaded product photos are permanently deleted immediately.

Encrypted database backups are retained on a rolling 7-day window by our hosting provider, and server logs on a rolling 7-day window. Deleted data can therefore persist in a backup for up to 7 days after deletion, after which the backup itself expires. Backups are used only for disaster recovery.

What is NOT removed by deleting your account:
• Feedback and bug reports you sent us — these are emailed to our support inbox and also stored in our feedback table. Deleting your account unlinks the feedback from you (your user ID is removed), but the message text remains. Email ${SUPPORT_EMAIL} and we will delete the message itself on request.
• Shared product-catalog entries created by a barcode scan — these hold only a product's name, brand, barcode, and category, contain nothing about you or your child, and are not linked to your account.
• Anonymised aggregate statistics (counts only, no personal data), which may be retained indefinitely.

──────────────────────────────────────
5. HOW TO DELETE YOUR DATA
──────────────────────────────────────

You have full control over your data:

• Delete a child — Go to Profile → tap the trash icon next to the child's name. This permanently deletes that child's profile, all milestones, and associated product alerts.

• Delete your account and all data — Go to Profile → Our Privacy Promise → Delete my account. This immediately and permanently deletes your account, all associated data, your uploaded product photos, and cancels any active subscription — no email required. See Section 4 for the two narrow categories this does not cover. If you'd rather request deletion by email instead, you can also write to ${SUPPORT_EMAIL} with the subject line "Delete my account".

• Export your data — Pro subscribers can download a complete JSON export of all their data at any time from the Profile page. Use this before requesting deletion if you want a copy.

──────────────────────────────────────
6. SECURITY
──────────────────────────────────────

• All data is transmitted over HTTPS. No unencrypted connections are used.
• Your database rows are protected by Row-Level Security; only your authenticated session can access them.
• Service keys that bypass RLS are used only for trusted system operations (recall syncing, alert generation, and Stripe webhook processing) and are never exposed to client code or human operators.
• Uploaded product photos are held in a private storage bucket. There is no public URL: access is checked per request against the same Row-Level Security rules as the rest of your data, so only you, the uploader, can retrieve an image (caregiver access to photos is not yet built — see Section 1).
• Error logs are sanitised before storage; email addresses, tokens, and other identifiers are stripped from log entries.

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
