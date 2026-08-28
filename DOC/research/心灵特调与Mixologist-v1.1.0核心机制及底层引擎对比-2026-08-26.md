# 心灵特调与 Mixologist v1.1.0 核心机制及底层引擎对比

> 整理日期：2026-08-26  
> 当前项目：`D:\MScIME25\SD5976-AI Tools For X\心灵特调`  
> 参考项目：`D:\腾讯星跃实战营\Mixologist-v1.1.0-source`  
> 分析方式：基于两个项目的源码、依赖、目录结构和测试结构进行静态对比，未修改或运行参考项目。

## 一、总体结论

两个项目明显来自同一套代码谱系，基础技术栈与核心玩法骨架高度一致。参考项目并没有更换为 Unity、Godot、Phaser 等另一种游戏引擎，而是在原有 React、Vite、PixiJS 技术基础上，重点向以下方向继续演进：

1. 将情绪判断从简单的流程门槛，升级为会影响后续资源与难度的正式玩法结果。
2. 在情绪和三维调酒数值之间增加“叙事意图”中间层。
3. 将单次顾客体验扩展为“理解—回应—留痕—回访证明”的长期关系闭环。
4. 将调酒规则、存档、叙事和页面运行时拆成更容易测试的模块。
5. 真正把 PixiJS 场景接入调酒台与氛围渲染的运行路径。
6. 建立可见状态、可执行动作、自动玩家和测试报告组成的 playtest 体系。

当前项目的主要优势是角色来源、Storyworld/MCP 接入、远程回退、多模型、角色图像与 TTS 等外围 AI 能力更丰富；参考项目的主要优势是核心玩法反馈更深、长期关系更明确、工程结构与自动验证更成熟。

因此，建议保留当前项目已有的 Storyworld、MCP 和多模型能力，选择性吸收参考项目的情绪评级、鸡尾酒叙事意图、关系回声、存档契约和测试体系，而不是直接用参考项目整体替换当前项目。

## 二、共同基础

两个项目均采用：

- React 18 负责页面、组件与大部分状态编排。
- Vite 5 负责开发服务器与构建。
- PixiJS 8 作为图形渲染依赖。
- Node.js HTTP 服务负责本地存档或接口代理。
- 文件型 JSON 负责本地数据持久化。
- 杯型、冰块、原液、配料、装饰组成调酒配方。
- Body/Thickness、Sweetness、Strength 三个维度构成调酒的主要数值空间。
- strict、transitional、expressive、master 四种调酒模式随章节逐步从数值匹配过渡到情感表达。
- 对话、情绪推断、调酒、反馈、信任与章节推进构成基础游戏循环。

这说明二者的区别不是游戏类型或核心框架发生变化，而是同一玩法原型在系统深度与工程成熟度上的不同阶段。

## 三、核心玩法机制对比

| 维度 | 当前项目“心灵特调” | 参考项目 Mixologist |
| --- | --- | --- |
| 基础循环 | 对话 → 选择三种真实情绪 → 调酒 → 共鸣/信任结算 → 下一位顾客 | 理解顾客 → A/B/C/D 判断评级 → 获得不同提示与容差 → 调酒回应 → 即时后果 → 记忆沉淀 → 回访证明 |
| 情绪判断 | 主要通过 `guessedCorrectly` 控制是否进入调酒，命中数影响奖励 | 将判断结果正式建模为 A/B/C/D，并让评级影响提示、目标公开程度、容差和信任奖励 |
| 调酒目标 | 从单个或组合情绪生成三维目标条件 | 先生成“应该如何回应顾客”的叙事意图，再编译为可解的三维目标 |
| 调酒反馈 | 已有数值成功、共鸣等级和鸡尾酒态度 | 在此基础上增加调酒预判、顾客内心反应、误读风险、下一步线索等结构化反馈 |
| 回头客 | 已有入池评分、回访调度、角色弧光、情绪轨迹和十字路口 | 增加关系回声、即时后果卡、回访凭证、未兑现叙事债务、保证回访窗口和熟悉度分层 |
| 长期记忆 | 主要由浏览器存储、前端 Hook 和前端 AI 请求管理 | 独立 Storymaker 服务按存档槽维护 NPC memory、teaser、customer seed 和会话总结 |
| 叙事节奏 | 按日期、概率、优先级安排回头客和高低张力 | 额外控制回头客密度、连续高张力疲劳、证明型回访和新顾客最低数量 |
| 自动测试 | `useAutoTest` 可直接调用内部状态和规则 | 通过 `state/actions/targets` 协议模拟玩家，仅执行当前合法且可见的动作 |

