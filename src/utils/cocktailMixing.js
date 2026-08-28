/**
 * 调酒混合计算工具
 * 实现三维属性计算、条件判定、目标生成等核心逻辑
 */

import { INGREDIENTS, MAX_PORTIONS_PER_INGREDIENT, MAX_TOTAL_PORTIONS } from '../data/ingredients.js';
import { EMOTION_TARGETS, EMOTION_TASTE_PROTOTYPES, GLASS_TYPES } from '../data/emotions.js';
import { ICE_TYPES, GARNISH_TYPES, DECORATION_TYPES } from '../data/addons.js';

/**
 * 三维属性范围
 */
export const ATTRIBUTE_RANGES = {
  thickness: { min: -5, max: 10, name: 'Thickness', icon: '🫗' },
  sweetness: { min: -5, max: 10, name: 'Sweetness', icon: '🍬' },
  strength: { min: 0, max: 10, name: 'Strength', icon: '🔥' }
};

/**
 * 计算原浆混合后的三维值
 * @param {Array} portions - 原浆份数数组 [{id: 'vodka', count: 2}, ...]
 * @param {string} iceType - 冰块类型ID（可选）
 * @param {string} garnishId - 配料ID（可选）
 * @param {string} decorationId - 装饰ID（可选）
 * @returns {Object} { thickness, sweetness, strength }
 */
export const calculateMixture = (portions, iceType = null, garnishId = null, decorationId = null) => {
  let thickness = 0;
  let sweetness = 0;
  let strength = 0;
  
  // 计算所有原浆的贡献
  portions.forEach(portion => {
    const ingredient = INGREDIENTS[portion.id];
    if (ingredient) {
      thickness += ingredient.thickness * portion.count;
      sweetness += ingredient.sweetness * portion.count;
      strength += ingredient.strength * portion.count;
    }
  });
  
  // 冰块的三维影响
  if (iceType) {
    const iceEffect = getIceEffect(iceType);
    thickness += iceEffect.thickness;
    sweetness += iceEffect.sweetness;
    strength += iceEffect.strength;
  }
  
  // 配料的三维影响
  if (garnishId) {
    const garnishEffect = getGarnishEffect(garnishId);
    thickness += garnishEffect.thickness;
    sweetness += garnishEffect.sweetness;
    strength += garnishEffect.strength;
  }
  
  // 装饰的三维影响
  if (decorationId) {
    const decoEffect = getDecorationEffect(decorationId);
    thickness += decoEffect.thickness;
    sweetness += decoEffect.sweetness;
    strength += decoEffect.strength;
  }
  
  return {
    thickness: Math.max(ATTRIBUTE_RANGES.thickness.min, Math.min(ATTRIBUTE_RANGES.thickness.max, thickness)),
    sweetness: Math.max(ATTRIBUTE_RANGES.sweetness.min, Math.min(ATTRIBUTE_RANGES.sweetness.max, sweetness)),
    strength: Math.max(ATTRIBUTE_RANGES.strength.min, Math.min(ATTRIBUTE_RANGES.strength.max, strength))
  };
};

/**
 * 获取冰块对三维的影响
 * @param {string} iceType - 冰块类型ID
 * @returns {Object} { thickness, sweetness, strength }
 */
export const getIceEffect = (iceType) => {
  const iceData = ICE_TYPES[iceType];
  if (!iceData) {
    return { thickness: 0, sweetness: 0, strength: 0 };
  }
  
  return {
    thickness: iceData.thicknessEffect || 0,
    sweetness: iceData.sweetnessEffect || 0,
    strength: iceData.strengthEffect || 0
  };
};

/**
 * 获取配料对三维的影响
 * @param {string} garnishId - 配料ID
 * @returns {Object} { thickness, sweetness, strength }
 */
export const getGarnishEffect = (garnishId) => {
  const garnishData = GARNISH_TYPES[garnishId];
  if (!garnishData) {
    return { thickness: 0, sweetness: 0, strength: 0 };
  }
  
  return {
    thickness: garnishData.thicknessEffect || 0,
    sweetness: garnishData.sweetnessEffect || 0,
    strength: garnishData.strengthEffect || 0
  };
};

/**
 * 获取装饰对三维的影响
 * @param {string} decoId - 装饰ID
 * @returns {Object} { thickness, sweetness, strength }
 */
