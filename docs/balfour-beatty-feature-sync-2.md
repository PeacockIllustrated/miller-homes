# Balfour Beatty — Feature Sync Prompt #2

Copy everything below the line into Claude as a message in the Balfour Beatty project.

---

## Prompt

You are working on the Balfour Beatty signage portal. This codebase was copied from the Persimmon portal and rebranded. The Persimmon version has had significant new features added that this copy is missing. Your job is to port all of these features across, changing table prefixes from `psp_` to `bal_` and order prefix from `PER-` to `BAL-` where needed.

The previous feature sync covered: `awaiting_po` status, Send to Nest button, Make.com webhooks, Raise PO idempotency, contacts & sites tables, checkout dropdowns, and order page filter pills/bento cards.

This sync covers everything added after that.

---

### 1. Database Migration

Run in Supabase SQL editor first:

```sql
-- Purchasers table
CREATE TABLE IF NOT EXISTS bal_purchasers (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  email      TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE bal_purchasers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_bal_purchasers" ON bal_purchasers FOR ALL USING (true) WITH CHECK (true);

-- Purchaser columns on orders
ALTER TABLE bal_orders ADD COLUMN IF NOT EXISTS purchaser_name TEXT;
ALTER TABLE bal_orders ADD COLUMN IF NOT EXISTS purchaser_email TEXT;
ALTER TABLE bal_orders ADD COLUMN IF NOT EXISTS purchaser_id UUID REFERENCES bal_purchasers(id);

-- PO document storage columns on orders
ALTER TABLE bal_orders ADD COLUMN IF NOT EXISTS po_document_data TEXT;
ALTER TABLE bal_orders ADD COLUMN IF NOT EXISTS po_document_name TEXT;
ALTER TABLE bal_orders ADD COLUMN IF NOT EXISTS po_document_type TEXT;

-- Custom data on order items (if not already present)
ALTER TABLE bal_order_items ADD COLUMN IF NOT EXISTS custom_data JSONB DEFAULT NULL;
```

---

### 2. New Environment Variable

Add to Vercel and local `.env`:

```
RAISE_PO_SECRET=<generate with: openssl rand -hex 32>
```

This is used to sign raise-po and upload-po token links (HMAC-SHA256).

---

### 3. New API Routes

Copy these files from Persimmon. In each file, rename `psp_` table references to `bal_`.

| Persimmon File | Table Changes |
|---|---|
| `shop/app/api/purchasers/route.ts` | `"psp_purchasers"` → `"bal_purchasers"`, `"psp_orders"` → `"bal_orders"` |
| `shop/app/api/orders/[orderNumber]/upload-po/route.ts` | `"psp_orders"` → `"bal_orders"` |
| `shop/app/api/orders/[orderNumber]/download-po/route.ts` | `"psp_orders"` → `"bal_orders"` |
| `shop/app/api/orders/[orderNumber]/delivery-note/route.ts` | `"psp_orders"` → `"bal_orders"`, `"psp_order_items"` → `"bal_order_items"` |
| `shop/app/po-upload/[orderNumber]/page.tsx` | No table refs — copy as-is |
| `shop/app/po-upload/[orderNumber]/PoUploadForm.tsx` | No table refs — copy as-is |
| `shop/lib/delivery-note.ts` | No table refs — copy as-is (PDF generation utility) |

**Important:** The `po-upload` directory sits outside the `(shop)` route group deliberately — it needs no shop auth because external purchasers access it via email token links.

#### Purchasers API (`api/purchasers/route.ts`)

Full CRUD:
- **GET** — returns all purchasers sorted by name
- **POST** — creates purchaser; upserts by email (returns existing if email matches)
- **PUT** — updates purchaser by ID
- **DELETE** — nullifies `purchaser_id` FK on any linked orders, then deletes the purchaser

#### Upload PO (`api/orders/[orderNumber]/upload-po/route.ts`)

- Accepts file upload (max 5MB; PDF, PNG, JPEG, WEBP)
- Auth: valid raise-po token OR admin cookie
- Stores as base64 in `po_document_data`, filename in `po_document_name`, MIME type in `po_document_type`

#### Download PO (`api/orders/[orderNumber]/download-po/route.ts`)

- Admin-only endpoint
- Returns the stored PO document as a binary download

#### Delivery Note (`api/orders/[orderNumber]/delivery-note/route.ts`)

- Admin-only endpoint
- Generates PDF on-demand using `lib/delivery-note.ts`
- Returns PDF as attachment download

---

### 4. Modified API Routes

#### `shop/app/api/orders/route.ts`

**POST handler changes:**
- Destructure `purchaserName`, `purchaserEmail`, `purchaserId` from request body
- Insert into DB: `purchaser_name: purchaserName || null`, `purchaser_email: purchaserEmail || null`, `purchaser_id: purchaserId || null`
- Add to `emailData`: `purchaserName` and `purchaserEmail`
- Build purchaser email HTML when purchaser is attached:
  ```typescript
  const uploadPoUrl = `${siteUrl}/po-upload/${orderNumber}?t=${token}`;
  const purchaserEmailPayload = purchaserEmail
    ? buildPurchaserPOEmailHtml(emailData, siteUrl, uploadPoUrl)
    : null;
  ```