### 3.1 情绪判断：从布尔门槛变成资源质量

当前项目已经会计算玩家猜中了多少真实情绪，并根据命中数给予信任或小费奖励，但整体流程仍然以 `guessedCorrectly` 作为进入调酒阶段的核心状态。

参考项目进一步把情绪判断整理为 A/B/C/D 四级结果：

- A：识别到核心情绪，可以获得更完整的调酒方向、目标信息和奖励。
- B：识别到支持情绪或同一情绪家族，获得部分提示。
- C：理解不完全，仍可继续，但信息质量较低。
- D：跳过判断或判断严重偏离，仍不阻断流程，但玩家需要在信息不足的情况下承担后果。

这种设计的优点是失败不会简单变成“不能继续”，而会转化为后续操作难度、信息缺失和关系风险。情绪理解因此成为一种可积累、可消费的玩法资源。

相关参考文件：

- 当前：`src/hooks/gameHandlers/useDialogueHandlers.js`
- 当前：`src/hooks/gameHandlers/helpers.js`
- 参考：`src/utils/judgmentResult.js`
- 参考：`src/hooks/gameHandlers/useDialogueHandlers.js`

### 3.2 调酒机制：增加“鸡尾酒叙事意图”中间层

当前项目的目标生成逻辑主要是：

```text
真实情绪或玩家选择的情绪组合
    ↓
生成 Thickness / Sweetness / Strength 条件
    ↓
搜索当前材料中是否存在可行解
```

参考项目增加了一层语义转换：

```text
顾客情绪、处境和本次关系上下文
    ↓
这杯酒应该表达的态度
    ↓
安抚、试探、鼓励、保持距离等叙事意图
    ↓
Thickness / Sweetness / Strength 的方向
    ↓
个性化、可解的具体条件
```

例如，“不要逼顾客立即承认问题”并不是直接等于某个甜度数值，而是先被解释为克制、柔和或留白，再映射到一个或多个数值方向。这样既保留了当前已有的三维调酒规则，也能让玩家感觉自己是在用酒回应一个人，而不是完成一道数学题。

相关参考文件：

- 当前：`src/utils/cocktailMixing.js`
- 当前：`src/utils/cocktailAttitude.js`
- 参考：`src/utils/cocktailIntent.js`
- 参考：`src/utils/judgmentResult.js`
- 参考：`src/utils/mixing/solver.js`

### 3.3 调酒模式：参考项目让章节差异更可感知

两个项目都已经存在四种调酒模式：

- `strict`：主要看精确数值条件。
- `transitional`：允许一定容差，并开始考虑酒的态度。
- `expressive`：减少数值提示，以情绪共鸣为主。
- `master`：进一步隐藏公式，只保留感受、语境和玩家判断。

参考项目把模式差异落实到更多具体层面：

- 是否公开目标条件。
- 是否显示精确属性数字。
- 是否提供材料推荐。
- 推荐是完整、部分还是隐约提示。
- 预览阶段允许多少容差。
- 最终成功由数值、态度还是共鸣共同决定。

这使章节升级不仅是文案变化，而是玩家获得信息的方式发生变化。

### 3.4 回头客：从“安排回来”升级为“回来证明什么”

当前 `src/hooks/useNarrativeEngine.js` 已经具备：

- 根据开放话题、信任、对话长度和离店状态计算回头客分数。
- 将符合条件的顾客加入回头客池。
- 根据日期、优先级和概率安排回访。
- 推进 introduction、escalation、turning_point、resolution、epilogue 角色弧光。
- 记录共同历史、情绪轨迹和十字路口选择。

参考项目不是简单增加更多回头客，而是补充“关系回声”层：

- `immediateEcho`：玩家行为当场产生的微小反应。
- `consequenceCard`：本轮行为造成的可读后果。
- `returnPlan`：为什么回来、以什么形式回来、需要多少叙事张力。
- `returnReceipt`：向玩家说明上次行为在回访中留下了什么。
- `proofDebt`：系统尚未向玩家兑现的承诺或后果。
- `guaranteedProofWindow`：确保关键选择不会因为随机调度而永远得不到反馈。

