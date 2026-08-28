const ACTIVE_SLOT_KEY = 'bartender_active_slot_id';
const MIGRATION_FLAG_KEY = 'bartender_migration_done_v1';

const LEGACY_KEYS = [
  'bartender_short_memory',
  'bartender_long_memory',
  'bartender_progress',
  'bartender_unlocked',
  'bartender_settings',
  'bartender_combos',
  'bartender_daily_memories',
  'bartender_player_profile',
  'bartender_world_state',
  'bartender_relationships',
  'bartender_atmospheres',
  'bartender_return_customers',
  'bartender_narrative_state',
  'bartender_pending_chains',
  'bartender_achievements',
  'bartender_achievement_stats',
  'bartender_chapter_state',
  'bartender_memory_fragments',
  'bartender_guides_shown',
  'bartender_custom_character_ids',
  'bartender_active_character_ids',
  'bartender_game_session',
  'bartender_has_seen_prologue',
];

const runtimeContext = {
  slotId: null,
  npcId: null,
};

let pendingSyncTimer = null;

const request = async (method, url, body) => {
  const response = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  let data = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    const message = data?.error || `${response.status}`;
    throw new Error(message);
  }

  return data || {};
};

const parseMaybeJson = (value) => {
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
};

export const getActiveSlotId = () => {
  if (runtimeContext.slotId) return runtimeContext.slotId;
  const stored = localStorage.getItem(ACTIVE_SLOT_KEY);
  if (stored) runtimeContext.slotId = stored;
  return runtimeContext.slotId;
};

export const setActiveSlotId = (slotId) => {
  runtimeContext.slotId = slotId || null;
  if (slotId) {
    localStorage.setItem(ACTIVE_SLOT_KEY, slotId);
  } else {
    localStorage.removeItem(ACTIVE_SLOT_KEY);
  }
};

export const setActiveNpcId = (npcId) => {
  runtimeContext.npcId = npcId || null;
};

export const getActiveNpcId = () => runtimeContext.npcId;

export const listSlots = async () => {
  const data = await request('GET', '/api/save/slots');
  return Array.isArray(data.slots) ? data.slots : [];
};

export const createSlot = async (name) => {
  const data = await request('POST', '/api/save/slots', { name });
  return data;
};

export const renameSlot = async (slotId, name) => {
  const data = await request('PATCH', `/api/save/slots/${slotId}`, { name });
  return data;
};

export const deleteSlot = async (slotId) => {
  const data = await request('DELETE', `/api/save/slots/${slotId}`);
  if (getActiveSlotId() === slotId) {
    setActiveSlotId(null);
    setActiveNpcId(null);
  }
  return data;
};

export const loadSlotGameState = async (slotId) => {
  const data = await request('GET', `/api/save/slots/${slotId}/game-state`);
  return data.gameState || null;
};

export const saveSlotGameState = async (slotId, gameState) => {
  const data = await request('PUT', `/api/save/slots/${slotId}/game-state`, { gameState });
  return data.gameState || null;
};

export const getNpcProfile = async (slotId, npcId) => {
  const data = await request('GET', `/api/save/slots/${slotId}/npcs/${npcId}/profile`);
  return data.profile || null;
};

export const saveNpcProfile = async (slotId, npcId, profile) => {
  const data = await request('PUT', `/api/save/slots/${slotId}/npcs/${npcId}/profile`, { profile });
  return data.profile || null;
};

export const getNpcMemory = async (slotId, npcId) => {
  const data = await request('GET', `/api/save/slots/${slotId}/npcs/${npcId}/memory`);
  return data.memory || null;
};

export const saveNpcMemory = async (slotId, npcId, memory) => {
  const data = await request('PUT', `/api/save/slots/${slotId}/npcs/${npcId}/memory`, { memory });
  return data.memory || null;
};

export const appendNpcMemoryEvent = async (slotId, npcId, event, summary = null) => {
  const data = await request('POST', `/api/save/slots/${slotId}/npcs/${npcId}/memory/events`, {
    event,
    summary,
  });
  return data.memory || null;
};

