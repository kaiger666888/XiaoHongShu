const RC = require('roughjs').generator;
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright-core');
const sharp = require('sharp');

const W = 1080;
const rc = new RC();

// Colors
const C = {
  calm: '#4CAF50', brew: '#FF9800', burst: '#F44336',
  freeze: '#2196F3', cloudy: '#9E9E9E', dark: '#2d3436',
  white: '#ffffff', lightGray: '#f5f5f5'
};

const FONT = `'Comic Sans MS','Segoe Print',cursive,sans-serif`;

// Helper: text with bg
function t(x, y, text, size=14, color=C.dark, anchor='middle', bold=false, bg=false) {
  const fw = bold ? 'font-weight="bold"' : '';
  const esc = text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  if (bg) {
    const tw = esc.length * size * 0.6 + 12;
    return `<rect x="${x-tw/2}" y="${y-size*0.85}" width="${tw}" height="${size+6}" fill="white" rx="4" opacity="0.88"/><text x="${x}" y="${y}" text-anchor="${anchor}" font-size="${size}" fill="${color}" font-family="${FONT}" ${fw}>${esc}</text>`;
  }
  return `<text x="${x}" y="${y}" text-anchor="${anchor}" font-size="${size}" fill="${color}" font-family="${FONT}" ${fw}>${esc}</text>`;
}

// Helper: rough rect to SVG paths
function roughRect(x, y, w, h, stroke, fill, roughness=1.2) {
  const shape = rc.rectangle(x, y, w, h, { stroke, fill, fillStyle:'hachure', hachureAngle:-45, hachureGap:7, strokeWidth:2, roughness });
  return shape.sets.map(p => {
    const d = rc.opsToPath(p);
    return p.type === 'fillPath'
      ? `<path d="${d}" fill="${fill}" stroke="none"/>`
      : `<path d="${d}" fill="none" stroke="${stroke}" stroke-width="2"/>`;
  }).join('\n');
}

// Helper: rough circle to SVG
function roughCircle(cx, cy, r, stroke, fill, roughness=1.2) {
  const shape = rc.circle(cx, cy, r, { stroke, fill, fillStyle:'hachure', hachureAngle:-45, hachureGap:7, strokeWidth:2, roughness });
  return shape.sets.map(p => {
    const d = rc.opsToPath(p);
    return p.type === 'fillPath'
      ? `<path d="${d}" fill="${fill}" stroke="none"/>`
      : `<path d="${d}" fill="none" stroke="${stroke}" stroke-width="2"/>`;
  }).join('\n');
}

// Helper: rough line
function roughLine(x1, y1, x2, y2, color='#555') {
  const shape = rc.line(x1, y1, x2, y2, { stroke:color, strokeWidth:2, roughness:1.2 });
  return shape.sets.map(p => {
    const d = rc.opsToPath(p);
    return `<path d="${d}" fill="none" stroke="${color}" stroke-width="2"/>`;
  }).join('\n');
}

