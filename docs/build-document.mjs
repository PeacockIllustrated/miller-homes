import {
  Document, Packer, Paragraph, TextRun, ImageRun, Table, TableRow, TableCell,
  Header, Footer, AlignmentType, BorderStyle, WidthType,
  ShadingType, PageBreak, PageNumber, LevelFormat,
  TabStopType, TabStopPosition, VerticalAlign, TableLayoutType
} from 'docx';
import fs from 'fs';

// ── Brand colours (Onesign) ──
const NAVY = '00474A';
const TEAL = '3DB28C';
const DARK = '1A1D21';
const MID = '4A5568';
const LIGHT = '9CA3AF';
const GRAY_BG = 'F0F4F8';
const WHITE = 'FFFFFF';
const BORDER = 'D1D5DB';

const FULL_W = 9026;
const HALF_W = 4513;
const noBorder = { style: BorderStyle.NONE, size: 0 };
const noBorders = { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder };

// ── Helpers ──
function loadImg(name, w, h) {
  return new ImageRun({
    type: 'png',
    data: fs.readFileSync(`docs/screenshots/${name}`),
    transformation: { width: w, height: h },
    altText: { title: name, description: name, name }
  });
}

function dims(name) {
  const d = fs.readFileSync(`docs/screenshots/${name}`);
  return { w: d.readUInt32BE(16), h: d.readUInt32BE(20) };
}

function txt(str, opts = {}) {
  return new TextRun({
    text: str, font: 'Calibri',
    size: opts.size || 22, bold: opts.bold || false,
    italics: opts.italic || false, color: opts.color || DARK,
    ...(opts.break ? { break: opts.break } : {})
  });
}

function para(children, opts = {}) {
  return new Paragraph({
    children: Array.isArray(children) ? children : [children],
    alignment: opts.align || AlignmentType.LEFT,
    spacing: { before: opts.before || 0, after: opts.after ?? 160 },
    ...(opts.border ? { border: opts.border } : {}),
    ...(opts.numbering ? { numbering: opts.numbering } : {}),
    ...(opts.pageBreakBefore ? { pageBreakBefore: true } : {})
  });
}

function heading1(str) {
  return para([txt(str, { size: 36, bold: true, color: NAVY })], { before: 100, after: 200 });
}

function heading2(str) {
  return para([txt(str, { size: 28, bold: true, color: NAVY })], { before: 200, after: 160 });
}

function body(str) {
  return para([txt(str, { size: 22, color: MID })], { after: 160 });
}

function caption(str) {
  return para([txt(str, { size: 18, italic: true, color: LIGHT })], { align: AlignmentType.CENTER, after: 200 });
}

// ── Full-width navy banner ──
function banner(title) {
  return new Table({
    width: { size: FULL_W, type: WidthType.DXA },
    rows: [new TableRow({
      children: [new TableCell({
        borders: noBorders,
        shading: { fill: NAVY, type: ShadingType.CLEAR },
        margins: { top: 160, bottom: 160, left: 300, right: 300 },
        width: { size: FULL_W, type: WidthType.DXA },
        children: [para([txt(title, { size: 28, bold: true, color: WHITE })], { after: 0 })]
      })]
    })]
  });
}

// ── Callout box with teal left accent ──
function callout(lines, bg = GRAY_BG) {
  const thin = { style: BorderStyle.SINGLE, size: 1, color: BORDER };
  return new Table({
    width: { size: FULL_W, type: WidthType.DXA },
    rows: [new TableRow({
      children: [new TableCell({
        borders: {
          top: thin, bottom: thin, right: thin,
          left: { style: BorderStyle.SINGLE, size: 8, color: TEAL }
        },
        shading: { fill: bg, type: ShadingType.CLEAR },
        margins: { top: 160, bottom: 160, left: 240, right: 240 },
        width: { size: FULL_W, type: WidthType.DXA },
        children: lines.map(l => para([txt(l, { size: 22, color: NAVY })], { after: 80 }))
      })]
    })]
  });
}