export const ensureNpcProfileInActiveSlot = async (npcId, config = {}) => {
  const slotId = getActiveSlotId();
  if (!slotId || !npcId) return null;

  const current = await getNpcProfile(slotId, npcId);
  if (current) return current;

  const profile = {
    version: 1,
    npcId,
    name: config.name || npcId,
    categoryId: config.categoryId || 'workplace',
    initialProfile: config,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  return saveNpcProfile(slotId, npcId, profile);
};

export const appendActiveNpcEvent = async (event, summary = null) => {
  const slotId = getActiveSlotId();
  const npcId = getActiveNpcId();
  if (!slotId || !npcId) return null;

  try {
    return await appendNpcMemoryEvent(slotId, npcId, event, summary);
  } catch (error) {
    console.warn('appendActiveNpcEvent failed:', error?.message || error);
    return null;
  }
};

export const buildNpcDecisionContext = async () => {
  const slotId = getActiveSlotId();
  const npcId = getActiveNpcId();

  if (!slotId || !npcId) {
    return {
      profile: null,
      memory: null,
      memoryContext: '',
    };
  }

  try {
    const [profile, memory] = await Promise.all([
      getNpcProfile(slotId, npcId),
      getNpcMemory(slotId, npcId),
    ]);

    const recentEvents = Array.isArray(memory?.recentEvents)
      ? memory.recentEvents.slice(-20)
      : [];

    const recentLines = recentEvents
      .map((item) => {
        const role = item.role || 'system';
        const content = item.content || '';
        return `${role}: ${content}`;
      })
      .filter((line) => line.trim().length > 0)
      .join('\n');

    const memoryContext = [
      profile?.name ? `Character: ${profile.name}` : '',
      memory?.summary ? `History Summary: ${memory.summary}` : '',
      recentLines ? `Recent Conversation:\n${recentLines}` : '',
    ]
      .filter(Boolean)
      .join('\n');

    return {
      profile,
      memory,
      memoryContext,
    };
  } catch (error) {
    console.warn('buildNpcDecisionContext failed:', error?.message || error);
    return {
      profile: null,
      memory: null,
      memoryContext: '',
    };
  }
};

export const collectLegacyStorageSnapshot = () => {
  const snapshot = {};
  LEGACY_KEYS.forEach((key) => {
    const raw = localStorage.getItem(key);
    if (raw === null) return;
    snapshot[key] = parseMaybeJson(raw);
  });
  return snapshot;
};

export const hydrateLegacyStorageFromGameState = (gameState) => {
  if (!gameState || typeof gameState !== 'object') return;

  const preservedCustomCharacterIds = localStorage.getItem('bartender_custom_character_ids');
  const preservedActiveCharacterIds = localStorage.getItem('bartender_active_character_ids');

  // 先清空 legacy 键，避免新槽位被上一个槽位的遗留会话/状态污染
  LEGACY_KEYS.forEach((key) => {
    try {
      localStorage.removeItem(key);
    } catch {
      // noop
    }
  });

  const snapshot = gameState.legacyStorageSnapshot || {};
  Object.entries(snapshot).forEach(([key, value]) => {
    try {
      localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
    } catch {
      // noop
    }
  });

  if (!Object.prototype.hasOwnProperty.call(snapshot, 'bartender_custom_character_ids') && preservedCustomCharacterIds !== null) {
    localStorage.setItem('bartender_custom_character_ids', preservedCustomCharacterIds);
  }
  if (!Object.prototype.hasOwnProperty.call(snapshot, 'bartender_active_character_ids') && preservedActiveCharacterIds !== null) {
    localStorage.setItem('bartender_active_character_ids', preservedActiveCharacterIds);
  }

  const progress = {
    day: gameState.day || 1,
    money: gameState.money || 0,
    trustLevel: gameState.trustLevel ?? 0,
    stats: gameState.stats || {},
  };

  localStorage.setItem('bartender_progress', JSON.stringify(progress));
  localStorage.setItem('bartender_unlocked', JSON.stringify(gameState.unlockedItems || {}));
};

const buildGameStateFromLocalStorage = () => {
  const progressRaw = localStorage.getItem('bartender_progress');
  const unlockedRaw = localStorage.getItem('bartender_unlocked');

  const progress = parseMaybeJson(progressRaw || '{}') || {};
  const unlockedItems = parseMaybeJson(unlockedRaw || '{}') || {};

  return {
    version: 1,
    day: progress.day || 1,
    money: progress.money || 0,
    trustLevel: progress.trustLevel ?? 0,
    stats: progress.stats || {},
    unlockedItems,
    legacyStorageSnapshot: collectLegacyStorageSnapshot(),
    updatedAt: Date.now(),
  };
};

export const syncActiveSlotGameState = async (reason = 'manual') => {
  const slotId = getActiveSlotId();
  if (!slotId) return null;

  try {
    const payload = buildGameStateFromLocalStorage();
    payload.syncReason = reason;
    return await saveSlotGameState(slotId, payload);
  } catch (error) {
    console.warn('syncActiveSlotGameState failed:', error?.message || error);
    return null;
  }
};

export const queueActiveSlotGameStateSync = (reason = 'debounced') => {
  if (pendingSyncTimer) {
    window.clearTimeout(pendingSyncTimer);
  }

  pendingSyncTimer = window.setTimeout(() => {
    pendingSyncTimer = null;
    syncActiveSlotGameState(reason).catch(() => {});
  }, 300);
};

export const shouldRunMigration = async () => {
  if (localStorage.getItem(MIGRATION_FLAG_KEY) === 'true') return false;
  const slots = await listSlots();
  if (Array.isArray(slots) && slots.length > 0) {
    localStorage.setItem(MIGRATION_FLAG_KEY, 'true');
    return false;
  }

  const hasLegacy = LEGACY_KEYS.some((key) => localStorage.getItem(key) !== null);
  return hasLegacy;
};

export const migrateFromLocalStorage = async (slotName = 'Migrated Save') => {
  const legacyStorage = collectLegacyStorageSnapshot();
  const data = await request('POST', '/api/save/migrate/localstorage', {
    slotName,
    legacyStorage,
  });
  localStorage.setItem(MIGRATION_FLAG_KEY, 'true');
  return data;
};
