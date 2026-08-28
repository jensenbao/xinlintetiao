/**
 * 进阶引导管理 Hook
 * 在游戏关键时刻触发一次性教学提示
 */
import { useState, useCallback } from 'react';
import { ADVANCED_GUIDES } from '../data/advancedGuides.js';

const STORAGE_KEY = 'bartender_guides_shown';

export const useAdvancedGuides = () => {
  const [shownGuides, setShownGuides] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    } catch { return []; }
  });

  const [currentGuide, setCurrentGuide] = useState(null);

  /**
   * 检查并触发引导
   * @param {string} triggerType - 触发类型
   * @param {Object} context - 触发上下文
   */
  const checkGuide = useCallback((triggerType, context = {}) => {
    if (currentGuide) return;

    for (const guide of Object.values(ADVANCED_GUIDES)) {
      if (shownGuides.includes(guide.id)) continue;
      if (guide.trigger.type !== triggerType) continue;
      if (!evaluateTriggerCondition(guide.trigger, context)) continue;

      setCurrentGuide(guide);
      break;
    }
  }, [shownGuides, currentGuide]);

  /**
   * 关闭当前引导
   */
  const dismissGuide = useCallback(() => {
    if (currentGuide) {
      const newShown = [...shownGuides, currentGuide.id];
      setShownGuides(newShown);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newShown));
      setCurrentGuide(null);
    }
  }, [currentGuide, shownGuides]);

  /**
   * 重置所有引导（用于新游戏）
   */
  const resetGuides = useCallback(() => {
    setShownGuides([]);
    localStorage.removeItem(STORAGE_KEY);
    setCurrentGuide(null);
  }, []);

  /**
   * 检查某条引导是否已显示
   */
  const hasSeenGuide = useCallback((id) => shownGuides.includes(id), [shownGuides]);

  return {
    currentGuide,
    checkGuide,
    dismissGuide,
    resetGuides,
    hasSeenGuide
  };
};

/**
 * 评估触发条件
 */
const evaluateTriggerCondition = (trigger, context) => {
  if (trigger.day) {
    if (trigger.day.min && (context.day || 0) < trigger.day.min) return false;
    if (trigger.day.max && (context.day || 0) > trigger.day.max) return false;
  }

  if (trigger.customerCount) {
    if (trigger.customerCount.min && (context.customerCount || 0) < trigger.customerCount.min) return false;
  }

  if (trigger.firstTime && !context.isFirstTime) return false;

  if (trigger.condition) {
    return evaluateConditionString(trigger.condition, context);
  }

  return true;
};

/**
 * 简单条件表达式求值
 */
const evaluateConditionString = (condition, context) => {
  if (condition === 'first_time') return context.isFirstTime;
  if (condition === 'is_return_customer') return context.isReturnCustomer;
  if (condition === 'customer_seems_fragile') return context.customerSeemFragile;

  // 数值比较
  const compMatch = condition.match(/(\w+)\s*(>=|<=|>|<|===?)\s*([\d.]+)/);
  if (compMatch) {
    const [, key, op, value] = compMatch;
    const actual = context[key];
    const expected = parseFloat(value);
    if (actual === undefined) return false;
    switch (op) {
      case '>=': return actual >= expected;
      case '<=': return actual <= expected;
      case '>': return actual > expected;
      case '<': return actual < expected;
      case '==':
      case '===': return actual === expected;
      default: return false;
    }
  }

  // 复合条件
  if (condition.includes('&&')) {
    return condition.split('&&').map(c => c.trim()).every(c => evaluateConditionString(c, context));
  }

  return true;
};

export default useAdvancedGuides;