// ── Two screenshots side by side ──
function twoUp(img1, cap1, img2, cap2, w = 175) {
  const d1 = dims(img1), d2 = dims(img2);
  const imgH1 = Math.round(w * (d1.h / d1.w));
  const imgH2 = Math.round(w * (d2.h / d2.w));
  return new Table({
    width: { size: FULL_W, type: WidthType.DXA },
    layout: TableLayoutType.FIXED,
    rows: [
      new TableRow({
        children: [
          new TableCell({
            borders: noBorders, width: { size: HALF_W, type: WidthType.DXA },
            margins: { top: 80, bottom: 40, left: 80, right: 80 },
            children: [para([loadImg(img1, w, imgH1)], { align: AlignmentType.CENTER, after: 40 })]
          }),
          new TableCell({
            borders: noBorders, width: { size: HALF_W, type: WidthType.DXA },
            margins: { top: 80, bottom: 40, left: 80, right: 80 },
            children: [para([loadImg(img2, w, imgH2)], { align: AlignmentType.CENTER, after: 40 })]
          })
        ]
      }),
      new TableRow({
        children: [
          new TableCell({
            borders: noBorders, width: { size: HALF_W, type: WidthType.DXA },
            margins: { top: 0, bottom: 80, left: 80, right: 80 },
            children: [para([txt(cap1, { size: 18, italic: true, color: LIGHT })], { align: AlignmentType.CENTER, after: 0 })]
          }),
          new TableCell({
            borders: noBorders, width: { size: HALF_W, type: WidthType.DXA },
            margins: { top: 0, bottom: 80, left: 80, right: 80 },
            children: [para([txt(cap2, { size: 18, italic: true, color: LIGHT })], { align: AlignmentType.CENTER, after: 0 })]
          })
        ]
      })
    ]
  });
}

// ── Single centred screenshot ──
function oneUp(imgName, captionText, w = 200) {
  const d = dims(imgName);
  const imgH = Math.round(w * (d.h / d.w));
  return [
    para([loadImg(imgName, w, imgH)], { align: AlignmentType.CENTER, after: 60 }),
    caption(captionText)
  ];
}

// ── Bullet ──
const bulletConfig = {
  reference: 'bullets',
  levels: [{
    level: 0, format: LevelFormat.BULLET, text: '\u2022',
    alignment: AlignmentType.LEFT,
    style: { paragraph: { indent: { left: 720, hanging: 360 } } }
  }]
};

function bullet(str) {
  return new Paragraph({
    numbering: { reference: 'bullets', level: 0 },
    children: [txt(str, { size: 22, color: MID })],
    spacing: { after: 80 }
  });
}

// ── Benefits table ──
function benefitsTable() {
  const items = [
    ['Faster Ordering', 'Site managers browse and order in minutes, not days'],
    ['Brand Consistency', 'Every order uses approved, visually referenced products'],
    ['Complete Visibility', 'Full oversight of every order across every site'],
    ['Structured Data', 'Clean order data replaces ambiguous email requests'],
    ['Reduced Admin', 'No more manual reconciliation of spreadsheets'],
    ['Scalable', 'The same platform serves five sites or five hundred']
  ];
  const bdr = { style: BorderStyle.SINGLE, size: 1, color: BORDER };
  return new Table({
    width: { size: FULL_W, type: WidthType.DXA },
    layout: TableLayoutType.FIXED,
    rows: items.map(([title, desc]) => new TableRow({
      children: [
        new TableCell({
          borders: { top: noBorder, bottom: bdr, left: noBorder, right: noBorder },
          margins: { top: 100, bottom: 100, left: 0, right: 200 },
          width: { size: 2800, type: WidthType.DXA },
          verticalAlign: VerticalAlign.TOP,
          children: [para([txt(title, { size: 22, bold: true, color: NAVY })], { after: 0 })]
        }),
        new TableCell({
          borders: { top: noBorder, bottom: bdr, left: noBorder, right: noBorder },
          margins: { top: 100, bottom: 100, left: 0, right: 0 },
          width: { size: FULL_W - 2800, type: WidthType.DXA },
          verticalAlign: VerticalAlign.TOP,
          children: [para([txt(desc, { size: 22, color: MID })], { after: 0 })]
        })
      ]
    }))
  });
}

// ── Sidebar image dimensions ──
const ckDims = dims('08-checkout-full.png');
const sideImgW = 150;
const sideImgH = Math.round(sideImgW * (ckDims.h / ckDims.w));
const sideImgColW = sideImgW * 20 + 400;
const sideTxtColW = FULL_W - sideImgColW;

// ══════════════════════════════════════════
//  BUILD DOCUMENT
// ══════════════════════════════════════════

