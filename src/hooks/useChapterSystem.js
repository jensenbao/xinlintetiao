/**
 * 章节系统 Hook
 * 管理章节状态、条件检测、章节推进、回忆碎片触发
 */
import { useState, useCallback, useRef } from 'react';
import { getChapterState, saveChapterState, getMemoryFragments, saveMemoryFragments, getWorldState, getReturnCustomers } from '../utils/storage.js';
import { CHAPTERS, getFragmentClarity } from '../data/chapterMilestones.js';
import { API_CONFIG } from '../config/api.js';

// 先聚焦核心玩法：暂时关闭主线叙事（章节推进/回忆碎片/结局）
const STORYLINE_ENABLED = false;

/**
 * 调用 AI 生成文本（内部工具函数）
 */
/**
 * 将截断的文本修剪到最后一个完整句子
 */
const trimToLastSentence = (text) => {
  if (!text) return text;
  // 从后往前找中文句号、问号、感叹号、省略号等完整句子结尾
  const sentenceEndPattern = /[。！？…」』\n]/g;
  let lastEnd = -1;
  let match;
  while ((match = sentenceEndPattern.exec(text)) !== null) {
    lastEnd = match.index;
  }
  if (lastEnd > 0 && lastEnd > text.length * 0.5) {
    // 只有当最后一个句子结尾在文本后半部分时才截断，避免损失太多内容
    return text.slice(0, lastEnd + 1);
  }
  return text; // 找不到合适的截断点就返回原文
};

