# Launch waitlist

Page: **https://peace-of-mine.lovable.app/waitlist**

TikTok bio link: **https://peace-of-mine.lovable.app/waitlist?ref=tiktok**

The `?ref=` tag records where each signup came from. Use a different tag per channel, for example `?ref=instagram` or `?ref=pinterest`.

## One-time setup

1. **Merge the changes on GitHub**, then open the project in Lovable.
2. **Create the database table.** The changes include `supabase/migrations/20261102120000_waitlist_signups.sql`.
   - If Lovable asks to apply or approve a database migration, approve it.
   - Otherwise, open the Supabase SQL Editor (or Lovable's **Cloud → Database → SQL**), paste the whole file and run it.
3. **Publish in Lovable** (**Publish → Update**).
4. **Test it:** open the page on your phone and join with your own email. In Supabase, open **Table Editor → `waitlist_signups`**, and your row should be there.

Until step 2 is done, the form shows "We couldn't add you just now" and the signup count stays hidden.

## Seeing and exporting signups

Go to Supabase → **Table Editor → `waitlist_signups`** → **Export → CSV**. The columns are email, first name, baby's stage, source (for example `tiktok`), consent and time.

The list is private. The public page can only add signups, and can only read the total number.

## How it behaves

- "Join N parents already waiting" appears once there are 25 or more signups.
- Signing up twice with the same email shows success both times but stores only one row. Because of this, the page never reveals whether an email is already on the list.
- A hidden field catches basic spam bots.
- People must tick the "Email me when Peace of Mine launches" box, and that consent is stored.
- The Privacy Policy now has a "Waitlist" section.
- When you email the list at launch, include an unsubscribe link (required in the US by CAN-SPAM, and in the EU/UK by GDPR).
