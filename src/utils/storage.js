// 本地存储管理工具
import {
  getActiveNpcId,
  getActiveSlotId,
  queueActiveSlotGameStateSync,
  saveNpcMemory
} from './saveRepository.js';
import { GLASS_TYPES } from '../data/emotions.js';
import { ICE_TYPES, GARNISH_TYPES, DECORATION_TYPES } from '../data/addons.js';
import { INGREDIENTS } from '../data/ingredients.js';
import { EMOTION_IDS_8 } from './emotionSchema.js';
import {
  DEFAULT_PRESET_CHARACTER_IDS,
  isPresetCharacterId,
  isPresetCharacterLockedUntilUserAdded,
} from '../config/defaultCharacters/index.js';

const ALL_EMOTION_IDS = [...EMOTION_IDS_8];

const buildFullyUnlockedItems = (base = {}) => ({
  emotions: [...ALL_EMOTION_IDS],
  glasses: Object.keys(GLASS_TYPES),
  iceTypes: Object.keys(ICE_TYPES),
  garnishes: Object.keys(GARNISH_TYPES),
  decorations: Object.keys(DECORATION_TYPES),
  ingredients: Object.keys(INGREDIENTS),
  successCount: Number(base.successCount || 0)
});

const STORAGE_KEYS = {
  SHORT_MEMORY: 'bartender_short_memory',  // 短期记忆
  LONG_MEMORY: 'bartender_long_memory',    // 长期记忆
  GAME_PROGRESS: 'bartender_progress',      // 游戏进度
  UNLOCKED_ITEMS: 'bartender_unlocked',     // 解锁内容
  SETTINGS: 'bartender_settings',           // 游戏设置
  DISCOVERED_COMBOS: 'bartender_combos',    // 已发现的黄金组合
  // 🆕 文档04 - AI记忆层
  DAILY_MEMORIES: 'bartender_daily_memories',
  PLAYER_PROFILE: 'bartender_player_profile',
  WORLD_STATE: 'bartender_world_state',
  RELATIONSHIPS: 'bartender_relationships',
  ATMOSPHERE_HISTORY: 'bartender_atmospheres',
  // 🆕 文档05 - AI叙事引擎
  RETURN_CUSTOMERS: 'bartender_return_customers',
  NARRATIVE_STATE: 'bartender_narrative_state',
  // 🆕 文档07 - 事件链
  PENDING_EVENT_CHAINS: 'bartender_pending_chains',
  // 🆕 文档13 - 灯塔系统
  CHAPTER_STATE: 'bartender_chapter_state',
  MEMORY_FRAGMENTS: 'bartender_memory_fragments',
  // 🆕 文档14 - 新手引导
  GUIDES_SHOWN: 'bartender_guides_shown',
  // 🆕 自定义角色池
  CUSTOM_CHARACTER_IDS: 'bartender_custom_character_ids',
  ACTIVE_CHARACTER_IDS: 'bartender_active_character_ids',
  ADDED_CHARACTER_IDS: 'bartender_added_character_ids',
  // 游戏会话状态（刷新恢复用）
  GAME_SESSION: 'bartender_game_session',
  // 序幕已观看标记
  HAS_SEEN_PROLOGUE: 'bartender_has_seen_prologue'
};

const CHARACTER_ID_PATTERN = /^[A-Za-z0-9_-]+$/;
const DEFAULT_INITIAL_CHARACTER_IDS = [...DEFAULT_PRESET_CHARACTER_IDS];

const hasAnyUserAddedCharacter = (ids) => {
  const normalized = normalizeCharacterIds(ids);
  return normalized.some((id) => !isPresetCharacterId(id));
};

const normalizeCharacterIds = (ids) => {
  if (!Array.isArray(ids)) return [];
  const dedup = new Set();
  ids.forEach((item) => {
    const value = String(item || '').trim();
    if (!value) return;
    if (!CHARACTER_ID_PATTERN.test(value)) return;
    dedup.add(value);
  });
  return Array.from(dedup);
};