const callGeminiForText = async (prompt, maxTokens = 1024) => {
  if (!API_CONFIG.gemini.enabled || !API_CONFIG.gemini.apiKey) {
    throw new Error('chapter_ai_not_configured');
  }
  const url = `${API_CONFIG.gemini.endpoint}/${API_CONFIG.gemini.model}:generateContent?key=${API_CONFIG.gemini.apiKey}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.8, maxOutputTokens: maxTokens, candidateCount: 1 }
    })
  });
  if (!response.ok) {
    throw new Error(`chapter_ai_http_${response.status}`);
  }
  const data = await response.json();
  const candidate = data.candidates?.[0];
  const wasTokenTruncated = candidate?.finishReason === 'MAX_TOKENS';
  let text = candidate?.content?.parts?.find(p => p.text)?.text;
  text = text?.trim() || null;
  if (!text) {
    throw new Error('chapter_ai_empty_text');
  }
  if (wasTokenTruncated) {
    const trimmed = trimToLastSentence(text);
    if (!trimmed || trimmed.length < Math.floor(text.length * 0.5)) {
      throw new Error('chapter_ai_truncated_output');
    }
    return trimmed;
  }
  return text;
};

export const useChapterSystem = () => {
  const [chapterState, setChapterState] = useState(() => getChapterState());
  const [memoryFragments, setMemoryFragments] = useState(() => getMemoryFragments());
  const [pendingChapterTransition, setPendingChapterTransition] = useState(null);
  const [pendingFragment, setPendingFragment] = useState(null);
  const [pendingEnding, setPendingEnding] = useState(null);

  const fragmentCounterRef = useRef(memoryFragments.length);
  const triggerMemoryFragmentRef = useRef(null);

  /**
   * 获取当前章节配置
   */
  const currentChapter = CHAPTERS[chapterState.currentChapter - 1] || CHAPTERS[0];

  /**
   * 检查是否满足下一章节条件
   */
  const checkChapterAdvance = useCallback(() => {
    // 章节系统已停用：只保留天数推进，不再触发章节切换
    return null;
  }, []);

  /**
   * 生成章节开场白（AI）
   */
  const generateChapterOpening = useCallback(async (chapter, currentDay, worldState) => {
    const prompt = `你是一个赛博朋克酒吧故事的叙述者。

酒吧刚刚进入一个新的阶段。请为这个阶段写一段开场白。

【当前信息】
- 新章节：第${chapter.id}章「${chapter.title}」
- 章节副标题：${chapter.subtitle}
- 当前天数：第${currentDay}天

【要求】
- 100-200字
- 第二人称（"你"）
- 不要说教，不要总结成就，而是描绘一个此刻的画面
- 基调：${chapter.theme.atmosphereMood === 'quiet' ? '安静、未知' : chapter.theme.atmosphereMood === 'warming' ? '微暖、初见端倪' : chapter.theme.atmosphereMood === 'alive' ? '活络、有了故事' : chapter.theme.atmosphereMood === 'intense' ? '深沉、厚重' : '超然、回望'}
- 结尾留一个意象，暗示接下来会发生什么

只输出开场白文本，不要其他内容。`;

    const aiText = await callGeminiForText(prompt, 1024);
    if (!aiText) {
      throw new Error(`chapter_opening_generation_failed:${chapter.id}`);
    }
    return aiText;
  }, []);

  /**
   * 推进到下一章节
   */
  const advanceChapter = useCallback(async (nextChapter, currentDay) => {
    const worldState = getWorldState();
    const opening = await generateChapterOpening(nextChapter, currentDay, worldState);

    const newState = {
      ...chapterState,
      currentChapter: nextChapter.id,
      chapterHistory: [
        ...chapterState.chapterHistory,
        {
          chapter: nextChapter.id,
          enteredOnDay: currentDay,
          openingNarrative: opening,
          triggeredBy: 'milestone'
        }
      ]
    };

    setChapterState(newState);
    saveChapterState(newState);

    setPendingChapterTransition({
      chapter: nextChapter,
      openingNarrative: opening,
      // 标记：转场结束后需要触发碎片
      pendingFragmentTrigger: { type: 'chapter_advance', day: currentDay, reason: `进入第${nextChapter.id}章` }
    });

    console.log(`📖 章节推进: 第${nextChapter.id}章「${nextChapter.title}」`);

    // 碎片不再在这里立即触发，而是在 dismissChapterTransition 时触发
    return { chapter: nextChapter, opening };
  }, [chapterState, generateChapterOpening]);

  /**
   * 清除章节转场状态，如果有待触发的碎片则延迟显示
   */
  const dismissChapterTransition = useCallback(() => {
    const pendingTrigger = pendingChapterTransition?.pendingFragmentTrigger;
    setPendingChapterTransition(null);

    // 转场结束后延迟触发回忆碎片（避免两个 overlay 同时显示）
    if (pendingTrigger && triggerMemoryFragmentRef.current) {
      setTimeout(() => {
        triggerMemoryFragmentRef.current(pendingTrigger.type, pendingTrigger.day, pendingTrigger.reason);
      }, 800);
    }
  }, [pendingChapterTransition]);

  /**
   * 从已有碎片中提取叙事锚点（已确定的不可动摇的事实）
   */
  const getNarrativeAnchors = useCallback(() => {
    return getMemoryFragments()
      .filter(f => f.anchor && f.anchor !== '无')
      .map(f => f.anchor);
  }, []);

  /**
   * 生成回忆碎片（AI）
   * 🆕 新增叙事锚点系统：注入已确定事实作为硬性约束，并要求AI输出新锚点
   */
  const generateMemoryFragmentText = useCallback(async (clarity, triggerReason, currentDay, chapterId, todayContext) => {
    const existingFragments = getMemoryFragments();
    const anchors = getNarrativeAnchors();

    const clarityGuide = {
      vague: '极度模糊。只有情绪和身体感觉——手的温度、某种味道、一闪而过的画面。不要有完整场景，不要有人名。像半梦半醒时的碎片。',
      hazy: '朦胧。有一个模糊的场景浮现——某个地方、某个季节、某个人的轮廓。但看不清脸，听不清话。像旧照片褪色后的样子。',
      clear: '清晰。一段具体的记忆。有场景、有对话、有情感。调酒师开始想起来了——自己为什么会在这里。',
      vivid: '鲜明。调酒师完全记起来了。这段记忆很完整，很真实。它解释了一切——为什么开这间酒吧，为什么选择沉默，为什么留在这条巷子里。'
    };

    // 只有 clear/vivid 阶段才允许确立锚点
    const anchorInstruction = (clarity === 'clear' || clarity === 'vivid')
      ? '3. 锚点（10字以内，描述这个碎片确立的一个不可动摇的事实，如"调酒师曾在医院工作"或"调酒师有一个妹妹"。如果没有确立新事实，写"无"）'
      : '3. 锚点（此清晰度阶段不应确立具体事实，请写"无"）';

    const prompt = `你是这位调酒师内心深处的声音。

调酒师每天在吧台后面听别人的故事，从来不提自己的。但今晚收拾杯子的时候，某些东西浮上来了。

【已有的回忆碎片（按时间顺序）】
${existingFragments.length > 0
  ? existingFragments.map((f, i) => `碎片${i + 1}（第${f.triggeredOnDay}天）：${f.summary}`).join('\n')
  : '（这是第一个碎片）'
}

${anchors.length > 0 ? `【不可违反的已确定事实】\n${anchors.map((a, i) => `${i + 1}. ${a}`).join('\n')}\n\n以上事实已经在之前的碎片中确立，你生成的新碎片不得与之矛盾。\n如果不确定，宁可不提及也不要冲突。\n` : ''}
【当前状态】
- 章节：第${chapterId}章
- 碎片清晰度要求：${clarity}
- 今天发生了什么：${todayContext || '又是忙碌的一天'}
- 触发原因：${triggerReason}

【清晰度说明】
${clarityGuide[clarity] || clarityGuide.vague}

【约束】
- 字数：80-150字
- 第一人称，但不要用"我"开头——从一个感觉、一个画面、一个声音开始
- 必须与已有碎片在叙事上连贯（如果有的话）
- 不要与已有碎片内容重复
- 不要解释，不要总结，只是"浮上来"
- 结尾留一丝悬念或不完整感

请输出：
1. 碎片正文（80-150字）
2. 摘要（20-30字，用于后续碎片参考）
${anchorInstruction}

格式：
FRAGMENT: (碎片正文)
SUMMARY: (摘要)
ANCHOR: (锚点或"无")`;

    const aiText = await callGeminiForText(prompt, 2048);
    const fragmentMatch = aiText.match(/FRAGMENT:\s*([\s\S]*?)(?:SUMMARY:|$)/i);
    const summaryMatch = aiText.match(/SUMMARY:\s*([\s\S]*?)(?:ANCHOR:|$)/i);
    const anchorMatch = aiText.match(/ANCHOR:\s*([\s\S]*?)$/i);
    if (!fragmentMatch || !summaryMatch) {
      throw new Error('memory_fragment_invalid_format');
    }
    const anchor = anchorMatch ? anchorMatch[1].trim() : '无';
    return {
      content: fragmentMatch[1].trim(),
      summary: summaryMatch[1].trim(),
      anchor: (anchor && anchor !== '无') ? anchor : null
    };
  }, [getNarrativeAnchors]);

  /**
   * 触发回忆碎片
   */
  const triggerMemoryFragment = useCallback(async (triggerType, currentDay, triggerReason, todayContext) => {
    const chapterId = chapterState.currentChapter;
    const clarity = getFragmentClarity(chapterId);

    const { content, summary, anchor } = await generateMemoryFragmentText(
      clarity, triggerReason || triggerType, currentDay, chapterId, todayContext
    );

    fragmentCounterRef.current += 1;
    const fragment = {
      id: `fragment_${fragmentCounterRef.current}`,
      triggeredBy: triggerType,
      triggeredOnDay: currentDay,
      chapter: chapterId,
      content,
      summary,
      clarity,
      anchor: anchor || null
    };

    const newFragments = [...memoryFragments, fragment];
    setMemoryFragments(newFragments);
    saveMemoryFragments(newFragments);
    setPendingFragment(fragment);

    console.log(`◈ 回忆碎片触发: ${triggerType} (${clarity})`);
    return fragment;
  }, [chapterState, memoryFragments, generateMemoryFragmentText]);

  // 同步 ref，供 dismissChapterTransition 使用（避免循环依赖）
  triggerMemoryFragmentRef.current = triggerMemoryFragment;

  /**
   * 清除回忆碎片展示状态
   */
  const dismissFragment = useCallback(() => {
    setPendingFragment(null);
  }, []);

  /**
   * 检查各种碎片触发条件
   */
  const checkFragmentTriggers = useCallback((context) => {
    const {
      currentDay,
      trustLevel,
      resonanceLevel,
      silenceCount,
      plainWaterCount,
      totalCustomersServed,
      crossroadsResolved
    } = context;

    // 避免同一天触发多个碎片
    const lastFragment = memoryFragments[memoryFragments.length - 1];
    if (lastFragment && lastFragment.triggeredOnDay === currentDay) return null;

    // 里程碑：服务满20人
    if (totalCustomersServed >= 20 && !memoryFragments.some(f => f.triggeredBy === 'milestone_20')) {
      return { type: 'milestone_20', reason: '服务满20位顾客' };
    }
    // 里程碑：服务满50人
    if (totalCustomersServed >= 50 && !memoryFragments.some(f => f.triggeredBy === 'milestone_50')) {
      return { type: 'milestone_50', reason: '服务满50位顾客' };
    }
    // 高信任度
    if (trustLevel >= 0.9 && !memoryFragments.some(f => f.triggeredBy === 'deep_trust')) {
      return { type: 'deep_trust', reason: '与顾客建立了极深的信任' };
    }
    // 十字路口解决
    if (crossroadsResolved && !memoryFragments.some(f => f.triggeredBy === 'crossroads_resolved')) {
      return { type: 'crossroads_resolved', reason: '帮助顾客做出了重要决定' };
    }
    // 完美共鸣（非 strict 模式）
    if (resonanceLevel === 'perfect' && currentChapter.mixingMode !== 'strict') {
      return { type: 'perfect_resonance', reason: '调出了一杯完美的酒' };
    }
    // 沉默达标
    if (silenceCount >= 5 && !memoryFragments.some(f => f.triggeredBy === 'silence_used')) {
      return { type: 'silence_used', reason: '在沉默中学会了倾听' };
    }
    // 白水达标
    if (plainWaterCount >= 3 && !memoryFragments.some(f => f.triggeredBy === 'plain_water')) {
      return { type: 'plain_water', reason: '有时候人需要的只是一杯白水' };
    }

    return null;
  }, [memoryFragments, currentChapter]);

  /**
   * 检查结局条件
   */
  const checkEndingConditions = useCallback((currentDay) => {
    if (chapterState.endingTriggered || chapterState.freeMode) {
      return null;
    }

    const worldState = getWorldState();
    const returnCustomers = getReturnCustomers();

    // 路径A：回头客完成弧光
    const completedArc = returnCustomers.find(c => c.characterArc?.currentPhase === 'epilogue');
    if (completedArc) {
      return { type: 'arc_complete', triggerCustomer: completedArc.name };
    }

    // 路径B：天数上限
    if (currentDay >= 50) {
      return { type: 'day_limit' };
    }

    // 路径C：碎片数量
    if (memoryFragments.length >= 8) {
      return { type: 'all_fragments' };
    }

    return null;
  }, [chapterState, memoryFragments]);

  /**
   * 验证 AI 生成的结局是否满足基本质量要求
   */
  const validateEnding = useCallback((narrative) => {
    const issues = [];
    if (narrative.length < 300) issues.push('too_short');
    if (narrative.length > 1200) issues.push('too_long');
    const paragraphs = narrative.split('\n\n').filter(p => p.trim().length > 0);
    if (paragraphs.length < 3) issues.push('too_few_paragraphs');
    const offToneKeywords = ['哈哈', '太棒了', '万岁', '拯救世界', '打败', '爆炸', '战斗', '魔法', '穿越', '系统提示'];
    if (offToneKeywords.some(kw => narrative.includes(kw))) issues.push('off_tone');
    if (!narrative.includes('你')) issues.push('wrong_perspective');
    return { valid: issues.length === 0, issues };
  }, []);

  /**
   * 生成结局叙事（AI），含重试机制和质量验证
   */
  const generateEnding = useCallback(async (triggerInfo, currentDay) => {
    const worldState = getWorldState();
    const returnCustomers = getReturnCustomers();
    const totalCustomersServed = Object.keys(worldState.customerRegistry || {}).length;

    const keyCustomer = returnCustomers[0];
    const triggerDesc = triggerInfo.type === 'arc_complete' ? `${triggerInfo.triggerCustomer}走完了自己的故事。`
      : triggerInfo.type === 'day_limit' ? '第五十天了。窗外的雨还在下。'
      : '调酒师终于想起了一切。';

    const prompt = `你是这个故事的叙述者。现在，故事来到了尾声。

这是一家赛博朋克城市深巷里的酒吧。一个沉默的调酒师在这里待了${currentDay}天，服务了${totalCustomersServed}位顾客。

【调酒师的回忆碎片】
${memoryFragments.map((f, i) => `${i + 1}. ${f.content}`).join('\n') || '（没有回忆）'}

【关键顾客】
${returnCustomers.slice(0, 3).map(c =>
  `- ${c.name}（来了${c.visitCount || 1}次）：${c.characterArc?.phases?.slice(-1)[0]?.state || '故事还在继续'}`
).join('\n') || '（没有回头客）'}

【结局触发】${triggerDesc}

【输出结构要求】
请严格按以下四段结构输出，每段之间用空行分隔：

第一段（100-150字）：此刻的画面
- 从结局触发的具体时刻开始
- 描述酒吧里此刻的光线、声音、气味
- 第二人称（"你"）

第二段（150-250字）：回望
- 串联调酒师的回忆碎片，给出身世的答案
- 提及1-2位关键顾客的命运
- 不要罗列所有顾客，选最重要的

第三段（100-150字）：意义
- 这些天的调酒意味着什么
- 不要说教

第四段（50-100字）：最后的画面
- 回到酒吧，此刻
- 灯还亮着，门没有关
- 留一个开放的意象

总字数控制在 500-700 字。基调：忧郁诗意。不要大团圆，不要说教。
只输出结局叙事文本。`;

    for (let i = 0; i < 3; i++) {
      const aiText = await callGeminiForText(prompt, 2048);
      const validation = validateEnding(aiText);

      if (validation.valid) {
        return aiText;
      }

      // 太长但调性正确：裁剪
      if (validation.issues.includes('too_long') && !validation.issues.includes('off_tone')) {
        const trimmed = aiText.slice(0, 1000);
        const lastPeriod = Math.max(trimmed.lastIndexOf('。'), trimmed.lastIndexOf('……'));
        if (lastPeriod > 300) {
          return trimmed.slice(0, lastPeriod + 1);
        }
      }
    }

    throw new Error(`ending_generation_invalid_after_retries:${triggerInfo.type}`);
  }, [memoryFragments, validateEnding]);

  /**
   * 触发结局
   */
  const triggerEnding = useCallback(async (triggerInfo, currentDay) => {
    const narrative = await generateEnding(triggerInfo, currentDay);

    const newState = {
      ...chapterState,
      endingTriggered: true,
      endingNarrative: narrative
    };
    setChapterState(newState);
    saveChapterState(newState);

    setPendingEnding({
      narrative,
      triggerType: triggerInfo.type
    });

    console.log(`🌅 结局触发: ${triggerInfo.type}`);
    return narrative;
  }, [chapterState, generateEnding]);

  /**
  * [DEV] 直接跳转到指定章节（开发者工具用）
  * 同时更新 React 状态 + localStorage
   */
  const devJumpToChapter = useCallback((targetChapterId, currentDay = 1) => {
    const id = Math.max(1, Math.min(5, Math.round(Number(targetChapterId) || 1)));
    const chapter = CHAPTERS[id - 1];
    if (!chapter) return;

    // 更新章节状态
    const newChapterState = {
      ...chapterState,
      currentChapter: id,
      endingTriggered: false,
      freeMode: false,
      endingNarrative: null,
      chapterHistory: [
        ...(chapterState.chapterHistory || []).filter(Boolean),
        {
          chapter: id,
          enteredOnDay: Math.max(1, Math.round(Number(currentDay) || 1)),
          openingNarrative: null,
          triggeredBy: 'dev_jump'
        }
      ].slice(-10)
    };
    setChapterState(newChapterState);
    saveChapterState(newChapterState);

    // 清除任何 pending overlay
    setPendingChapterTransition(null);
    setPendingFragment(null);
    setPendingEnding(null);

    console.log(`🚀 [DEV] 直接跳转到第${id}章「${chapter.title}」`);
    return chapter;
  }, [chapterState]);

  /**
   * 进入自由模式
   */
  const enterFreeMode = useCallback(() => {
    const newState = { ...chapterState, freeMode: true };
    setChapterState(newState);
    saveChapterState(newState);
    setPendingEnding(null);
  }, [chapterState]);

  /**
   * 清除结局展示
   */
  const dismissEnding = useCallback(() => {
    setPendingEnding(null);
  }, []);

  /**
   * 每日结算时的完整检查
   * 在 GamePage 的 dayEnd 逻辑中调用
   */
  const processDayEnd = useCallback(async (currentDay, context = {}) => {
    if (!STORYLINE_ENABLED) {
      return null;
    }

    const worldState = getWorldState();
    const totalCustomersServed = Object.keys(worldState.customerRegistry || {}).length;

    // 1. 检查回忆碎片触发
    const fragmentTrigger = checkFragmentTriggers({
      currentDay,
      totalCustomersServed,
      ...context
    });
    if (fragmentTrigger) {
      await triggerMemoryFragment(fragmentTrigger.type, currentDay, fragmentTrigger.reason);
      return { type: 'fragment', fragment: fragmentTrigger };
    }

    // 2. 检查结局条件
    const endingTrigger = checkEndingConditions(currentDay);
    if (endingTrigger) {
      await triggerEnding(endingTrigger, currentDay);
      return { type: 'ending', ending: endingTrigger };
    }

    return null;
  }, [checkFragmentTriggers, triggerMemoryFragment, checkEndingConditions, triggerEnding]);

  return {
    // 状态
    chapterState,
    currentChapter,
    memoryFragments,
    pendingChapterTransition,
    pendingFragment,
    pendingEnding,
    storylineEnabled: STORYLINE_ENABLED,

    // 操作
    processDayEnd,
    triggerMemoryFragment,
    dismissChapterTransition,
    dismissFragment,
    dismissEnding,
    enterFreeMode,
    checkFragmentTriggers,
    devJumpToChapter
  };
};
