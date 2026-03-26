import puppeteer from 'puppeteer';
import { fileURLToPath } from 'url';
import { dirname, resolve, basename } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Accept optional CLI arg: node generate-pdf.mjs [html-filename]
const inputFile = process.argv[2];
let htmlPath, pdfPath;
if (inputFile) {
  htmlPath = resolve(__dirname, inputFile);
  pdfPath = resolve(__dirname, basename(inputFile, '.html') + '.pdf');
} else {
  htmlPath = resolve(__dirname, 'brochure.html');
  pdfPath = resolve(__dirname, 'Miller-Homes-Signage-Portal-Brochure.pdf');
}

const browser = await puppeteer.launch({ headless: true });
const page = await browser.newPage();

await page.goto(`file:///${htmlPath.replace(/\\/g, '/')}`, {
  waitUntil: 'networkidle0',
  timeout: 30000
});

// Wait for fonts to load
await page.evaluateHandle('document.fonts.ready');

await page.pdf({
  path: pdfPath,
  format: 'A4',
  printBackground: true,
  margin: { top: 0, right: 0, bottom: 0, left: 0 },
  preferCSSPageSize: true
});

await browser.close();
console.log(`PDF generated: ${pdfPath}`);
