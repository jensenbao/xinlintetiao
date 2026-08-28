/**
 * 统一调酒判定系统
 * 根据当前调酒模式（strict/transitional/expressive/master）判定成功与否
 * 
 * 模式含义：
 * - strict：纯数值判定（现有逻辑）
 * - transitional：数值容差放宽 + 态度权重
 * - expressive：AI共鸣判定为主（shallow 也算成功）
 * - master：更高共鸣门槛（门槛上移，shallow 算失败，仅 deep/perfect 成功）
 */

import { checkTargetConditions } from './cocktailMixing.js';
import { checkDissonance } from './cocktailAttitude.js';
import { getActiveAPIConfig, getActiveAPIType } from '../config/api.js';

// 导出过渡期失败引导（供 GamePage 使用）
export { getTransitionalFailureHint } from '../data/chapterMilestones.js';

/**
 * 带容差的目标条件检查
 * @param {Object} mixture - 当前酒的三维值
 * @param {Array} conditions - 目标条件
 * @param {number} tolerancePercent - 容差百分比（如 15 = 15%）
 * @returns {Object} 检查结果
 */
const checkTargetConditionsWithTolerance = (mixture, conditions, tolerancePercent = 15) => {
  if (!conditions || conditions.length === 0) {
    return { allMet: true, metCount: 0, conditions: [] };
  }

  const tolerance = tolerancePercent / 100;
  const results = conditions.map(cond => {
    const actualValue = mixture[cond.attr] || 0;
    const toleranceAmount = Math.max(1, Math.abs(cond.value) * tolerance);

    let met = false;
    switch (cond.op) {
      case '>=':
        met = actualValue >= cond.value - toleranceAmount;
        break;
      case '<=':
        met = actualValue <= cond.value + toleranceAmount;
        break;
      case '>':
        met = actualValue > cond.value - toleranceAmount;
        break;
      case '<':
        met = actualValue < cond.value + toleranceAmount;
        break;
      case '=':
        met = Math.abs(actualValue - cond.value) <= toleranceAmount;
        break;
      default:
        met = actualValue >= cond.value - toleranceAmount;
    }
    return { ...cond, met, actualValue };
  });

  return {
    allMet: results.every(r => r.met),
    metCount: results.filter(r => r.met).length,
    conditions: results
  };
};

/**
 * AI 共鸣判定
 * 调用 AI 判断酒的态度与顾客情绪的共鸣等级
 * @returns {string} 'shallow' | 'deep' | 'perfect' | 'dissonance'
 */
