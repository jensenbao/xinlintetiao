/**
 * 开发者模式调试操作函数
 */

import { GLASS_TYPES } from '../../data/emotions.js';
import { ICE_TYPES, GARNISH_TYPES, DECORATION_TYPES, COMBO_BONUS } from '../../data/addons.js';
import { INGREDIENTS } from '../../data/ingredients.js';
import {
  getStorageUsage,
  clearAllCache,
  saveUnlockedItems,
  getUnlockedItems,
  saveDiscoveredCombo,
  getDiscoveredCombos,
  getGameProgress,
  getCocktailRecipes,
  getShortMemory,
  getSettings,
  getWorldState,
  getReturnCustomers,
  saveReturnCustomers,
  updateReturnCustomer,
  getChapterState,
  saveChapterState
} from '../../utils/storage.js';
import { EMOTION_IDS_8 } from '../../utils/emotionSchema.js';

/**
 * 获取所有物品ID列表
 */
const getAllItemIds = () => {
  return {
    emotions: [...EMOTION_IDS_8],
    glasses: Object.keys(GLASS_TYPES),
    iceTypes: Object.keys(ICE_TYPES),
    garnishes: Object.keys(GARNISH_TYPES),
    decorations: Object.keys(DECORATION_TYPES),
    ingredients: Object.keys(INGREDIENTS)
  };
};

/**
 * 解锁所有物品
 */
export const unlockAllItems = () => {
  const allItems = getAllItemIds();
  const unlocked = {
    emotions: allItems.emotions,
    glasses: allItems.glasses,
    iceTypes: allItems.iceTypes,
    garnishes: allItems.garnishes,
    decorations: allItems.decorations,
    ingredients: allItems.ingredients,
    successCount: 999
  };
  saveUnlockedItems(unlocked);
  console.log('🔓 All items unlocked:', unlocked);
  return unlocked;
};

/**
 * 解锁指定类别的物品
 */
export const unlockCategory = (currentUnlocked, category) => {
  const allItems = getAllItemIds();
  
  if (!allItems[category]) {
    console.warn('Unknown category:', category);
    return currentUnlocked;
  }
  
  const updated = {
    ...currentUnlocked,
    [category]: allItems[category]
  };
  
  saveUnlockedItems(updated);
  console.log(`🔓 Unlocked all ${category}:`, allItems[category]);
  return updated;
};

/**
 * 发现所有黄金组合
 */
export const discoverAllCombos = () => {
  const combos = Object.entries(COMBO_BONUS);
  
  combos.forEach(([comboId, combo]) => {
    saveDiscoveredCombo(comboId, {
      name: combo.name,
      icon: combo.icon,
      description: combo.description,
      bonus: combo.bonus,
      requires: combo.requires
    });
  });
  
  console.log('🎊 Discovered all golden combos:', combos.length, 'total');
  return getDiscoveredCombos();
};

/**
 * 导出所有游戏数据
 */
export const exportGameData = () => {
  const data = {
    exportTime: new Date().toISOString(),
    version: '1.0',
    gameProgress: getGameProgress(),
    unlockedItems: getUnlockedItems(),
    discoveredCombos: getDiscoveredCombos(),
    cocktailRecipes: getCocktailRecipes(),
    settings: getSettings(),
    worldState: getWorldState(),
    chapterState: getChapterState(),
    returnCustomers: getReturnCustomers(),
    shortMemory: {
      workplace: getShortMemory('workplace'),
      artistic: getShortMemory('artistic'),
      student: getShortMemory('student')
    }
  };
  
  console.log('📦 Game data exported:', data);
  return data;
};

/**
 * 设置当前章节（仅修改持久化章节状态）
 */