const doc = new Document({
  styles: {
    default: { document: { run: { font: 'Calibri', size: 22, color: DARK } } }
  },
  numbering: { config: [bulletConfig] },
  sections: [

    // ══════════════ COVER ══════════════
    {
      properties: {
        page: {
          size: { width: 11906, height: 16838 },
          margin: { top: 720, right: 1440, bottom: 720, left: 1440 }
        }
      },
      children: [
        para([txt('')], { after: 800 }),
        para([loadImg('onesign-logo.png', 280, 93)], { align: AlignmentType.CENTER, after: 600 }),

        para([txt('CASE STUDY', { size: 16, bold: true, color: TEAL })], {
          align: AlignmentType.CENTER, after: 80
        }),
        para([txt('Persimmon Homes', { size: 20, color: MID })], {
          align: AlignmentType.CENTER, after: 600
        }),

        // Green line
        para([txt('')], {
          after: 400,
          border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: TEAL, space: 1 } }
        }),

        para([txt('')], { after: 200 }),
        para([txt('Digital Procurement', { size: 52, bold: true, color: NAVY })], {
          align: AlignmentType.CENTER, after: 40
        }),
        para([txt('for Branded Signage', { size: 52, bold: true, color: NAVY })], {
          align: AlignmentType.CENTER, after: 300
        }),

        para([txt('How a single platform replaced spreadsheets, emails and manual coordination', {
          size: 24, italic: true, color: MID
        })], { align: AlignmentType.CENTER, after: 600 }),

        // Green line
        para([txt('')], {
          after: 600,
          border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: TEAL, space: 1 } }
        }),

        para([txt('')], { after: 400 }),
        para([txt('Onesign and Digital', { size: 22, bold: true, color: NAVY })], {
          align: AlignmentType.CENTER, after: 60
        }),
        para([txt('D86 Princesway, Gateshead NE11 0TU', { size: 18, color: MID })], {
          align: AlignmentType.CENTER, after: 40
        }),
        para([txt('onesignanddigital.com  |  0191 487 6767', { size: 18, color: MID })], {
          align: AlignmentType.CENTER
        }),
      ]
    },

    // ══════════════ CONTENT PAGES ══════════════
    {
      properties: {
        page: {
          size: { width: 11906, height: 16838 },
          margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 }
        }
      },
      headers: {
        default: new Header({
          children: [new Paragraph({
            children: [
              txt('Onesign and Digital', { size: 16, bold: true, color: NAVY }),
              new TextRun({ children: ['\t'], font: 'Calibri' }),
              txt('Case Study: Persimmon Signage Portal', { size: 16, color: MID }),
            ],
            tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
            border: { bottom: { style: BorderStyle.SINGLE, size: 2, color: TEAL, space: 4 } }
          })]
        })
      },
      footers: {
        default: new Footer({
          children: [new Paragraph({
            children: [
              txt('onesignanddigital.com', { size: 16, color: MID }),
              new TextRun({ children: ['\t'], font: 'Calibri' }),
              txt('Page ', { size: 16, color: MID }),
              new TextRun({ children: [PageNumber.CURRENT], font: 'Calibri', size: 16, color: MID }),
            ],
            tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
            border: { top: { style: BorderStyle.SINGLE, size: 1, color: BORDER, space: 4 } }
          })]
        })
      },
      children: [

        // ──── PAGE 2: THE CHALLENGE ────
        banner('The Challenge'),
        para([txt('')], { after: 200 }),
        body('For large housebuilders managing branded signage across hundreds of active sites, procurement is often more complex than it needs to be. Requirements arrive via spreadsheets, brand guidelines live in separate documents, and procurement teams spend hours reconciling requests.'),
        para([txt('')], { after: 40 }),
        bullet('Limited visibility of what is ordered across sites'),
        bullet('Inconsistent brand application without visual references'),
        bullet('Version control issues with shared spreadsheets'),
        bullet('Manual administration for every order'),
        bullet('Extended lead times from clarification cycles'),

        para([txt('')], { after: 200 }),
        banner('The Solution'),
        para([txt('')], { after: 200 }),
        body('Working with Persimmon Homes, we built a branded digital procurement portal. Site managers browse approved signage with images, select variants, and submit orders directly. Procurement teams get structured data, full visibility, and a single source of truth.'),
        callout([
          'One platform. Visual product selection. Structured ordering. Complete visibility from site to sign.'
        ]),

        // ──── PAGE 3: PLATFORM + LOGIN/HOMEPAGE ────
        new Paragraph({ children: [new PageBreak()] }),
        heading1('The Platform'),
        body('The Persimmon Signage Portal replaces fragmented workflows with a single digital ordering experience. Here\'s how it works.'),
        para([txt('')], { after: 80 }),
        heading2('Secure Access & Category Browsing'),
        body('Site managers log in through a branded entry point. On login, they see all available signage categories \u2014 Site Setup Packs, Environmental Signs, Health & Safety, and more.'),
        twoUp('01-login.png', 'Branded login screen',
              '02-homepage.png', 'Category overview'),

        // ──── PAGE 4: PRODUCT DISCOVERY ────
        new Paragraph({ children: [new PageBreak()] }),
        heading2('Visual Product Catalog'),
        body('Products are displayed with images, codes, names, and pricing. Each product page shows all available size and material variants with clear pricing.'),
        twoUp('03-category.png', 'Product grid with images and pricing',
              '04-product.png', 'Variant selection with preview'),

        // ──── PAGE 5: ORDERING (SIDEBAR LAYOUT) ────
        new Paragraph({ children: [new PageBreak()] }),
        heading1('The Ordering Experience'),
        new Table({
          width: { size: FULL_W, type: WidthType.DXA },
          layout: TableLayoutType.FIXED,
          rows: [new TableRow({
            children: [
              new TableCell({
                borders: noBorders,
                width: { size: sideTxtColW, type: WidthType.DXA },
                margins: { top: 40, bottom: 40, left: 0, right: 200 },
                verticalAlign: VerticalAlign.TOP,
                children: [
                  heading2('Basket & Checkout'),
                  body('Selected items are summarised in a basket with images, quantities, and a full pricing breakdown including VAT.'),
                  body('At checkout, users select a contact, delivery site, and optional purchaser from saved records. A PO number and special instructions can be attached.'),
                  body('Previously saved contacts and sites make repeat ordering fast.'),
                  para([txt('')], { after: 80 }),
                  heading2('Structured Data'),
                  body('Every order captures:'),
                  bullet('Contact and site details'),
                  bullet('Product codes and quantities'),
                  bullet('PO reference'),
                  bullet('Special instructions'),
                  para([txt('')], { after: 60 }),
                  body('Clean, actionable data replaces ambiguous email requests.'),
                ]
              }),
              new TableCell({
                borders: {
                  top: noBorder, bottom: noBorder, right: noBorder,
                  left: { style: BorderStyle.SINGLE, size: 2, color: TEAL }
                },
                width: { size: sideImgColW, type: WidthType.DXA },
                margins: { top: 40, bottom: 40, left: 160, right: 0 },
                verticalAlign: VerticalAlign.TOP,
                children: [
                  para([loadImg('08-checkout-full.png', sideImgW, sideImgH)], { align: AlignmentType.CENTER, after: 40 }),
                  para([txt('Complete checkout flow', { size: 16, italic: true, color: LIGHT })], { align: AlignmentType.CENTER, after: 0 })
                ]
              })
            ]
          })]
        }),

        // ──── PAGE 6: CUSTOM SIGNS ────
        new Paragraph({ children: [new PageBreak()] }),
        heading1('Custom Sign Builder'),
        body('For bespoke requirements, users specify sign type, shape, size, material, and text. A live preview renders the sign in real time. Custom signs are submitted as quote requests \u2014 the team reviews and confirms pricing before manufacture.'),
        twoUp('09-custom-sign.png', 'Sign specification form',
              '09-custom-sign-preview.png', 'Live preview with size and material options'),

        // ──── PAGE 7: VISIBILITY ────
        new Paragraph({ children: [new PageBreak()] }),
        heading1('Visibility & Control'),
        body('Both site managers and the production team get complete order visibility. Users track progress without chasing updates. The admin dashboard gives the production team a single view of all orders across the estate.'),
        twoUp('10-orders.png', 'Order tracking with filters and status',
              '12-admin-orders.png', 'Admin dashboard for order management'),

        // ──── PAGE 8: BENEFITS + CTA ────
        new Paragraph({ children: [new PageBreak()] }),
        banner('The Results'),
        para([txt('')], { after: 200 }),
        body('By replacing manual processes with a structured digital workflow, the portal delivers measurable improvements across procurement, operations, and brand management.'),
        para([txt('')], { after: 80 }),
        benefitsTable(),
        para([txt('')], { after: 200 }),
        callout([
          'From site manager to delivered signage: one digital workflow replacing spreadsheets, emails, and manual coordination.'
        ]),

        para([txt('')], { after: 400 }),
        para([txt('')], {
          border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: TEAL, space: 1 } },
          after: 300
        }),
        para([txt('Get in Touch', { size: 36, bold: true, color: NAVY })], {
          align: AlignmentType.CENTER, after: 200
        }),
        para([txt('If you\'d like to explore how a digital procurement portal could simplify signage ordering across your estate, we\'d be happy to show you how it works.', {
          size: 22, color: MID
        })], { align: AlignmentType.CENTER, after: 300 }),

        para([txt('mike@onesignanddigital.com', { size: 24, bold: true, color: TEAL })], {
          align: AlignmentType.CENTER, after: 100
        }),
        para([txt('0191 487 6767', { size: 22, color: NAVY })], {
          align: AlignmentType.CENTER, after: 60
        }),
        para([txt('onesignanddigital.com', { size: 22, color: TEAL })], {
          align: AlignmentType.CENTER, after: 300
        }),

        para([txt('Onesign and Digital', { size: 20, bold: true, color: NAVY })], {
          align: AlignmentType.CENTER, after: 40
        }),
        para([txt('D86 Princesway, Gateshead NE11 0TU', { size: 18, color: MID })], {
          align: AlignmentType.CENTER
        }),
      ]
    }
  ]
});

// ── Write ──
const buffer = await Packer.toBuffer(doc);
fs.writeFileSync('docs/Persimmon-Signage-Portal-Overview.docx', buffer);
console.log(`Written (${(buffer.length / 1024).toFixed(0)} KB)`);
