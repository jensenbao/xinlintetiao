/**
 * 酒的态度系统
 * 根据三维值 + 材料 feeling 计算酒传递的"态度"
 * 不影响成功/失败判定，只影响AI叙事
 */

import { INGREDIENTS } from '../data/ingredients.js';
import { GLASS_TYPES } from '../data/emotions.js';
import { ICE_TYPES, GARNISH_TYPES, DECORATION_TYPES } from '../data/addons.js';

/**
 * 根据三维值 + 具体材料计算酒传递的"态度"
 * @param {Object} mixture - { thickness, sweetness, strength }
 * @param {boolean} isPlainWater - 是否是白水
 * @param {Object} recipe - 完整配方（可选），含 ingredients, glass, ice, garnish, decoration
 * @returns {Object} 态度对象
 */
export const interpretCocktailAttitude = (mixture, isPlainWater = false, recipe = null) => {
  // 白水特殊处理
  if (isPlainWater) {
    return {
      approach: 'gentle',
      tone: 'honest',
      depth: 'lighten',
      summary: 'The bartender did not make a cocktail. They simply placed a glass of water in front of you. Sometimes people do not need a drink. They just need someone to stay.',
      feelingSummary: '',
      isWater: true
    };
  }

  const { thickness = 0, sweetness = 0, strength = 0 } = mixture;

  const attitude = {
    // 烈度维度：温柔 vs 直面
    approach: strength >= 3 ? 'confront'
            : strength >= 1 ? 'moderate'
            :                  'gentle',

    // 甜度维度：承认苦涩 vs 给予希望
    tone: sweetness >= 2 ? 'hopeful'
        : sweetness >= 0 ? 'balanced'
        :                   'honest',

    // 浓稠度维度：放下 vs 沉淀
    depth: thickness >= 2 ? 'reflective'
         : thickness >= 0 ? 'moderate'
         :                   'lighten',
  };

  // === 基础态度文本（用组合 key 生成自然语句，而非三段拼接）===
  const attitudeKey = `${attitude.approach}_${attitude.tone}_${attitude.depth}`;
  const attitudeSentences = {
    // confront (烈) 组合
    confront_hopeful_reflective: 'You have to face this, but do not panic. Think it through, then move.',
    confront_hopeful_moderate: 'Go do it. You are more capable than you think.',
    confront_hopeful_lighten: 'It is not bigger than you. You can handle it.',
    confront_balanced_reflective: 'This is what it is. Ask yourself what you truly want.',
    confront_balanced_moderate: 'See it clearly, then make your choice.',
    confront_balanced_lighten: 'Do not overthink it. Do what needs to be done.',
    confront_honest_reflective: 'This road is not easy, but you know why you are still on it.',
    confront_honest_moderate: 'No one can carry it for you, but you can carry it.',
    confront_honest_lighten: 'If it hurts, it hurts. Stand back up.',

    // moderate (中) 组合
    moderate_hopeful_reflective: 'Take it slowly. Think it through. It can still get better.',
    moderate_hopeful_moderate: 'It is not as bad as it feels. Just take it step by step.',
    moderate_hopeful_lighten: 'Ease up a little. Tomorrow may feel lighter.',
    moderate_balanced_reflective: 'There is no rush, but do not stop either. Ask what you really want.',
    moderate_balanced_moderate: 'It is neither great nor terrible. Keep moving.',
    moderate_balanced_lighten: 'Do not grip it so tightly. Let the past stay where it is.',
    moderate_honest_reflective: 'It has not been easy, but you understand more now than before.',
    moderate_honest_moderate: 'Some things simply are what they are. Acceptance is courage too.',
    moderate_honest_lighten: 'Let it go for now. Do not be so hard on yourself.',

    // gentle (柔) 组合
    gentle_hopeful_reflective: 'Rest for a moment. You deserve this drink. We can talk after you breathe.',
    gentle_hopeful_moderate: 'You do not have to think about all of that tonight. This may help a little.',
    gentle_hopeful_lighten: 'Set everything down for now. In this moment, just have a drink.',
    gentle_balanced_reflective: 'There is no rush. Think slowly. I am here.',
    gentle_balanced_moderate: 'Just drink tonight. The rest can wait until tomorrow.',
    gentle_balanced_lighten: 'Leave it alone for a moment. Catch your breath first.',
    gentle_honest_reflective: 'This drink will not solve everything, but at least you do not have to sit with it alone.',
    gentle_honest_moderate: 'It is okay. You do not have to say anything.',
    gentle_honest_lighten: 'If you are tired, you are tired. There is no shame in that.'
  };

  const baseSummary = attitudeSentences[attitudeKey] || 'I am here. If you want to talk, talk.';

  // === 材料 feeling 融合 ===
  // 收集各部分的 feeling，每种角色只取一条
  let mainFeeling = null;   // 主料（用量最多的原料）
  let subFeeling = null;    // 副料
  let vesselFeeling = null; // 杯子或冰块
  let finishFeeling = null; // 配料或装饰（收尾的一笔）

  if (recipe) {
    const sortedIngredients = [...(recipe.ingredients || [])].sort((a, b) => (b.count || 1) - (a.count || 1));
    if (sortedIngredients[0]) mainFeeling = INGREDIENTS[sortedIngredients[0].id]?.feeling;
    if (sortedIngredients[1]) subFeeling = INGREDIENTS[sortedIngredients[1].id]?.feeling;

    const glass = GLASS_TYPES[recipe.glass];
    const ice = (recipe.ice && recipe.ice !== 'no_ice') ? ICE_TYPES[recipe.ice] : null;
    vesselFeeling = glass?.feeling || ice?.feeling || null;

    const garnish = GARNISH_TYPES[recipe.garnish];
    const deco = DECORATION_TYPES[recipe.decoration];
    finishFeeling = garnish?.feeling || deco?.feeling || null;
  }

  // 编织成一段自然的叙述，而非分号罗列
  let feelingSummary = '';
  if (mainFeeling) {
    feelingSummary = mainFeeling;
    if (subFeeling) {
      // 两种原料间用转折/递进连接
      const connectors = [', then ', ', and then ', ' while ', ' mixed with '];
      const conn = connectors[Math.abs(hashStr(mainFeeling + subFeeling)) % connectors.length];
      feelingSummary += `${conn}${subFeeling}`;
    }
    if (vesselFeeling) {
      feelingSummary += `。${vesselFeeling}`;
    }
    if (finishFeeling) {
      feelingSummary += `. Finally, ${finishFeeling}`;
    }
  }

  attitude.baseSummary = baseSummary;
  attitude.feelingSummary = feelingSummary;
  // 最终 summary
  attitude.summary = feelingSummary ? `${baseSummary}。\n${feelingSummary}` : baseSummary;
  attitude.isWater = false;

  return attitude;
};