export const getDecorationEffect = (decoId) => {
  const decoData = DECORATION_TYPES[decoId];
  if (!decoData) {
    return { thickness: 0, sweetness: 0, strength: 0 };
  }
  
  return {
    thickness: decoData.thicknessEffect || 0,
    sweetness: decoData.sweetnessEffect || 0,
    strength: decoData.strengthEffect || 0
  };
};

/**
 * 检查单个条件是否满足
 * @param {number} currentValue - 当前属性值
 * @param {Object} condition - 条件对象 { attr, op, value }
 * @returns {boolean}
 */
export const checkSingleCondition = (currentValue, condition) => {
  const { op, value } = condition;
  
  switch (op) {
    case '>=':
      return currentValue >= value;
    case '<=':
      return currentValue <= value;
    case '=':
    case '==':
      return currentValue === value;
    case '>':
      return currentValue > value;
    case '<':
      return currentValue < value;
    default:
      console.warn(`Unknown operator: ${op}`);
      return false;
  }
};

/**
 * 检查当前混合是否满足所有目标条件
 * @param {Object} current - 当前三维值 { thickness, sweetness, strength }
 * @param {Array} conditions - 条件数组 [{ attr, op, value }, ...]
 * @returns {Object} { allMet: boolean, results: Array }
 */
export const checkTargetConditions = (current, conditions) => {
  const results = conditions.map(cond => ({
    ...cond,
    currentValue: current[cond.attr],
    met: checkSingleCondition(current[cond.attr], cond)
  }));
  
  const allMet = results.every(r => r.met);
  const metCount = results.filter(r => r.met).length;
  
  return {
    allMet,
    metCount,
    totalConditions: conditions.length,
    results,
    satisfaction: conditions.length > 0 ? metCount / conditions.length : 0
  };
};

/**
 * 计算条件满足的进度（用于UI显示）
 * @param {number} currentValue - 当前值
 * @param {Object} condition - 条件
 * @returns {Object} { progress, distance, direction }
 */
export const calculateConditionProgress = (currentValue, condition) => {
  const { op, value } = condition;
  let progress = 0;
  let distance = 0;
  let direction = 'neutral'; // 'increase', 'decrease', 'neutral', 'exact'
  
  switch (op) {
    case '>=':
      if (currentValue >= value) {
        progress = 1;
        direction = 'met';
      } else {
        progress = value !== 0 ? Math.max(0, currentValue / value) : 0;
        distance = value - currentValue;
        direction = 'increase';
      }
      break;
    case '<=':
      if (currentValue <= value) {
        progress = 1;
        direction = 'met';
      } else {
        progress = currentValue !== 0 ? Math.max(0, value / currentValue) : 0;
        distance = currentValue - value;
        direction = 'decrease';
      }
      break;
    case '=':
    case '==':
      if (currentValue === value) {
        progress = 1;
        direction = 'met';
      } else {
        progress = 1 - Math.min(1, Math.abs(currentValue - value) / Math.max(1, Math.abs(value)));
        distance = currentValue - value;
        direction = currentValue < value ? 'increase' : 'decrease';
      }
      break;
    case '>':
      if (currentValue > value) {
        progress = 1;
        direction = 'met';
      } else {
        progress = (value + 1) !== 0 ? Math.max(0, currentValue / (value + 1)) : 0;
        distance = value + 1 - currentValue;
        direction = 'increase';
      }
      break;
    case '<':
      if (currentValue < value) {
        progress = 1;
        direction = 'met';
      } else {
        progress = currentValue !== 0 ? Math.max(0, (value - 1) / currentValue) : 0;
        distance = currentValue - value + 1;
        direction = 'decrease';
      }
      break;
    default:
      break;
  }
  
  return { progress, distance, direction };
};

/**
 * 验证目标是否有解
 * 使用简单的搜索算法检查是否存在可行的原浆组合
 * @param {Array} conditions - 目标条件
 * @param {Array} availableIngredients - 可用原浆ID列表
 * @returns {boolean}
 */
