# Delivery Note PDF Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Generate a branded PDF delivery note (no prices, with signature blocks) and attach it to the team notification email via the Make.com webhook.

**Architecture:** `@react-pdf/renderer` generates the PDF server-side in the order API route. The PDF is base64-encoded and included in the existing Make webhook payload. Make.com decodes and attaches it to the team email.

**Tech Stack:** `@react-pdf/renderer`, Next.js 16, TypeScript, Make.com webhooks

---

## Chunk 1: Setup and Shared Types

### Task 1: Install `@react-pdf/renderer`

**Files:**
- Modify: `shop/package.json`

- [ ] **Step 1: Install the dependency**

```bash
cd shop && npm install @react-pdf/renderer --legacy-peer-deps
```

> **Note:** `@react-pdf/renderer` has a peer dependency on React 18, but this project uses React 19.2.3. The `--legacy-peer-deps` flag is required. After installing, verify at runtime (Step 2) that the library works correctly under React 19.

- [ ] **Step 2: Verify installation**

```bash
cd shop && node -e "require('@react-pdf/renderer'); console.log('OK')"
```

Expected: `OK` (no errors)

- [ ] **Step 3: Commit**

```bash
git add shop/package.json shop/package-lock.json
git commit -m "chore: add @react-pdf/renderer for delivery note PDF generation"
```

---

### Task 2: Export shared types from email.ts

**Files:**
- Modify: `shop/lib/email.ts:23-55`

The `OrderItem` and `OrderData` interfaces and the `SIGN_TYPE_COLORS` map in `email.ts` are currently not exported. The delivery note module needs them.

- [ ] **Step 1: Add `export` keyword to both interfaces and `SIGN_TYPE_COLORS`**

In `shop/lib/email.ts`, change:

```typescript
interface OrderItem {
```

to:

```typescript
export interface OrderItem {
```

And change:

```typescript
interface OrderData {
```

to:

```typescript
export interface OrderData {
```

These are at lines 23 and 42 respectively.

Also change (line 76):

```typescript
const SIGN_TYPE_COLORS: Record<string, { bg: string; fg: string }> = {
```

to:

```typescript
export const SIGN_TYPE_COLORS: Record<string, { bg: string; fg: string }> = {
```

- [ ] **Step 2: Add `serverExternalPackages` to `next.config.ts`**

`@react-pdf/renderer` uses native Node.js modules that webpack cannot bundle. In `shop/next.config.ts`, add `serverExternalPackages` to the config object:

```typescript
const nextConfig: NextConfig = {
  serverExternalPackages: ["@react-pdf/renderer"],
  async headers() {
```

- [ ] **Step 3: Verify the build still works**

```bash
cd shop && npx next build --webpack
```

Expected: Build succeeds with no type errors.

- [ ] **Step 3: Commit**

```bash
git add shop/lib/email.ts shop/next.config.ts
git commit -m "refactor: export shared types and configure serverExternalPackages for @react-pdf/renderer"
```

---

## Chunk 2: Delivery Note PDF Component

### Task 3: Create the delivery note PDF module

**Files:**
- Create: `shop/lib/delivery-note.tsx`

This is the core file. It contains:
1. The `@react-pdf/renderer` Document component with all the styled sections
2. A `generateDeliveryNotePdf()` function that renders the document to a base64 string
3. Helper to fetch product images and convert to base64 data URIs for embedding

- [ ] **Step 1: Create `shop/lib/delivery-note.tsx` with the full implementation**

