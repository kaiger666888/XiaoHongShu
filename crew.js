module.exports = {
  name: "beauty-uml-viz",
  goal: "美妆知识可视化系列 - 用UML手绘风格图解美妆知识，输出为带逐步动画+TTS讲解的HTML交互页面",
  workdir: "/tmp/crew-beauty-uml",

  steps: [
    {
      id: "content-research",
      skill: "deep-research",
      params: {
        topic: "护肤成分兼容性大全：哪些成分能一起用，哪些不能，为什么。包括：VC+烟酰胺、果酸+A醇、烟酰胺+酸类、胜肽+VC、玻色因+胜肽等常见组合的科学依据",
        depth: "deep"
      },
      output: "research.md"
    },
    {
      id: "script",
      skill: "general",
      input: "research.md",
      output: "narration-script.md",
      params: {
        instruction: "基于研究报告，生成小红书讲解脚本。要求：\n1. 口语化、短句、有节奏感\n2. 分为5-8个讲解段落，每段对应动画的一个步骤\n3. 每段标注要高亮/动画展示的元素\n4. 总时长控制在2-3分钟\n5. 语气：专业但亲切，像闺蜜聊天\n6. 结尾有互动引导（收藏/评论）\n\n输出格式：\n## 段落1: [标题]\n- 讲解文案: ...\n- 动画指令: ...\n- 高亮元素: ...\n"
      }
    },
    {
      id: "html-build",
      skill: "claude-code-via-openclaw",
      input: ["research.md", "narration-script.md"],
      output: "index.html",
      params: {
        instruction: `创建一个单文件HTML页面，实现美妆成分兼容性知识可视化。

## 核心要求

### 视觉风格
- **手绘风格**：使用 rough.js 绘制所有图形元素（成分框、连线、标注等）
- 配色：柔和粉+淡紫+薄荷绿为主色调（美妆感），红色标记冲突，绿色标记兼容
- 背景：淡米色/奶白色，带细微纹理感
- 字体：使用圆体/手写感字体（如 ZCOOL XiaoWei 或 Noto Sans SC 圆体）

### UML 类图结构
用 Class Diagram 风格展示护肤成分之间的兼容关系：
- 每个成分是一个"类框"（rough.js 手绘风格）：框内写成分名、功效标签、注意事项
- 关系连线类型：
  - 绿色实线 = 兼容/增效（标注 ✅ boost）
  - 红色虚线 = 冲突/互相抵消（标注 ❌ conflict）
  - 黄色点线 = 需间隔使用（标注 ⚠️ separate）
- 重点展示 12-15 个常见成分：VC、烟酰胺、果酸(AHA)、水杨酸(BHA)、A醇、胜肽、玻色因、神经酰胺、玻尿酸、防晒、VC衍生物、传明酸

### 逐步动画（核心交互）
页面加载后分步骤展示，每步对应讲解脚本的一个段落：
1. 先画出空的框架 → "护肤成分到底能不能一起涂？"
2. 逐个填入成分框（每次1-2个，带手绘动画效果）
3. 开始画兼容关系线（绿色），每画一条高亮两端成分
4. 画冲突关系线（红色），同样高亮
5. 画需间隔线（黄色）
6. 最终全景展示 + 总结标注
7. 自动播放 TTS 语音讲解

### TTS 语音讲解
- 使用 Web Speech API (speechSynthesis) 或内嵌预生成的音频
- 每个动画步骤触发对应段落的语音播放
- 提供播放/暂停/重新播放控制
- 语速适中（中文约 200字/分钟）

### 交互功能
- 点击任意成分框 → 弹出详细信息卡片（功效、适用肤质、注意事项）
- 鼠标悬停关系线 → 显示科学依据简述
- 右上角有"自动播放"和"手动浏览"切换按钮
- 进度条显示当前讲解进度

### 技术栈
- 单文件 HTML（内联CSS+JS）
- rough.js CDN: https://unpkg.com/roughjs@latest/bundled/rough.cjs.js
- 不依赖任何后端
- 响应式设计，手机端也能看

### 小红书封面适配
- 第一帧（动画开始前）的视觉效果要能截成小红书封面
- 3:4 比例区域居中，标题"成分能不能一起涂？一张图告诉你"
- 底部小字：程序员用UML讲美妆系列

请确保动画流畅、手绘效果明显、视觉效果精美。这是一个面向小红书用户的内容，要好看、易懂、有传播力。`
      }
    }
  ],

  optimize: {
    enabled: true,
    maxRounds: 3,
    targetScore: 8.0
  }
};