export const findValidSolution = (conditions, availableIngredients) => {
  // 简化版本：尝试所有单原浆和双原浆组合
  const ingredients = availableIngredients.map(id => INGREDIENTS[id]).filter(Boolean);
  
  // 检查单原浆（1-5份）
  for (const ing of ingredients) {
    for (let count = 1; count <= MAX_PORTIONS_PER_INGREDIENT; count++) {
      const mixture = calculateMixture([{ id: ing.id, count }]);
      const { allMet } = checkTargetConditions(mixture, conditions);
      if (allMet) return true;
    }
  }
  
  // 检查双原浆组合
  for (let i = 0; i < ingredients.length; i++) {
    for (let j = i; j < ingredients.length; j++) {
      for (let c1 = 1; c1 <= 3; c1++) {
        for (let c2 = 1; c2 <= 3; c2++) {
          if (c1 + c2 > MAX_TOTAL_PORTIONS) continue;
          
          const portions = i === j 
            ? [{ id: ingredients[i].id, count: c1 + c2 }]
            : [{ id: ingredients[i].id, count: c1 }, { id: ingredients[j].id, count: c2 }];
          
          const mixture = calculateMixture(portions);
          const { allMet } = checkTargetConditions(mixture, conditions);
          if (allMet) return true;
        }
      }
    }
  }
  
  // 检查三原浆组合（简化）
  for (let i = 0; i < ingredients.length; i++) {
    for (let j = i + 1; j < ingredients.length; j++) {
      for (let k = j + 1; k < ingredients.length; k++) {
        const portions = [
          { id: ingredients[i].id, count: 1 },
          { id: ingredients[j].id, count: 1 },
          { id: ingredients[k].id, count: 1 }
        ];
        const mixture = calculateMixture(portions);
        const { allMet } = checkTargetConditions(mixture, conditions);
        if (allMet) return true;
      }
    }
  }
  
  return false;
};

/**
 * 生成确保有解的目标条件
 * @param {string} emotionId - 情绪ID
 * @param {Array} availableIngredients - 可用原浆ID列表
 * @param {number} maxAttempts - 最大尝试次数
 * @returns {Object} 目标对象
 */
export const generateSolvableTarget = (emotionId, availableIngredients, maxAttempts = 10) => {
  const baseTarget = EMOTION_TARGETS[emotionId];
  if (!baseTarget) {
    console.error(`Unknown emotion: ${emotionId}`);
    return null;
  }
  
  // 先检查基础目标是否有解
  if (findValidSolution(baseTarget.conditions, availableIngredients)) {
    return {
      emotionId,
      conditions: [...baseTarget.conditions],
      hint: baseTarget.hint,
      description: baseTarget.description,
      hasVariance: false
    };
  }
  
  // 如果基础目标无解，尝试放宽条件
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const relaxedConditions = baseTarget.conditions.map(cond => {
      // 逐步放宽条件
      let newValue = cond.value;
      
      if (cond.op === '>=' || cond.op === '>') {
        newValue = cond.value - (attempt + 1);
      } else if (cond.op === '<=' || cond.op === '<') {
        newValue = cond.value + (attempt + 1);
      }
      
      return { ...cond, value: newValue };
    });
    
    if (findValidSolution(relaxedConditions, availableIngredients)) {
      return {
        emotionId,
        conditions: relaxedConditions,
        hint: baseTarget.hint,
        description: generateConditionDescription(relaxedConditions),
        hasVariance: true,
        relaxLevel: attempt + 1
      };
    }
  }
  
  // 如果仍无解，返回非常宽松的条件
  const easyConditions = baseTarget.conditions.map(cond => ({
    ...cond,
    value: cond.op.includes('>') ? -5 : 10
  }));
  
  return {
    emotionId,
    conditions: easyConditions,
    hint: baseTarget.hint,
    description: 'Any combination works.',
    hasVariance: true,
    relaxLevel: 'max'
  };
};

const clampAttrValue = (attr, value) => {
  const range = ATTRIBUTE_RANGES[attr];
  if (!range) {
    return value;
  }
  return Math.max(range.min, Math.min(range.max, value));
};

const buildConditionsFromVector = (vector, tolerance = 0.5) => {
  const axes = ['thickness', 'sweetness', 'strength'];

  return axes.flatMap((attr) => {
    const center = Number(vector[attr] || 0);
    const lower = clampAttrValue(attr, Math.floor(center - tolerance));
    const upper = clampAttrValue(attr, Math.ceil(center + tolerance));

    if (lower >= upper) {
      return [{ attr, op: '=', value: lower }];
    }

    return [
      { attr, op: '>=', value: lower },
      { attr, op: '<=', value: upper }
    ];
  });
};