```tsx
import React from "react";
import {
  Document,
  Page,
  View,
  Text,
  Image,
  Svg,
  Path,
  Font,
  StyleSheet,
  renderToBuffer,
} from "@react-pdf/renderer";
import type { OrderItem, OrderData } from "./email";
import { SIGN_TYPE_COLORS } from "./email";

/* ------------------------------------------------------------------ */
/*  Colours (matching the order confirmation email)                    */
/* ------------------------------------------------------------------ */
const C = {
  navy: "#00474a",
  green: "#3db28c",
  lightGreenBg: "#f8faf9",
  greenBorder: "#bbf7d0",
  orangeBg: "#fff7ed",
  orangeBorder: "#fed7aa",
  orangeText: "#c2410c",
  grey: "#666666",
  lightGrey: "#f5f5f5",
  darkText: "#333333",
  divider: "#eeeeee",
  white: "#ffffff",
};

/* ------------------------------------------------------------------ */
/*  Styles                                                             */
/* ------------------------------------------------------------------ */
const s = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 10,
    paddingTop: 0,
    paddingBottom: 40,
    paddingHorizontal: 0,
    color: C.darkText,
  },

  /* ---------- Header ---------- */
  headerBar: {
    backgroundColor: C.navy,
    paddingVertical: 18,
    paddingHorizontal: 32,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerTitle: {
    color: C.white,
    fontSize: 18,
    fontFamily: "Helvetica-Bold",
    letterSpacing: 1,
  },
  headerSub: {
    fontSize: 8,
    color: C.grey,
    textAlign: "center",
    marginTop: 6,
    paddingHorizontal: 32,
  },

  /* ---------- Body ---------- */
  body: {
    paddingHorizontal: 32,
    paddingTop: 16,
  },

  /* ---------- Order info box ---------- */
  orderBox: {
    backgroundColor: C.lightGreenBg,
    borderWidth: 1,
    borderColor: C.greenBorder,
    borderRadius: 6,
    padding: 14,
    marginBottom: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  orderNumber: {
    fontSize: 16,
    fontFamily: "Helvetica-Bold",
    color: C.navy,
  },
  orderDate: {
    fontSize: 10,
    color: C.grey,
  },

  /* ---------- Info columns ---------- */
  infoRow: {
    flexDirection: "row",
    columnGap: 24,
    marginBottom: 14,
  },
  infoCol: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 8,
    color: "#999999",
    textTransform: "uppercase",
    marginBottom: 3,
    letterSpacing: 0.5,
  },
  infoValue: {
    fontSize: 10,
    color: C.darkText,
  },
  infoBold: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: C.darkText,
  },

  /* ---------- PO number ---------- */
  poLine: {
    fontSize: 10,
    color: C.grey,
    marginBottom: 14,
  },
  poBold: {
    fontFamily: "Helvetica-Bold",
  },

  /* ---------- Items table ---------- */
  tableHeader: {
    flexDirection: "row",
    backgroundColor: C.lightGrey,
    paddingVertical: 6,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: C.divider,
  },
  tableHeaderText: {
    fontSize: 8,
    color: C.grey,
    textTransform: "uppercase",
    fontFamily: "Helvetica-Bold",
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: C.divider,
    alignItems: "center",
  },
  tableRowAlt: {
    backgroundColor: "#fafafa",
  },
  colImage: { width: 48, paddingRight: 6 },
  colProduct: { flex: 1, paddingRight: 8 },
  colQty: { width: 50, textAlign: "center" },
  productImage: {
    width: 38,
    height: 38,
    borderRadius: 4,
    objectFit: "contain",
    backgroundColor: "#f8f8f8",
  },
  productCode: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: C.darkText,
  },
  productName: {
    fontSize: 9,
    color: C.grey,
    marginTop: 1,
  },
  customFieldText: {
    fontSize: 8,
    color: C.navy,
    marginTop: 1,
  },
  customFieldValue: {
    color: C.grey,
  },
  qtyText: {
    fontSize: 11,
    textAlign: "center",
  },

  /* ---------- Custom sign badge ---------- */
  signBadge: {
    width: 38,
    height: 38,
    borderRadius: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  signBadgeText: {
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    textAlign: "center",
  },
  customSignTitle: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: C.darkText,
  },
  customSignDetail: {
    fontSize: 9,
    color: C.grey,
    marginTop: 1,
  },
  customSignText: {
    fontSize: 9,
    color: C.orangeText,
    marginTop: 1,
  },
  customSignNotes: {
    fontSize: 8,
    color: "#999999",
    marginTop: 1,
  },

  /* ---------- Notes ---------- */
  notesBox: {
    backgroundColor: C.orangeBg,
    borderWidth: 1,
    borderColor: C.orangeBorder,
    borderRadius: 6,
    padding: 10,
    marginTop: 16,
  },
  notesLabel: {
    fontFamily: "Helvetica-Bold",
    fontSize: 10,
    color: C.orangeText,
  },
  notesText: {
    fontSize: 10,
    color: C.orangeText,
  },

  /* ---------- Signature block ---------- */
  sigSection: {
    flexDirection: "row",
    columnGap: 20,
    marginTop: 30,
  },
  sigBox: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#cccccc",
    borderRadius: 6,
    padding: 14,
  },
  sigTitle: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    color: C.navy,
    marginBottom: 14,
  },
  sigFieldRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    marginBottom: 18,
  },
  sigFieldLabel: {
    fontSize: 9,
    color: C.grey,
    width: 65,
  },
  sigFieldLine: {
    flex: 1,
    borderBottomWidth: 1,
    borderBottomColor: "#999999",
    height: 14,
  },

  /* ---------- Footer ---------- */
  footer: {
    position: "absolute",
    bottom: 16,
    left: 32,
    right: 32,
    borderTopWidth: 1,
    borderTopColor: C.navy,
    paddingTop: 6,
  },
  footerText: {
    fontSize: 8,
    color: C.grey,
    textAlign: "center",
  },
});

/* ------------------------------------------------------------------ */
/*  Image helper — fetch product PNGs and convert to data URIs         */
/* ------------------------------------------------------------------ */
async function fetchImageAsDataUri(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    const base64 = buf.toString("base64");
    const contentType = res.headers.get("content-type") || "image/png";
    return `data:${contentType};base64,${base64}`;
  } catch {
    return null;
  }
}

interface ImageMap {
  [code: string]: string;
}

async function buildImageMap(
  items: OrderItem[],
  siteUrl: string
): Promise<ImageMap> {
  const map: ImageMap = {};
  const seen = new Set<string>();

  const fetches = items
    .filter((item) => !item.custom_data?.signType)
    .map((item) => {
      const imgCode = (
        item.base_code || item.code.replace(/\/.*$/, "")
      ).replace(/\//g, "_");
      if (seen.has(imgCode)) return null;
      seen.add(imgCode);
      return fetchImageAsDataUri(
        `${siteUrl}/images/products/${imgCode}.png`
      ).then((uri) => {
        if (uri) map[imgCode] = uri;
      });
    })
    .filter(Boolean);

  await Promise.all(fetches);
  return map;
}

/* ------------------------------------------------------------------ */
/*  Onesign icon (SVG path data from shop/assets/icon.svg)             */
/* ------------------------------------------------------------------ */
function OnesignIcon({ size = 28 }: { size?: number }) {
  const aspect = 28.71 / 24.32;
  const w = size * aspect;
  return (
    <Svg viewBox="0 0 28.71 24.32" width={w} height={size}>
      <Path
        d="M24.88,3.25c-2.55-2.17-6.06-3.25-10.51-3.25S6.4,1.08,3.84,3.25C1.28,5.42,0,8.39,0,12.15s1.29,6.73,3.86,8.92c2.36,2,5.5,3.08,9.42,3.25v-10.13H5.23v-4.99h.68c2.5,0,4.4-.39,5.7-1.18,1.3-.79,2.14-2.06,2.52-3.8h6.32v19.26c1.7-.55,3.17-1.35,4.42-2.42,2.56-2.18,3.84-5.16,3.84-8.92s-1.28-6.73-3.83-8.9"
        fill={C.white}
      />
    </Svg>
  );
}

/* ------------------------------------------------------------------ */
/*  Signature block component                                          */
/* ------------------------------------------------------------------ */
function SignatureBlock({ title }: { title: string }) {
  return (
    <View style={s.sigBox}>
      <Text style={s.sigTitle}>{title}</Text>
      {["Name", "Signature", "Date"].map((label) => (
        <View key={label} style={s.sigFieldRow}>
          <Text style={s.sigFieldLabel}>{label}:</Text>
          <View style={s.sigFieldLine} />
        </View>
      ))}
    </View>
  );
}

/* ------------------------------------------------------------------ */
/*  Item row components                                                */
/* ------------------------------------------------------------------ */
function StandardItemRow({
  item,
  images,
  index,
}: {
  item: OrderItem;
  images: ImageMap;
  index: number;
}) {
  const imgCode = (
    item.base_code || item.code.replace(/\/.*$/, "")
  ).replace(/\//g, "_");
  const imgUri = images[imgCode];

  const customFields = item.custom_data?.fields as
    | Array<{ label: string; key: string; value: string }>
    | undefined;

  return (
    <View
      style={[s.tableRow, index % 2 === 1 ? s.tableRowAlt : {}]}
      wrap={false}
    >
      <View style={s.colImage}>
        {imgUri ? (
          <Image src={imgUri} style={s.productImage} />
        ) : (
          <View
            style={[
              s.productImage,
              { backgroundColor: "#f0f0f0" },
            ]}
          />
        )}
      </View>
      <View style={s.colProduct}>
        <Text style={s.productCode}>{item.code}</Text>
        <Text style={s.productName}>
          {item.name}
          {item.size ? ` (${item.size})` : ""}
        </Text>
        {customFields?.map((f) => (
          <Text key={f.key} style={s.customFieldText}>
            {f.label}: <Text style={s.customFieldValue}>{f.value}</Text>
          </Text>
        ))}
      </View>
      <View style={s.colQty}>
        <Text style={s.qtyText}>{item.quantity}</Text>
      </View>
    </View>
  );
}

function CustomSignRow({
  item,
  index,
}: {
  item: OrderItem;
  index: number;
}) {
  const cd = item.custom_data!;
  const colors = SIGN_TYPE_COLORS[cd.signType || ""] || {
    bg: "#666",
    fg: "#FFF",
  };
  const typeLabel =
    (cd.signType || "custom")
      .charAt(0)
      .toUpperCase() +
    (cd.signType || "custom").slice(1).replace("-", " ");

  return (
    <View
      style={[s.tableRow, index % 2 === 1 ? s.tableRowAlt : {}]}
      wrap={false}
    >
      <View style={s.colImage}>
        <View style={[s.signBadge, { backgroundColor: colors.bg }]}>
          <Text style={[s.signBadgeText, { color: colors.fg }]}>
            {typeLabel}
          </Text>
        </View>
      </View>
      <View style={s.colProduct}>
        <Text style={s.customSignTitle}>CUSTOM SIGN REQUEST</Text>
        <Text style={s.customSignDetail}>
          {typeLabel} {"\u00B7"} {cd.shape} {"\u00B7"} {item.size}
        </Text>
        <Text style={s.customSignText}>
          Text: {"\u201C"}
          {cd.textContent}
          {"\u201D"}
        </Text>
        {cd.additionalNotes ? (
          <Text style={s.customSignNotes}>
            Notes: {cd.additionalNotes}
          </Text>
        ) : null}
      </View>
      <View style={s.colQty}>
        <Text style={s.qtyText}>{item.quantity}</Text>
      </View>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Document                                                      */
/* ------------------------------------------------------------------ */
function DeliveryNoteDocument({
  order,
  images,
}: {
  order: OrderData;
  images: ImageMap;
}) {
  const orderDate = new Date().toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <Document>
      <Page size="A4" style={s.page}>
        {/* ---- Header bar ---- */}
        <View style={s.headerBar}>
          <OnesignIcon size={26} />
          <Text style={s.headerTitle}>DELIVERY NOTE</Text>
        </View>
        <Text style={s.headerSub}>
          Onesign and Digital {"  |  "} D86 Princesway, Gateshead NE11 0TU
          {"  |  "} 0191 487 6767
        </Text>

        <View style={s.body}>
          {/* ---- Order info box ---- */}
          <View style={s.orderBox}>
            <View>
              <Text style={s.orderNumber}>{order.orderNumber}</Text>
            </View>
            <Text style={s.orderDate}>{orderDate}</Text>
          </View>

          {/* ---- Site & Contact columns ---- */}
          <View style={s.infoRow}>
            <View style={s.infoCol}>
              <Text style={s.infoLabel}>Site</Text>
              <Text style={s.infoBold}>{order.siteName}</Text>
              <Text style={s.infoValue}>{order.siteAddress}</Text>
            </View>
            <View style={s.infoCol}>
              <Text style={s.infoLabel}>Contact</Text>
              <Text style={s.infoBold}>{order.contactName}</Text>
              <Text style={s.infoValue}>{order.phone}</Text>
            </View>
          </View>

          {/* ---- PO number ---- */}
          {order.poNumber ? (
            <Text style={s.poLine}>
              <Text style={s.poBold}>PO Number: </Text>
              {order.poNumber}
            </Text>
          ) : null}

          {/* ---- Items table ---- */}
          <View style={s.tableHeader}>
            <View style={s.colImage} />
            <View style={s.colProduct}>
              <Text style={s.tableHeaderText}>Product</Text>
            </View>
            <View style={s.colQty}>
              <Text style={[s.tableHeaderText, { textAlign: "center" }]}>
                Qty
              </Text>
            </View>
          </View>
          {order.items.map((item, i) =>
            item.custom_data?.signType ? (
              <CustomSignRow key={i} item={item} index={i} />
            ) : (
              <StandardItemRow
                key={i}
                item={item}
                images={images}
                index={i}
              />
            )
          )}

          {/* ---- Notes ---- */}
          {order.notes ? (
            <View style={s.notesBox}>
              <Text style={s.notesText}>
                <Text style={s.notesLabel}>Notes: </Text>
                {order.notes}
              </Text>
            </View>
          ) : null}

          {/* ---- Signature blocks ---- */}
          <View style={s.sigSection} wrap={false}>
            <SignatureBlock title="Delivered By" />
            <SignatureBlock title="Received By" />
          </View>
        </View>

        {/* ---- Footer ---- */}
        <View style={s.footer} fixed>
          <Text style={s.footerText}>
            Onesign and Digital {"  |  "} onesignanddigital.com
          </Text>
        </View>
      </Page>
    </Document>
  );
}

/* ------------------------------------------------------------------ */
/*  Public API                                                         */
/* ------------------------------------------------------------------ */

/**
 * Generate a delivery note PDF and return it as a base64-encoded string.
 * The PDF mirrors the order confirmation email style but excludes prices
 * and adds signature blocks for delivery handover.
 */
export async function generateDeliveryNotePdf(
  order: OrderData
): Promise<string> {
  const siteUrl = process.env.SITE_URL || "http://localhost:3000";
  const images = await buildImageMap(order.items, siteUrl);
  const buffer = await renderToBuffer(
    <DeliveryNoteDocument order={order} images={images} />
  );
  return Buffer.from(buffer).toString("base64");
}
```

