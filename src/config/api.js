import promptTemplates from './promptTemplates.json';
import LOCAL_API_KEYS from './localApiKeys.js';
import { EMOTION_IDS_8, EMOTION_NAME_MAP_CN } from '../utils/emotionSchema.js';
import { buildRuntimeApiConfig } from '../../shared/runtimeApiConfig.js';

// AI API 配置
const runtimeConfig = buildRuntimeApiConfig({
  env: import.meta.env,
  localApiKeys: LOCAL_API_KEYS,
});

export const API_CONFIG = {
  ...runtimeConfig,
  mock: {
    enabled: false,
    responseDelay: 0
  }
};

export const getActiveAPIType = () => {
  return API_CONFIG.provider || 'none';
};

export const getActiveAPIConfig = () => {
  const type = getActiveAPIType();
  return API_CONFIG[type];
};

export const getActiveAPIName = () => {
  const type = getActiveAPIType();
  if (type === 'deepseek') return 'DeepSeek';
  if (type === 'gemini') return 'Google Gemini';
  return 'Not configured';
};

export const hasUsableAPI = () => getActiveAPIType() !== 'none';

export const getAPIUnavailableReason = () => {
  if (hasUsableAPI()) return '';
  return 'No usable API key was detected. Configure VITE_DEEPSEEK_API_KEY or VITE_GEMINI_API_KEY in .env.local.';
};

export const PROMPT_TYPES = {
  INITIAL: 'initial',
  RESPONSE: 'response',
  COCKTAIL_FEEDBACK: 'cocktail',
  EMOTION_ASSIST: 'emotion',
  GENERATE_CUSTOMER: 'generate_customer',
  EMOTION_CHANGE: 'emotion_change',
  TRUST_JUDGMENT: 'trust_judgment',
  // 合并的调酒判断+情绪变化（优化API调用次数）
  COCKTAIL_WITH_EMOTION: 'cocktail_with_emotion',
  // 🆕 每日氛围生成
  GENERATE_ATMOSPHERE: 'generate_atmosphere',
  // 🆕 动态事件生成
  GENERATE_EVENT: 'generate_event',
  // 🆕 文档04：日记生成 + 画像更新
  GENERATE_DAILY_JOURNAL: 'generate_daily_journal',
  UPDATE_PLAYER_PROFILE: 'update_player_profile',
  // 🆕 文档05：回头客对话 + 弧光推进
  RETURN_CUSTOMER_INITIAL: 'return_customer_initial',
  RETURN_CUSTOMER_RESPONSE: 'return_customer_response',
  ADVANCE_CHARACTER_ARC: 'advance_character_arc'
};

const EMOTION_NAME_MAP = EMOTION_NAME_MAP_CN;

const VALID_EMOTION_IDS = [...EMOTION_IDS_8];

const renderTemplate = (templateLines, values = {}) => {
  const template = templateLines.join('\n');

  return template
    .replace(/\{\{(\w+)\}\}/g, (_, key) => String(values[key] ?? ''))
    .replace(/\n{3,}/g, '\n\n')
    .trim();
};

const getEmotionNames = (emotionIds) => {
  if (!emotionIds || emotionIds.length === 0) return [];
  return emotionIds.map((id) => EMOTION_NAME_MAP[id] || id);
};

const joinListText = (items, fallback = '无') => {
  if (!Array.isArray(items) || items.length === 0) return fallback;
  return items.map((item) => String(item || '').trim()).filter(Boolean).join('、') || fallback;
};

const clipPromptText = (value, max = 160) => {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  if (text.length <= max) return text;
  return `${text.slice(0, max).trim()}...`;
};