/**
 * 简单字符串哈希（确定性，相同输入永远相同输出）
 * 用于从连接词列表中稳定选择，避免每次渲染随机变化
 */
function hashStr(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  }
  return h;
}

/**
 * 判断态度的影响方向
 * 用于十字路口系统判定酒对决策的影响
 * @param {Object} attitude - 态度对象
 * @returns {string} 影响方向
 */
export const getAttitudeInfluence = (attitude) => {
  if (!attitude) return 'neutral';
  
  // 白水固定为 accept
  if (attitude.isWater) return 'accept';

  // confront + honest = "该行动了"
  if (attitude.approach === 'confront' && attitude.tone === 'honest') {
    return 'push_action';
  }
  // gentle + hopeful = "别冲动，会好的"
  if (attitude.approach === 'gentle' && attitude.tone === 'hopeful') {
    return 'encourage_patience';
  }
  // confront + hopeful = "你能行的，去做吧"
  if (attitude.approach === 'confront' && attitude.tone === 'hopeful') {
    return 'empower';
  }
  // gentle + honest = "现在不行也没关系"
  if (attitude.approach === 'gentle' && attitude.tone === 'honest') {
    return 'accept';
  }
  return 'neutral';
};

/**
 * 🆕 检测酒的态度与顾客情绪是否明显失调
 * 只排除"显然说错话"的情况，其他都允许
 * @param {Object} attitude - 态度对象（来自 interpretCocktailAttitude）
 * @param {Object} customerState - 顾客状态 { realEmotions: string[] }
 * @returns {boolean} true = 失调
 */
export const checkDissonance = (attitude, customerState) => {
  if (!attitude || !customerState) return false;

  const realEmotions = customerState.realEmotions || [];

  const hasFragile = realEmotions.some(e =>
    ['fear', 'sadness', 'anger', 'disgust'].includes(e)
  );
  const hasPositive = realEmotions.some(e =>
    ['joy', 'trust', 'anticipation', 'surprise'].includes(e)
  );

  // 规则1：顾客脆弱时，给极度激烈对抗的酒 = 失调
  if (hasFragile && attitude.approach === 'confront' && attitude.tone === 'honest') {
    return true;
  }

  // 规则2：顾客开心/有勇气时，给极度消沉的酒 = 失调
  if (hasPositive && attitude.approach === 'gentle' && attitude.tone === 'honest' && attitude.depth === 'reflective') {
    return true;
  }

  // 其他情况都不算失调——给AI足够的解读空间
  return false;
};