const pickSingleActiveId = (candidateIds, customIds, { forceLockedPresetWhenNoUserCharacters = false } = {}) => {
  const normalizedCustom = normalizeCharacterIds(customIds);
  const valid = normalizeCharacterIds(candidateIds).filter((id) => normalizedCustom.includes(id));
  const hasUserCharacters = hasAnyUserAddedCharacter(normalizedCustom);

  if (forceLockedPresetWhenNoUserCharacters && !hasUserCharacters) {
    const lockedPresetIds = normalizedCustom.filter((id) => isPresetCharacterLockedUntilUserAdded(id));
    const pickedLocked = valid.find((id) => lockedPresetIds.includes(id)) || lockedPresetIds[0];
    if (pickedLocked) return [pickedLocked];
  }

  if (valid.length > 0) return [valid[0]];
  if (normalizedCustom.length > 0) return [normalizedCustom[0]];
  return [];
};

const getKnownAddedCharacterIds = () => {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEYS.ADDED_CHARACTER_IDS) || '[]');
    return normalizeCharacterIds(raw).filter((id) => !isPresetCharacterId(id));
  } catch {
    return [];
  }
};

const saveKnownAddedCharacterIds = (ids) => {
  try {
    const normalized = normalizeCharacterIds(ids).filter((id) => !isPresetCharacterId(id));
    localStorage.setItem(STORAGE_KEYS.ADDED_CHARACTER_IDS, JSON.stringify(normalized));
    return normalized;
  } catch {
    return [];
  }
};

const rememberAddedCharacterId = (id) => {
  const value = String(id || '').trim();
  if (!value || isPresetCharacterId(value)) return;
  const known = getKnownAddedCharacterIds();
  if (known.includes(value)) return;
  saveKnownAddedCharacterIds([...known, value]);
};

const forgetAddedCharacterId = (id) => {
  const value = String(id || '').trim();
  if (!value || isPresetCharacterId(value)) return;
  const known = getKnownAddedCharacterIds();
  saveKnownAddedCharacterIds(known.filter((item) => item !== value));
};

// 短期记忆：当前AI顾客的对话、情绪判断、调酒记录
export const saveShortMemory = (aiType, data) => {
  try {
    const allMemory = JSON.parse(localStorage.getItem(STORAGE_KEYS.SHORT_MEMORY) || '{}');
    allMemory[aiType] = {
      ...data,
      timestamp: Date.now()
    };
    localStorage.setItem(STORAGE_KEYS.SHORT_MEMORY, JSON.stringify(allMemory));

    const slotId = getActiveSlotId();
    const npcId = getActiveNpcId();
    if (slotId && npcId) {
      const dialogueHistory = Array.isArray(data?.dialogueHistory) ? data.dialogueHistory : [];
      const recentEvents = dialogueHistory.slice(-20).map((item, idx) => ({
        id: `dlg_${Date.now()}_${idx}`,
        role: item?.role || 'system',
        type: 'dialogue',
        content: item?.content || '',
        timestamp: item?.timestamp || Date.now()
      }));
      const summary = recentEvents
        .slice(-3)
        .map((evt) => evt.content)
        .join(' ')
        .slice(0, 240);

      saveNpcMemory(slotId, npcId, {
        version: 1,
        npcId,
        summary,
        recentEvents,
        updatedAt: Date.now()
      }).catch(() => {});
    }

    return true;
  } catch (error) {
    console.error('Failed to save short-term memory:', error);
    return false;
  }
};

export const getShortMemory = (aiType) => {
  try {
    const allMemory = JSON.parse(localStorage.getItem(STORAGE_KEYS.SHORT_MEMORY) || '{}');
    return allMemory[aiType] || null;
  } catch (error) {
    console.error('Failed to load short-term memory:', error);
    return null;
  }
};

