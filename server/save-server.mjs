import http from 'node:http';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getCharacterByName, searchCharacters } from './local-character-service.mjs';
import { analyzeCharacterEmotionWithAI } from './emotion-service.mjs';
import { generateCharacterImages, removeCharacterAssets } from './character-image-service.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const SAVES_ROOT = path.join(ROOT, 'saves');
const SEED_ROOT = path.join(ROOT, 'seeds', 'default');
const PORT = Number(process.env.SAVE_SERVER_PORT || 3001);

const VALID_ID = /^[a-zA-Z0-9_-]+$/;

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

const DEFAULT_UNLOCKED = {
  emotions: ['nostalgia', 'courage', 'loneliness', 'relief', 'anxiety', 'calm', 'regret', 'aspiration', 'pressure', 'dependence', 'confusion', 'happiness'],
  glasses: ['martini'],
  iceTypes: ['no_ice'],
  garnishes: [],
  decorations: [],
  ingredients: ['vodka', 'juice_orange', 'juice_lemon', 'soda', 'syrup'],
  aiCustomers: ['workplace'],
  successCount: 0,
};

const DEFAULT_GAME_STATE = {
  version: 1,
  day: 1,
  money: 0,
  trustLevel: 0.3,
  stats: { totalServed: 0, successCount: 0, failureCount: 0, totalDays: 1 },
  unlockedItems: DEFAULT_UNLOCKED,
  legacyStorageSnapshot: {},
  updatedAt: Date.now(),
};

const now = () => Date.now();

const json = (status, data) => ({
  status,
  headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify(data),
});

const text = (status, msg) => ({
  status,
  headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  body: msg,
});

const safeId = (value, label) => {
  if (!value || !VALID_ID.test(value)) {
    throw new Error(`invalid_${label}`);
  }
  return value;
};

const ensureDir = async (dir) => {
  await fs.mkdir(dir, { recursive: true });
};

const exists = async (target) => {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
};

