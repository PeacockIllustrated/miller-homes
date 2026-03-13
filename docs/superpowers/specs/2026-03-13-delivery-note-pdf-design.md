# Delivery Note PDF — Design Spec

**Date:** 2026-03-13
**Status:** Approved

## Goal

Generate a professional, printable PDF delivery note for every order and send it as an attachment on the team notification email via the Make.com webhook. The delivery note mirrors the order confirmation email's visual style but excludes prices and includes two handwritten signature blocks (Delivered By / Received By).

## Requirements

1. **PDF generated server-side** using `@react-pdf/renderer` in the Next.js API route during order submission.
2. **Visual style matches the order confirmation email** — navy header, green order box, product image thumbnails, same typography and colour palette.
3. **No prices** — no unit price, line total, subtotal, VAT, or total columns/rows.
4. **Product images embedded** — fetched from `/images/products/{baseCode}.png` and included as thumbnails in each item row.
5. **Custom sign items** — displayed with colour-coded type badge (warning/prohibition/mandatory/etc.), shape, size, and text content. Same visual treatment as the email.
6. **Custom field values** — displayed below product name, same as email.
7. **Two signature blocks** at the bottom:
   - "Delivered By" — Name, Signature, Date (blank lined fields)
   - "Received By" — Name, Signature, Date (blank lined fields)
8. **Onesign branding** — icon mark from `shop/assets/icon.svg` (the "O" mark, not the full wordmark from `Logo.svg` which is too complex for SVG primitives), rendered via `@react-pdf/renderer`'s `<Svg>`/`<Path>` primitives. Company address and phone in header. Note: the shop is Persimmon-branded but delivery notes are Onesign-branded since Onesign is the fulfilment company.
9. **A4 portrait**, printable with sensible margins.
10. **Attached to team email** — base64-encoded PDF sent in the Make webhook payload as `deliveryNotePdf`. Make.com scenario reads this field and attaches it as `Delivery-Note-{orderNumber}.pdf`.

## PDF Layout

### Header
- Full-width navy (#00474a) bar
- Onesign logo (white) on the left, rendered using SVG path primitives
- "DELIVERY NOTE" title on the right in white, bold
- Below the bar: "Onesign and Digital | D86 Princesway, Gateshead NE11 0TU | 0191 487 6767" in small grey text

### Order Info
- Light green (#f8faf9) rounded box containing:
  - Order number in bold navy (#00474a), large font
  - Date of order
- Below the box, two columns:
  - **Site:** site name (bold) + address
  - **Contact:** contact name (bold) + phone
- PO number line (if present)

### Items Table
- Column headers: Image | Product | Qty
- Each row:
  - 40x40 product image thumbnail (rounded corners)
  - Product code (bold), name, size on separate lines
  - Custom field values in green below name (if present)
  - Quantity (centred)
- Custom sign rows: colour-coded badge instead of image, "CUSTOM SIGN REQUEST" label, type/shape/size, quoted text in orange
- Light grey row dividers, alternating white/light-grey background for readability

### Notes (conditional)
- If order has notes: orange-tinted box with notes text, matching email style

### Signature Block
- Two side-by-side boxes with grey borders:
  - **Delivered By:**
    - Name: ________________________
    - Signature: ________________________
    - Date: ________________________
  - **Received By:**
    - Name: ________________________
    - Signature: ________________________
    - Date: ________________________

### Footer
- Thin navy line
- "Onesign and Digital | onesignanddigital.com" centred in small grey text

## Architecture

### New Files
- `shop/lib/delivery-note.tsx` — The `@react-pdf/renderer` Document component and `generateDeliveryNotePdf(order: OrderData): Promise<string>` function that returns a base64-encoded PDF string.

### Modified Files
- `shop/app/api/orders/route.ts` — Call `generateDeliveryNotePdf()` after order insertion, include base64 string in Make webhook JSON payload.
- `shop/lib/email.ts` — Add `OrderData` export so it can be shared with the delivery note module (currently the interface is not exported).

### Dependencies
- `@react-pdf/renderer` — PDF generation in Node.js with JSX layout

### Data Flow
1. Order submitted → validated → saved to Supabase (existing)
2. `generateDeliveryNotePdf(emailData)` called → fetches product images → renders PDF → returns base64 string
3. Base64 string added to Make webhook payload as `deliveryNotePdf`
4. Make.com scenario decodes base64 and attaches as PDF file to team notification email

## Colours (matching email)
- Navy: `#00474a`
- Green accent: `#3db28c`
- Light green bg: `#f8faf9`
- Green border: `#bbf7d0`
- Orange notes bg: `#fff7ed`
- Orange notes border: `#fed7aa`
- Orange notes text: `#c2410c`
- Custom sign type colours: same as `SIGN_TYPE_COLORS` in email.ts