// SVG wrapper
function svg(w, h, elements) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><style>text{font-family:${FONT};}</style>${elements.join('\n')}</svg>`;
}

// State node (rounded rect + emoji + name)
function stateNode(cx, cy, emoji, name, color, w=160, h=70) {
  const x = cx - w/2, y = cy - h/2;
  let out = roughRect(x, y, w, h, color, color);
  out += `<rect x="${x+4}" y="${y+4}" width="${w-8}" height="${h-8}" fill="white" rx="6" opacity="0.88"/>`;
  out += `<text x="${cx}" y="${cy-8}" text-anchor="middle" font-size="26">${emoji}</text>`;
  out += t(cx, cy+22, name, 16, color, 'middle', true);
  return out;
}

// Arrow with label
function arrow(x1, y1, x2, y2, color='#555', label='') {
  const dx = x2-x1, dy = y2-y1;
  const len = Math.sqrt(dx*dx+dy*dy);
  const ux = dx/len, uy = dy/len;
  const ax = x2 - ux*10, ay = y2 - uy*10;
  let out = roughLine(x1, y1, ax, ay, color);
  // arrowhead
  const px = -uy, py = ux;
  out += `<polygon points="${x2},${y2} ${ax+px*6},${ay+py*6} ${ax-px*6},${ay-py*6}" fill="${color}"/>`;
  if (label) {
    const mx = (x1+x2)/2 + px*18, my = (y1+y2)/2 + py*18;
    out += t(mx, my, label, 13, color, 'middle', false, true);
  }
  return out;
}

// Curved arrow (for loops) using quadratic bezier
function curvedArrow(x1, y1, cx1, cy1, x2, y2, color='#555', label='') {
  let out = `<path d="M${x1},${y1} Q${cx1},${cy1} ${x2},${y2}" fill="none" stroke="${color}" stroke-width="2" stroke-dasharray="none"/>`;
  // arrowhead
  const t2 = 0.95;
  const ax = (1-t2)*(1-t2)*x1 + 2*(1-t2)*t2*cx1 + t2*t2*x2;
  const ay = (1-t2)*(1-t2)*y1 + 2*(1-t2)*t2*cy1 + t2*t2*y2;
  const tdx = 2*(1-t2)*(cx1-x1) + 2*t2*(x2-cx1);
  const tdy = 2*(1-t2)*(cy1-y1) + 2*t2*(y2-cy1);
  const tl = Math.sqrt(tdx*tdx+tdy*tdy);
  const tux = tdx/tl, tuy = tdy/tl;
  const tpx = -tuy, tpy = tux;
  out += `<polygon points="${x2},${y2} ${ax+tux*2+tpx*5},${ay+tuy*2+tpy*5} ${ax+tux*2-tpx*5},${ay+tuy*2-tpy*5}" fill="${color}"/>`;
  if (label) {
    out += t(cx1 + (cx1 > (x1+x2)/2 ? 15 : -15), cy1 - 10, label, 13, color, 'middle', false, true);
  }
  return out;
}

// Numbered circle badge
function badge(x, y, num, color='#555') {
  const r = 14;
  let out = roughCircle(x, y, r*2, color, color);
  out += `<rect x="${x-r+2}" y="${y-r+2}" width="${r*2-4}" height="${r*2-4}" fill="white" rx="10" opacity="0.88"/>`;
  out += t(x, y+5, num, 13, color, 'middle', true);
  return out;
}

// ===================== SLIDES =====================

function slide1() {
  const h = 1440;
  const els = [];
  // Big rough border
  els.push(roughRect(40, 40, W-80, h-80, '#555', '#fafafa', 1.5));
  // Title
  els.push(t(W/2, 400, '老婆的生气周期', 52, C.dark, 'middle', true));
  els.push(t(W/2, 470, '· 分析报告 ·', 36, '#666', 'middle'));
  // Divider line
  els.push(roughLine(200, 520, 880, 520, '#ccc'));
  // Subtitle
  els.push(t(W/2, 600, '一个理工男用状态机图的硬核分析', 24, '#888', 'middle'));
  // Emoji decoration
  els.push(t(W/2, 750, '😌  🤔  💢  🧊  🌧️', 48, C.dark, 'middle'));
  // Author
  els.push(t(W/2, 950, '架构活了 @小红书', 22, '#999', 'middle'));
  // Decorative boxes
  els.push(roughRect(80, 1050, 200, 60, C.calm, C.calm));
  els.push(`<rect x="84" y="1054" width="192" height="52" fill="white" rx="4" opacity="0.88"/>`);
  els.push(t(180, 1085, '状态机分析', 16, C.calm, 'middle', true));
  els.push(roughRect(440, 1050, 200, 60, C.burst, C.burst));
  els.push(`<rect x="444" y="1054" width="192" height="52" fill="white" rx="4" opacity="0.88"/>`);
  els.push(t(540, 1085, '路径推导', 16, C.burst, 'middle', true));
  els.push(roughRect(800, 1050, 200, 60, C.freeze, C.freeze));
  els.push(`<rect x="804" y="1054" width="192" height="52" fill="white" rx="4" opacity="0.88"/>`);
  els.push(t(900, 1085, '修复方案', 16, C.freeze, 'middle', true));
  return svg(W, h, els);
}

function slide2() {
  const h = 1500;
  const els = [];
  els.push(roughRect(40, 40, W-80, h-80, '#555', '#fafafa', 1.5));
  els.push(t(W/2, 130, '🤔 为什么画这个', 36, C.dark, 'middle', true));
  els.push(roughLine(150, 170, 930, 170, '#ccc'));
  
  const points = [
    '因为被问了太多次「你到底在气什么」',
    '因为理工男的理解方式就是画图',
    '因为发现这玩意居然是个死循环……'
  ];
  points.forEach((p, i) => {
    const y = 280 + i * 120;
    els.push(roughRect(120, y-30, W-240, 80, '#ddd', '#f9f9f9'));
    els.push(`<rect x="124" y="${y-26}" width="${W-248}" height="72" fill="white" rx="4" opacity="0.88"/>`);
    els.push(t(W/2, y+12, p, 22, C.dark, 'middle'));
  });

  // Quote box
  els.push(roughRect(100, 680, W-200, 160, C.burst, '#fff3e0'));
  els.push(`<rect x="104" y="684" width="${W-208}" height="152" fill="white" rx="6" opacity="0.88"/>`);
  els.push(t(W/2, 740, '「如果你看不懂她的状态机，', 24, C.burst, 'middle', true));
  els.push(t(W/2, 780, '那你永远走不出这个循环。」', 24, C.burst, 'middle', true));

  // Bottom note
  els.push(t(W/2, 950, '于是，一本正经地开始了分析……', 20, '#999', 'middle'));
  els.push(t(W/2, 1020, '📊 用 UML 状态机图 · 系统化建模', 18, '#bbb', 'middle'));
  return svg(W, h, els);
}

function slide3() {
  const h = 1600;
  const els = [];
  els.push(roughRect(30, 30, W-60, h-60, '#555', '#fafafa', 1.5));
  els.push(t(W/2, 100, '老婆的生气周期 · 状态机全貌', 32, C.dark, 'middle', true));
  els.push(roughLine(150, 130, 930, 130, '#ccc'));

  // 5 states positioned
  const states = [
    { cx:540, cy:320, emoji:'😌', name:'平静态', color:C.calm },
    { cx:240, cy:560, emoji:'🤔', name:'酝酿态', color:C.brew },
    { cx:540, cy:800, emoji:'💢', name:'爆发态', color:C.burst },
    { cx:840, cy:560, emoji:'🧊', name:'冷冻态', color:C.freeze },
    { cx:840, cy:800, emoji:'🌧️', name:'阴天态', color:C.cloudy },
  ];
  states.forEach(s => els.push(stateNode(s.cx, s.cy, s.emoji, s.name, s.color)));

  // Arrows with labels
  // ❶ 平静→酝酿
  els.push(arrow(470, 345, 310, 535, C.brew));
  els.push(badge(370, 420, '❶', C.brew));
  els.push(t(340, 400, '触发事件', 12, '#888', 'middle', false, true));

  // ❷ 酝酿→平静
  els.push(arrow(310, 535, 470, 345, C.calm));
  els.push(badge(430, 420, '❷', C.calm));
  els.push(t(460, 440, '10min内哄好', 12, '#888', 'middle', false, true));

  // ❸ 酝酿→爆发
  els.push(arrow(310, 585, 470, 775, C.burst));
  els.push(badge(360, 680, '❸', C.burst));
  els.push(t(340, 700, '你居然没发现', 12, '#888', 'middle', false, true));

  // ❹ 爆发→冷冻
  els.push(arrow(610, 790, 770, 575, C.freeze));
  els.push(badge(710, 680, '❹', C.freeze));

  // ❺ 阴天→爆发
  els.push(curvedArrow(840, 770, 920, 860, 620, 810, C.burst));
  els.push(badge(880, 850, '❺', C.burst));

  // ❻ 爆发→阴天
  els.push(arrow(610, 820, 770, 810, C.cloudy));
  els.push(badge(690, 840, '❻', C.cloudy));

  // ❼ 冷冻→平静
  els.push(arrow(870, 535, 580, 330, C.calm));
  els.push(badge(750, 400, '❼', C.calm));
  els.push(t(790, 380, '冷战结束', 12, '#888', 'middle', false, true));

  // ❽ 阴天→平静
  els.push(curvedArrow(840, 770, 1000, 900, 600, 340, C.calm));
  els.push(badge(920, 700, '❽', C.calm));

  // Death loop indicator
  els.push(roughCircle(700, 850, 50, C.burst, '#ffebee'));
  els.push(`<rect x="652" y="802" width="96" height="96" fill="white" rx="20" opacity="0.88"/>`);
  els.push(t(700, 845, '↻', 30, C.burst, 'middle'));
  els.push(t(700, 870, '死循环', 13, C.burst, 'middle', true));

  // Legend at bottom
  els.push(roughRect(100, 1050, W-200, 350, '#aaa', '#f5f5f5'));
  els.push(`<rect x="104" y="1054" width="${W-208}" height="342" fill="white" rx="4" opacity="0.88"/>`);
  els.push(t(W/2, 1090, '8条转移路径说明', 20, C.dark, 'middle', true));
  const legend = [
    '❶ 触发事件 → 进入酝酿    ❷ 10分钟内哄好 → 恢复平静',
    '❸ 你没发现 → 直接爆发     ❹ 爆发后 → 进入冷冻',
    '❺ 阴天中再踩雷 → 再次爆发  ❻ 爆发后残留 → 变阴天',
    '❼ 冷战结束 → 恢复平静     ❽ 阴天渐消 → 回归平静'
  ];
  legend.forEach((l, i) => els.push(t(W/2, 1140 + i*40, l, 17, '#555', 'middle')));

  return svg(W, h, els);
}

function slide4() {
  const h = 1500;
  const els = [];
  els.push(roughRect(40, 40, W-80, h-80, '#555', '#fafafa', 1.5));
  els.push(t(W/2, 110, '第一章：暴风雨前的宁静', 32, C.dark, 'middle', true));
  els.push(t(W/2, 150, '😌 平静态 → 🤔 酝酿态（❶❷）', 22, '#666', 'middle'));
  els.push(roughLine(150, 175, 930, 175, '#ccc'));

  // Local state diagram
  els.push(stateNode(250, 320, '😌', '平静态', C.calm));
  els.push(stateNode(700, 320, '🤔', '酝酿态', C.brew));
  els.push(arrow(330, 310, 620, 310, C.brew));
  els.push(badge(475, 280, '❶', C.brew));
  els.push(t(475, 260, '触发事件', 14, '#888', 'middle', false, true));
  els.push(arrow(620, 350, 330, 350, C.calm));
  els.push(badge(475, 380, '❷', C.calm));
  els.push(t(475, 400, '及时哄好', 14, '#888', 'middle', false, true));

  // Trigger signals box
  els.push(roughRect(100, 460, W-200, 420, C.brew, '#fff3e0'));
  els.push(`<rect x="104" y="464" width="${W-208}" height="412" fill="white" rx="6" opacity="0.88"/>`);
  els.push(t(W/2, 510, '⚠️ 高危触发信号', 24, C.brew, 'middle', true));
  
  const signals = [
    '• 回消息变慢了（从秒回到分钟级）',
    '• 语气从「嗯嗯」变成「嗯。」',
    '• 开始说「随便」「都行」「你看着办」',
    '• 笑容消失，表情管理进入静默模式',
    '• 突然开始收拾房间（暴风雨前的整理）',
    '• 问「你觉得我刚才说的是什么意思？」',
  ];
  signals.forEach((s, i) => els.push(t(W/2, 560 + i*38, s, 18, '#555', 'middle')));

  // Recovery window
  els.push(roughRect(250, 950, 580, 100, C.calm, '#e8f5e9'));
  els.push(`<rect x="254" y="954" width="572" height="92" fill="white" rx="6" opacity="0.88"/>`);
  els.push(t(W/2, 990, '⏱️ 恢复窗口：10分钟 ~ 2小时', 24, C.calm, 'middle', true));
  els.push(t(W/2, 1025, '超时未处理 → 自动升级为酝酿态', 16, '#888', 'middle'));

  // Warning
  els.push(t(W/2, 1150, '💡 关键洞察：平静态不是终点，而是窗口期', 18, '#999', 'middle'));
  return svg(W, h, els);
}

function slide5() {
  const h = 1500;
  const els = [];
  els.push(roughRect(40, 40, W-80, h-80, '#555', '#fafafa', 1.5));
  els.push(t(W/2, 110, '第二章：你居然没发现？', 32, C.dark, 'middle', true));
  els.push(t(W/2, 150, '🤔 酝酿态 → 💢 爆发态（❸）', 22, '#666', 'middle'));
  els.push(roughLine(150, 175, 930, 175, '#ccc'));

  // Local state diagram
  els.push(stateNode(250, 310, '🤔', '酝酿态', C.brew));
  els.push(stateNode(700, 310, '💢', '爆发态', C.burst));
  els.push(arrow(330, 310, 620, 310, C.burst));
  els.push(badge(475, 275, '❸', C.burst));
  els.push(t(475, 255, '你没发现！', 14, C.burst, 'middle', true, true));

  // Invisible signals
  els.push(roughRect(100, 430, W-200, 400, C.burst, '#ffebee'));
  els.push(`<rect x="104" y="434" width="${W-208}" height="392" fill="white" rx="6" opacity="0.88"/>`);
  els.push(t(W/2, 480, '👻 隐形信号（你以为没事了）', 24, C.burst, 'middle', true));

  const signals = [
    '• 她说「没事」= 有事（而且很严重）',
    '• 她说「我没事你玩吧」= 最后通牒',
    '• 她突然特别温柔 = 暴风雨前的最后宁静',
    '• 她开始叹气 = 蓄力阶段',
    '• 她问「你是不是觉得我不重要？」= 倒计时启动',
  ];
  signals.forEach((s, i) => els.push(t(W/2, 530 + i*38, s, 18, '#555', 'middle')));

  // Countdown
  els.push(roughRect(300, 900, 480, 120, C.burst, C.burst));
  els.push(`<rect x="304" y="904" width="472" height="112" fill="white" rx="6" opacity="0.88"/>`);
  els.push(t(W/2, 945, '⏰ 倒计时：30秒', 32, C.burst, 'middle', true));
  els.push(t(W/2, 985, '从「没事」到爆发的平均时间', 16, '#888', 'middle'));

  // Tip
  els.push(roughRect(150, 1100, W-300, 80, '#fff3e0', '#fff3e0'));
  els.push(`<rect x="154" y="1104" width="${W-308}" height="72" fill="white" rx="6" opacity="0.88"/>`);
  els.push(t(W/2, 1145, '⚠️ 此阶段唯一的正确操作：放下手机，看着她的眼睛', 18, C.brew, 'middle', true));
  return svg(W, h, els);
}

function slide6() {
  const h = 1550;
  const els = [];
  els.push(roughRect(40, 40, W-80, h-80, '#555', '#fafafa', 1.5));
  els.push(t(W/2, 110, '第三章：全面崩溃', 32, C.dark, 'middle', true));
  els.push(t(W/2, 150, '💢 爆发态 → 🧊 冷冻态（❹）', 22, '#666', 'middle'));
  els.push(roughLine(150, 175, 930, 175, '#ccc'));

  // Local state diagram
  els.push(stateNode(250, 300, '💢', '爆发态', C.burst));
  els.push(stateNode(700, 300, '🧊', '冷冻态', C.freeze));
  els.push(arrow(330, 300, 620, 300, C.freeze));
  els.push(badge(475, 265, '❹', C.freeze));

  // Burst characteristics
  els.push(roughRect(80, 400, 440, 320, C.burst, '#ffebee'));
  els.push(`<rect x="84" y="404" width="432" height="312" fill="white" rx="6" opacity="0.88"/>`);
  els.push(t(300, 440, '💢 爆发特征', 22, C.burst, 'middle', true));
  const burstF = ['声音分贝急剧上升', '逻辑链断裂，开始翻旧账', '眼泪/摔门/拉黑三连', '你的任何解释都是火上浇油'];
  burstF.forEach((s, i) => els.push(t(300, 490 + i*38, '• ' + s, 17, '#555', 'middle')));

  // Freeze characteristics
  els.push(roughRect(560, 400, 440, 320, C.freeze, '#e3f2fd'));
  els.push(`<rect x="564" y="404" width="432" height="312" fill="white" rx="6" opacity="0.88"/>`);
  els.push(t(780, 440, '🧊 冷冻特征', 22, C.freeze, 'middle', true));
  const freezeF = ['彻底不说话', '你的消息已读不回', '朋友圈三天可见变成仅自己可见', '你问她怎么了她说「没什么」'];
  freezeF.forEach((s, i) => els.push(t(780, 490 + i*38, '• ' + s, 17, '#555', 'middle')));

  // Difficulty rating
  els.push(roughRect(300, 780, 480, 120, C.burst, '#ffebee'));
  els.push(`<rect x="304" y="784" width="472" height="112" fill="white" rx="6" opacity="0.88"/>`);
  els.push(t(W/2, 820, '恢复难度', 24, C.burst, 'middle', true));
  els.push(t(W/2, 865, '⭐⭐⭐⭐⭐', 36, C.burst, 'middle'));

  // Recovery tips
  els.push(roughRect(150, 960, W-300, 140, C.freeze, '#e3f2fd'));
  els.push(`<rect x="154" y="964" width="${W-308}" height="132" fill="white" rx="6" opacity="0.88"/>`);
  els.push(t(W/2, 1005, '🧊 冷冻态恢复要点', 20, C.freeze, 'middle', true));
  els.push(t(W/2, 1040, '• 不要试图讲道理 · 不要冷战对冷战', 17, '#555', 'middle'));
  els.push(t(W/2, 1070, '• 诚恳道歉 + 具体行动 > 一万句「对不起」', 17, '#555', 'middle'));
  return svg(W, h, els);
}

function slide7() {
  const h = 1500;
  const els = [];
  els.push(roughRect(40, 40, W-80, h-80, '#555', '#fafafa', 1.5));
  els.push(t(W/2, 110, '第四章：最危险的死循环', 32, C.dark, 'middle', true));
  els.push(t(W/2, 150, '🌧️ 阴天态 ↔ 💢 爆发态（❺❻ ↻）', 22, '#666', 'middle'));
  els.push(roughLine(150, 175, 930, 175, '#ccc'));

  // Death loop diagram
  els.push(stateNode(300, 320, '🌧️', '阴天态', C.cloudy));
  els.push(stateNode(780, 320, '💢', '爆发态', C.burst));
  
  // Loop arrows
  els.push(arrow(380, 300, 700, 300, C.burst));
  els.push(badge(540, 265, '❺', C.burst));
  els.push(t(540, 245, '再踩雷', 14, '#888', 'middle', false, true));
  
  els.push(arrow(700, 350, 380, 350, C.cloudy));
  els.push(badge(540, 380, '❻', C.cloudy));
  els.push(t(540, 400, '爆发后残留', 14, '#888', 'middle', false, true));

  // Big loop symbol
  els.push(roughCircle(540, 320, 180, C.burst, '#ffebee'));
  els.push(`<rect x="362" y="232" width="356" height="176" fill="white" rx="20" opacity="0.75"/>`);
  els.push(t(540, 330, '↻ 死循环', 28, C.burst, 'middle', true));

  // Failed apologies
  els.push(roughRect(100, 480, W-200, 450, C.burst, '#ffebee'));
  els.push(`<rect x="104" y="484" width="${W-208}" height="442" fill="white" rx="6" opacity="0.88"/>`);
  els.push(t(W/2, 530, '❌ 道歉失败 Top 5（会让你陷入死循环）', 22, C.burst, 'middle', true));

  const fails = [
    '❌ 「行行行都是我的错行了吧」→ 嘲讽级道歉',
    '❌ 「你要这么想我也没办法」→ 摆烂级道歉',
    '❌ 「我都道歉了你还要怎样」→ 反问级道歉',
    '❌ 「好了好了别闹了」→ 轻视级道歉',
    '❌ 发个红包了事 → 物质级道歉',
  ];
  fails.forEach((f, i) => els.push(t(W/2, 585 + i*48, f, 19, '#555', 'middle')));

  // Warning
  els.push(roughRect(200, 1000, W-400, 100, C.burst, C.burst));
  els.push(`<rect x="204" y="1004" width="${W-408}" height="92" fill="white" rx="6" opacity="0.88"/>`);
  els.push(t(W/2, 1040, '🚨 每次假道歉 = 死循环 +1 圈', 26, C.burst, 'middle', true));
  els.push(t(W/2, 1075, '循环次数越多，恢复难度指数级上升', 16, '#888', 'middle'));
  return svg(W, h, els);
}

function slide8() {
  const h = 1550;
  const els = [];
  els.push(roughRect(40, 40, W-80, h-80, '#555', '#fafafa', 1.5));
  els.push(t(W/2, 110, '终章：唯一修复方案', 32, C.dark, 'middle', true));
  els.push(roughLine(150, 140, 930, 140, '#ccc'));

  // 3 recovery paths comparison
  const paths = [
    { title: '❌ 假道歉', desc: '「都是我的错」\n嘲讽/摆烂/敷衍', color: C.burst, result: '死循环+1', resultColor: C.burst },
    { title: '⚠️ 讲道理', desc: '「其实这件事的\n客观情况是……」', color: C.brew, result: '冷静期延长', resultColor: C.brew },
    { title: '✅ 认真听她说话', desc: '放下手机\n看着她的眼睛\n「你觉得哪里不舒服？」', color: C.calm, result: '✅ 修复成功', resultColor: C.calm },
  ];

  paths.forEach((p, i) => {
    const x = 100 + i * 320;
    const w = 290;
    els.push(roughRect(x, 200, w, 380, p.color, p.color === C.calm ? '#e8f5e9' : '#fafafa'));
    els.push(`<rect x="${x+4}" y="204" width="${w-8}" height="372" fill="white" rx="6" opacity="0.88"/>`);
    els.push(t(x+w/2, 240, p.title, 22, p.color, 'middle', true));
    els.push(roughLine(x+20, 265, x+w-20, 265, '#ddd'));
    
    const lines = p.desc.split('\n');
    lines.forEach((l, j) => els.push(t(x+w/2, 310 + j*40, l, 18, '#555', 'middle')));
    
    // Result
    els.push(roughRect(x+30, 500, w-60, 50, p.resultColor, p.resultColor === C.calm ? '#e8f5e9' : '#fff3e0'));
    els.push(`<rect x="${x+34}" y="504" width="${w-68}" height="42" fill="white" rx="4" opacity="0.88"/>`);
    els.push(t(x+w/2, 532, p.result, 18, p.resultColor, 'middle', true));
  });

  // Arrow pointing to correct one
  els.push(t(540, 630, '⬆️ 这才是正确答案', 24, C.calm, 'middle', true));

  // Volvo quote
  els.push(roughRect(150, 720, W-300, 200, '#1565c0', '#e3f2fd'));
  els.push(`<rect x="154" y="724" width="${W-308}" height="192" fill="white" rx="8" opacity="0.88"/>`);
  els.push(t(W/2, 780, '就像沃尔沃的安全理念：', 22, '#1565c0', 'middle', true));
  els.push(t(W/2, 830, '「最安全的车，不是碰撞测试得分最高的车，', 20, '#555', 'middle'));
  els.push(t(W/2, 865, '而是从一开始就不让你发生碰撞的车。」', 20, '#555', 'middle'));

  // Core message
  els.push(roughRect(200, 1000, W-400, 120, C.calm, '#e8f5e9'));
  els.push(`<rect x="204" y="1004" width="${W-408}" height="112" fill="white" rx="6" opacity="0.88"/>`);
  els.push(t(W/2, 1045, '真正的修复方案：', 22, C.calm, 'middle', true));
  els.push(t(W/2, 1085, '认真对待她的感受，从源头避免进入循环', 20, '#555', 'middle'));
  return svg(W, h, els);
}

function slide9() {
  const h = 1440;
  const els = [];
  els.push(roughRect(40, 40, W-80, h-80, '#555', '#fafafa', 1.5));

  // Car placeholder
  els.push(roughRect(190, 200, W-380, 500, '#1565c0', '#e3f2fd'));
  els.push(`<rect x="194" y="204" width="${W-388}" height="492" fill="white" rx="8" opacity="0.88"/>`);
  els.push(t(W/2, 400, '🚗', 80, '#1565c0', 'middle'));
  els.push(t(W/2, 480, 'Volvo XC90', 28, '#1565c0', 'middle', true));
  els.push(t(W/2, 520, '[ 车型图占位 ]', 20, '#999', 'middle'));

  // Quote
  els.push(roughLine(200, 780, 880, 780, '#ccc'));
  els.push(t(W/2, 880, '「安全，从认真对待身边人开始。」', 30, '#1565c0', 'middle', true));
  els.push(roughLine(200, 920, 880, 920, '#ccc'));

  // Brand elements
  els.push(t(W/2, 1020, '架构活了 @小红书', 22, '#999', 'middle'));
  els.push(t(W/2, 1070, '用理工男的方式，认真对待每一份感情', 18, '#bbb', 'middle'));

  // Tags
  const tags = ['#状态机', '#老婆生气', '#理工男', '#情感分析', '#UML'];
  els.push(t(W/2, 1180, tags.join('  '), 16, '#ccc', 'middle'));
  return svg(W, h, els);
}

// ===================== MAIN =====================
async function main() {
  const dir = '/tmp/wife-anger-cycle-handdrawn';
  const generators = [slide1, slide2, slide3, slide4, slide5, slide6, slide7, slide8, slide9];
  
  // Generate SVGs
  for (let i = 0; i < generators.length; i++) {
    const svgContent = generators[i]();
    fs.writeFileSync(path.join(dir, `slide-${String(i+1).padStart(2,'0')}.svg`), svgContent);
    console.log(`Generated SVG ${i+1}`);
  }

  // Find chromium
  const { execSync } = require('child_process');
  const chromiumPath = process.env.HOME + '/.cache/ms-playwright/chromium-1208/chrome-linux64/chrome';
  console.log('Chromium:', chromiumPath);

  // Screenshot with Playwright
  const browser = await chromium.launch({ 
    executablePath: chromiumPath || undefined,
    args: ['--no-sandbox', '--disable-setuid-sandbox'] 
  });
  const context = await browser.newContext({ deviceScaleFactor: 2 });
  const page = await context.newPage();

  for (let i = 1; i <= 9; i++) {
    const svgFile = path.join(dir, `slide-${String(i).padStart(2,'0')}.svg`);
    const pngFile = path.join(dir, `slide-${String(i).padStart(2,'0')}.png`);
    
    await page.goto(`file://${svgFile}`, { waitUntil: 'networkidle' });
    const body = await page.$('svg');
    const box = await body.boundingBox();
    
    await page.screenshot({ path: pngFile, clip: { x: 0, y: 0, width: box.width, height: box.height } });
    console.log(`Screenshot ${i}: ${box.width}x${box.height}`);
  }
  await browser.close();

  // Trim with sharp
  for (let i = 1; i <= 9; i++) {
    const pngFile = path.join(dir, `slide-${String(i).padStart(2,'0')}.png`);
    const meta = await sharp(pngFile).metadata();
    const trimmed = await sharp(pngFile).trim().toBuffer();
    await sharp(trimmed).resize({ width: 1080, withoutEnlargement: false }).toFile(pngFile);
    console.log(`Trimmed ${i}: ${meta.width}x${meta.height}`);
  }

  console.log('All done!');
}

main().catch(e => { console.error(e); process.exit(1); });