export const clearShortMemory = (aiType) => {
  try {
    const allMemory = JSON.parse(localStorage.getItem(STORAGE_KEYS.SHORT_MEMORY) || '{}');
    delete allMemory[aiType];
    localStorage.setItem(STORAGE_KEYS.SHORT_MEMORY, JSON.stringify(allMemory));
    return true;
  } catch (error) {
    console.error('Failed to clear short-term memory:', error);
    return false;
  }
};

// 长期记忆：所有调酒配方记录
export const saveCocktailRecipe = (recipe) => {
  try {
    const recipes = JSON.parse(localStorage.getItem(STORAGE_KEYS.LONG_MEMORY) || '[]');
    recipes.push({
      ...recipe,
      timestamp: Date.now()
    });
    
    // 限制最多保存100条记录
    if (recipes.length > 100) {
      recipes.shift();
    }
    
    localStorage.setItem(STORAGE_KEYS.LONG_MEMORY, JSON.stringify(recipes));
    return true;
  } catch (error) {
    console.error('Failed to save cocktail recipe:', error);
    return false;
  }
};

export const getCocktailRecipes = () => {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.LONG_MEMORY) || '[]');
  } catch (error) {
    console.error('Failed to load cocktail recipes:', error);
    return [];
  }
};

// 查找相似配方（用于AI记忆联想）
export const findSimilarRecipes = (currentEmotions) => {
  const recipes = getCocktailRecipes();
  return recipes.filter(recipe => {
    if (!recipe.emotions || !Array.isArray(recipe.emotions)) return false;
    const overlap = recipe.emotions.filter(e => currentEmotions.includes(e));
    return overlap.length > 0;
  });
};

// 已发现的黄金组合管理
export const saveDiscoveredCombo = (comboId, comboData) => {
  try {
    const combos = JSON.parse(localStorage.getItem(STORAGE_KEYS.DISCOVERED_COMBOS) || '{}');
    if (!combos[comboId]) {
      combos[comboId] = {
        ...comboData,
        discoveredAt: Date.now(),
        count: 1
      };
    } else {
      combos[comboId].count += 1;
      combos[comboId].lastUsedAt = Date.now();
    }
    localStorage.setItem(STORAGE_KEYS.DISCOVERED_COMBOS, JSON.stringify(combos));
    return !combos[comboId] || combos[comboId].count === 1; // 返回是否是首次发现
  } catch (error) {
    console.error('Failed to save discovered combo:', error);
    return false;
  }
};

export const getDiscoveredCombos = () => {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.DISCOVERED_COMBOS) || '{}');
  } catch (error) {
    console.error('Failed to load discovered combos:', error);
    return {};
  }
};

export const isComboDiscovered = (comboId) => {
  const combos = getDiscoveredCombos();
  return !!combos[comboId];
};

// 游戏进度保存
export const saveGameProgress = (progress) => {
  try {
    localStorage.setItem(STORAGE_KEYS.GAME_PROGRESS, JSON.stringify({
      ...progress,
      lastSaved: Date.now()
    }));
    queueActiveSlotGameStateSync('save_game_progress');
    return true;
  } catch (error) {
    console.error('Failed to save game progress:', error);
    return false;
  }
};

export const getGameProgress = () => {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.GAME_PROGRESS) || 'null');
  } catch (error) {
    console.error('Failed to load game progress:', error);
    return null;
  }
};

// 解锁内容管理
export const saveUnlockedItems = (items) => {
  try {
    localStorage.setItem(STORAGE_KEYS.UNLOCKED_ITEMS, JSON.stringify(items));
    queueActiveSlotGameStateSync('save_unlocked_items');
    return true;
  } catch (error) {
    console.error('Failed to save unlocked items:', error);
    return false;
  }
};

