# Balfour Beatty — Feature Sync Guide

Features added to the Persimmon portal since the original rebrand guide was written. Apply these to the Balfour Beatty copy to reach feature parity.

---

## Feature Inventory

| # | Feature | Commits | Files Added/Modified |
|---|---------|---------|---------------------|
| 1 | **`awaiting_po` order status** | `9dc73a3`..`4615cde` | Order model, admin dashboard, customer orders page |
| 2 | **Send to Nest button** (admin) | `a2789b6`, `10fa6b2` | `api/orders/[orderNumber]/send-to-nest/route.ts`, admin order detail |
| 3 | **Make.com webhook integration** | `a7cb8c5` | `api/orders/[orderNumber]/raise-po/route.ts`, email template with Raise PO button |
| 4 | **Raise PO idempotency guard** | `0f601c9` | `raise-po/route.ts` — status check, branded "already raised" page |
| 5 | **Admin dashboard links on raise-po** | `0f601c9` | "View in Admin Dashboard" on success/already-raised pages |
| 6 | **Send to Nest rewired to Make webhook** | `03c7c10` | `send-to-nest/route.ts` — replaced Nodemailer with Make webhook |
| 7 | **Contacts & Sites tables** | `16f72df` | `supabase-setup.sql`, `api/contacts/route.ts`, `api/sites/route.ts` |
| 8 | **Orders API — contactId/siteId** | `16f72df` | `api/orders/route.ts` — accepts and returns FK references |
| 9 | **Checkout — dropdown selectors** | `16f72df` | `checkout/page.tsx` — contact/site dropdowns with inline add-new forms |
| 10 | **Orders page — site bento cards** | `16f72df` | `orders/page.tsx` — site cards with status pills, click-to-filter |
| 11 | **Orders page — contact filter pills** | `066f577` | `orders/page.tsx` — avatar pills with initials, order count, click-to-filter |

---

## Step-by-Step Application

### 1. Database Migration

Run in Supabase SQL editor. Uses `bal_` prefix instead of `psp_`.

```sql
-- ============================================================
-- Contacts & Sites
-- ============================================================

CREATE TABLE IF NOT EXISTS bal_contacts (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT NOT NULL,
  email        TEXT NOT NULL UNIQUE,
  phone        TEXT NOT NULL,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS bal_sites (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT NOT NULL UNIQUE,
  address      TEXT NOT NULL,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE bal_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE bal_sites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_bal_contacts" ON bal_contacts FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "service_bal_sites" ON bal_sites FOR ALL USING (true) WITH CHECK (true);

-- Foreign keys on orders (nullable for existing orders)
ALTER TABLE bal_orders ADD COLUMN IF NOT EXISTS contact_id UUID REFERENCES bal_contacts(id);
ALTER TABLE bal_orders ADD COLUMN IF NOT EXISTS site_id UUID REFERENCES bal_sites(id);
CREATE INDEX IF NOT EXISTS idx_bal_orders_contact_id ON bal_orders(contact_id);
CREATE INDEX IF NOT EXISTS idx_bal_orders_site_id ON bal_orders(site_id);

-- Custom data on order items (if not already present)
ALTER TABLE bal_order_items ADD COLUMN IF NOT EXISTS custom_data JSONB DEFAULT NULL;
```

### 2. Environment Variables

Add to Vercel and local `.env`:

```
MAKE_WEBHOOK_URL=<Make.com webhook URL — can share with Persimmon or use a separate scenario>
RAISE_PO_SECRET=<generate: openssl rand -hex 32 — used to sign raise-po email links>
```

### 3. New API Routes

Copy these files from Persimmon and update table references:

| Persimmon File | Table Changes |
|---|---|
| `shop/app/api/contacts/route.ts` | `"psp_contacts"` → `"bal_contacts"` |
| `shop/app/api/sites/route.ts` | `"psp_sites"` → `"bal_sites"` |
| `shop/app/api/orders/[orderNumber]/raise-po/route.ts` | `"psp_orders"` → `"bal_orders"` |
| `shop/app/api/orders/[orderNumber]/send-to-nest/route.ts` | `"psp_orders"` → `"bal_orders"`, `"psp_order_items"` → `"bal_order_items"` |

### 4. Modified API Routes

These existing files need updates:

#### `shop/app/api/orders/route.ts`
- **POST handler**: Add `contactId`, `siteId` to destructuring and insert as `contact_id: contactId || null`, `site_id: siteId || null`
- **GET handler**: Add `contactId: o.contact_id || null`, `siteId: o.site_id || null` to the response transform
- Table refs already changed to `bal_` in the original rebrand

#### `shop/lib/email.ts`
- The `buildNestPOEmailHtml` function should already exist if the Persimmon copy was taken after commit `66c0c7c`
- Ensure the Raise PO button URL is embedded in the HTML payload
- Ensure `isPO: true` boolean is sent in webhook payloads for PO requests

### 5. Updated Pages

Copy these files directly from Persimmon — they contain no table references or brand-specific text (colours come from CSS variables):

| File | What Changed |
|---|---|
| `shop/app/(shop)/checkout/page.tsx` | Full rewrite — contact/site dropdown selectors with inline add-new forms |
| `shop/app/(shop)/orders/page.tsx` | Site bento cards, contact filter pills, `awaiting_po` status support |
| Admin order detail page | "Send to Nest" button, `awaiting_po` badge |

### 6. Make.com Scenario

If sharing the same Make scenario as Persimmon:
- The webhook already handles both notification and PO request flows via the `isPO` boolean
- Ensure the scenario routes Balfour orders to the correct Nest inbox/recipient

If using a separate scenario:
- Create a new Make webhook
- Set `MAKE_WEBHOOK_URL` to the new webhook URL
- Replicate the same scenario logic (email send with HTML body)

---

## Verification Checklist

After applying all changes:

- [ ] `bal_contacts` and `bal_sites` tables exist in Supabase
- [ ] `bal_orders` has `contact_id` and `site_id` columns
- [ ] Checkout page shows contact/site dropdown selectors
- [ ] "Add new contact" inline form saves and auto-selects
- [ ] "Add new site" inline form saves and auto-selects
- [ ] Orders page shows contact filter pills (after placing orders with contacts)
- [ ] Orders page shows site bento cards with status breakdown
- [ ] Clicking a contact pill filters the orders list
- [ ] Clicking a site card filters the orders list
- [ ] Both filters combine (contact + site + status + search)
- [ ] Order confirmation email contains "Raise PO" button
- [ ] Clicking "Raise PO" in email updates order to `awaiting_po`
- [ ] Clicking "Raise PO" a second time shows "PO Already Raised" page
- [ ] Admin "Send to Nest" button fires Make webhook
- [ ] Admin "Send to Nest" can be re-sent from `awaiting_po` status
- [ ] `MAKE_WEBHOOK_URL` and `RAISE_PO_SECRET` are set in Vercel
- [ ] `next build` passes cleanly

---

## Files That Can Be Copied As-Is

These files have **zero brand-specific content** — they use CSS variables for colours and don't reference table names. Copy directly from Persimmon:

```
shop/app/(shop)/checkout/page.tsx
shop/app/(shop)/orders/page.tsx
```

## Files That Need `psp_` → `bal_` Rename

```
shop/app/api/contacts/route.ts
shop/app/api/sites/route.ts
shop/app/api/orders/route.ts              (already done in original rebrand, just add contactId/siteId)
shop/app/api/orders/[orderNumber]/raise-po/route.ts
shop/app/api/orders/[orderNumber]/send-to-nest/route.ts
```