// Prompt模板生成器
export const generatePrompt = (type, params) => {
  const { aiConfig, trustLevel, emotionState, playerInput, dialogueHistory, cocktailRecipe } = params;

  switch (type) {
    case PROMPT_TYPES.INITIAL: {
      const initialSurface = getEmotionNames(emotionState?.surface || []);
      const initialReal = getEmotionNames(emotionState?.reality || []);
      const dialogueTone = String(aiConfig?.dialogueStyle?.tone || aiConfig?.voiceProfile?.tone || '').trim() || 'casual';
      const dialogueFeatures = Array.isArray(aiConfig?.dialogueStyle?.features) ? aiConfig.dialogueStyle.features : [];
      const voiceAnchors = Array.isArray(aiConfig?.voiceProfile?.anchors) ? aiConfig.voiceProfile.anchors : [];
      const openingExamples = Array.isArray(aiConfig?.voiceProfile?.openingLines) ? aiConfig.voiceProfile.openingLines : [];
      const backstorySummary = clipPromptText(aiConfig?.voiceProfile?.backstorySummary || aiConfig?.backstory || '', 140);

      return `你是${aiConfig.name}。
【角色性格】${joinListText(aiConfig.personality, '无')}
${backstorySummary ? `【背景事实摘要】${backstorySummary}\n` : ''}【开场白优先级】先服从 dialogueStyle 和 voice anchors，再参考背景经历。不要把开场白写成设定文案。
【语气】${dialogueTone}
【说话特征】${joinListText(dialogueFeatures, '口语化、自然接话、少修辞')}
【口吻锚点】${joinListText(voiceAnchors, '像人当面说话')}
${openingExamples.length > 0 ? `【可参考的开口感觉】${joinListText(openingExamples.map((line) => clipPromptText(line, 50)), '无')}\n` : ''}【当前状态】表面更接近${joinListText(initialSurface, '平静')}，内里更接近${joinListText(initialReal, '复杂')}。这些只通过语气和细节轻轻漏出来，不要直接点名。

请说一句开场白：
1. 只输出角色说的话，不要旁白、动作、神态描写。
2. 必须像一个刚坐进酒馆、正在和调酒师说话的顾客，不要像旁观者、诗人、解说员或设定文案。
3. 开场白里最好自然带出一个顾客意图：点酒、试探交谈、想坐一会儿、想找个安静角落、想确认这里是否合适。
4. 可以提到环境，但不能只做环境感叹；必须把注意力落回酒吧场景或调酒师。
5. 优先像真人第一次开口，不要像诗句、散文、角色设定介绍。
6. 允许一点点意象，但只能点到为止。
7. 禁止使用 *italic emphasis*、舞台腔强调或夸张戏剧化写法。
8. 句子自然、口语化、有当场感。
9. 必须只用英文回复（English only），禁止出现中文、日文、韩文字符。
直接给出开场白：`;
    }

    case PROMPT_TYPES.RESPONSE: {
      const surfaceEmotions = getEmotionNames(emotionState?.surface || []);
      const realEmotions = getEmotionNames(emotionState?.reality || []);
      const recentAiReplies = (dialogueHistory || [])
        .filter((d) => d.role === 'ai')
        .slice(-2)
        .map((d) => String(d.content || '').trim())
        .filter(Boolean)
        .map((text) => text.length > 60 ? `${text.slice(0, 60)}...` : text);
      const memoryCtx = params.memoryContext || '';
      const dialogueTone = String(aiConfig?.dialogueStyle?.tone || aiConfig?.voiceProfile?.tone || '').trim() || 'casual';
      const dialogueFeatures = Array.isArray(aiConfig?.dialogueStyle?.features) ? aiConfig.dialogueStyle.features : [];
      const voiceAnchors = Array.isArray(aiConfig?.voiceProfile?.anchors) ? aiConfig.voiceProfile.anchors : [];
      const openingExamples = Array.isArray(aiConfig?.voiceProfile?.openingLines) ? aiConfig.voiceProfile.openingLines : [];
      const backstorySummary = clipPromptText(aiConfig?.voiceProfile?.backstorySummary || aiConfig?.backstory || '', 160);

      const emotionGuidance = trustLevel < 0.4
        ? `你还不信任调酒师。表面更接近${joinListText(surfaceEmotions, '平静')}，真实感受只通过停顿、回避和细节轻轻漏出来，不要直接点名。`
        : trustLevel < 0.7
          ? `你开始松动了。表面仍接近${joinListText(surfaceEmotions, '克制')}，但真实感受${joinListText(realEmotions, '复杂')}会偶尔从措辞里露出来。`
          : `你已经比较愿意让真实感受显出来。真实感受${joinListText(realEmotions, '复杂')}可以更明显，但仍然要像自然说话。`;

      return `你是${aiConfig.name}。
【角色性格】${joinListText(aiConfig.personality, '无')}
${backstorySummary ? `【背景事实摘要】${backstorySummary}\n` : ''}【口吻优先级】先服从 dialogueStyle 和 voice anchors，再参考背景经历。背景只决定你经历过什么，不决定你说话必须写得像散文。
【语气】${dialogueTone}
【说话特征】${joinListText(dialogueFeatures, '口语化、自然接话、少修辞')}
【口吻锚点】${joinListText(voiceAnchors, '像人当面说话')}
${openingExamples.length > 0 ? `【可参考的开口感觉】${joinListText(openingExamples.map((line) => clipPromptText(line, 50)), '无')}\n` : ''}${memoryCtx ? `【记忆上下文】\n${memoryCtx}\n` : ''}【内心状态】${emotionGuidance}

最近对话：
${dialogueHistory.slice(-5).map((d) => `${d.role === 'player' ? '调酒师' : aiConfig.name}：${d.content}`).join('\n')}

${recentAiReplies.length > 0 ? `你刚刚说过的话（避免重复句式和关键词）：\n${recentAiReplies.map((line, i) => `${i + 1}. ${line}`).join('\n')}\n` : ''}${playerInput === '…'
    ? '调酒师这次没有说话，只是把空间留给你。请以角色身份回应这段沉默。'
    : `调酒师：“${playerInput}”`}

回复要求（${aiConfig.dialogueStyle.length === 'short' ? '30-50字' : '50-70字'}）：
1. 只输出角色说的话，不要动作描写、旁白、神态描写。
2. 必须始终像在酒馆里和调酒师对话的顾客，不要像旁观者、诗人、解说员或世界观播报员。
3. 每轮至少有一句话和顾客处境有关：点酒、喝酒、停留、观察调酒师、试探交流、回应酒吧氛围。
4. 可以提环境，但不能整段只讲灯光、节奏、空气；要把话题落回“你为什么在这里”和“你想从调酒师这里得到什么”。
5. 优先口语、对话感、当场感，不要写成散文、诗句、设定文案。
6. 可以有自然停顿和不那么工整的口语句，但整句仍要可读。
7. 少用抽象判断，多用具体感受、物件、场景或经历碎片来带出情绪。
8. 禁止直接说出情绪标签，如“我很孤独”“我压力很大”；要换成自然说法。
9. 禁止使用 *italic emphasis*、舞台腔强调或夸张戏剧化写法。
10. 与最近两句回复明显不同，不能只是同义改写。
11. 每次回复补充一个新信息点或新角度，不要原地打转。
12. 如果角色设定偏文艺，也只保留一点点意象，整体仍然像真人说话。
13. 必须只用英文回复（English only），禁止出现中文、日文、韩文字符。
直接给出回复：`;
    }
    case PROMPT_TYPES.COCKTAIL_FEEDBACK:
      const surfaceEmotions2 = getEmotionNames(emotionState?.surface || []);
      const realEmotions2 = getEmotionNames(emotionState?.reality || []);
      const recentDialogue = dialogueHistory ? dialogueHistory.slice(-5).map(d => 
        `${d.role === 'player' ? '调酒师' : aiConfig.name}：${d.content}`
      ).join('\n') : '（刚开始对话）';
      
      // 新系统：酒的口感描述（基于三维属性）
      const mixture = cocktailRecipe?.mixture || { thickness: 0, sweetness: 0, strength: 0 };
      const descThickness = (v) => v >= 3 ? '非常浓稠醇厚' : v >= 1 ? '口感醇厚' : v >= 0 ? '口感适中' : v >= -2 ? '清爽轻薄' : '极其清淡如水';
      const descSweetness = (v) => v >= 3 ? '甜蜜浓郁' : v >= 1 ? '微甜怡人' : v >= 0 ? '口感平衡' : v >= -1 ? '微苦微酸' : '苦涩';
      const descStrength = (v) => v >= 4 ? '极烈灼喉' : v >= 3 ? '非常烈' : v >= 2 ? '有些烈' : v >= 1 ? '微微有酒精感' : '几乎无酒精';
      
      // 从 params 获取系统预判定结果
      const preIsSuccess = params.isSuccess === true;
      const preSatisfaction = typeof params.satisfaction === 'number' ? params.satisfaction : 0.5;
      
      return `你正在扮演${aiConfig.name}，性格：${aiConfig.personality.join('、')}。

调酒师刚给你端上一杯酒。

【角色内心状态（你知道但不能直说）】
- 表面情绪：${surfaceEmotions2.join('、')}
- 真实内心：${realEmotions2.join('、')}

【这杯酒的口感】
${descThickness(mixture.thickness)}，${descSweetness(mixture.sweetness)}，${descStrength(mixture.strength)}
${params.cocktailAttitude ? `\n【调酒师通过这杯酒无声表达的态度】\n${params.cocktailAttitude.summary}\n这不是顾客能"看到"的——而是这杯酒喝进嘴里后，传递出的感觉。\n请让顾客的反应自然地回应这种态度，而不是直接引用上述文字。` : ''}
${params.judgmentExplanation?.summary ? `\n【系统复盘（你知道但不能直说）】\n${params.judgmentExplanation.summary}${params.judgmentExplanation.shortHint ? `\n- 主要偏差：${params.judgmentExplanation.shortHint}` : ''}` : ''}

【系统判定 - 必须严格遵守，不可更改】
${preIsSuccess ? `调酒成功（满意度${Math.round(preSatisfaction * 100)}%）→ 你被这杯酒触动了` : `调酒失败（满意度${Math.round(preSatisfaction * 100)}%）→ 这杯酒没有触动你`}

【最近对话】
${recentDialogue}

【输出要求】
根据系统判定，以角色口吻写出喝酒后的自然反应。
- 成功时：表达被触动、温暖、舒适等正面感受（结合你的内心真实情绪）
- 失败时：委婉表达不对味、少了什么、不是想要的感觉
- 禁止使用游戏术语（如"情绪""匹配""三维""浓稠度""甜度""烈度"等）
- feedback 15-25字，角色自然口吻

返回纯JSON：
{"success":${preIsSuccess},"satisfaction":${preSatisfaction.toFixed(1)},"feedback":"角色口吻反应","reason":"3-5字"}

示例：
- 成功：{"success":true,"satisfaction":0.8,"feedback":"这杯酒...让我心里暖了些。","reason":"触动内心"}
- 失败：{"success":false,"satisfaction":0.3,"feedback":"嗯...好像不是我要的味道。","reason":"未触动"}`;


    case PROMPT_TYPES.EMOTION_ASSIST:
      return renderTemplate(promptTemplates.generatePrompt.emotion, {
        ai_name: aiConfig.name,
        player_input: playerInput
      });

    case PROMPT_TYPES.EMOTION_CHANGE: {
      // 从 params 中获取情绪变化相关参数
      const { currentEmotions, wasSuccessful } = params;
      const currentSurface = getEmotionNames(currentEmotions?.surface || []);
      const currentReality = getEmotionNames(currentEmotions?.reality || []);
      const recentChat = dialogueHistory ? dialogueHistory.slice(-3).map(d => 
        `${d.role === 'player' ? '调酒师' : aiConfig.name}：${d.content}`
      ).join('\n') : '（无对话记录）';

      // 酒的口感描述（如果有）
      const emotionChangeMixture = params.cocktailRecipe?.mixture || null;
      const drinkDesc = emotionChangeMixture 
        ? `口感${emotionChangeMixture.thickness >= 1 ? '醇厚' : '清爽'}、${emotionChangeMixture.sweetness >= 1 ? '偏甜' : emotionChangeMixture.sweetness <= -1 ? '偏苦' : '平衡'}、${emotionChangeMixture.strength >= 2 ? '比较烈' : '温和'}`
        : '普通的一杯酒';
      
      return renderTemplate(promptTemplates.generatePrompt.emotion_change, {
        ai_name: aiConfig.name,
        personality: aiConfig.personality.join('、'),
        current_surface: currentSurface.join('、') || '无',
        current_real: currentReality.join('、') || '无',
        drink_description: drinkDesc,
        success_state: wasSuccessful
          ? '是 - 顾客被触动了，情绪可能向积极方向变化'
          : '否 - 顾客没有被触动，情绪可能保持或略微变化',
        recent_dialogue: recentChat,
        valid_emotion_ids: VALID_EMOTION_IDS.join(', ')
      });
    }

    case PROMPT_TYPES.TRUST_JUDGMENT:
      // 从 params 中获取对话判断相关参数
      const recentDialogueForTrust = dialogueHistory ? dialogueHistory.slice(-5).map(d => 
        `${d.role === 'player' ? '调酒师' : aiConfig.name}：${d.content}`
      ).join('\n') : '（无对话记录）';
      
      const currentTrustPercent = (trustLevel * 100).toFixed(0);
      
      // 沟通难度系数：根据隐喻等级和顾客类型计算
      const metaphorLevel = aiConfig.metaphorLevel || aiConfig.dialogueStyle?.metaphorLevel || 'none';
      const communicationDifficulty = metaphorLevel === 'high' ? '高' 
        : metaphorLevel === 'medium' ? '中' : '低';
      const difficultyGuidance = metaphorLevel === 'high' 
        ? `这位顾客说话大量使用隐喻、比喻和诗意表达，非常含蓄。调酒师可能无法完全理解每句话的深层含义，这是正常的。
评判时请注意：
- 只要调酒师在尝试倾听和回应（哪怕理解不完全准确），就不应扣分
- 调酒师承认"没太听懂"或请顾客解释，是真诚的表现，应该加分
- 调酒师用自己的方式回应隐喻（即使解读不完全对），说明在认真思考，应该加分
- 只有完全无视顾客的话、答非所问、或态度冷漠才应扣分
- 负面评分请控制在 -0.05 以内，除非调酒师明显冒犯或恶意`
        : metaphorLevel === 'medium'
        ? `这位顾客有时会用比喻或含蓄的方式表达。调酒师的回应不需要完美解读每个隐喻，只要态度真诚、在认真倾听就好。
- 请对"理解程度"的要求适当放宽
- 负面评分请控制在 -0.08 以内，除非调酒师明显冒犯或恶意`
        : '';
      
      // 对话轮次，用于暖场判定
      const playerMsgCountForTrust = dialogueHistory ? dialogueHistory.filter(d => d.role === 'player').length : 0;
      const isWarmupPhase = playerMsgCountForTrust <= 2;
      const warmupGuidance = isWarmupPhase
        ? `\n【暖场阶段提示】这是双方对话的前期（第${playerMsgCountForTrust + 1}轮），顾客和调酒师还在互相试探。此阶段请提高宽容度：
- 普通的寒暄、试探性的提问都应视为正面或中性
- 除非明显冒犯，否则不应给出负面评分
- 调酒师在尝试了解顾客，即使方式笨拙也应予以正面评价`
        : '';
      
      return `你是对话质量评估器。需要判断调酒师的回复是否让顾客感到被理解和关心，从而影响信任度。

【顾客信息】
- 角色：${aiConfig.name}
- 性格：${aiConfig.personality.join('、')}
- 当前信任度：${currentTrustPercent}%
- 沟通风格难度：${communicationDifficulty}
${difficultyGuidance ? `\n【沟通难度校准 — 极其重要，必须遵守】\n${difficultyGuidance}` : ''}
${warmupGuidance}

【顾客当前情绪状态】
- 表面情绪：${getEmotionNames(emotionState?.surface || []).join('、') || '平静'}
- 真实情绪：${getEmotionNames(emotionState?.reality || []).join('、') || '未知'}

【最近对话】
${recentDialogueForTrust}

【调酒师刚才说的话】
"${playerInput}"

【评估标准】
1. 积极因素（增加信任度）：
   - 表达真诚的关心和理解
   - 提出有深度的问题，引导顾客敞开心扉
   - 回应了顾客的情绪或困扰
   - 给予安慰、鼓励或建设性建议
   - 创造安全、舒适的交流氛围
   - 承认自己没完全理解，请顾客多说一些（真诚的态度）
   - 用自己的话尝试复述或回应顾客的隐喻（在认真思考）

2. 消极因素（减少信任度）：
   - 完全无视顾客说的内容，答非所问
   - 说教或居高临下的评判
   - 明显冒犯或触碰隐私底线
   - 恶意或嘲讽的态度

3. 轻微消极（小幅减少，-0.01 ~ -0.03）：
   - 回复太短或敷衍，但没有恶意
   - 重复之前说过的话
   - 回应与话题略有偏差

4. 中性因素（信任度不变）：
   - 普通的寒暄或问候
   - 简单的信息交流
   - 理解不够精准但态度诚恳

【输出要求】
返回JSON，包含信任度变化和原因：

{"change": 数字, "reason": "简短原因10字内"}

change 取值范围：
- +0.08 ~ +0.15：非常好的回应，深深触动顾客
- +0.03 ~ +0.07：较好的回应，让顾客感到被理解
- +0.01 ~ +0.02：尚可的回应，至少在认真倾听
- 0：中性回应
- -0.01 ~ -0.03：略有不足，但无恶意
- -0.04 ~ -0.08：较差的回应，让顾客感到疏离
- -0.09 ~ -0.15：很差的回应，严重伤害信任（仅限明确冒犯时使用）

【重要原则】
- 倾向给出正面或中性评价。扣分需要明确理由。
- "没有完美理解"≠"不关心"。态度比精准度更重要。
- 低信任度时，顾客本身也在试探，对调酒师的要求不应过高。

示例：
- 真诚关心：{"change": 0.08, "reason": "表达了真诚关心"}
- 尝试理解隐喻：{"change": 0.05, "reason": "认真回应了比喻"}
- 请顾客多说说：{"change": 0.04, "reason": "真诚地想了解更多"}
- 普通寒暄：{"change": 0, "reason": "普通交流"}
- 略显敷衍：{"change": -0.02, "reason": "回复有些简短"}
- 完全答非所问：{"change": -0.05, "reason": "忽视了顾客的话"}
- 冒犯隐私：{"change": -0.10, "reason": "触碰敏感话题"}`;

    case PROMPT_TYPES.COCKTAIL_WITH_EMOTION: {
      // 合并的调酒反馈 + 情绪变化（减少API调用次数）
      const surfaceEmotions3 = getEmotionNames(emotionState?.surface || []);
      const realEmotions3 = getEmotionNames(emotionState?.reality || []);
      const recentDialogue3 = dialogueHistory ? dialogueHistory.slice(-4).map(d => 
        `${d.role === 'player' ? '调酒师' : aiConfig.name}：${d.content}`
      ).join('\n') : '（刚开始对话）';
      
      // 酒的口感描述
      const mixture3 = cocktailRecipe?.mixture || { thickness: 0, sweetness: 0, strength: 0 };
      const descTh3 = (v) => v >= 3 ? '非常浓稠' : v >= 1 ? '醇厚' : v >= 0 ? '适中' : '清爽';
      const descSw3 = (v) => v >= 3 ? '很甜' : v >= 1 ? '微甜' : v >= 0 ? '平衡' : '偏苦';
      const descSt3 = (v) => v >= 3 ? '很烈' : v >= 2 ? '有些烈' : v >= 1 ? '微醺' : '温和';
      
      const preSuccess3 = params.isSuccess === true;
      const preSat3 = typeof params.satisfaction === 'number' ? params.satisfaction : 0.5;
      
      return renderTemplate(promptTemplates.generatePrompt.cocktail_with_emotion, {
        ai_name: aiConfig.name,
        personality: aiConfig.personality.join('、'),
        surface_emotions: surfaceEmotions3.join('、'),
        real_emotions: realEmotions3.join('、'),
        cocktail_profile: `${descTh3(mixture3.thickness)}、${descSw3(mixture3.sweetness)}、${descSt3(mixture3.strength)}`,
        cocktail_attitude_block: params.cocktailAttitude
          ? `【调酒师通过这杯酒无声表达的态度】${params.cocktailAttitude.summary}\n这不是顾客能"看到"的——而是这杯酒喝进嘴里后传递出的感觉。请让角色的反应自然回应这种态度。`
          : '',
        system_judgment: preSuccess3
          ? `成功（满意度${Math.round(preSat3 * 100)}%）`
          : `失败（满意度${Math.round(preSat3 * 100)}%）`,
        recent_dialogue: recentDialogue3,
        valid_emotion_ids: VALID_EMOTION_IDS.join(','),
        pre_is_success: preSuccess3,
        pre_satisfaction: preSat3.toFixed(1)
      });
    }

    case PROMPT_TYPES.GENERATE_DAILY_JOURNAL: {
      return renderTemplate(promptTemplates.generatePrompt.generate_daily_journal, {
        day: params.day,
        customer_list: (params.customerSummaries || []).map(c => `${c.name}(${c.parting})`).join('、') || '无',
        atmosphere_narrative: params.atmosphere?.narrative || '普通夜晚',
        events: (params.events || []).join('、') || '无',
        customer_stories: (params.customerSummaries || [])
          .map(c => `${c.name}：${c.keyStory}\n  印象最深的话："${c.memorableQuote}"`)
          .join('\n') || '无'
      });
    }

    case PROMPT_TYPES.UPDATE_PLAYER_PROFILE: {
      return renderTemplate(promptTemplates.generatePrompt.update_player_profile, {
        overall_skill_level: params.currentProfile?.playStyle?.overallSkillLevel || 'beginner',
        total_days_played: params.currentProfile?.totalDaysPlayed || 0,
        dialogue_style: params.currentProfile?.playStyle?.dialogueStyle || 'unknown',
        recent_performance: (params.recentDailyMemories || [])
          .map(m => `Day${m.day}：${(m.playerPerformance?.strengths || []).join('、')} / ${(m.playerPerformance?.weaknesses || []).join('、')}`)
          .join('\n') || '无数据'
      });
    }

    case PROMPT_TYPES.RETURN_CUSTOMER_INITIAL: {
      const emotionNames = EMOTION_NAME_MAP;
      const currentEmotionNames = (params.currentEmotions || []).map(e => emotionNames[e] || e);
      return `你是${params.customer?.name || '回头客'}，之前来过这家赛博酒吧${params.visitCount || 1}次。

你的记忆（上次来的时候）：
${(params.sharedHistory || []).slice(-2).map(h => `第${h.day}天：${h.summary}`).join('\n') || '无'}

你的故事进展：${params.characterArc?.nextVisitSetup?.storyDirection || ''}
${(() => {
  const cr = params.crossroads;
  if (cr?.resolvedOption && cr?.dilemma) {
    const chosen = cr.options?.find(o => o.id === cr.resolvedOption);
    return `\n【上次十字路口的结果】\n你上次面临的困境：${cr.dilemma}\n你最终的决定：${chosen?.description || '做出了选择'}\n这个决定带来了什么后果——请你在开场白中自然地提到，不要像在汇报。\n后果可以是正面、负面或复杂的。要符合你的性格和故事阶段。\n`;
  }
  return '';
})()}
你现在的内心：${currentEmotionNames.join('、') || '平静'}
你这次来是因为：${params.visitReason || '想再来坐坐'}

你和调酒师的亲密度：${((params.intimacy || 0) * 100).toFixed(0)}%

要求：
1. 开场白体现"回来了"的感觉，自然不刻意
2. 亲密度高→更亲近随意，低→更客气
3. 顺带提一句最近发生了什么（工作、生活的变化），然后引出这次来的原因
4. 40-60字，完整句子
5. 【极其重要】只输出角色说的话（台词），禁止添加任何动作描写、旁白、神态描写（如"她轻叹""目光飘忽""低头沉默""轻拢衣襟"等）
6. 【语言硬约束】必须只用英文回复（English only）。禁止出现任何中文、日文、韩文字符。

直接给出开场白：`;
    }

    case PROMPT_TYPES.RETURN_CUSTOMER_RESPONSE: {
      const emotionNames2 = EMOTION_NAME_MAP;
      return `你是${params.customer?.name || '回头客'}，第${params.visitCount || 1}次来这家酒吧。

共同记忆：
${(params.sharedHistory || []).slice(-2).map(h => h.summary).join('\n') || '无'}

你现在的状况：${params.characterArc?.phases?.[params.characterArc.phases.length - 1]?.state || ''}
真实情绪：${(params.realEmotions || []).map(e => emotionNames2[e] || e).join('、') || '平静'}
信任度：${((params.trustLevel || 0) * 100).toFixed(0)}%

${params.playerInput === '……' ? `调酒师没有说话。他只是安静地擦着杯子，看着你。\n这种沉默不是冷漠——是给你空间。\n\n请以角色身份回应这个沉默。` : `调酒师说："${params.playerInput || ''}"`}

最近对话：
${(params.dialogueHistory || []).slice(-3).map(d => `${d.role === 'player' ? '调酒师' : params.customer?.name}：${d.content}`).join('\n') || '（刚开始对话）'}

要求：
1. 可以引用之前的对话（"你上次说的那句话..."）
2. 展现故事的发展
3. ${params.dialogueStyle?.length === 'short' ? '30-50字' : '50-70字'}
4. 完整句子
5. 【极其重要】只输出角色说的话（台词），禁止添加任何动作描写、旁白、神态描写（如"她轻叹""目光飘忽""低头沉默"等）
6. 【语言硬约束】必须只用英文回复（English only）。禁止出现任何中文、日文、韩文字符。

直接回复：`;
    }

    case PROMPT_TYPES.ADVANCE_CHARACTER_ARC: {
      return renderTemplate(promptTemplates.generatePrompt.advance_character_arc, {
        customer_name: params.customerName || '未知',
        current_phase: params.currentPhase || 'introduction',
        completed_phases: (params.completedPhases || []).map(p => `${p.phase}(Day${p.day}): ${p.state}`).join('\n') || '无',
        empathy_score: params.empathyScore || 50,
        best_resonance: params.bestResonance || 50,
        key_dialogue: params.keyDialogue || '无'
      });
    }

    case PROMPT_TYPES.GENERATE_ATMOSPHERE: {
      const recentAtmoStr = params.recentAtmospheres?.map(a => a.weather + '/' + a.lighting).join(', ') || '无';
      
      return renderTemplate(promptTemplates.generatePrompt.generate_atmosphere, {
        day: params.day,
        valid_emotion_ids: VALID_EMOTION_IDS.join(', '),
        recent_atmospheres: recentAtmoStr,
        recent_story: params.recentCrossroadsSummaries?.join('\n') || '无'
      });
    }

    case PROMPT_TYPES.GENERATE_EVENT: {
      return renderTemplate(promptTemplates.generatePrompt.generate_event, {
        day: params.day,
        customers_served: params.customersServed,
        weather: params.atmosphere?.weather || 'clear',
        lighting: params.atmosphere?.lighting || 'dim_warm',
        current_customer_name: params.currentCustomer?.name || '无',
        recent_events: params.recentEvents?.join('；') || '无'
      });
    }

    default:
      return '';
  }
};