export const getUnlockedItems = () => {
  try {
    const defaultUnlocked = buildFullyUnlockedItems();
    const unlocked = JSON.parse(localStorage.getItem(STORAGE_KEYS.UNLOCKED_ITEMS) || 'null');

    // 全量提前解锁：旧存档也强制补全为全解锁，仅保留 successCount
    if (unlocked) {
      return buildFullyUnlockedItems(unlocked);
    }

    return defaultUnlocked;
  } catch (error) {
    console.error('Failed to load unlocked items:', error);
    return null;
  }
};

// 游戏设置
export const saveSettings = (settings) => {
  try {
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
    return true;
  } catch (error) {
    console.error('Failed to save settings:', error);
    return false;
  }
};

export const getSettings = () => {
  try {
    const defaultSettings = {
      soundEnabled: true,
      musicVolume: 0.5,
      sfxVolume: 0.7
    };
    const settings = JSON.parse(localStorage.getItem(STORAGE_KEYS.SETTINGS) || 'null');
    return settings || defaultSettings;
  } catch (error) {
    console.error('Failed to load settings:', error);
    return null;
  }
};

// ========== 自定义角色池 ==========
export const getCustomCharacterIds = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.CUSTOM_CHARACTER_IDS);
    if (raw === null) {
      return normalizeCharacterIds([...DEFAULT_INITIAL_CHARACTER_IDS, ...getKnownAddedCharacterIds()]);
    }
    return normalizeCharacterIds(JSON.parse(raw));
  } catch (error) {
    console.error('Failed to load custom character IDs:', error);
    return normalizeCharacterIds([...DEFAULT_INITIAL_CHARACTER_IDS, ...getKnownAddedCharacterIds()]);
  }
};

export const saveCustomCharacterIds = (ids) => {
  try {
    const normalized = normalizeCharacterIds(ids);
    localStorage.setItem(STORAGE_KEYS.CUSTOM_CHARACTER_IDS, JSON.stringify(normalized));

    // active 列表必须是 custom 列表子集，且仅允许一个激活角色
    const currentActive = getActiveCharacterIds();
    const nextActive = pickSingleActiveId(currentActive, normalized, {
      forceLockedPresetWhenNoUserCharacters: true
    });
    localStorage.setItem(STORAGE_KEYS.ACTIVE_CHARACTER_IDS, JSON.stringify(nextActive));

    queueActiveSlotGameStateSync('save_custom_character_ids');
    return normalized;
  } catch (error) {
    console.error('Failed to save custom character IDs:', error);
    return [];
  }
};

export const addCustomCharacterId = (id) => {
  const value = String(id || '').trim();
  if (!CHARACTER_ID_PATTERN.test(value)) {
    return { ok: false, reason: 'invalid_format' };
  }

  const current = getCustomCharacterIds();
  if (current.includes(value)) {
    return { ok: false, reason: 'duplicate' };
  }

  const next = saveCustomCharacterIds([...current, value]);
  // 新增角色后默认切换为该角色（单选模式）
  saveActiveCharacterIds([value]);
  rememberAddedCharacterId(value);
  return { ok: true, ids: next };
};

export const removeCustomCharacterId = (id) => {
  const value = String(id || '').trim();
  const current = getCustomCharacterIds();
  const hasUserCharacters = hasAnyUserAddedCharacter(current);
  if (!hasUserCharacters && isPresetCharacterLockedUntilUserAdded(value)) {
    return current;
  }
  const next = saveCustomCharacterIds(current.filter((item) => item !== value));
  forgetAddedCharacterId(value);
  return next;
};

export const getActiveCharacterIds = () => {
  try {
    const custom = getCustomCharacterIds();
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEYS.ACTIVE_CHARACTER_IDS) || 'null');
    if (!raw) {
      return pickSingleActiveId(custom, custom, {
        forceLockedPresetWhenNoUserCharacters: true
      });
    }
    return pickSingleActiveId(raw, custom, {
      forceLockedPresetWhenNoUserCharacters: true
    });
  } catch (error) {
    console.error('Failed to load active character IDs:', error);
    const custom = getCustomCharacterIds();
    return pickSingleActiveId(custom, custom, {
      forceLockedPresetWhenNoUserCharacters: true
    });
  }
};