export const setCurrentChapter = (chapterId, currentDay = 1) => {
  const id = Math.max(1, Math.min(5, Math.round(Number(chapterId) || 1)));
  const prev = getChapterState();
  const updated = {
    ...prev,
    currentChapter: id,
    endingTriggered: false,
    freeMode: false,
    endingNarrative: null,
    chapterHistory: [
      ...(prev.chapterHistory || []).filter(Boolean),
      {
        chapter: id,
        enteredOnDay: Math.max(1, Math.round(Number(currentDay) || 1)),
        openingNarrative: null,
        triggeredBy: 'dev'
      }
    ].slice(-10)
  };
  saveChapterState(updated);
  console.log('📖 [DEV] Current chapter set:', id);
  return updated;
};

/**
 * 创建一个最小可用的回头客（用于测试）
 */
export const createTestReturnCustomer = (options = {}) => {
  const now = Date.now();
  const category = options.categoryId || 'workplace';
  const name = options.name || `ReturnGuest${String(now).slice(-4)}`;
  const phase = options.phase || 'introduction';
  const baseEmotions = options.realEmotions || ['fear', 'sadness'];

  const customer = {
    id: `return_${category}_${name}_${now}`,
    originalConfig: {
      id: `dev_${category}_${now}`,
      name,
      categoryId: category,
      avatar: '👤',
      personality: ['quiet', 'guarded', 'testing the waters'],
      dialogueStyle: { tone: 'casual', length: 'short', features: ['frequent pauses', 'brief replies', 'dialogue only'] },
      emotionMask: {
        surface: ['trust'],
        reality: baseEmotions.slice(0, 2),
        trustThreshold: { low: 0.25, medium: 0.55, high: 0.75 }
      },
      preferences: { iceType: 'no_ice', garnishes: [], decorations: [] },
      backstory: '(DEV) Sample character used for return-guest continuity and crossroads testing.'
    },
    name,
    category,
    relationship: {
      totalVisits: 1,
      intimacy: 0.6,
      sharedHistory: [{
        day: 1,
        summary: 'First visit (created by DEV).'
      }]
    },
    characterArc: {
      currentPhase: phase,
      phases: [{
        phase,
        day: 1,
        state: '(DEV) The story starts here.',
        emotions: baseEmotions.slice(0, 2),
        resolved: true
      }],
      nextVisitSetup: {
        visitReason: 'Wanted to come back for another quiet sit-down',
        openingMood: 'familiar',
        storyDirection: 'Continue the last conversation',
        suggestedDayGap: 1
      }
    },
    crossroads: {
      active: false,
      dilemma: '',
      options: [],
      influenceFactors: { cocktailAttitudes: [], trustAtEnd: 0, dialogueKeywords: [] },
      resolvedOption: null,
      resolvedDay: null
    },
    emotionTrajectory: [{
      day: 1,
      emotions: { surface: ['trust'], reality: baseEmotions.slice(0, 2) }
    }],
    scheduling: {
      nextPossibleDay: 1,
      returnPriority: 90,
      weatherCondition: null,
      isScheduled: false
    }
  };

  const pool = getReturnCustomers();
  const updated = [...pool, customer].slice(0, 15);
  saveReturnCustomers(updated);
  console.log('🔄 [DEV] Created return guest:', customer.name, customer.id);
  return customer;
};

/**
 * 强制安排回头客在指定天数可来访（不保证一定被抽到）
 */
export const scheduleReturnCustomerOnDay = (returnCustomerId, day) => {
  const customers = getReturnCustomers();
  const idx = customers.findIndex(c => c.id === returnCustomerId);
  if (idx < 0) return null;
  const d = Math.max(1, Math.round(Number(day) || 1));
  customers[idx] = {
    ...customers[idx],
    scheduling: {
      ...(customers[idx].scheduling || {}),
      nextPossibleDay: d,
      isScheduled: false,
      returnPriority: Math.max(95, customers[idx].scheduling?.returnPriority || 0)
    }
  };
  saveReturnCustomers(customers);
  console.log('📅 [DEV] Scheduled return-guest availability day:', d, returnCustomerId);
  return customers[idx];
};

/**
 * 强制设置回头客弧光阶段
 */