- Add to Make webhook payload:
  ```typescript
  purchaserName: purchaserName ? String(purchaserName) : null,
  purchaserEmail: purchaserEmail ? String(purchaserEmail) : null,
  purchaserEmailSubject: purchaserEmailPayload?.subject || null,
  purchaserEmailHtml: purchaserEmailPayload?.html || null,
  ```

**GET handler changes:**
- Add to response transform: `purchaserName: o.purchaser_name`, `purchaserEmail: o.purchaser_email`, `poDocumentName: o.po_document_name`

#### `shop/app/api/orders/[orderNumber]/raise-po/route.ts`

Major rewrite:
- Import `buildPurchaserPOEmailHtml` and `generateRaisePoToken` from `@/lib/email`
- Build purchaser email payload alongside the nest email:
  ```typescript
  const uploadPoUrl = `${siteUrl}/po-upload/${orderNumber}?t=${token}`;
  const purchaserEmailPayload = order.purchaser_email
    ? buildPurchaserPOEmailHtml({ ...orderData, purchaserName: order.purchaser_name, purchaserEmail: order.purchaser_email }, siteUrl, uploadPoUrl)
    : null;
  ```
- Add `purchaserEmailSubject` and `purchaserEmailHtml` to webhook payload
- **Replace the redirect to `/po-upload/...`** with a branded confirmation HTML page:
  - Green header with checkmark icon and "Sent to Purchaser" title
  - Shows order number and who it was sent to (purchaser name or email)
  - "View in Admin Dashboard" link
  - No PO upload form — the purchaser handles that via their own email

#### `shop/app/api/orders/[orderNumber]/send-to-nest/route.ts`

- Import `buildPurchaserPOEmailHtml` and `generateRaisePoToken`
- Build purchaser email payload same as raise-po
- Add `purchaserEmailSubject` and `purchaserEmailHtml` to webhook payload

---

### 5. Email Template Changes (`shop/lib/email.ts`)

#### OrderData interface

Add optional purchaser fields:
```typescript
purchaserName?: string | null;
purchaserEmail?: string | null;
```

#### All 4 existing email functions

Add a conditional purchaser block to each function, showing purchaser name and email after the site info section:
- `sendOrderConfirmation` — "Purchaser: **Name** / email"
- `sendTeamNotification` — uppercase "PURCHASER" label block
- `sendNestPORequest` — same pattern
- `buildNestPOEmailHtml` — same pattern with word-break styles

#### `buildNestPOEmailHtml` button change

Change the button text and subtext:
```typescript
const buttonHtml = raisePoUrl
  ? `<div style="text-align:center;margin:28px 0 8px">
      <a href="${raisePoUrl}" style="background:#3db28c;color:white;padding:14px 32px;border-radius:8px;text-decoration:none;display:inline-block;font-size:16px;font-weight:bold;letter-spacing:0.5px">Send to Purchaser</a>
      <p style="margin:8px 0 0;font-size:12px;color:#999">Click to forward this order to the purchaser for PO attachment</p>
    </div>`
  : "";
```

Replace the brand accent colour `#3db28c` with the Balfour equivalent (BB blue `#005d99`), and `#00474a` with BB navy `#002b49` throughout.

#### New function: `buildPurchaserPOEmailHtml`

Add this new exported function. It generates a full email for the purchaser with:
- Navy header: "Purchase Order Required"
- Greeting: "Hi {purchaserName},"
- Explanation paragraph
- Order summary box (order number, total, item count)
- Contact and site info table
- PO number if present
- Notes if present
- Full items table with images
- **"Attach PO" button** linking to `uploadPoUrl` (the PO upload page with token)
- Subtext: "Click to upload your purchase order document for this order"

Signature: `buildPurchaserPOEmailHtml(order: OrderData, siteUrl: string, uploadPoUrl: string): { subject: string; html: string }`

Subject format: `"Purchase Order Required — {orderNumber} — {siteName}"`

---

### 6. Updated Pages

#### `shop/app/(shop)/checkout/page.tsx`

Add the full purchaser dropdown section after the site section. Pattern is identical to contacts and sites:
- State: `purchasers`, `selectedPurchaser`, `showNewPurchaser`, `newPurchaser`, `savingPurchaser`, `managePurchasers`, `editingPurchaser`, `editPurchaserForm`
- Fetch `/api/purchasers` on mount
- Dropdown with options: "No purchaser" (default), all purchasers, "+ Add new purchaser", "Manage purchasers..."
- Inline add-new form (name + email fields, no phone)
- "Manage Purchasers" modal with edit/delete
- On submit, send `purchaserName`, `purchaserEmail`, `purchaserId` with the order
- This field is **optional** — "No purchaser" is the default

#### `shop/app/(shop)/orders/page.tsx`