export const saveActiveCharacterIds = (ids) => {
  try {
    const custom = getCustomCharacterIds();
    const normalized = pickSingleActiveId(ids, custom, {
      forceLockedPresetWhenNoUserCharacters: true
    });
    localStorage.setItem(STORAGE_KEYS.ACTIVE_CHARACTER_IDS, JSON.stringify(normalized));
    queueActiveSlotGameStateSync('save_active_character_ids');
    return normalized;
  } catch (error) {
    console.error('Failed to save active character IDs:', error);
    return [];
  }
};

export const canDisableCharacter = (id, customIds = null) => {
  const current = Array.isArray(customIds) ? normalizeCharacterIds(customIds) : getCustomCharacterIds();
  if (hasAnyUserAddedCharacter(current)) return true;
  return !isPresetCharacterLockedUntilUserAdded(id);
};

// 清除所有缓存
export const clearAllCache = () => {
  try {
    Object.values(STORAGE_KEYS).forEach(key => {
      localStorage.removeItem(key);
    });
    return true;
  } catch (error) {
    console.error('Failed to clear cache:', error);
    return false;
  }
};

// ==================== 文档04：AI记忆层 ====================

// 默认玩家画像
const DEFAULT_PLAYER_PROFILE = {
  totalDaysPlayed: 0, totalCustomersServed: 0, totalCocktailsMade: 0,
  playStyle: { dialogueStyle: 'unknown', cocktailStyle: 'unknown', overallSkillLevel: 'beginner' },
  proficiency: {
    customerTypeScores: {
      workplace: { avgResonance: 0, count: 0 }, artistic: { avgResonance: 0, count: 0 },
      student: { avgResonance: 0, count: 0 }, midlife: { avgResonance: 0, count: 0 }
    },
    ingredientPreferences: { mostUsed: [], neverUsed: [] }
  },
  milestones: [], lastUpdated: Date.now()
};

// 默认世界状态
const DEFAULT_WORLD_STATE = {
  customerRegistry: {},
  worldEvents: [],
  timeline: { currentSeason: 'autumn', daysInSeason: 0 }
};

// ========== 日记忆 ==========
export const saveDailyMemory = (dayMemory) => {
  try {
    const memories = JSON.parse(localStorage.getItem(STORAGE_KEYS.DAILY_MEMORIES) || '[]');
    memories.push(dayMemory);
    // 保留最多30条，超出时优先删除没有 openThreads 的
    while (memories.length > 30) {
      const idx = memories.findIndex(m => !m.openThreads || m.openThreads.length === 0);
      if (idx >= 0) memories.splice(idx, 1);
      else memories.shift();
    }
    localStorage.setItem(STORAGE_KEYS.DAILY_MEMORIES, JSON.stringify(memories));
    queueActiveSlotGameStateSync('save_daily_memory');
    return true;
  } catch (e) { console.error('Failed to save daily memory:', e); return false; }
};

export const getDailyMemories = () => {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEYS.DAILY_MEMORIES) || '[]'); }
  catch (e) { return []; }
};

export const getRecentDailyMemories = (count = 3) => {
  return getDailyMemories().slice(-count);
};

// ========== 玩家画像 ==========
export const savePlayerProfile = (profile) => {
  try {
    localStorage.setItem(STORAGE_KEYS.PLAYER_PROFILE, JSON.stringify({ ...profile, lastUpdated: Date.now() }));
    return true;
  } catch (e) { console.error('Failed to save player profile:', e); return false; }
};