const getAIResonanceJudgment = async (attitude, customerState) => {
  const apiType = getActiveAPIType();
  const config = getActiveAPIConfig();

  if (apiType === 'none' || !config?.apiKey) {
    return 'shallow';
  }

  const realEmotions = customerState?.realEmotions || [];
  const dialogueContext = customerState?.dialogueContext || '???????';

  const prompt = `?????????????????

????????????????????????????????????????????

??????
- ?????${realEmotions.join('?')}
- ???????${dialogueContext}

???????
${attitude?.summary || '??????'}

??????
???????????????????????

???????????????????
- shallow?????????????
- deep????????????????
- perfect?????????????????????????
- dissonance????????????????????

??????????????`;

  const validLevels = ['shallow', 'deep', 'perfect', 'dissonance'];
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);

  try {
    let response;

    if (apiType === 'deepseek') {
      response = await fetch(config.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.apiKey}`
        },
        body: JSON.stringify({
          model: config.model,
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.3,
          max_tokens: 32
        }),
        signal: controller.signal
      });
    } else {
      const url = `${config.endpoint}/${config.model}:generateContent?key=${config.apiKey}`;

      response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.3, maxOutputTokens: 32, candidateCount: 1 }
        }),
        signal: controller.signal
      });
    }

    if (!response.ok) return 'shallow';

    let text = '';

    if (apiType === 'deepseek') {
      const data = await response.json();
      text = data.choices?.[0]?.message?.content?.trim().toLowerCase() || '';
    } else {
      const data = await response.json();
      text = data.candidates?.[0]?.content?.parts?.find(p => p.text)?.text?.trim().toLowerCase() || '';
    }

    if (validLevels.includes(text)) return text;

    for (const level of validLevels) {
      if (text.includes(level)) return level;
    }

    return 'shallow';
  } catch (e) {
    console.warn('AI resonance judgment failed, defaulting to shallow');
    return 'shallow';
  } finally {
    clearTimeout(timeoutId);
  }
};

/**
 * 共鸣等级的影响系数
 */
export const RESONANCE_EFFECTS = {
  perfect: { trustChange: 0.20, tipMultiplier: 2.0, label: 'Perfect Resonance' },
  deep: { trustChange: 0.15, tipMultiplier: 1.5, label: 'Deep Resonance' },
  shallow: { trustChange: 0.05, tipMultiplier: 1.0, label: 'Shallow Resonance' },
  dissonance: { trustChange: -0.10, tipMultiplier: 0.5, label: 'Emotional Dissonance' }
};

/**
 * 混合共鸣评分
 * 60%由确定性规则决定，40%由AI微调
 * 确保相同输入得到稳定的基线，AI只做锦上添花
 */
const getHybridResonanceScore = async (attitude, customerState, mixingMode = 'expressive') => {
  // === 确定性部分（60%权重）===
  let deterministicScore = 0;
  const realEmotions = customerState?.realEmotions || [];

  const fragileEmotions = ['fear', 'sadness', 'anger', 'disgust'];
  const positiveEmotions = ['joy', 'trust', 'anticipation', 'surprise'];
  const heavyEmotions = ['sadness', 'fear', 'disgust'];

  const isFragile = realEmotions.some(e => fragileEmotions.includes(e));
  const isPositive = realEmotions.some(e => positiveEmotions.includes(e));
  const isHeavy = realEmotions.some(e => heavyEmotions.includes(e));

  if (isFragile && attitude.approach === 'gentle') deterministicScore += 2;
  if (isFragile && attitude.tone === 'hopeful') deterministicScore += 2;
  if (isPositive && attitude.approach === 'confront') deterministicScore += 1;
  if (isHeavy && attitude.depth === 'reflective') deterministicScore += 2;
  if (isPositive && attitude.depth === 'lighten') deterministicScore += 1;
  if (attitude.approach === 'moderate') deterministicScore += 1;
  if (attitude.tone === 'balanced') deterministicScore += 1;

  const deterministicLevel = deterministicScore >= 4 ? 2
                           : deterministicScore >= 2 ? 1
                           :                           0;

  // === AI 部分（40%权重）===
  let aiLevel = 1;
  try {
    const aiResult = await getAIResonanceJudgment(attitude, customerState);
    aiLevel = aiResult === 'perfect' ? 3
            : aiResult === 'deep'    ? 2
            : aiResult === 'shallow' ? 1
            :                          0;
  } catch (e) {
    aiLevel = deterministicLevel;
  }

  const blendedScore = deterministicLevel * 0.6 + aiLevel * 0.4;

  // master 模式：门槛提高——需要更精准的情感共鸣
  if (mixingMode === 'master') {
    if (blendedScore >= 2.6) return 'perfect';
    if (blendedScore >= 1.6) return 'deep';
    if (blendedScore >= 0.8) return 'shallow';
    return 'dissonance';
  }

  // expressive 模式（默认）
  if (blendedScore >= 2.2) return 'perfect';
  if (blendedScore >= 1.2) return 'deep';
  return 'shallow';
};

/**
 * 统一调酒判定
 * @param {Object} params
 * @param {Object} params.mixture - 当前酒的三维值
 * @param {Array} params.targetConditions - 目标条件
 * @param {Object} params.attitude - 酒的态度（来自 cocktailAttitude.js）
 * @param {Object} params.customerState - 顾客状态 { realEmotions, dialogueContext }
 * @param {string} params.mixingMode - 当前调酒模式
 * @returns {Object} 判定结果 { success, resonance, method, satisfaction }
 */
export const judgeCocktail = async ({
  mixture,
  targetConditions,
  attitude,
  customerState,
  mixingMode = 'strict'
}) => {
  switch (mixingMode) {
    case 'strict': {
      // 纯数值判定（现有逻辑）
      const result = checkTargetConditions(mixture, targetConditions);
      return {
        success: result.allMet,
        resonance: null,
        method: 'numeric',
        satisfaction: result.allMet ? 0.8 : 0.3,
        targetCheck: result
      };
    }

    case 'transitional': {
      // 数值容差放宽 + 态度权重
      const strictResult = checkTargetConditions(mixture, targetConditions);
      const tolerantResult = checkTargetConditionsWithTolerance(mixture, targetConditions, 15);
      const dissonance = checkDissonance(attitude, customerState);

      if (strictResult.allMet && !dissonance) {
        // 严格通过且不失调 → 成功 + basic 共鸣
        return {
          success: true,
          resonance: 'deep',
          method: 'hybrid',
          satisfaction: 0.85,
          targetCheck: strictResult
        };
      }
      if (tolerantResult.allMet && !dissonance) {
        // 容差通过且不失调 → 成功 + shallow 共鸣
        return {
          success: true,
          resonance: 'shallow',
          method: 'hybrid',
          satisfaction: 0.7,
          targetCheck: tolerantResult
        };
      }
      if (!tolerantResult.allMet && !dissonance) {
        // 数值没过但态度不失调 → 给额外容差（而非随机）
        const almostResult = checkTargetConditionsWithTolerance(mixture, targetConditions, 30);
        if (almostResult.allMet) {
          return {
            success: true,
            resonance: 'shallow',
            method: 'hybrid',
            satisfaction: 0.55,
            targetCheck: almostResult
          };
        }
        return {
          success: false,
          resonance: null,
          method: 'hybrid',
          satisfaction: 0.3,
          targetCheck: tolerantResult
        };
      }
      // 失调
      return {
        success: false,
        resonance: 'dissonance',
        method: 'hybrid',
        satisfaction: 0.2,
        targetCheck: tolerantResult
      };
    }

    case 'expressive': {
      // 第一层：确定性兜底——失调检测
      const exDissonance = checkDissonance(attitude, customerState);
      if (exDissonance) {
        return {
          success: false,
          resonance: 'dissonance',
          method: 'resonance',
          satisfaction: 0.2,
          targetCheck: null
        };
      }

      // 第二层：混合共鸣评分（60%确定性 + 40%AI）
      const exResonance = await getHybridResonanceScore(attitude, customerState, 'expressive');
      return {
        success: exResonance !== 'dissonance',
        resonance: exResonance,
        method: 'resonance',
        satisfaction: exResonance === 'perfect' ? 1.0 : exResonance === 'deep' ? 0.85 : exResonance === 'shallow' ? 0.65 : 0.2,
        targetCheck: null
      };
    }

    case 'master': {
      // master 模式：更高的共鸣门槛，shallow 共鸣视为失败
      const mDissonance = checkDissonance(attitude, customerState);
      if (mDissonance) {
        return {
          success: false,
          resonance: 'dissonance',
          method: 'resonance',
          satisfaction: 0.15,
          targetCheck: null
        };
      }

      // 混合共鸣评分（master 门槛）
      const mResonance = await getHybridResonanceScore(attitude, customerState, 'master');
      // master 模式下，shallow 和 dissonance 都算失败——只有 deep 及以上才成功
      const mSuccess = mResonance === 'perfect' || mResonance === 'deep';
      return {
        success: mSuccess,
        resonance: mResonance,
        method: 'resonance',
        satisfaction: mResonance === 'perfect' ? 1.0 : mResonance === 'deep' ? 0.8 : mResonance === 'shallow' ? 0.4 : 0.15,
        targetCheck: null
      };
    }

    default:
      // 降级到 strict
      const defaultResult = checkTargetConditions(mixture, targetConditions);
      return {
        success: defaultResult.allMet,
        resonance: null,
        method: 'numeric',
        satisfaction: defaultResult.allMet ? 0.8 : 0.3,
        targetCheck: defaultResult
      };
  }
};