这一设计解决了随机叙事中常见的问题：玩家做了选择，但很久以后也不知道选择有没有用。

相关参考文件：

- 当前：`src/hooks/useNarrativeEngine.js`
- 当前：`src/utils/crossroadsResolver.js`
- 参考：`src/utils/relationshipEcho/`
- 参考：`src/hooks/gameHandlers/customerLifecycle/relationshipEcho.js`
- 参考：`src/hooks/narrative/returnScheduler.js`
- 参考：`src/hooks/narrative/arcProgression.js`

## 四、底层引擎与渲染差异

### 4.1 不是引擎换代，而是 Pixi 是否真正进入运行路径

两个项目的依赖中都是 PixiJS 8.16.0，因此不存在框架层面的引擎升级。

但当前项目中名为 `PixiMixingBoard.jsx` 的组件实际只导入 React，最终渲染的是 DOM、按钮和 CSS，并没有创建 Pixi `Application`。当前的 `AmbientGameCanvas.jsx` 同样没有调用已经存在的 `createAmbientPixiScene.js`。因此当前主要运行路径更接近：

```text
React Hook 状态
    ↓
React/DOM 组件
    ↓
CSS 视觉表现
```

当前仓库虽然存在 Pixi 场景实现文件，但并未完整接入调酒台和氛围组件的运行链路。

参考项目则采用：

```text
React Hook 状态
    ↓
纯 Pixi View Model
    ↓
Pixi Scene
    ↓
Application / Canvas / Graphics / Text / Pointer Events
```

参考项目中的 `PixiMixingBoard.jsx` 只负责生命周期与模型同步，真正的绘制与交互被拆到：

- `src/game/pixi/createPixiMixingBoardScene.js`
- `src/game/pixi/pixiMixingBoardModel.js`
- `src/game/pixi/mixingBoardPrimitives.js`
- `src/game/pixi/mixingBoardCards.js`
- `src/game/pixi/mixingBoardCardViewport.js`
- `src/game/pixi/mixingBoardHeaderSection.js`
- `src/game/pixi/mixingBoardSummarySection.js`
- `src/game/pixi/mixingBoardFooterSection.js`

参考项目的 `AmbientGameCanvas.jsx` 也会真正创建、更新和销毁 Pixi 氛围场景。

### 4.2 是否应该把当前调酒台全部迁移到 Pixi

不建议仅为了“使用了 Pixi”而把整个调酒界面迁入 Canvas。

调酒台包含大量文字、按钮、卡片、提示和滚动区域。DOM 的优势是：

- 文本清晰且容易响应式布局。
- 键盘、屏幕阅读器和无障碍语义更好。
- React Testing Library 更容易测试。
- CSS 调整成本更低。
- 不需要手动实现命中区域、滚动、指针捕获和文本排版。

Pixi 的优势是：

- 酒液、粒子、灯光、玻璃、倾倒和递酒动画更自然。
- 大量动态元素的统一渲染性能更好。
- 更容易形成明显的“游戏画面”而不是网页表单感。

更适合当前项目的混合方案是：

1. React/DOM 保留对话、说明、卡片、数值和可访问按钮。
2. Pixi 负责背景氛围、光影、粒子、酒液、杯体和递酒动画。
3. React 状态通过纯 view model 传给 Pixi，Pixi 不直接持有业务规则。
4. 如果课程或展示明确要求 Pixi 交互调酒，再逐步将核心操作区迁移到 Canvas。

## 五、状态管理与代码结构差异

### 5.1 当前项目

当前项目的主要特点是功能集中：

- `GamePage.jsx` 同时承担较多页面组装和运行时逻辑。
- `useGameInit.js`、`useNarrativeEngine.js`、`useServeProgressHandlers.js` 等 Hook 较大。
- `cocktailMixing.js` 同时包含常量、效果计算、条件判断、目标生成、求解、提示和份量操作。
- `save-server.mjs` 同时处理存档、Storyworld、情绪分析、角色图片和 MCP 风格路由。
- `storage.js` 与 `saveRepository.js` 承担较多不同类型的持久化职责。

这种结构开发初期速度快，但规则增长后会出现：

