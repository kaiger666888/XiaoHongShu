const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const sharp = require('sharp');
const RC = require('roughjs').generator;

const DIR = '/tmp/wife-anger-cycle-v2';

// ─── rough.js helpers ───
function rc() { return new RC(); }

function shapeToSvg(rc, shape, strokeColor, fillColor) {
  return shape.sets.map(p => {
    const d = rc.opsToPath(p);
    if (p.type === 'fillPath')
      return `<path d="${d}" fill="${fillColor}" stroke="none" opacity="0.3"/>`;
    return `<path d="${d}" fill="none" stroke="${strokeColor}" stroke-width="2.5" stroke-linejoin="round"/>`;
  }).join('\n');
}

function hachureRect(r, x, y, w, h, strokeColor, fillColor) {
  const s = r.rectangle(x, y, w, h, {
    stroke: strokeColor, fill: fillColor, fillStyle: 'hachure',
    hachureAngle: -45, hachureGap: 6, strokeWidth: 2.5, roughness: 1.0
  });
  return shapeToSvg(r, s, strokeColor, fillColor);
}

function hachureCircle(r, cx, cy, radius, strokeColor, fillColor) {
  const s = r.circle(cx, cy, radius, {
    stroke: strokeColor, fill: fillColor, fillStyle: 'hachure',
    hachureAngle: -45, hachureGap: 6, strokeWidth: 2.5, roughness: 1.0
  });
  return shapeToSvg(r, s, strokeColor, fillColor);
}

function arrowLine(r, x1, y1, x2, y2, color, dashed=false) {
  const s = r.line(x1, y1, x2, y2, { stroke: color, strokeWidth: 2, roughness: 0.8 });
  let svg = shapeToSvg(r, s, color, color);
  if (dashed) svg = svg.replace('stroke-width="2.5"', 'stroke-width="2.5" stroke-dasharray="8,4"');
  // arrowhead
  const angle = Math.atan2(y2-y1, x2-x1);
  const ax = x2 - 12*Math.cos(angle-0.3), ay = y2 - 12*Math.sin(angle-0.3);
  const bx = x2 - 12*Math.cos(angle+0.3), by = y2 - 12*Math.sin(angle+0.3);
  svg += `<polygon points="${x2},${y2} ${ax},${ay} ${bx},${by}" fill="${color}" opacity="0.8"/>`;
  return svg;
}