export const getPlayerProfile = () => {
  try {
    const p = JSON.parse(localStorage.getItem(STORAGE_KEYS.PLAYER_PROFILE) || 'null');
    return p || { ...DEFAULT_PLAYER_PROFILE };
  } catch (e) { return { ...DEFAULT_PLAYER_PROFILE }; }
};

// ========== 世界状态 ==========
export const saveWorldState = (state) => {
  try {
    localStorage.setItem(STORAGE_KEYS.WORLD_STATE, JSON.stringify(state));
    return true;
  } catch (e) { console.error('Failed to save world state:', e); return false; }
};

export const getWorldState = () => {
  try {
    const s = JSON.parse(localStorage.getItem(STORAGE_KEYS.WORLD_STATE) || 'null');
    return s || { ...DEFAULT_WORLD_STATE, customerRegistry: {}, worldEvents: [] };
  } catch (e) { return { ...DEFAULT_WORLD_STATE, customerRegistry: {}, worldEvents: [] }; }
};

// ========== 关系图谱 ==========
export const saveRelationships = (graph) => {
  try {
    localStorage.setItem(STORAGE_KEYS.RELATIONSHIPS, JSON.stringify(graph));
    return true;
  } catch (e) { return false; }
};

export const getRelationships = () => {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEYS.RELATIONSHIPS) || '{}'); }
  catch (e) { return {}; }
};

// ========== 氛围历史 ==========
export const saveAtmosphereHistory = (atmosphere) => {
  try {
    const history = JSON.parse(localStorage.getItem(STORAGE_KEYS.ATMOSPHERE_HISTORY) || '[]');
    history.push(atmosphere);
    while (history.length > 15) history.shift();
    localStorage.setItem(STORAGE_KEYS.ATMOSPHERE_HISTORY, JSON.stringify(history));
    return true;
  } catch (e) { return false; }
};

export const getAtmosphereHistory = () => {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEYS.ATMOSPHERE_HISTORY) || '[]'); }
  catch (e) { return []; }
};

// ==================== 文档05：AI叙事引擎 ====================

export const saveReturnCustomers = (customers) => {
  try {
    const limited = customers.slice(0, 15);
    localStorage.setItem(STORAGE_KEYS.RETURN_CUSTOMERS, JSON.stringify(limited));
    queueActiveSlotGameStateSync('save_return_customers');
    return true;
  } catch (e) { console.error('Failed to save return customers:', e); return false; }
};

export const getReturnCustomers = () => {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEYS.RETURN_CUSTOMERS) || '[]'); }
  catch (e) { return []; }
};

export const updateReturnCustomer = (id, updates) => {
  try {
    const customers = getReturnCustomers();
    const idx = customers.findIndex(c => c.id === id);
    if (idx >= 0) {
      customers[idx] = { ...customers[idx], ...updates };
      saveReturnCustomers(customers);
    }
    return true;
  } catch (e) { return false; }
};

export const saveNarrativeState = (state) => {
  try {
    localStorage.setItem(STORAGE_KEYS.NARRATIVE_STATE, JSON.stringify(state));
    queueActiveSlotGameStateSync('save_narrative_state');
    return true;
  } catch (e) { return false; }
};

export const getNarrativeState = () => {
  try {
    const s = JSON.parse(localStorage.getItem(STORAGE_KEYS.NARRATIVE_STATE) || 'null');
    return s || { recentTensions: [], mainStoryProgress: {} };
  } catch (e) { return { recentTensions: [], mainStoryProgress: {} }; }
};

// 获取存储使用情况
export const getStorageUsage = () => {
  try {
    let totalSize = 0;
    Object.values(STORAGE_KEYS).forEach(key => {
      const item = localStorage.getItem(key);
      if (item) {
        totalSize += item.length * 2; // 粗略估算（UTF-16编码）
      }
    });
    return {
      usedBytes: totalSize,
      usedKB: (totalSize / 1024).toFixed(2),
      usedMB: (totalSize / 1024 / 1024).toFixed(2)
    };
  } catch (error) {
    console.error('Failed to get storage usage:', error);
    return null;
  }
};

