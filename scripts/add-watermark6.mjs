import sharp from 'sharp';
import fs from 'fs';

const WATERMARK = '架构活了@小红书';
const DIR = '/tmp/uml-volvo/output';

function seededRandom(seed) {
  let s = seed;
  return () => { s = (s * 16807 + 0) % 2147483647; return s / 2147483647; };
}

function createWatermarkSVG(w, h) {
  const rand = seededRandom(42);
  const fontSize = 38;
  const angle = -25;
  let texts = '';
  
  // Each row has regular spacing, but rows themselves shift randomly
  for (let y = -200; y < h + 200; y += 220) {
    const rowOffset = (rand() - 0.5) * 160; // random horizontal shift per row
    for (let x = -300 + rowOffset; x < w + 300; x += 460) {
      texts += `<text x="${x}" y="${y}" 
        font-size="${fontSize}" 
        font-family="'PingFang SC','Microsoft YaHei',sans-serif"
        fill="rgba(0,0,0,0.06)"
        transform="rotate(${angle}, ${x}, ${y})"
        >${WATERMARK}</text>`;
    }
  }
  
  return `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
    <g>${texts}</g>
  </svg>`;
}

async function processFile(file) {
  const inputPath = `${DIR}/${file}`;
  const outputPath = `${DIR}/${file.replace('.png', '.wm6.png')}`;
  await sharp(inputPath)
    .composite([{ input: Buffer.from(createWatermarkSVG(1080, 1440)), blend: 'over' }])
    .toFile(outputPath);
  fs.renameSync(outputPath, inputPath);
  console.log(`✅ ${file}`);
}

const files = fs.readdirSync(DIR).filter(f => f.endsWith('.png')).sort();
for (const f of files) { await processFile(f); }
console.log(`\n✅ ${files.length} files done`);
