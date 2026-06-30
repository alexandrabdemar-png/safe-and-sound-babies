# Peace of Mine — App Store Screenshot Guide

## Required Device Sizes

| Device | Resolution | App Store Slot |
|---|---|---|
| iPhone 15 Pro Max (6.7") | 1290 × 2796 px | 6.7-inch display |
| iPhone 8 Plus (5.5") | 1242 × 2208 px | 5.5-inch display |

Take screenshots in **portrait orientation** on a real device or Xcode Simulator at the exact resolutions above. Both device sizes are required by App Store Connect.

---

## Required Screenshots (6 screens)

### 1. Home Screen — Today Card
**File name:** `01-home-today.png`
**Caption:** "Your daily safety snapshot — always one step ahead."
**Setup:** Log in with a child added and at least one safety tip visible in the Today card. The pool safety tip or a recall nudge works well.
**Notes:** Show the "Good morning" header with child name, the Today card, and the safety tip row. Do not show any empty states.

---

### 2. Products Screen — Product List
**File name:** `02-products-list.png`
**Caption:** "Track every baby product — get instant recall alerts."
**Setup:** Add at least 3 products across different categories (e.g. a car seat, a stroller, and a pacifier). Show the recall-safe badges.
**Notes:** Include at least one product with a green safety badge visible. Avoid showing any recall alerts here — save that for screenshot 3.

---

### 3. Recall Alert Modal
**File name:** `03-recall-alert.png`
**Caption:** "Real-time recall alerts — we check every product you own."
**Setup:** Trigger the recall alert modal by adding a product that matches a known recall, or use a demo account with a flagged product. The modal should show the product name, recall reason, and the "What to do" guidance.
**Notes:** This is the most important screenshot for communicating safety value. The modal should be fully open and readable.

---

### 4. Add Product Form
**File name:** `04-add-product.png`
**Caption:** "Add any baby essential in seconds — we do the safety checks."
**Setup:** Open the Add Product form with the category picker visible and a product name partially typed. The form should look active, not blank.
**Notes:** Show the category icons grid or the name/brand fields with realistic example content (e.g. "Graco 4Ever" or "Chicco KeyFit").

---

### 5. Moments Timeline
**File name:** `05-moments-timeline.png`
**Caption:** "Every milestone, beautifully kept in your Memory Book."
**Setup:** Log at least 4 moments across different types (First, Funny, Milestone). The timeline should show the colored type badges and dates.
**Notes:** Show a mix of moment types with their emoji dots on the timeline line. Include at least one with a note visible.

---

### 6. Pricing / Pro Screen
**File name:** `06-pricing.png`
**Caption:** "Safety is always free. Upgrade for expert features."
**Setup:** Navigate to the pricing screen. Both Free and Pro plan cards should be fully visible.
**Notes:** Highlight the Pro card with the Sparkles badge. The "7-day free trial" badge should be visible on the Pro plan.

---

## Screenshot Workflow

1. Build and install the app on Simulator or a physical device.
2. Sign in with the demo/test account that has sample data.
3. For each screen above:
   a. Navigate to the screen.
   b. Take a screenshot (⌘+S in Simulator, or side button + volume up on device).
   c. Export at native resolution — do NOT scale down.
4. Upload to App Store Connect under each app version → Screenshots → select device size.
5. Drag to reorder: screenshots appear in the order shown in App Store, so use the numbered sequence above.

## Caption Text for App Store Listing

Use the captions above as the **screenshot subtitle text** in App Store Connect (field below each screenshot slot). Keep them under 100 characters each.

## App Preview Video (optional but recommended)

If adding an App Preview video (15–30 seconds), show the following flow:
1. Home screen → tap a safety tip
2. Products screen → tap Add → fill form → see safety check
3. Moments screen → scroll the timeline

Video resolution must match the screenshot size for each device slot.