- 修改一个玩法规则时需要理解很多不相关代码。
- UI、网络、副作用和纯规则容易互相耦合。
- 单元测试难以隔离。
- 存档字段变化缺少统一契约。

### 5.2 参考项目

参考项目将较大模块拆成：

- 调酒纯规则：`src/utils/mixing/`
- 调酒结算阶段：`src/hooks/gameHandlers/serve/`
- 顾客离店生命周期：`src/hooks/gameHandlers/customerLifecycle/`
- 叙事编排：`src/hooks/narrative/`
- 游戏页面运行时：`src/pages/gamePage/runtime/`
- 应用启动与持久化：`src/hooks/app/`
- 存档服务：`server/save/`
- Storymaker 客户端与回退：`src/utils/storymaker/`
- 自动游玩桥：`playtest/bridge/`
- 自动玩家与报告：`playtest/runner/`

静态统计结果：

| 项目 | 生产代码文件 | 生产代码行数 | 测试文件 | 测试代码行数 |
| --- | ---: | ---: | ---: | ---: |
| 当前项目 | 约 114 | 约 22,558 | 0 | 0 |
| 参考项目 | 约 338 | 约 46,804 | 约 103 | 约 11,811 |

统计范围为相关目录中的 `.js`、`.jsx`、`.mjs`、`.py` 文件，不包含 CSS、JSON、文档与素材，仅用于比较规模。

参考项目的优势是职责清晰和测试充分；风险是文件数量和认知成本明显增加。当前项目不需要机械复制其全部拆分粒度，应优先拆分纯规则、高变化逻辑和具有稳定输入输出的模块。

## 六、后端与存档架构差异

### 6.1 当前项目：单 Node 服务聚合更多能力

当前 `server/save-server.mjs` 同时接入：

- 存档槽与游戏状态。
- NPC profile 和 session memory。
- Storyworld 本地与远程角色搜索。
- 角色情绪分析。
- 角色图片生成和缓存。
- `/api/mcp/...` 风格接口。

优点是只需要启动一个 Node 服务，适合课程展示与本地原型。缺点是服务职责较多，存档逻辑与外部内容服务耦合。

### 6.2 参考项目：Node 存档与 Python 叙事服务分离

参考项目把本地后端拆为：

- Node save server：只管理存档、NPC 文件、迁移、路由和响应。
- Python Storymaker：管理 NPC 对话、会话总结、长期记忆、teaser、调酒反思和回访材料。

Storymaker 会按存档槽隔离 NPC 运行时数据，并写入：

- `memory.json`
- `memory.md`
- `session.json`
- `teaser.md`

参考项目还在 `shared/saveContract.js` 中集中定义存档版本、默认值、数据规范化和旧字段过滤，减少前后端对同一字段理解不一致的问题。

这种分离更适合长期开发，但会增加：

- Python 运行环境。
- 8010 端口与额外启动链路。
- 第二套 LLM 配置与健康检查。
- 前端、Node、Python 三层故障定位成本。

因此，建议当前项目先借鉴版本化存档契约和模块化 repository，不急于立即引入完整 Python Storymaker。

## 七、当前项目相对参考项目的优势

以下能力不应在借鉴参考项目时被丢弃：

1. `venetanji/polyu-storyworld` 子模块接入。
2. GitHub 与 Hugging Face 远程角色回退。
3. Storyworld YAML 角色解析和人物导入。
4. `/api/mcp/character/...` 与 `/api/mcp/emotion/...` 风格接口。
5. 角色头像生成、缓存和素材管理。
6. Gemini、DeepSeek、OpenAI-compatible/OpenRouter 等较宽的模型接入方式。
7. 远程 TTS 与文本同步保护。
8. 更少的运行时服务和更简单的一键启动结构。

参考项目在核心叙事深度上更成熟，但在课程生态、开放角色来源和 TTS 等维度并不是全面替代当前项目。

## 八、建议直接借鉴的内容

### 优先级 P0：低风险、高收益

#### 1. 引入 A/B/C/D 情绪判断结果

在现有命中数计算基础上产生统一 `judgmentResult`：

```js
{
  grade,
  coreEmotion,
  matchedEmotions,
  summary,
  benefits: {
    trustBonus,
    guidanceLevel,
    tolerancePercent,
    revealTargetConditions
  }
}
```

让判断质量影响后续玩法，而不是只控制能否进入调酒。