- [ ] **Step 2: Verify the file has no TypeScript errors**

```bash
cd shop && npx tsc --noEmit --jsx react-jsx lib/delivery-note.tsx 2>&1 | head -20
```

If there are JSX config issues, this may need to be checked with the full build instead:

```bash
cd shop && npx next build --webpack 2>&1 | tail -20
```

Expected: No type errors related to `delivery-note.tsx`.

- [ ] **Step 3: Commit**

```bash
git add shop/lib/delivery-note.tsx
git commit -m "feat: add delivery note PDF component using @react-pdf/renderer"
```

---

## Chunk 3: Integration with Order API

### Task 4: Wire PDF generation into the order submission flow

**Files:**
- Modify: `shop/app/api/orders/route.ts:1-4` (imports)
- Modify: `shop/app/api/orders/route.ts:148-188` (webhook payload)

- [ ] **Step 1: Add the import**

At the top of `shop/app/api/orders/route.ts`, add the import for `generateDeliveryNotePdf`:

Change line 3 from:

```typescript
import { sendOrderConfirmation, sendTeamNotification, buildNestPOEmailHtml, generateRaisePoToken } from "@/lib/email";
```

to:

```typescript
import { sendOrderConfirmation, sendTeamNotification, buildNestPOEmailHtml, generateRaisePoToken } from "@/lib/email";
import { generateDeliveryNotePdf } from "@/lib/delivery-note";
```