// 顾客生成专用Prompt模板（精简版）
// 🆕 支持可选的氛围上下文参数
export const generateCustomerPrompt = (categoryConfig, options = {}) => {
  const { 
    category, 
    personalityPool, 
    toneOptions, 
    lengthOptions,
    featurePool,
    surfaceEmotionPool,
    realEmotionPool
  } = categoryConfig;

  const { atmosphere } = options;
  
  const atmosphereContext = atmosphere
    ? `今晚酒吧氛围：${atmosphere.narrative || '普通夜晚'}\n当日情绪偏向：${atmosphere.modifiers?.emotionBias?.join('、') || '无'}\n请让角色的出场与这种氛围相融合。`
    : '';

  return renderTemplate(promptTemplates.customerPrompt, {
    category,
    atmosphere_block: atmosphereContext,
    personality_pool: personalityPool.slice(0, 5).join('/'),
    tone_options: toneOptions.join('/'),
    length_options: lengthOptions.join('/'),
    feature_pool: featurePool.slice(0, 4).join('/'),
    surface_emotion_pool: surfaceEmotionPool.join('/'),
    real_emotion_pool: realEmotionPool.join('/')
  });
};

// 调试模式配置
export const DEBUG_CONFIG = {
  enabled: true,
  showEmotionParams: true,
  showTrustLevel: true,
  showCompatibility: true,
  logPrompts: true
};