const averageEmotionVector = (emotionIds) => {
  const validIds = (Array.isArray(emotionIds) ? emotionIds : [])
    .filter((id) => Boolean(EMOTION_TASTE_PROTOTYPES[id]));

  if (validIds.length === 0) {
    return null;
  }

  const sum = validIds.reduce((acc, id) => {
    const proto = EMOTION_TASTE_PROTOTYPES[id];
    return {
      thickness: acc.thickness + (proto.thickness || 0),
      sweetness: acc.sweetness + (proto.sweetness || 0),
      strength: acc.strength + (proto.strength || 0)
    };
  }, { thickness: 0, sweetness: 0, strength: 0 });

  return {
    thickness: sum.thickness / validIds.length,
    sweetness: sum.sweetness / validIds.length,
    strength: sum.strength / validIds.length,
    validIds
  };
};

export const generateSolvableTargetFromEmotionCombo = (emotionIds, availableIngredients, maxAttempts = 10) => {
  const averaged = averageEmotionVector(emotionIds);
  if (!averaged) {
    return null;
  }

  const { validIds, ...vector } = averaged;
  const baseConditions = buildConditionsFromVector(vector, 0.5);

  if (findValidSolution(baseConditions, availableIngredients)) {
    return {
      emotionIds: validIds,
      targetVector: vector,
      conditions: baseConditions,
      hint: `Mix around the combined taste profile of ${validIds.join(' + ')}.`,
      description: generateConditionDescription(baseConditions),
      hasVariance: false
    };
  }

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const widened = buildConditionsFromVector(vector, 0.5 + attempt * 0.5);
    if (findValidSolution(widened, availableIngredients)) {
      return {
        emotionIds: validIds,
        targetVector: vector,
        conditions: widened,
        hint: `Mix around the combined taste profile of ${validIds.join(' + ')}.`,
        description: generateConditionDescription(widened),
        hasVariance: true,
        relaxLevel: attempt
      };
    }
  }

  const easyConditions = [
    { attr: 'thickness', op: '>=', value: ATTRIBUTE_RANGES.thickness.min },
    { attr: 'thickness', op: '<=', value: ATTRIBUTE_RANGES.thickness.max },
    { attr: 'sweetness', op: '>=', value: ATTRIBUTE_RANGES.sweetness.min },
    { attr: 'sweetness', op: '<=', value: ATTRIBUTE_RANGES.sweetness.max },
    { attr: 'strength', op: '>=', value: ATTRIBUTE_RANGES.strength.min },
    { attr: 'strength', op: '<=', value: ATTRIBUTE_RANGES.strength.max }
  ];

  return {
    emotionIds: validIds,
    targetVector: vector,
    conditions: easyConditions,
    hint: `Mix around the combined taste profile of ${validIds.join(' + ')}.`,
    description: 'Automatically relaxed to a free-mixing range for the current ingredient pool.',
    hasVariance: true,
    relaxLevel: 'max'
  };
};

/**
 * 生成条件描述文本
 * @param {Array} conditions - 条件数组
 * @returns {string}
 */
export const generateConditionDescription = (conditions) => {
  const attrNames = {
    thickness: 'Thickness',
    sweetness: 'Sweetness',
    strength: 'Strength'
  };
  
  return conditions.map(cond => {
    const attrName = attrNames[cond.attr] || cond.attr;
    const opText = {
      '>=': '≥',
      '<=': '≤',
      '>': '>',
      '<': '<',
      '=': '=',
      '==': '='
    }[cond.op] || cond.op;
    
    return `${attrName}${opText}${cond.value}`;
  }).join('，');
};

/**
 * 获取调酒建议（根据当前状态和目标）
 * @param {Object} current - 当前三维值
 * @param {Array} conditions - 目标条件
 * @param {Array} availableIngredients - 可用原浆列表
 * @returns {Array} 建议数组
 */