- [ ] **Step 2: Generate PDF and include in webhook payload**

In the order route, the PDF needs to be generated before the Make webhook fires. Modify the section starting at line 148. Replace the block from `// Send emails + fire Make webhook in parallel` through the end of the `Promise.all` (lines 148-188) with:

```typescript
    // Generate delivery note PDF (before webhook so we can include it)
    const siteUrl = process.env.SITE_URL || "http://localhost:3000";
    const makeWebhookUrl = process.env.MAKE_WEBHOOK_URL;

    let deliveryNotePdf: string | null = null;
    try {
      deliveryNotePdf = await generateDeliveryNotePdf(emailData);
      console.log(`Delivery note PDF generated for ${orderNumber} — ${Math.round(deliveryNotePdf.length * 0.75 / 1024)}KB`);
    } catch (e) {
      console.error("Delivery note PDF generation failed:", e);
    }

    // Send emails + fire Make webhook in parallel
    await Promise.all([
      sendOrderConfirmation(emailData).catch((e) => console.error("Confirmation email failed:", e)),
      sendTeamNotification(emailData).catch((e) => console.error("Team notification failed:", e)),
      makeWebhookUrl
        ? (() => {
            const token = generateRaisePoToken(orderNumber);
            const raisePoUrl = `${siteUrl}/api/orders/${orderNumber}/raise-po?t=${token}`;
            const { subject, html } = buildNestPOEmailHtml(emailData, siteUrl, raisePoUrl);
            return fetch(makeWebhookUrl, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                brand: "persimmon",
                isPO: false,
                emailSubject: subject,
                emailHtml: html,
                raisePoUrl,
                orderNumber,
                contactName: String(contactName),
                contactEmail: String(email),
                contactPhone: String(phone),
                siteName: String(siteName),
                siteAddress: String(siteAddress),
                poNumber: poNumber ? String(poNumber) : null,
                notes: notes ? String(notes) : null,
                subtotal,
                vat,
                total,
                itemCount: validatedItems.length,
                hasCustomItems: validatedItems.some((i: { custom_data: unknown }) => !!i.custom_data),
                deliveryNotePdf,
              }),
            })
              .then((r) => console.log(`Make webhook fired for ${orderNumber} — ${r.status}`))
              .catch((e) => console.error("Make webhook failed:", e));
          })()
        : Promise.resolve(),
    ]);
```