function svgWrap(w, h, content) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <style>text{font-family:'Humor Sans','Comic Sans MS',cursive,'PingFang SC',sans-serif;}</style>
  ${content}</svg>`;
}

// ─── Generate rough.js SVGs as data URIs ───

function generateStateMachineFull() {
  const r = rc();
  const W = 960, H = 820;
  let svg = '';
  
  // Nodes: pentagon layout - top center, left, center, right, bottom left
  const nodes = [
    { x: 480, y: 60, emoji: '😌', name: '平静态', en: 'Normal', color: '#4CAF50', fill: '#E8F5E9' },
    { x: 120, y: 280, emoji: '🤔', name: '酝酿态', en: 'Warning', color: '#FF9800', fill: '#FFF3E0' },
    { x: 480, y: 280, emoji: '💢', name: '爆发态', en: 'Critical', color: '#F44336', fill: '#FFEBEE' },
    { x: 840, y: 280, emoji: '🧊', name: '冷冻态', en: 'Frozen', color: '#2196F3', fill: '#E3F2FD' },
    { x: 120, y: 520, emoji: '🌧️', name: '阴天态', en: 'Unstable', color: '#9C27B0', fill: '#F3E5F5' },
  ];
  
  // Draw boxes
  nodes.forEach(n => {
    const bw = 200, bh = 80, bx = n.x - bw/2, by = n.y - bh/2;
    svg += hachureRect(r, bx, by, bw, bh, n.color, n.fill);
    // White overlay for text
    svg += `<rect x="${bx+4}" y="${by+4}" width="${bw-8}" height="${bh-8}" fill="white" rx="6" opacity="0.85"/>`;
    svg += `<text x="${n.x}" y="${n.y-6}" text-anchor="middle" font-size="28" font-weight="bold" fill="${n.color}">${n.emoji} ${n.name}</text>`;
    svg += `<text x="${n.x}" y="${n.y+22}" text-anchor="middle" font-size="18" fill="#999">${n.en}</text>`;
  });
  
  // Recovery node bottom-right
  const rx = 840, ry = 520;
  svg += hachureRect(r, rx-100, ry-40, 200, 80, '#4CAF50', '#E8F5E9');
  svg += `<rect x="${rx-96}" y="${ry-36}" width="192" height="72" fill="white" rx="6" opacity="0.85"/>`;
  svg += `<text x="${rx}" y="${ry-6}" text-anchor="middle" font-size="28" font-weight="bold" fill="#4CAF50">😌 平静态</text>`;
  svg += `<text x="${rx}" y="${ry+22}" text-anchor="middle" font-size="18" fill="#999">恢复</text>`;
  
  // Arrows with labels
  // ❶ 平静→酝酿
  svg += arrowLine(r, 400, 100, 190, 240, '#FF9800');
  svg += `<rect x="245" y="145" width="110" height="28" rx="4" fill="white" opacity="0.92"/>`;
  svg += `<text x="300" y="164" text-anchor="middle" font-size="20" font-weight="bold" fill="#FF9800">❶ 忽视预警</text>`;
  
  // ❷ 平静→酝酿 (dashed)
  svg += arrowLine(r, 440, 100, 240, 240, '#FF9800', true);
  svg += `<rect x="290" y="125" width="140" height="28" rx="4" fill="white" opacity="0.92"/>`;
  svg += `<text x="360" y="144" text-anchor="middle" font-size="20" font-weight="bold" fill="#FF9800" opacity="0.7">❷ "你随意吧"</text>`;
  
  // ❸ 酝酿→爆发
  svg += arrowLine(r, 220, 280, 380, 280, '#F44336');
  svg += `<rect x="252" y="258" width="110" height="28" rx="4" fill="white" opacity="0.92"/>`;
  svg += `<text x="307" y="277" text-anchor="middle" font-size="20" font-weight="bold" fill="#F44336">❸ 继续忽视</text>`;
  
  // ❹ 爆发→冷冻
  svg += arrowLine(r, 580, 280, 740, 280, '#2196F3');
  svg += `<rect x="604" y="258" width="110" height="28" rx="4" fill="white" opacity="0.92"/>`;
  svg += `<text x="659" y="277" text-anchor="middle" font-size="20" font-weight="bold" fill="#2196F3">❹ 无人劝阻</text>`;
  
  // ❺ 爆发→阴天
  svg += arrowLine(r, 400, 320, 190, 480, '#9C27B0');
  svg += `<rect x="230" y="375" width="110" height="28" rx="4" fill="white" opacity="0.92"/>`;
  svg += `<text x="285" y="394" text-anchor="middle" font-size="20" font-weight="bold" fill="#9C27B0">❺ 道歉失败</text>`;
  
  // ❻ 阴天→爆发
  svg += arrowLine(r, 190, 500, 400, 320, '#F44336');
  svg += `<rect x="340" y="395" width="110" height="28" rx="4" fill="white" opacity="0.92"/>`;
  svg += `<text x="395" y="414" text-anchor="middle" font-size="20" font-weight="bold" fill="#F44336">❻ 二次爆发</text>`;
  
  // Death loop indicator
  svg += `<text x="340" y="460" text-anchor="middle" font-size="24" fill="#F44336" font-weight="bold">↻ 死循环</text>`;
  
  // ❼ 冷冻→恢复平静
  svg += arrowLine(r, 840, 320, 840, 480, '#4CAF50');
  svg += `<rect x="850" y="380" width="110" height="28" rx="4" fill="white" opacity="0.92"/>`;
  svg += `<text x="905" y="399" text-anchor="middle" font-size="20" font-weight="bold" fill="#4CAF50">❼ 自行恢复</text>`;
  
  // ❽ 阴天→恢复平静
  svg += arrowLine(r, 220, 520, 740, 520, '#4CAF50', true);
  svg += `<rect x="410" y="530" width="150" height="28" rx="4" fill="white" opacity="0.95" stroke="#4CAF50" stroke-width="1.5"/>`;
  svg += `<text x="485" y="549" text-anchor="middle" font-size="20" font-weight="bold" fill="#4CAF50">❽ 认真哄好了 ✓</text>`;
  
  return svgWrap(W, H, svg);
}

function generateMiniStateMachine(from, to, label, labelColor, dashed=false) {
  const r = rc();
  const W = 952, H = 160;
  let svg = '';
  
  const states = {
    '平静': { color: '#4CAF50', fill: '#E8F5E9' },
    '酝酿': { color: '#FF9800', fill: '#FFF3E0' },
    '爆发': { color: '#F44336', fill: '#FFEBEE' },
    '冷冻': { color: '#2196F3', fill: '#E3F2FD' },
    '阴天': { color: '#9C27B0', fill: '#F3E5F5' },
  };
  
  const fs = states[from], ts = states[to];
  
  // From box
  svg += hachureRect(r, 40, 40, 180, 80, fs.color, fs.fill);
  svg += `<rect x="44" y="44" width="172" height="72" fill="white" rx="6" opacity="0.85"/>`;
  svg += `<text x="130" y="90" text-anchor="middle" font-size="36" font-weight="bold" fill="${fs.color}">${from}态</text>`;
  
  // To box
  svg += hachureRect(r, 732, 40, 180, 80, ts.color, ts.fill);
  svg += `<rect x="736" y="44" width="172" height="72" fill="white" rx="6" opacity="0.85"/>`;
  svg += `<text x="822" y="90" text-anchor="middle" font-size="36" font-weight="bold" fill="${ts.color}">${to}态</text>`;
  
  // Arrow
  svg += arrowLine(r, 220, 80, 732, 80, labelColor, dashed);
  svg += `<rect x="386" y="58" width="180" height="36" rx="5" fill="white" opacity="0.92"/>`;
  svg += `<text x="476" y="82" text-anchor="middle" font-size="28" font-weight="bold" fill="${labelColor}">${label}</text>`;
  
  return svgWrap(W, H, svg);
}

function generateDualArrow(from, to, topLabel, topColor, botLabel, botColor) {
  const r = rc();
  const W = 952, H = 180;
  let svg = '';
  
  const states = {
    '阴天': { color: '#9C27B0', fill: '#F3E5F5' },
    '爆发': { color: '#F44336', fill: '#FFEBEE' },
  };
  
  const fs = states[from], ts = states[to];
  
  svg += hachureRect(r, 40, 50, 180, 80, fs.color, fs.fill);
  svg += `<rect x="44" y="54" width="172" height="72" fill="white" rx="6" opacity="0.85"/>`;
  svg += `<text x="130" y="100" text-anchor="middle" font-size="36" font-weight="bold" fill="${fs.color}">${from}态</text>`;
  
  svg += hachureRect(r, 732, 50, 180, 80, ts.color, ts.fill);
  svg += `<rect x="736" y="54" width="172" height="72" fill="white" rx="6" opacity="0.85"/>`;
  svg += `<text x="822" y="100" text-anchor="middle" font-size="36" font-weight="bold" fill="${ts.color}">${to}态</text>`;
  
  // Top arrow: from→to
  svg += arrowLine(r, 220, 70, 732, 70, topColor);
  svg += `<rect x="386" y="48" width="180" height="32" rx="5" fill="white" opacity="0.92"/>`;
  svg += `<text x="476" y="70" text-anchor="middle" font-size="26" font-weight="bold" fill="${topColor}">${topLabel}</text>`;
  
  // Bottom arrow: to→from
  svg += arrowLine(r, 732, 110, 220, 110, botColor);
  svg += `<rect x="386" y="96" width="180" height="32" rx="5" fill="white" opacity="0.92"/>`;
  svg += `<text x="476" y="118" text-anchor="middle" font-size="26" font-weight="bold" fill="${botColor}">${botLabel}</text>`;
  
  // Loop symbol
  svg += `<text x="476" y="160" text-anchor="middle" font-size="30" fill="#F44336" font-weight="bold">↻ 死循环</text>`;
  
  return svgWrap(W, H, svg);
}

function generateRecoveryDiagram() {
  const r = rc();
  const W = 952, H = 200;
  let svg = '';
  
  // Frozen
  svg += hachureRect(r, 40, 20, 160, 60, '#2196F3', '#E3F2FD');
  svg += `<rect x="44" y="24" width="152" height="52" fill="white" rx="6" opacity="0.85"/>`;
  svg += `<text x="120" y="58" text-anchor="middle" font-size="30" font-weight="bold" fill="#2196F3">🧊 冷冻态</text>`;
  
  // Unstable
  svg += hachureRect(r, 40, 100, 160, 60, '#9C27B0', '#F3E5F5');
  svg += `<rect x="44" y="104" width="152" height="52" fill="white" rx="6" opacity="0.85"/>`;
  svg += `<text x="120" y="138" text-anchor="middle" font-size="30" font-weight="bold" fill="#9C27B0">🌧️ 阴天态</text>`;
  
  // Recovery target
  svg += hachureRect(r, 752, 50, 160, 70, '#4CAF50', '#E8F5E9');
  svg += `<rect x="756" y="54" width="152" height="62" fill="white" rx="6" opacity="0.85"/>`;
  svg += `<text x="832" y="92" text-anchor="middle" font-size="30" font-weight="bold" fill="#4CAF50">😌 平静态</text>`;
  
  // ❼ dashed
  svg += arrowLine(r, 200, 50, 752, 72, '#9E9E9E', true);
  svg += `<rect x="410" y="38" width="140" height="28" rx="4" fill="white" opacity="0.92"/>`;
  svg += `<text x="480" y="57" text-anchor="middle" font-size="22" fill="#9E9E9E">❼ 自行恢复</text>`;
  
  // Loop dashed
  svg += arrowLine(r, 200, 125, 752, 100, '#9E9E9E', true);
  svg += `<rect x="405" y="98" width="140" height="28" rx="4" fill="white" opacity="0.92"/>`;
  svg += `<text x="475" y="117" text-anchor="middle" font-size="22" fill="#9E9E9E">反复循环 ↻</text>`;
  
  // ❽ green bold
  svg += arrowLine(r, 200, 130, 752, 88, '#4CAF50');
  svg += `<rect x="400" y="148" width="180" height="34" rx="5" fill="white" opacity="0.95" stroke="#4CAF50" stroke-width="1.5"/>`;
  svg += `<text x="490" y="170" text-anchor="middle" font-size="24" font-weight="bold" fill="#2E7D32">✅ ❽ 认真哄好了</text>`;
  
  return svgWrap(W, H, svg);
}

// ─── Save SVGs as PNG via Playwright ───
async function svgToDataUri(svgContent) {
  const buf = Buffer.from(svgContent);
  return `data:image/svg+xml;base64,${buf.toString('base64')}`;
}

// ─── CSS base ───
const BASE_CSS = `*{margin:0;padding:0;box-sizing:border-box}
body{width:1080px;background:#FFF9F0;font-family:'PingFang SC','Microsoft YaHei',sans-serif;color:#2C3E50}
.wrap{padding:30px 32px 30px 32px}
.handwrite{font-family:'Humor Sans','Comic Sans MS',cursive,sans-serif}
h2{font-size:80px;font-weight:900;line-height:1.2}
.sub{font-size:40px;color:#7F8C8D;margin-bottom:14px}
.txt{font-size:38px;line-height:1.5}
.sm{font-size:32px;color:#7F8C8D}
.card{background:#fff;border-radius:12px;padding:22px 26px;margin:12px 0;box-shadow:0 2px 10px rgba(0,0,0,.05)}
.highlight{color:#F44336;font-weight:bold}
.green{color:#4CAF50;font-weight:bold}
.foot{position:fixed;bottom:28px;left:56px;font-size:28px;color:#7F8C8D}
svg text{font-family:'PingFang SC','Microsoft YaHei',sans-serif}`;

// ─── Generate all 9 HTML slides ───
async function generateSlides() {
  // Pre-generate all rough.js SVGs
  const smFull = generateStateMachineFull();
  const sm12a = generateMiniStateMachine('平静', '酝酿', '❶ 忽视预警', '#FF9800');
  const sm12b = generateMiniStateMachine('平静', '酝酿', '❶ 忽视预警', '#FF9800', true); // unused, use single with both
  const sm34 = generateMiniStateMachine('酝酿', '爆发', '❸ 继续忽视', '#F44336');
  const sm56 = generateMiniStateMachine('爆发', '冷冻', '❹ 无人劝阻', '#2196F3');
  const sm57 = generateDualArrow('阴天', '爆发', '❺ 道歉失败', '#F44336', '❻ 二次爆发', '#9C27B0');
  const smRecovery = generateRecoveryDiagram();

  // Save SVGs for debugging
  fs.writeFileSync(`${DIR}/debug-sm-full.svg`, smFull);

  // Slide 1 - Cover
  const slides = [];

  slides.push(`<!DOCTYPE html><html><head><meta charset="utf-8"><style>${BASE_CSS}</style></head><body>
<div class="wrap" style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:1440px;text-align:center">
  <div style="font-size:140px;margin-bottom:14px">💢</div>
  <h1 class="handwrite" style="font-size:90px;font-weight:900;line-height:1.3;text-align:center">老婆的生气周期<br>分析报告</h1>
  <p class="sub" style="text-align:center;margin-bottom:28px">一个理工男用状态机图的硬核分析</p>
  <div style="width:100px;height:3px;background:#2C3E50;opacity:.15;margin:0 auto 36px"></div>
  <p class="sm handwrite">State Diagram Analysis v1.0</p>
</div>
<div class="foot handwrite">© 架构活了@小红书</div>
</body></html>`);

  // Slide 2 - Why
  slides.push(`<!DOCTYPE html><html><head><meta charset="utf-8"><style>${BASE_CSS}</style></head><body>
<div class="wrap" style="min-height:1440px">
  <h2 class="handwrite">🤔 为什么画这个</h2>
  <div style="height:2px;background:#2C3E50;opacity:.1;margin:12px 0 32px"></div>
  <div class="txt" style="margin:14px 0">
    <p style="margin:10px 0">• 理工男职业病，看什么都想建模</p>
    <p style="margin:10px 0">• 老婆生气这件事，比任何系统都复杂</p>
    <p style="margin:10px 0">• 于是我决定认真分析一下</p>
  </div>
  <div style="text-align:center;margin:28px 0">
    <div style="font-size:100px">👨‍💻　👩</div>
    <p class="sm" style="margin-top:8px">（大概是这个感觉）</p>
  </div>
  <div class="card">
    <p class="txt handwrite" style="text-align:center">"建模是理工男最后的倔强<br>——虽然模型跑出来自己也看不懂"</p>
  </div>
</div>
<div class="foot">Page 2 / 9</div>
</body></html>`);

  // Slide 3 - State machine full
  const smFullUri = await svgToDataUri(smFull);
  slides.push(`<!DOCTYPE html><html><head><meta charset="utf-8"><style>${BASE_CSS}</style></head><body>
<div class="wrap" style="min-height:1440px">
  <h2 class="handwrite">📊 状态机图全貌</h2>
  <p class="sub">老婆情绪系统的完整状态转移图 · 8条路径一览</p>
  <div style="height:2px;background:#2C3E50;opacity:.1;margin:6px 0 10px"></div>
  <div style="text-align:center;margin:6px 0">
    <img src="${smFullUri}" width="960" height="820" style="max-width:100%">
  </div>
  <div class="card">
    <p class="txt" style="text-align:center">5个状态 · 8条转移路径 · 唯一正确出口：❽</p>
  </div>
</div>
<div class="foot">Page 3 / 9</div>
</body></html>`);

  // Slide 4 - Chapter 1
  const sm41 = generateMiniStateMachine('平静', '酝酿', '❶ 忽视预警 / ❷ "你随意吧"', '#FF9800');
  const sm41Uri = await svgToDataUri(sm41);
  slides.push(`<!DOCTYPE html><html><head><meta charset="utf-8"><style>${BASE_CSS}</style></head><body>
<div class="wrap">
  <h2 class="handwrite">第一章：暴风雨前的宁静</h2>
  <div class="sub">一切从"你随意吧"开始……</div>
  <div class="card">
    <div class="txt" style="margin-bottom:10px"><span class="highlight">⚠️ 高危触发信号</span></div>
    <div class="txt" style="line-height:1.7">
      🔴 "你随意吧"<br>
      🔴 突然安静<br>
      🔴 微笑表情包 🙂<br>
      🔴 "你看看你做的这些事"
    </div>
  </div>
  <div class="card">
    <div class="txt"><span class="highlight">⏱ 恢复窗口：10分钟 ~ 2小时</span></div>
    <div class="sm">错过窗口，自动进入酝酿态</div>
  </div>
  <div style="text-align:center;margin:8px 0">
    <img src="${sm41Uri}" width="952" height="160" style="max-width:100%">
  </div>
  <div style="padding:18px 25px;background:linear-gradient(90deg,#FFF3E0,#FFEBEE);border-radius:12px;border-left:4px solid #F44336">
    <div class="txt handwrite" style="font-style:italic">"这个阶段最好识别，但大多数男人选择无视。"</div>
  </div>
</div>
<div class="foot">4 / 9</div>
</body></html>`);

  // Slide 5 - Chapter 2
  const sm5Uri = await svgToDataUri(sm34);
  slides.push(`<!DOCTYPE html><html><head><meta charset="utf-8"><style>${BASE_CSS}</style></head><body>
<div class="wrap">
  <h2 class="handwrite">第二章：你居然没发现？</h2>
  <div class="sub">她给了你2小时窗口，你用来打游戏了……</div>
  <div class="card">
    <div class="txt" style="margin-bottom:10px"><span class="highlight">👻 酝酿期的"隐形信号"</span></div>
    <div class="txt" style="line-height:1.7">
      📦 收拾东西声特别大<br>
      🚪 关门声比平时重<br>
      💬 回消息从秒回到轮回<br>
      📱 刷手机但不是在笑
    </div>
  </div>
  <div class="card" style="border-left:4px solid #F44336">
    <div class="txt"><span class="highlight">🚨 窗口关闭标志</span></div>
    <div class="txt" style="margin-top:6px;font-size:48px;font-weight:bold">"算了，跟你说也没用"</div>
    <div class="sm" style="margin-top:6px">听到这句话，你还有大约30秒……</div>
  </div>
  <div style="text-align:center;margin:8px 0">
    <img src="${sm5Uri}" width="952" height="160" style="max-width:100%">
  </div>
  <div style="padding:18px 25px;background:linear-gradient(90deg,#FFF3E0,#FFEBEE);border-radius:12px;border-left:4px solid #FF9800">
    <div class="txt handwrite" style="font-style:italic">"她在等你主动，你却觉得一切正常。"</div>
  </div>
</div>
<div class="foot">5 / 9</div>
</body></html>`);

  // Slide 6 - Chapter 3
  const sm6Uri = await svgToDataUri(sm56);
  slides.push(`<!DOCTYPE html><html><head><meta charset="utf-8"><style>${BASE_CSS}</style></head><body>
<div class="wrap">
  <h2 class="handwrite">第三章：全面崩溃</h2>
  <div class="sub">爆发不是终点，冷冻才是……</div>
  <div style="display:flex;gap:12px">
    <div class="card" style="flex:1;border-top:4px solid #F44336">
      <div class="txt" style="margin-bottom:10px"><span class="highlight">💥 爆发态</span></div>
      <div class="txt" style="line-height:1.6">
        语速加快<br>
        翻旧账（从去年开始）<br>
        摔门<br>
        "你永远都是这样！"
      </div>
    </div>
    <div class="card" style="flex:1;border-top:4px solid #1565C0">
      <div class="txt" style="margin-bottom:10px;color:#1565C0;font-weight:bold">🧊 冷冻态</div>
      <div class="txt" style="line-height:1.6">
        不说话<br>
        分房睡<br>
        朋友圈伤感文案<br>
        "你开心就好"
      </div>
    </div>
  </div>
  <div class="card" style="text-align:center">
    <div class="txt">恢复难度 <span style="font-size:30px">⭐⭐⭐⭐⭐</span></div>
  </div>
  <div style="text-align:center;margin:8px 0">
    <img src="${sm6Uri}" width="952" height="160" style="max-width:100%">
  </div>
  <div style="padding:18px 25px;background:linear-gradient(90deg,#FFEBEE,#E3F2FD);border-radius:12px;border-left:4px solid #1565C0">
    <div class="txt handwrite" style="font-style:italic">"冷冻态不是冷静，是心寒。热量没了，就再也点不起来了。"</div>
  </div>
</div>
<div class="foot">6 / 9</div>
</body></html>`);

  // Slide 7 - Chapter 4
  const sm7Uri = await svgToDataUri(sm57);
  slides.push(`<!DOCTYPE html><html><head><meta charset="utf-8"><style>${BASE_CSS}</style></head><body>
<div class="wrap">
  <h2 class="handwrite">第四章：最危险的死循环</h2>
  <div class="sub">你以为结束了，其实只是开始了……</div>
  <div class="card">
    <div class="txt" style="margin-bottom:10px"><span style="color:#9C27B0;font-weight:bold">☁️ 阴天态特征</span></div>
    <div class="txt" style="line-height:1.6">
      表面说"算了没事了" — <span class="highlight">但并没有</span><br>
      对你的态度"还行" — 但明显少了点什么<br>
      偶尔翻个白眼 — 你假装没看见
    </div>
  </div>
  <div style="display:flex;gap:12px">
    <div class="card" style="flex:1;border-left:4px solid #F44336">
      <div class="txt" style="margin-bottom:8px"><span class="highlight">❺ 道歉失败</span></div>
      <div class="txt" style="line-height:1.6">
        ❌ "我来跟你讲道理"<br>
        ❌ "分析一下对错"<br>
        ❌ "我都道歉了你还要怎样"
      </div>
    </div>
    <div class="card" style="flex:1;border-left:4px solid #FF5722">
      <div class="txt" style="margin-bottom:8px;color:#FF5722;font-weight:bold">❻ 二次爆发</div>
      <div class="txt" style="line-height:1.6">
        比第一次更猛烈<br>
        加上"你上次也是这样"<br>
        进入死循环 ♾️
      </div>
    </div>
  </div>
  <div style="text-align:center;margin:8px 0">
    <img src="${sm7Uri}" width="952" height="180" style="max-width:100%">
  </div>
  <div style="padding:18px 25px;background:linear-gradient(90deg,#F3E5F5,#FFEBEE);border-radius:12px;border-left:4px solid #9C27B0">
    <div class="txt handwrite" style="font-style:italic">"阴天态是最危险的，因为你觉得'已经过去了'。"</div>
  </div>
</div>
<div class="foot">7 / 9</div>
</body></html>`);

  // Slide 8 - Recovery
  const sm8Uri = await svgToDataUri(smRecovery);
  slides.push(`<!DOCTYPE html><html><head><meta charset="utf-8"><style>${BASE_CSS}</style></head><body>
<div class="wrap">
  <h2 class="handwrite">终章：唯一的修复方案</h2>
  <div class="sub">三条路，只有一条是对的</div>
  <div style="display:flex;gap:10px;margin-bottom:14px">
    <div class="card" style="flex:1;border-top:3px solid #1565C0">
      <div class="txt" style="color:#1565C0;font-weight:bold;margin-bottom:8px">❶ 冷冻态恢复</div>
      <div class="sm" style="line-height:1.45">
        靠时间慢慢融化<br>
        <span class="highlight">但有后遗症</span><br>
        信任裂痕永久留存
      </div>
    </div>
    <div class="card" style="flex:1;border-top:3px solid #9C27B0">
      <div class="txt" style="color:#9C27B0;font-weight:bold;margin-bottom:8px">❷ 阴天态假恢复</div>
      <div class="sm" style="line-height:1.45">
        反复循环<br>
        <span class="highlight">越闹越凶</span><br>
        能量持续消耗
      </div>
    </div>
    <div class="card" style="flex:1;border-top:3px solid #4CAF50;background:#F1F8E9">
      <div class="txt green" style="margin-bottom:8px">✅ ❽ 正确出口</div>
      <div class="sm" style="line-height:1.45">
        认真听她说话<br>
        <span class="green">情绪被看见</span><br>
        一次性修复
      </div>
    </div>
  </div>
  <div style="text-align:center;padding:28px;background:linear-gradient(135deg,#E8F5E9,#C8E6C9);border-radius:12px;margin-bottom:14px">
    <div class="handwrite" style="font-size:68px;font-weight:900;color:#2E7D32;letter-spacing:4px">"认真听她说话"</div>
  </div>
  <div style="text-align:center;margin:8px 0">
    <img src="${sm8Uri}" width="952" height="200" style="max-width:100%">
  </div>
  <div style="padding:18px 25px;background:#F5F5F5;border-radius:12px;border-left:4px solid #003057">
    <div class="sm" style="color:#666;margin-bottom:6px">🚗 沃尔沃类比</div>
    <div class="txt" style="font-size:36px;color:#444">"能预警碰撞，预警不了'我没事'。<br>安全不只是技术，也是一种态度。"</div>
  </div>
</div>
<div class="foot">8 / 9</div>
</body></html>`);

  // Slide 9 - Brand
  slides.push(`<!DOCTYPE html><html><head><meta charset="utf-8"><style>
*{margin:0;padding:0;box-sizing:border-box}
body{width:1080px;height:1440px;display:flex;flex-direction:column;align-items:center;justify-content:center;background:linear-gradient(135deg,#1a1a2e,#16213e,#0f3460);color:#fff;font-family:'PingFang SC','Microsoft YaHei',sans-serif}
</style></head><body>
  <div style="text-align:center">
    <p style="font-size:36px;opacity:.4;margin-bottom:14px">[ 此处放沃尔沃车型图 ]</p>
    <div style="width:580px;height:380px;border:2px dashed rgba(255,255,255,.15);border-radius:20px;display:flex;align-items:center;justify-content:center;margin:0 auto">
      <p style="font-size:54px;opacity:.25">Volvo Car Image Placeholder</p>
    </div>
  </div>
  <p class="handwrite" style="margin-top:40px;font-size:54px;font-weight:300">安全，从认真对待身边人开始。</p>
  <p style="position:fixed;bottom:36px;right:64px;font-size:44px;font-weight:700;opacity:.5">Volvo</p>
  <p style="position:fixed;bottom:36px;left:64px;font-size:54px;opacity:.25">Page 9 / 9</p>
</body></html>`);

  return slides;
}

// ─── Screenshot with Playwright ───
async function screenshotSlides(htmlSlides) {
  const browser = await chromium.launch({
    executablePath: process.env.HOME + '/.cache/ms-playwright/chromium-1208/chrome-linux64/chrome',
    args: ['--no-sandbox']
  });
  const ctx = await browser.newContext({ deviceScaleFactor: 2 });
  const page = await ctx.newPage();

  for (let i = 0; i < htmlSlides.length; i++) {
    const html = htmlSlides[i];
    await page.setContent(html, { waitUntil: 'networkidle' });
    const height = await page.evaluate(() => document.documentElement.scrollHeight);
    await page.setViewportSize({ width: 1080, height: Math.max(height, 1440) });
    await page.screenshot({ path: `${DIR}/slide-${String(i+1).padStart(2,'0')}.png`, fullPage: true });
    console.log(`✅ slide-${String(i+1).padStart(2,'0')}.png`);
  }

  await browser.close();
}

// ─── Main ───
(async () => {
  console.log('Generating rough.js SVGs...');
  const slides = await generateSlides();
  console.log('Screenshoting...');
  await screenshotSlides(slides);
  console.log('Done!');
})();