// ==================== 事件链存储 ====================

/**
 * 保存待触发的事件链
 * @param {Array} chains - 待触发的事件链列表
 */
export const savePendingChains = (chains) => {
  try {
    localStorage.setItem(STORAGE_KEYS.PENDING_EVENT_CHAINS, JSON.stringify(chains));
  } catch (error) {
    console.error('Failed to save pending event chains:', error);
  }
};

/**
 * 获取待触发的事件链
 * @returns {Array} 待触发的事件链列表
 */
export const getPendingChains = () => {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.PENDING_EVENT_CHAINS);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('Failed to load pending event chains:', error);
    return [];
  }
};

// ==================== 灯塔系统存储 ====================

const DEFAULT_CHAPTER_STATE = {
  currentChapter: 1,
  chapterHistory: [
    {
      chapter: 1,
      enteredOnDay: 1,
      openingNarrative: null,
      triggeredBy: 'auto'
    }
  ],
  endingTriggered: false,
  endingNarrative: null,
  freeMode: false
};

export const saveChapterState = (state) => {
  try {
    localStorage.setItem(STORAGE_KEYS.CHAPTER_STATE, JSON.stringify(state));
    return true;
  } catch (e) { console.error('Failed to save chapter state:', e); return false; }
};

export const getChapterState = () => {
  try {
    const s = JSON.parse(localStorage.getItem(STORAGE_KEYS.CHAPTER_STATE) || 'null');
    return s || { ...DEFAULT_CHAPTER_STATE, chapterHistory: [...DEFAULT_CHAPTER_STATE.chapterHistory] };
  } catch (e) { return { ...DEFAULT_CHAPTER_STATE, chapterHistory: [...DEFAULT_CHAPTER_STATE.chapterHistory] }; }
};

export const saveMemoryFragments = (fragments) => {
  try {
    localStorage.setItem(STORAGE_KEYS.MEMORY_FRAGMENTS, JSON.stringify(fragments));
    return true;
  } catch (e) { console.error('Failed to save memory fragments:', e); return false; }
};

export const getMemoryFragments = () => {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEYS.MEMORY_FRAGMENTS) || '[]'); }
  catch (e) { return []; }
};

// ==================== 游戏会话持久化 ====================

/**
 * 保存游戏会话状态（用于刷新恢复）
 * 包含当前对话、顾客队列、调酒状态等运行时数据
 */
export const saveGameSession = (session) => {
  try {
    const data = JSON.stringify({ ...session, savedAt: Date.now() });
    // 超过 2MB 则放弃保存（避免撑爆 localStorage）
    if (data.length > 2 * 1024 * 1024) {
      console.warn('Session data is too large, skipping save:', (data.length / 1024).toFixed(0), 'KB');
      return false;
    }
    localStorage.setItem(STORAGE_KEYS.GAME_SESSION, data);
    queueActiveSlotGameStateSync('save_game_session');
    return true;
  } catch (e) {
    // 配额超限时静默失败，不影响游戏
    console.warn('Failed to save game session:', e.message);
    return false;
  }
};

/**
 * 获取游戏会话状态
 * 如果超过 30 分钟则视为过期，返回 null
 */
export const getGameSession = () => {
  try {
    const s = JSON.parse(localStorage.getItem(STORAGE_KEYS.GAME_SESSION) || 'null');
    if (!s) return null;
    // 30 分钟过期
    if (Date.now() - (s.savedAt || 0) > 30 * 60 * 1000) {
      clearGameSession();
      return null;
    }
    return s;
  } catch (e) { return null; }
};

/**
 * 清除游戏会话
 */
export const clearGameSession = () => {
  try { localStorage.removeItem(STORAGE_KEYS.GAME_SESSION); } catch (e) {}
};