Key changes:
- PDF generation happens **before** `Promise.all` so the base64 string is available for the webhook payload
- `deliveryNotePdf` field added to the webhook JSON body (will be `null` if generation failed — Make.com can handle this gracefully)
- Added a log line showing the generated PDF size in KB

- [ ] **Step 3: Build and verify**

```bash
cd shop && npx next build --webpack 2>&1 | tail -10
```

Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add shop/app/api/orders/route.ts
git commit -m "feat: generate delivery note PDF and include in Make webhook payload"
```

---

## Chunk 4: Manual Testing & Verification

### Task 5: End-to-end verification

- [ ] **Step 1: Start the dev server**

```bash
cd shop && npm run dev
```

- [ ] **Step 2: Place a test order through the shop**

Navigate to the shop, add items to basket, and complete checkout. Check the terminal logs for:

```
Delivery note PDF generated for PER-XXXXXXXX-XXXX — XXkb
Make webhook fired for PER-XXXXXXXX-XXXX — 200
```

- [ ] **Step 3: Verify the webhook payload**

In Make.com, check the webhook scenario history. The payload should include a `deliveryNotePdf` field containing a long base64 string.

- [ ] **Step 4: Test PDF decoding**

To verify the PDF is valid, you can decode it locally:

```bash
echo "<paste base64 string>" | base64 -d > test-delivery-note.pdf
```

Open the PDF and verify:
- Onesign logo and "DELIVERY NOTE" in navy header
- Company address below header
- Order number in green box with date
- Site and contact info in two columns
- Items table with images and quantities (no prices)
- Notes box (if order had notes)
- Two signature blocks side by side
- Footer with company details

- [ ] **Step 5: Update Make.com scenario**

In the Make.com scenario that sends the team notification email:
1. Add a step to decode the `deliveryNotePdf` base64 field
2. Attach it to the email as `Delivery-Note-{orderNumber}.pdf`

This is a Make.com configuration step, not a code change.

- [ ] **Step 6: Final commit with any adjustments**

```bash
git add -A
git commit -m "feat: delivery note PDF generation complete"
```