const readJson = async (file, fallback = null) => {
  try {
    const raw = await fs.readFile(file, 'utf8');
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
};

const writeJsonAtomic = async (file, data) => {
  await ensureDir(path.dirname(file));
  const tmp = `${file}.tmp-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const payload = `${JSON.stringify(data, null, 2)}\n`;
  await fs.writeFile(tmp, payload, 'utf8');
  await fs.rename(tmp, file);
};

const copyDirRecursive = async (fromDir, toDir) => {
  await ensureDir(toDir);
  const entries = await fs.readdir(fromDir, { withFileTypes: true });
  for (const entry of entries) {
    const fromPath = path.join(fromDir, entry.name);
    const toPath = path.join(toDir, entry.name);
    if (entry.isDirectory()) {
      await copyDirRecursive(fromPath, toPath);
    } else if (entry.isFile()) {
      await ensureDir(path.dirname(toPath));
      await fs.copyFile(fromPath, toPath);
    }
  }
};

const slotDir = (slotId) => path.join(SAVES_ROOT, safeId(slotId, 'slot_id'));
const slotMetaPath = (slotId) => path.join(slotDir(slotId), 'meta.json');
const slotGameStatePath = (slotId) => path.join(slotDir(slotId), 'game_state.json');
const slotNpcIndexPath = (slotId) => path.join(slotDir(slotId), 'npcs', 'index.json');
const slotNpcProfilePath = (slotId, npcId) => path.join(slotDir(slotId), 'npcs', safeId(npcId, 'npc_id'), 'initial_profile.json');
const slotNpcMemoryPath = (slotId, npcId) => path.join(slotDir(slotId), 'npcs', safeId(npcId, 'npc_id'), 'session_memory.json');

const baseMeta = (slotId, name = null) => {
  const timestamp = now();
  return {
    slotId,
    name: name || `Save ${slotId}`,
    createdAt: timestamp,
    updatedAt: timestamp,
    lastPlayedAt: null,
    version: 1,
  };
};

const touchMeta = async (slotId, patch = {}) => {
  const current = (await readJson(slotMetaPath(slotId), {})) || {};
  const next = {
    ...baseMeta(slotId),
    ...current,
    ...patch,
    updatedAt: now(),
  };
  await writeJsonAtomic(slotMetaPath(slotId), next);
  return next;
};

const createSlot = async ({ name } = {}) => {
  const slotId = `slot_${now()}`;
  const dir = slotDir(slotId);

  if (!(await exists(SEED_ROOT))) {
    throw new Error('missing_seed_root');
  }

  await copyDirRecursive(SEED_ROOT, dir);
  await writeJsonAtomic(slotMetaPath(slotId), baseMeta(slotId, name));

  const state = await readJson(slotGameStatePath(slotId), DEFAULT_GAME_STATE);
  if (!state || typeof state !== 'object') {
    await writeJsonAtomic(slotGameStatePath(slotId), { ...DEFAULT_GAME_STATE, updatedAt: now() });
  }

  const index = await readJson(slotNpcIndexPath(slotId), null);
  if (!Array.isArray(index)) {
    await writeJsonAtomic(slotNpcIndexPath(slotId), []);
  }

  return slotId;
};

const listSlots = async () => {
  await ensureDir(SAVES_ROOT);
  const entries = await fs.readdir(SAVES_ROOT, { withFileTypes: true });
  const slots = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const slotId = entry.name;
    if (!VALID_ID.test(slotId)) continue;
    const meta = await readJson(slotMetaPath(slotId), baseMeta(slotId));
    const gameState = await readJson(slotGameStatePath(slotId), DEFAULT_GAME_STATE);
    slots.push({
      ...meta,
      summary: {
        day: gameState?.day || 1,
        money: gameState?.money || 0,
        updatedAt: gameState?.updatedAt || meta?.updatedAt || 0,
      },
    });
  }

  return slots.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
};

const removeDirRecursive = async (target) => {
  await fs.rm(target, { recursive: true, force: true });
};

const parseBody = async (req) => {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(Buffer.from(chunk));
  }

  if (chunks.length === 0) return {};

  const raw = Buffer.concat(chunks).toString('utf8');
  if (!raw.trim()) return {};
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error('invalid_json');
  }
};

const mergeGameState = (payload = {}, current = {}) => {
  const merged = {
    ...DEFAULT_GAME_STATE,
    ...current,
    ...payload,
    unlockedItems: {
      ...DEFAULT_UNLOCKED,
      ...(current.unlockedItems || {}),
      ...(payload.unlockedItems || {}),
    },
    stats: {
      ...(DEFAULT_GAME_STATE.stats || {}),
      ...(current.stats || {}),
      ...(payload.stats || {}),
    },
    updatedAt: now(),
  };

  return merged;
};

const ensureNpcIndexHas = async (slotId, npcId) => {
  const indexPath = slotNpcIndexPath(slotId);
  const current = await readJson(indexPath, []);
  const index = Array.isArray(current) ? current : [];

  if (!index.some((item) => item.npcId === npcId)) {
    index.push({ npcId, createdAt: now(), updatedAt: now() });
    await writeJsonAtomic(indexPath, index);
  }
};

const updateNpcIndexTime = async (slotId, npcId) => {
  const indexPath = slotNpcIndexPath(slotId);
  const current = await readJson(indexPath, []);
  const index = Array.isArray(current) ? current : [];
  const idx = index.findIndex((item) => item.npcId === npcId);
  if (idx >= 0) {
    index[idx] = { ...index[idx], updatedAt: now() };
  } else {
    index.push({ npcId, createdAt: now(), updatedAt: now() });
  }
  await writeJsonAtomic(indexPath, index);
};

const migrateFromLegacyPayload = async (payload = {}) => {
  const legacy = (payload && typeof payload === 'object' && payload.legacyStorage)
    ? payload.legacyStorage
    : {};

  const progress = legacy.bartender_progress || {};
  const unlockedItems = legacy.bartender_unlocked || DEFAULT_UNLOCKED;

  const slotId = await createSlot({ name: payload?.slotName || 'Migrated Save' });

  const gameState = mergeGameState({
    day: progress.day || 1,
    money: progress.money || 0,
    trustLevel: progress.trustLevel ?? 0.3,
    stats: progress.stats || DEFAULT_GAME_STATE.stats,
    unlockedItems,
    legacyStorageSnapshot: Object.fromEntries(
      LEGACY_KEYS
        .filter((key) => key in legacy)
        .map((key) => [key, legacy[key]])
    ),
  }, {});

  await writeJsonAtomic(slotGameStatePath(slotId), gameState);

  const returnCustomers = Array.isArray(legacy.bartender_return_customers)
    ? legacy.bartender_return_customers
    : [];

  for (const customer of returnCustomers) {
    const rawId = customer?.id || `npc_${now()}_${Math.random().toString(36).slice(2, 6)}`;
    const npcId = String(rawId).replace(/[^a-zA-Z0-9_-]/g, '_');

    const profile = {
      version: 1,
      npcId,
      name: customer?.name || customer?.originalConfig?.name || 'Unknown Guest',
      categoryId: customer?.category || customer?.originalConfig?.categoryId || 'workplace',
      initialProfile: customer?.originalConfig || {},
      metadata: {
        importedFromLegacy: true,
        createdAt: now(),
      },
    };

    const memory = {
      version: 1,
      npcId,
      summary: (customer?.relationship?.sharedHistory || [])
        .slice(-1)
        .map((item) => item?.summary || '')
        .join(' ')
        .trim(),
      recentEvents: (customer?.relationship?.sharedHistory || []).slice(-20).map((item, idx) => ({
        id: `legacy_${npcId}_${idx}`,
        day: item?.day || 0,
        role: 'system',
        type: 'legacy_import',
        content: item?.summary || '',
        timestamp: now(),
      })),
      trustTimeline: [],
      emotionTimeline: [],
      updatedAt: now(),
      importedFromLegacy: true,
    };

    await writeJsonAtomic(slotNpcProfilePath(slotId, npcId), profile);
    await writeJsonAtomic(slotNpcMemoryPath(slotId, npcId), memory);
    await ensureNpcIndexHas(slotId, npcId);
  }

  await touchMeta(slotId, { name: payload?.slotName || 'Migrated Save' });
  return slotId;
};

const handlers = {
  async health() {
    return json(200, { ok: true, service: 'save-server' });
  },

  async listSlots() {
    const slots = await listSlots();
    return json(200, { slots });
  },

  async createSlot(req) {
    const body = await parseBody(req);
    const slotId = await createSlot({ name: body?.name || null });
    const meta = await readJson(slotMetaPath(slotId), null);
    const gameState = await readJson(slotGameStatePath(slotId), DEFAULT_GAME_STATE);
    return json(201, { slotId, meta, gameState });
  },

  async updateSlot(req, slotId) {
    const body = await parseBody(req);
    if (typeof body?.name !== 'string' || body.name.trim().length === 0) {
      return json(400, { error: 'invalid_name' });
    }
    const meta = await touchMeta(slotId, { name: body.name.trim() });
    return json(200, { slotId, meta });
  },

  async deleteSlot(_, slotId) {
    await removeDirRecursive(slotDir(slotId));
    return json(200, { ok: true, slotId });
  },

  async getGameState(_, slotId) {
    const state = await readJson(slotGameStatePath(slotId), DEFAULT_GAME_STATE);
    return json(200, { slotId, gameState: state });
  },

  async putGameState(req, slotId) {
    const body = await parseBody(req);
    const current = await readJson(slotGameStatePath(slotId), DEFAULT_GAME_STATE);
    const merged = mergeGameState(body?.gameState || body, current || {});
    await writeJsonAtomic(slotGameStatePath(slotId), merged);
    await touchMeta(slotId, { lastPlayedAt: now() });
    return json(200, { slotId, gameState: merged });
  },

  async getNpcProfile(_, slotId, npcId) {
    const profile = await readJson(slotNpcProfilePath(slotId, npcId), null);
    return json(200, { slotId, npcId, profile });
  },

  async putNpcProfile(req, slotId, npcId) {
    const body = await parseBody(req);
    const payload = body?.profile || body || {};
    const current = await readJson(slotNpcProfilePath(slotId, npcId), {});
    const next = {
      version: 1,
      npcId,
      ...current,
      ...payload,
      npcId,
      updatedAt: now(),
    };
    await writeJsonAtomic(slotNpcProfilePath(slotId, npcId), next);
    await updateNpcIndexTime(slotId, npcId);
    return json(200, { slotId, npcId, profile: next });
  },

  async getNpcMemory(_, slotId, npcId) {
    const memory = await readJson(slotNpcMemoryPath(slotId, npcId), null);
    return json(200, { slotId, npcId, memory });
  },

  async putNpcMemory(req, slotId, npcId) {
    const body = await parseBody(req);
    const payload = body?.memory || body || {};
    const current = await readJson(slotNpcMemoryPath(slotId, npcId), {});
    const next = {
      version: 1,
      npcId,
      summary: '',
      recentEvents: [],
      trustTimeline: [],
      emotionTimeline: [],
      ...current,
      ...payload,
      recentEvents: Array.isArray(payload?.recentEvents)
        ? payload.recentEvents.slice(-200)
        : (Array.isArray(current?.recentEvents) ? current.recentEvents.slice(-200) : []),
      updatedAt: now(),
    };
    await writeJsonAtomic(slotNpcMemoryPath(slotId, npcId), next);
    await updateNpcIndexTime(slotId, npcId);
    return json(200, { slotId, npcId, memory: next });
  },

  async appendNpcMemoryEvent(req, slotId, npcId) {
    const body = await parseBody(req);
    const event = body?.event;
    if (!event || typeof event !== 'object') {
      return json(400, { error: 'invalid_event' });
    }
    const current = await readJson(slotNpcMemoryPath(slotId, npcId), {
      version: 1,
      npcId,
      summary: '',
      recentEvents: [],
      trustTimeline: [],
      emotionTimeline: [],
    });
    const nextEvents = [...(Array.isArray(current.recentEvents) ? current.recentEvents : []), {
      id: event.id || `evt_${now()}_${Math.random().toString(36).slice(2, 8)}`,
      timestamp: event.timestamp || now(),
      ...event,
    }].slice(-200);

    const next = {
      ...current,
      version: 1,
      npcId,
      summary: typeof body?.summary === 'string' ? body.summary : (current.summary || ''),
      recentEvents: nextEvents,
      updatedAt: now(),
    };

    await writeJsonAtomic(slotNpcMemoryPath(slotId, npcId), next);
    await updateNpcIndexTime(slotId, npcId);
    return json(200, { slotId, npcId, memory: next });
  },

  async migrateLegacy(req) {
    const body = await parseBody(req);
    const slotId = await migrateFromLegacyPayload(body || {});
    const meta = await readJson(slotMetaPath(slotId), null);
    return json(201, { ok: true, slotId, meta });
  },

  async getCharacterByName(req, requestUrl) {
    const queryFromUrl = requestUrl.searchParams.get('query') || requestUrl.searchParams.get('code') || requestUrl.searchParams.get('name');
    const inferGenderFromUrl = requestUrl.searchParams.get('inferPortraitGender');
    let query = queryFromUrl;
    let inferPortraitGender = inferGenderFromUrl !== '0' && inferGenderFromUrl !== 'false';

    if (!query && (req.method || 'GET') !== 'GET') {
      const body = await parseBody(req);
      query = body?.query || body?.code || body?.name || null;
      inferPortraitGender = body?.inferPortraitGender === undefined
        ? inferPortraitGender
        : Boolean(body?.inferPortraitGender);
    }

    const character = await getCharacterByName({ rootDir: ROOT, query, inferPortraitGender });
    if (!character) {
      return json(404, { error: 'character_not_found' });
    }

    return json(200, { character });
  },

  async searchCharacters(req, requestUrl) {
    const queryFromUrl = requestUrl.searchParams.get('query') || requestUrl.searchParams.get('q') || '';
    const limitFromUrl = requestUrl.searchParams.get('limit');
    let query = queryFromUrl;
    let limit = limitFromUrl;

    if ((req.method || 'GET') !== 'GET') {
      const body = await parseBody(req);
      query = body?.query ?? body?.q ?? query;
      limit = body?.limit ?? limit;
    }

    const results = await searchCharacters({
      rootDir: ROOT,
      query,
      limit,
    });

    return json(200, { results });
  },

  async analyzeCharacterEmotion(req, requestUrl) {
    let query = requestUrl.searchParams.get('query') || requestUrl.searchParams.get('code') || requestUrl.searchParams.get('name') || null;
    let character = null;

    if ((req.method || 'GET') !== 'GET') {
      const body = await parseBody(req);
      query = body?.query ?? body?.code ?? body?.name ?? query;
      character = body?.character && typeof body.character === 'object' ? body.character : null;
    }

    if (!character && query) {
      character = await getCharacterByName({ rootDir: ROOT, query });
    }

    if (!character) {
      return json(404, { error: 'character_not_found' });
    }

    const emotion = await analyzeCharacterEmotionWithAI({ character });
    return json(200, {
      ok: true,
      character: {
        code: character.code,
        displayName: character.displayName,
        source: character.source || null,
      },
      emotion,
    });
  },

  async generateCharacterImages(req, requestUrl) {
    let code = requestUrl.searchParams.get('code') || requestUrl.searchParams.get('query') || null;
    let force = requestUrl.searchParams.get('force') === '1' || requestUrl.searchParams.get('force') === 'true';

    if ((req.method || 'GET') !== 'GET') {
      const body = await parseBody(req);
      code = body?.code || body?.query || code;
      force = Boolean(body?.force ?? force);
    }

    const result = await generateCharacterImages({ rootDir: ROOT, code, force });
    return json(200, result);
  },

  async removeCharacterAssets(req, requestUrl) {
    let code = requestUrl.searchParams.get('code') || requestUrl.searchParams.get('query') || null;

    if ((req.method || 'GET') !== 'GET') {
      const body = await parseBody(req);
      code = body?.code || body?.query || code;
    }

    const result = await removeCharacterAssets({ rootDir: ROOT, code });
    return json(200, result);
  },

};

const route = async (req) => {
  const requestUrl = new URL(req.url || '/', 'http://localhost');
  const pathname = requestUrl.pathname;
  const method = req.method || 'GET';

  if (pathname === '/health' && method === 'GET') return handlers.health();

  if (pathname === '/api/save/slots' && method === 'GET') return handlers.listSlots();
  if (pathname === '/api/save/slots' && method === 'POST') return handlers.createSlot(req);
  if (pathname === '/api/save/migrate/localstorage' && method === 'POST') return handlers.migrateLegacy(req);

  if (pathname === '/api/mcp/character/get_by_name' && (method === 'GET' || method === 'POST')) {
    return handlers.getCharacterByName(req, requestUrl);
  }
  if (pathname === '/api/mcp/character/search' && (method === 'GET' || method === 'POST')) {
    return handlers.searchCharacters(req, requestUrl);
  }
  if (pathname === '/api/mcp/emotion/analyze_character' && (method === 'GET' || method === 'POST')) {
    return handlers.analyzeCharacterEmotion(req, requestUrl);
  }
  if (pathname === '/api/mcp/character/generate_images' && (method === 'GET' || method === 'POST')) {
    return handlers.generateCharacterImages(req, requestUrl);
  }
  if (pathname === '/api/mcp/character/remove_assets' && (method === 'GET' || method === 'POST')) {
    return handlers.removeCharacterAssets(req, requestUrl);
  }
  const slotMatch = pathname.match(/^\/api\/save\/slots\/([a-zA-Z0-9_-]+)$/);
  if (slotMatch) {
    const slotId = slotMatch[1];
    if (method === 'PATCH') return handlers.updateSlot(req, slotId);
    if (method === 'DELETE') return handlers.deleteSlot(req, slotId);
  }

  const gameStateMatch = pathname.match(/^\/api\/save\/slots\/([a-zA-Z0-9_-]+)\/game-state$/);
  if (gameStateMatch) {
    const slotId = gameStateMatch[1];
    if (method === 'GET') return handlers.getGameState(req, slotId);
    if (method === 'PUT') return handlers.putGameState(req, slotId);
  }

  const npcProfileMatch = pathname.match(/^\/api\/save\/slots\/([a-zA-Z0-9_-]+)\/npcs\/([a-zA-Z0-9_-]+)\/profile$/);
  if (npcProfileMatch) {
    const slotId = npcProfileMatch[1];
    const npcId = npcProfileMatch[2];
    if (method === 'GET') return handlers.getNpcProfile(req, slotId, npcId);
    if (method === 'PUT') return handlers.putNpcProfile(req, slotId, npcId);
  }

  const npcMemoryMatch = pathname.match(/^\/api\/save\/slots\/([a-zA-Z0-9_-]+)\/npcs\/([a-zA-Z0-9_-]+)\/memory$/);
  if (npcMemoryMatch) {
    const slotId = npcMemoryMatch[1];
    const npcId = npcMemoryMatch[2];
    if (method === 'GET') return handlers.getNpcMemory(req, slotId, npcId);
    if (method === 'PUT') return handlers.putNpcMemory(req, slotId, npcId);
  }

  const npcMemoryEventMatch = pathname.match(/^\/api\/save\/slots\/([a-zA-Z0-9_-]+)\/npcs\/([a-zA-Z0-9_-]+)\/memory\/events$/);
  if (npcMemoryEventMatch) {
    const slotId = npcMemoryEventMatch[1];
    const npcId = npcMemoryEventMatch[2];
    if (method === 'POST') return handlers.appendNpcMemoryEvent(req, slotId, npcId);
  }

  return text(404, 'Not Found');
};

const sendResponse = (res, response) => {
  res.statusCode = response.status;
  Object.entries(response.headers || {}).forEach(([k, v]) => res.setHeader(k, v));
  res.setHeader('Cache-Control', 'no-store');
  res.end(response.body || '');
};

const server = http.createServer(async (req, res) => {
  try {
    const response = await route(req);
    sendResponse(res, response);
  } catch (error) {
    const msg = typeof error?.message === 'string' ? error.message : 'internal_error';
    const status = msg.startsWith('invalid_') ? 400 : 500;
    sendResponse(res, json(status, { error: msg }));
  }
});

const bootstrap = async () => {
  await ensureDir(SAVES_ROOT);
  await ensureDir(SEED_ROOT);
  server.listen(PORT, '127.0.0.1', () => {
    console.log(`[save-server] listening on http://127.0.0.1:${PORT}`);
  });
};

bootstrap().catch((err) => {
  console.error('[save-server] failed to start:', err);
  process.exitCode = 1;
});