export const setReturnCustomerPhase = (returnCustomerId, phase) => {
  const customers = getReturnCustomers();
  const idx = customers.findIndex(c => c.id === returnCustomerId);
  if (idx < 0) return null;
  const allowed = ['introduction', 'escalation', 'turning_point', 'resolution', 'epilogue'];
  const nextPhase = allowed.includes(phase) ? phase : 'introduction';
  const updated = {
    ...customers[idx],
    characterArc: {
      ...(customers[idx].characterArc || {}),
      currentPhase: nextPhase
    }
  };
  customers[idx] = updated;
  saveReturnCustomers(customers);
  console.log('🧭 [DEV] Set return-guest phase:', nextPhase, returnCustomerId);
  return updated;
};

/**
 * 设置回头客的“已解决十字路口”用于后果叙述测试
 */
export const setResolvedCrossroadsForReturnCustomer = (returnCustomerId, crossroads) => {
  const customers = getReturnCustomers();
  const idx = customers.findIndex(c => c.id === returnCustomerId);
  if (idx < 0) return null;
  const updated = {
    ...customers[idx],
    crossroads: {
      active: false,
      dilemma: crossroads?.dilemma || '(DEV) Should they make a change?',
      options: Array.isArray(crossroads?.options) && crossroads.options.length > 0
        ? crossroads.options.map(o => ({ ...o }))
        : [
          { id: 'option_a', description: 'Keep pushing forward', consequence: '', wasChosen: false },
          { id: 'option_b', description: 'Try to change', consequence: '', wasChosen: true }
        ],
      influenceFactors: customers[idx].crossroads?.influenceFactors || { cocktailAttitudes: [], trustAtEnd: 0, dialogueKeywords: [] },
      resolvedOption: crossroads?.resolvedOption || 'option_b',
      resolvedDay: crossroads?.resolvedDay || 1
    }
  };
  customers[idx] = updated;
  saveReturnCustomers(customers);
  console.log('🔀 [DEV] Crossroads result set:', returnCustomerId);
  return updated;
};

/**
 * 准备章节切换测试的“门槛条件”（写入 localStorage 持久化状态）
 * 注意：真正触发章节转场需要在 GamePage 内执行一次 processDayEnd（可由 DevPanel 按钮触发）
 */
export const prepareChapterGate = (targetChapterId) => {
  const t = Math.max(2, Math.min(5, Math.round(Number(targetChapterId) || 2)));
  // 将当前章节设为上一章
  setCurrentChapter(t - 1, 1);

  // 准备回头客池满足条件
  let pool = getReturnCustomers();
  const need = (phase) => pool.filter(c => c.characterArc?.currentPhase === phase).length;
  const push = (phase) => {
    const c = createTestReturnCustomer({ phase });
    pool = getReturnCustomers();
    return c;
  };

  if (t === 2) {
    if (pool.length === 0) push('introduction');
  } else if (t === 3) {
    while (need('escalation') < 2) push('escalation');
  } else if (t === 4) {
    if (pool.filter(c => ['turning_point', 'resolution', 'epilogue'].includes(c.characterArc?.currentPhase)).length < 1) {
      push('turning_point');
    }
  } else if (t === 5) {
    // 无硬性回头客要求，保留空分支仅为结构对齐
  }

  console.log('🚦 [DEV] Prepared chapter gate conditions, target chapter:', t);
  return { targetChapter: t };
};

/**
 * 创建开发者操作对象（传递给DevPanel）
 */
export const createDevActions = () => {
  return {
    unlockAllItems,
    unlockCategory,
    discoverAllCombos,
    exportGameData,
    getStorageUsage,
    clearAllCache,
    getAllItemIds,
    // 🆕 AI/叙事/章节调试
    setCurrentChapter,
    prepareChapterGate,
    createTestReturnCustomer,
    scheduleReturnCustomerOnDay,
    setReturnCustomerPhase,
    setResolvedCrossroadsForReturnCustomer,
    // 透传读取（给 DevPanel 列表用）
    getWorldState,
    getReturnCustomers,
    getChapterState
  };
};

export default createDevActions;