#### 2. 拆分调酒纯规则

建议将 `src/utils/cocktailMixing.js` 逐步拆为：

```text
src/utils/mixing/
├─ constants.js
├─ effects.js
├─ conditions.js
├─ solver.js
├─ portionOps.js
├─ suggestions.js
└─ index.js
```

拆分时保持原有统一导出，避免一次性修改所有调用方。

#### 3. 为纯规则增加 Vitest

优先覆盖：

- 混合值计算。
- 杯型容量与份量增减。
- 条件判断和容差。
- 目标是否有解。
- 情绪评级。
- 回头客调度。
- 十字路口确定性结果。

### 优先级 P1：提升核心体验

#### 4. 增加鸡尾酒叙事意图

保留现有三轴规则，在其上增加：

- 玩家可见的回应方向。
- 内部使用的三轴偏向。
- 顾客语境个性化。
- 可解性检查和条件放宽。

#### 5. 增加关系回声最小模型

先在当前存储结构中增加：

```js
{
  immediateEcho,
  returnPlan,
  proofDebt
}
```

并确保重要玩家选择在有限天数内获得一次可见反馈。

#### 6. 建立版本化存档契约

将默认状态、版本、字段规范化、旧数据迁移和 NPC memory 结构集中到 `shared/`，由前端和 Node 服务共同使用。

### 优先级 P2：工程与展示增强

#### 7. 建立 playtest 可见状态协议

对自动玩家只公开：

- 当前页面和阶段。
- 玩家此刻能看到的信息。
- 当前可执行动作。
- 每个动作需要的参数。
- 当前可交互目标。
- 是否存在阻塞覆盖层。

避免自动测试直接修改内部 React 状态，这样测试结果才真正代表玩家可以完成游戏。

#### 8. 选择性接入 Pixi

优先接入当前已有但未进入运行路径的氛围场景，再增加酒液、光效与递酒动画。是否将整个调酒面板迁到 Pixi，应根据展示目标、无障碍和维护成本另行决定。

#### 9. 评估是否需要独立 Storymaker

只有当以下需求成为主要目标时，再考虑独立 Python 服务：

- NPC 必须跨多次访问持续记忆。
- 每次离店必须生成结构化记忆和下次 teaser。
- 多个存档槽需要严格隔离 NPC 叙事状态。
- 前端不再适合承担长期叙事数据处理。

## 九、不建议直接照搬的内容

1. 不建议第一步就引入 Python Storymaker，会显著增加启动和部署复杂度。
2. 不建议为了使用 Pixi 而把所有文字、按钮和卡片迁入 Canvas。
3. 不建议删除当前 Storyworld、MCP、角色回退、TTS 和 OpenAI-compatible 能力。
4. 不建议一次性把所有大文件拆成数百个小文件，应围绕稳定职责逐步拆分。
5. 不建议让 AI 直接决定所有关键数值结果。确定性规则应负责基线，AI 更适合补充语义解释、个性化文案和有限度微调。
6. 不建议让随机回访承担关键剧情兑现；重要选择应具有保证反馈窗口。

## 十、推荐实施顺序

```text
阶段 1：规则可靠性
情绪评级 → 调酒规则拆分 → 单元测试 → 存档契约

阶段 2：玩法深度
鸡尾酒叙事意图 → 分级提示/容差 → 关系回声 → 保证回访

阶段 3：可验证性
可见状态协议 → 合法动作协议 → 自动玩家 → 报告

阶段 4：表现与服务演进
接入 Pixi 氛围/酒液 → 评估调酒台 Canvas 化 → 评估独立 Storymaker
```

## 十一、最终建议

当前项目不需要换掉核心技术栈，也不需要把参考项目整体合并进来。更合理的演进方向是：

> 保留当前项目“角色来源广、AI 接入多、课程生态完整”的优势，吸收参考项目“情绪判断有层次、调酒具有叙事意图、玩家行为能在回访中得到证明、规则可以自动验证”的设计。

如果只选择三个最重要的借鉴点，推荐依次为：

1. A/B/C/D 情绪判断及其对提示和容差的影响。
2. 鸡尾酒叙事意图与关系回声。
3. 调酒纯规则、存档契约与自动化测试。

这三项能够直接增强游戏核心，而不会破坏当前项目已经形成的 Storyworld、MCP、多模型和角色内容管线。