- Fix strict filtering: change `o.contactId === selectedContactId || !o.contactId` to just `o.contactId === selectedContactId` (same for siteId). This prevents orders with null IDs leaking through every filter.

#### `shop/app/(shop)/admin/page.tsx`

Port the full filter system from the orders page:
- Add state: `search`, `selectedSiteId`, `selectedContactId`
- Add computed: `contactCards`, `siteCards`, `filteredOrders` (contact/site/status/search filtering)
- Add UI: contact pills at top, site bento cards below, active filter indicators with clear buttons, search bar
- **Move doc links to card header** (collapsed state, not expanded):
  - "Delivery Note" link → `/api/orders/{orderNumber}/delivery-note`
  - "PO: {filename}" link → `/api/orders/{orderNumber}/download-po` (only if PO uploaded)
  - Use `onClick={(e) => e.stopPropagation()}` to prevent card expand on link click
- Add purchaser info display in expanded order details

#### `shop/app/(shop)/page.tsx`

Add mobile-only admin link at bottom of homepage:
```tsx
<div className="mt-16 pb-8 text-center md:hidden">
  <Link href="/admin" className="text-xs text-gray-400 hover:text-gray-500 transition-colors">
    Admin
  </Link>
</div>
```

#### `shop/components/Header.tsx`

Make the toolbar sticky with scroll shadow:
```typescript
className={`bg-white/95 backdrop-blur-md border-b sticky top-0 z-50 transition-[box-shadow,border-color] duration-300 ${scrolled ? "shadow-md border-gray-200/60" : "border-gray-200/80 shadow-none"}`}
```
Track scroll position with a `scrolled` state that toggles at `window.scrollY > 10`.

#### `shop/app/(auth)/login/page.tsx` and layout

- Add brand icon and wordmark SVGs to login page
- Style with gradient button using brand CSS variables
- Add "Signage Portal" / "Order management" subtext based on mode
- Add subtle entry aesthetic with background styling in layout

#### `shop/app/globals.css`

Add these animations if not already present:
- Toast in/out
- Drawer in/out
- Fade in/out
- Slide-up
- Splash screen animations (icon, wordmark, exit)
- Brand fade-in

---

### 7. Make.com Webhook Updates

The webhook payload now includes these additional fields that Make needs to handle:

```
purchaserName        — purchaser's name (or null)
purchaserEmail       — purchaser's email address (or null)
purchaserEmailSubject — subject line for the purchaser email (or null)
purchaserEmailHtml   — full HTML email body for the purchaser (or null)
```

**Make flow for purchaser emails:**
When `purchaserEmailHtml` is not null, Make should send a second email:
- **To:** `purchaserEmail`
- **Subject:** `purchaserEmailSubject`
- **Body:** `purchaserEmailHtml`

This email contains an "Attach PO" button that takes the purchaser to the upload page.

Also ensure the `brand` field in webhook payloads is set to `"balfour"` (not `"persimmon"`).

---

### 8. Product Display Hierarchy

On product pages and basket, ensure the text hierarchy is:
1. **Code** (bold)
2. Size (gray)
3. Material (lighter gray)

---

### 9. Mobile Fixes

These should already be handled if copied from Persimmon, but verify:
- No horizontal overflow on mobile viewports
- Product images constrained to container width and max 80vh height
- TypeScript version pinned in `package.json`

---

## Task Order

1. Run the SQL migration
2. Add `RAISE_PO_SECRET` env variable
3. Copy new API routes and utility files (with `psp_` → `bal_` renames)
4. Update existing API routes (orders, raise-po, send-to-nest)
5. Update `lib/email.ts` (interface, purchaser blocks, button rename, new function)
6. Update checkout page (purchaser dropdown)
7. Fix orders page filtering
8. Update admin page (filters, doc links, purchaser display)
9. Update homepage, header, login page, globals.css
10. Run `next build` to confirm everything compiles

## Verification Checklist

- [ ] `bal_purchasers` table exists in Supabase
- [ ] `bal_orders` has `purchaser_*` and `po_document_*` columns
- [ ] Checkout shows purchaser dropdown with add/manage
- [ ] "No purchaser" is the default (optional field)
- [ ] Order confirmation email includes purchaser info when set
- [ ] First email has "Send to Purchaser" button (not "Raise PO")
- [ ] Clicking "Send to Purchaser" shows confirmation page (no upload form)
- [ ] Purchaser receives email with "Attach PO" button
- [ ] "Attach PO" links to `/po-upload/{orderNumber}?t=token`
- [ ] PO upload page works with drag-and-drop (max 5MB)
- [ ] "View Orders" link shown after successful PO upload
- [ ] Admin can download PO from order card header
- [ ] Admin can download delivery note PDF from order card header
- [ ] Admin page has contact pills, site bento cards, search, filter indicators
- [ ] Orders page filters strictly (no null ID leak)
- [ ] `brand` field in webhook is `"balfour"`
- [ ] Order numbers use `BAL-` prefix
- [ ] Mobile admin link on homepage
- [ ] Sticky header with scroll shadow
- [ ] Login page has brand styling
- [ ] `next build` passes cleanly