export const getMixingSuggestions = (current, conditions, availableIngredients) => {
  const suggestions = [];
  const checkResult = checkTargetConditions(current, conditions);
  
  if (checkResult.allMet) {
    suggestions.push({ type: 'success', message: 'All conditions met.' });
    return suggestions;
  }
  
  // 分析未满足的条件
  checkResult.results.filter(r => !r.met).forEach(r => {
    const { attr, op, value, currentValue } = r;
    const attrName = ATTRIBUTE_RANGES[attr]?.name || attr;
    const progress = calculateConditionProgress(currentValue, { op, value });
    
    if (progress.direction === 'increase') {
      // 寻找能增加该属性的原浆
      const helpfulIngs = availableIngredients
        .map(id => INGREDIENTS[id])
        .filter(ing => ing && ing[attr] > 0)
        .sort((a, b) => b[attr] - a[attr])
        .slice(0, 2);
      
      if (helpfulIngs.length > 0) {
        suggestions.push({
          type: 'hint',
          message: `${attrName} needs to increase by ${progress.distance.toFixed(1)}`,
          recommended: helpfulIngs.map(i => i.name).join(', ')
        });
      }
    } else if (progress.direction === 'decrease') {
      // 寻找能降低该属性的原浆
      const helpfulIngs = availableIngredients
        .map(id => INGREDIENTS[id])
        .filter(ing => ing && ing[attr] < 0)
        .sort((a, b) => a[attr] - b[attr])
        .slice(0, 2);
      
      if (helpfulIngs.length > 0) {
        suggestions.push({
          type: 'hint',
          message: `${attrName} needs to decrease by ${progress.distance.toFixed(1)}`,
          recommended: helpfulIngs.map(i => i.name).join(', ')
        });
      } else {
        suggestions.push({
          type: 'warning',
          message: `${attrName} is too high. Consider reducing related ingredients.`
        });
      }
    }
  });
  
  return suggestions;
};

/**
 * 计算总份数
 * @param {Array} portions - 原浆份数数组
 * @returns {number}
 */
export const getTotalPortions = (portions) => {
  return portions.reduce((sum, p) => sum + p.count, 0);
};

/**
 * 检查是否可以添加更多原浆
 * @param {Array} portions - 当前原浆份数数组
 * @param {string} ingredientId - 要添加的原浆ID
 * @param {string} glassId - 杯型ID（可选）
 * @returns {Object} { canAdd, reason }
 */
export const canAddIngredient = (portions, ingredientId, glassId = null) => {
  const total = getTotalPortions(portions);
  
  // 根据杯型确定最大份数
  let maxTotal = MAX_TOTAL_PORTIONS;
  if (glassId && GLASS_TYPES[glassId]) {
    maxTotal = GLASS_TYPES[glassId].maxPortions || MAX_TOTAL_PORTIONS;
  }
  
  if (total >= maxTotal) {
    const glassName = glassId && GLASS_TYPES[glassId] ? GLASS_TYPES[glassId].name : 'Current glass';
    return { canAdd: false, reason: `${glassName} has reached its limit (${maxTotal} portions)` };
  }
  
  const existing = portions.find(p => p.id === ingredientId);
  if (existing && existing.count >= MAX_PORTIONS_PER_INGREDIENT) {
    return { canAdd: false, reason: `This ingredient has reached its limit (${MAX_PORTIONS_PER_INGREDIENT} portions)` };
  }
  
  return { canAdd: true, reason: null };
};

/**
 * 添加一份原浆
 * @param {Array} portions - 当前原浆份数数组
 * @param {string} ingredientId - 原浆ID
 * @param {string} glassId - 杯型ID（可选）
 * @returns {Array} 新的原浆份数数组
 */
export const addPortion = (portions, ingredientId, glassId = null) => {
  const { canAdd } = canAddIngredient(portions, ingredientId, glassId);
  if (!canAdd) return portions;
  
  const existingIndex = portions.findIndex(p => p.id === ingredientId);
  
  if (existingIndex >= 0) {
    // 深拷贝避免修改原始对象
    return portions.map((p, i) => 
      i === existingIndex ? { ...p, count: p.count + 1 } : p
    );
  } else {
    return [...portions, { id: ingredientId, count: 1 }];
  }
};

/**
 * 移除一份原浆
 * @param {Array} portions - 当前原浆份数数组
 * @param {string} ingredientId - 原浆ID
 * @returns {Array} 新的原浆份数数组
 */
export const removePortion = (portions, ingredientId) => {
  const index = portions.findIndex(p => p.id === ingredientId);
  
  if (index === -1) return portions;
  
  if (portions[index].count > 1) {
    // 深拷贝避免修改原始对象
    return portions.map((p, i) => 
      i === index ? { ...p, count: p.count - 1 } : p
    );
  } else {
    return portions.filter((_, i) => i !== index);
  }
};
