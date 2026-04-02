---
name: xhs-3d-enhance
description: 为小红书轮播图（HTML）添加 CSS 3D 立体化效果。包括标题投影、卡片浮层、状态机图透视、环境光等技巧。适用于已有 HTML slide 的 3D 增强、排版优化、截图生成。触发词：3D增强、立体化、3D效果、轮播图优化、小红书封面。
---

# 小红书轮播图 3D 增强指南

## 规格标准

- **尺寸**: 1080×1440px（3:4 小红书封面比例）
- **截图**: Playwright 2x DPR（实际输出 2160×2880）
- **技术**: 纯 CSS + HTML + 内联 SVG，不依赖外部资源

## 3D 效果方案

### ✅ 效果好（已验证）

| 技巧 | CSS | 适用场景 | 注意事项 |
|------|-----|---------|---------|
| 单方向投影 | `text-shadow:4px 4px 0 rgba(0,0,0,.1),8px 8px 0 rgba(0,0,0,.05)` | 标题 | **不要级联阴影**（30/60/90px），会晕眼 |
| 多层 box-shadow | `0 10px 30px .12, 0 2px 8px .08, inset 0 1px 0 .8` | 卡片浮层 | 三层：远阴影+近阴影+顶部高光 |
| 环境光 | `body::before` 径向渐变 opacity 0.15-0.25 | 全局氛围 | 暖色（琥珀/金）适合生活化主题 |
| perspective 微透视 | `perspective(800px) rotateX(12deg)` | 状态机图/SVG | >8° 文字变形，>15° 明显失真 |
| 节点 feDropShadow | SVG filter `feDropShadow dx=3 dy=3 stdDeviation=3` | 状态机节点 | 关键状态加彩色发光圈 |
| 左/上边框色 | `border-left:4px solid #color` + `box-shadow:-4px 0 15px` | 强调卡片 | 发光不要太强（opacity 0.3以内） |

### ❌ 效果差（踩坑记录）

| 技巧 | 问题 | 原因 |
|------|------|------|
| 级联 text-shadow（30/60/90px） | 晕眼 | 像文字在"融化"，大画布上不清晰 |
| 不同卡片不同 rotateY 角度 | 画面不稳 | 角度不一致，阴影方向混乱 |
| 霓虹/赛博朋克风格 | 主题冲突 | 冷色调不适合生活化/暖色内容 |
| 大量 animation | 无效 | 小红书轮播是静态截图，看不见动画 |
| opacity < 0.06 的渐变 | 看不见 | 大画布上等于透明 |
| rotateY > 2° + box-shadow 发光 | 杂乱 | 多种效果叠加失去统一感 |

### 光源统一原则

**所有阴影必须来自同一光源方向**（默认左上方）：
- text-shadow: 向右下偏移 (正X正Y)
- box-shadow: 同方向
- 环境光: 左上暖色 → 右下暗色
- 卡片内边框高光: 顶部 `inset 0 1px 0 rgba(255,255,255,.8)`

## 排版规范

### 内容不溢出

1. `body` 加 `overflow:hidden; height:1440px`
2. 内容少的 slide：`justify-content:center` 垂直居中
3. 内容多的 slide：`justify-content:space-between` 均匀分布
4. 用 `min-height:1440px` 确保填满

### Page 标记

底部居中：
```css
.foot{position:fixed;bottom:28px;left:0;right:0;text-align:center;font-size:24px;color:#7F8C8D;z-index:10}
```

### 水印

左下角固定：
```html
<p style="position:fixed;bottom:28px;left:40px;font-size:24px;color:#7F8C8D;opacity:.4;z-index:10">© 作者名@平台</p>
```

### SVG 状态机图

- 双向箭头（❺❻）用 `<path>` 二次贝塞尔曲线避免交叉
- 同起点的箭头（❶❷）一个直走一个弧线绕行
- 路径说明框要足够宽，文字不超出（内边距充足）
- viewBox 固定，通过 width/height 控制显示大小

## 截图脚本

```javascript
import { chromium } from 'playwright';
const b = await chromium.launch({headless:true,args:['--no-sandbox','--force-device-scale-factor=2']});
const p = await b.newPage({viewport:{width:1080,height:1440,deviceScaleFactor:2}});
for(let i=1;i<=9;i++){
  const f = `slides/slide-${String(i).padStart(2,'0')}.html`;
  await p.goto(`file:///path/to/${f}`,{waitUntil:'load'});
  await p.waitForTimeout(300);
  await p.screenshot({path:`output/3d-${String(i).padStart(2,'0')}.png`});
}
await b.close();
```

## 工作流程

1. **改完先截图确认** → 不要直接 commit
2. **用户确认后** → git commit + push
3. **截图验证** → 用 Playwright 2x DPR，确认内容不超出 1440px
4. **检查 scrollHeight** → `document.body.scrollHeight` 必须 ≤ 1440（有 overflow:hidden 时等于视口高度）
5. **统一风格** → 所有 slide 使用同一套阴影参数，不要每张各搞一套
