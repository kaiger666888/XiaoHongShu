import sharp from 'sharp';
import { chromium } from 'playwright-core';
import fs from 'fs';
import path from 'path';

const DIR = '/tmp/uml-volvo/output';
const CHROMIUM = '/home/kai/.cache/ms-playwright/chromium-1208/chrome-linux64/chrome';

const browser = await chromium.launch({
  executablePath: CHROMIUM,
  args: ['--no-sandbox', '--disable-setuid-sandbox']
});
const page = await browser.newPage();

const files = fs.readdirSync(DIR).filter(f => f.endsWith('.html')).sort();
for (const f of files) {
  const htmlPath = path.join(DIR, f);
  const html = fs.readFileSync(htmlPath, 'utf-8');
  const pngFile = f.replace('.html', '.png');
  
  await page.setContent(html);
  await page.setViewportSize({ width: 1080, height: 1440, deviceScaleFactor: 2 });
  const buf = await page.screenshot({ type: 'png' });
  fs.writeFileSync(path.join(DIR, pngFile), buf);
  console.log(`✅ ${pngFile}`);
}

await browser.close();
console.log(`\n✅ ${files.length} files re-rendered`);
