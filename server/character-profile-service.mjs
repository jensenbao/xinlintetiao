import path from 'node:path';
import { analyzeCharacterEmotionWithAI } from './emotion-service.mjs';

const normalizeList = (value) => {
  if (Array.isArray(value)) {
    return value.map((item) => String(item || '').trim()).filter(Boolean);
  }
  if (typeof value === 'string') {
    return value
      .split(/[;,，、]/)
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
};

const dedupeList = (items = []) => {
  const seen = new Set();
  return (Array.isArray(items) ? items : [])
    .map((item) => String(item || '').trim())
    .filter((item) => {
      const key = item.toLowerCase();
      if (!item || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
};

const normalizeWhitespace = (value) => String(value || '').replace(/\s+/g, ' ').trim();

const clipText = (value, max = 220) => {
  const text = normalizeWhitespace(value);
  if (text.length <= max) return text;
  return `${text.slice(0, max).trim()}...`;
};

const summarizeBackstory = (value) => {
  const text = normalizeWhitespace(value);
  if (!text) return '';
  const sentences = text
    .split(/(?<=[.!?。！？])\s+/)
    .map((item) => item.trim())
    .filter(Boolean);
  return clipText(sentences.slice(0, 2).join(' ') || text, 220);
};

const buildVoiceAnchors = ({ tone, features, personality = [], backstorySummary = '' }) => {
  const anchors = [
    'Prefer natural spoken dialogue over narration.',
    'Favor concrete feelings, objects, and scenes over abstract explanation.',
  ];

  if (tone === 'poetic' || tone === 'dreamy' || tone === 'melancholic') {
    anchors.push('Allow a little imagery, but keep it grounded and brief.');
  } else {
    anchors.push('Keep phrasing direct and conversational.');
  }

  if ((Array.isArray(personality) ? personality : []).some((trait) => /gentle|soft|nostalg/i.test(String(trait || '')))) {
    anchors.push('Keep the delivery soft without turning it into prose.');
  }

  if (/ocean|water|fish|robot|machine|ruin/i.test(backstorySummary)) {
    anchors.push('If referencing the past, mention concrete environments or objects first.');
  }

  anchors.push(...(Array.isArray(features) ? features : []).map((feature) => `Speech trait: ${feature}`));
  return dedupeList(anchors).slice(0, 6);
};

const normalizeGenderValue = (value) => {
  const text = String(value || '').trim().toLowerCase();
  if (!text) return 'unknown';
  if (['male', 'female', 'nonbinary', 'unknown'].includes(text)) return text;
  return 'unknown';
};

const normalizeGender = (value) => {
  if (value && typeof value === 'object') {
    return {
      value: normalizeGenderValue(value.value),
      confidence: Math.max(0, Math.min(1, Number(value.confidence) || 0)),
      source: String(value.source || 'unknown').trim() || 'unknown',
      evidence: normalizeList(value.evidence || []).slice(0, 6),
    };
  }

  return {
    value: normalizeGenderValue(value),
    confidence: 0,
    source: 'unknown',
    evidence: [],
  };
};

const normalizeVoiceProfile = (value, fallback = {}) => {
  const voice = value && typeof value === 'object' ? value : {};
  const tone = String(voice.tone || fallback.tone || '').trim();
  const features = normalizeList(voice.features || fallback.features || []);
  const openingLines = Array.isArray(voice.openingLines)
    ? voice.openingLines.map((line) => String(line || '').trim()).filter(Boolean)
    : normalizeList(fallback.openingLines || []);
  const backstorySummary = String(voice.backstorySummary || fallback.backstorySummary || '').trim();
  const anchors = normalizeList(voice.anchors || fallback.anchors || []);
  return {
    tone,
    features,
    openingLines,
    backstorySummary,
    anchors,
    ttsVoice: String(voice.ttsVoice || '').trim() || null,
  };
};

const buildAliases = ({ code, displayName, name, aliases }) => {
  return dedupeList([
    ...(Array.isArray(aliases) ? aliases : normalizeList(aliases || [])),
    displayName,
    name,
    code,
  ]).slice(0, 10);
};

const buildDerivedVoiceProfile = ({ displayName, categoryId, personality, dialogueStyle, background, explicitVoiceProfile }) => {
  const tone = String(explicitVoiceProfile?.tone || dialogueStyle?.tone || '').trim().toLowerCase() || 'casual';
  const features = normalizeList(explicitVoiceProfile?.features || dialogueStyle?.features || []);
  const openingLines = Array.isArray(explicitVoiceProfile?.openingLines) && explicitVoiceProfile.openingLines.length > 0
    ? explicitVoiceProfile.openingLines
    : (Array.isArray(dialogueStyle?.openingLines) ? dialogueStyle.openingLines : []);
  const backstorySummary = String(explicitVoiceProfile?.backstorySummary || '').trim()
    || summarizeBackstory(background?.backstory || '');

  return {
    tone,
    features,
    openingLines,
    backstorySummary,
    anchors: normalizeList(explicitVoiceProfile?.anchors || []).length > 0
      ? normalizeList(explicitVoiceProfile.anchors)
      : buildVoiceAnchors({
        tone,
        features,
        personality,
        backstorySummary,
      }),
    ttsVoice: String(explicitVoiceProfile?.ttsVoice || '').trim() || null,
  };
};

export const buildCharacterProfileDocument = async ({ code, character, preset = false, notes } = {}) => {
  const normalizedId = String(code || character?.code || '').trim().toLowerCase();
  const displayName = String(character?.displayName || character?.profile?.name || code || '').trim();
  const slug = String(character?.slug || displayName)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || normalizedId;
  const emotion = await analyzeCharacterEmotionWithAI({
    character,
    options: {
      allowPartialModelOutput: false,
      requireCompleteWeightSet: true,
    },
  });

  const doc = {
    schemaVersion: 1,
    id: normalizedId,
    slug,
    displayName,
    kind: preset ? 'preset' : 'custom',
    preset,
    lockedUntilUserAdded: Boolean(preset),
    character: {
      code: String(character?.code || code || '').trim().toLowerCase(),
      displayName,
      categoryId: character?.categoryId || null,
      aliases: buildAliases({
        code: character?.code || code || '',
        displayName,
        name: character?.profile?.name || displayName,
        aliases: character?.aliases || [],
      }),
      profile: {
        name: String(character?.profile?.name || displayName).trim(),
        age: character?.profile?.age ?? null,
        personality: normalizeList(character?.profile?.personality || []),
        appearance: String(character?.profile?.appearance || '').trim(),
        occupation: String(character?.profile?.occupation || '').trim(),
      },
      background: {
        backstory: String(character?.background?.backstory || '').trim(),
        origin: String(character?.background?.origin || '').trim(),
      },
      dialogueStyle: {
        tone: String(character?.dialogueStyle?.tone || '').trim(),
        features: normalizeList(character?.dialogueStyle?.features || []),
        openingLines: Array.isArray(character?.dialogueStyle?.openingLines)
          ? character.dialogueStyle.openingLines.map((line) => String(line || '').trim()).filter(Boolean)
          : [],
      },
      voiceProfile: normalizeVoiceProfile(character?.voiceProfile, buildDerivedVoiceProfile({
        displayName,
        categoryId: character?.categoryId || null,
        personality: character?.profile?.personality || [],
        dialogueStyle: character?.dialogueStyle || {},
        background: character?.background || {},
        explicitVoiceProfile: character?.voiceProfile || {},
      })),
      gender: normalizeGender(character?.gender),
      source: {
        type: character?.source?.type || 'local_profile',
        path: character?.source?.path || null,
        url: character?.source?.url || null,
      },
      portrait: character?.portrait && typeof character.portrait === 'object'
        ? {
          path: character.portrait.path || null,
          url: character.portrait.url || null,
          mimeType: character.portrait.mimeType || null,
        }
        : null,
    },
    assets: {
      source: 'source.yaml',
      portrait: character?.portrait?.path ? path.basename(character.portrait.path) : null,
      concept: null,
      pixel: null,
      generation: null,
      publicCutout: normalizedId ? `public/asset/角色/cutout/${normalizedId}_cutout.png` : null,
    },
    emotionSchemaVersion: 2,
    currentEmotionWeights: emotion.weights,
    currentEmotionTop3: emotion.top3,
    emotionAnalysis: {
      confidence: emotion.confidence,
      rationale: emotion.rationale,
      source: emotion.source,
      sourceHash: emotion.sourceHash,
      analyzedAt: Date.now(),
    },
  };

  if (typeof notes === 'string' && notes.trim()) {
    doc.notes = notes.trim();
  }

  return doc;
};

export const mapProfileDocumentToCharacter = ({ doc, code, sourcePath = null }) => {
  const embedded = doc?.character || {};
  const normalizedCode = String(embedded?.code || doc?.id || code || '').trim().toLowerCase() || 'unknown';
  const displayName = String(embedded?.displayName || doc?.displayName || embedded?.profile?.name || normalizedCode).trim();
  const sourceType = String(doc?.kind || embedded?.source?.type || '').trim() || (doc?.preset ? 'preset' : 'custom');
  const portraitAsset = String(doc?.assets?.portrait || '').trim();
  const profile = {
    name: String(embedded?.profile?.name || displayName).trim(),
    age: embedded?.profile?.age ?? null,
    personality: normalizeList(embedded?.profile?.personality || []),
    appearance: String(embedded?.profile?.appearance || '').trim(),
    occupation: String(embedded?.profile?.occupation || '').trim(),
  };
  const background = {
    backstory: String(embedded?.background?.backstory || '').trim(),
    origin: String(embedded?.background?.origin || '').trim(),
  };
  const dialogueStyle = {
    tone: String(embedded?.dialogueStyle?.tone || '').trim(),
    features: normalizeList(embedded?.dialogueStyle?.features || []),
    openingLines: Array.isArray(embedded?.dialogueStyle?.openingLines)
      ? embedded.dialogueStyle.openingLines.map((line) => String(line || '').trim()).filter(Boolean)
      : [],
  };

  return {
    code: normalizedCode,
    displayName,
    categoryId: String(embedded?.categoryId || '').trim() || null,
    aliases: buildAliases({
      code: normalizedCode,
      displayName,
      name: profile.name,
      aliases: embedded?.aliases || [],
    }),
    profile,
    background,
    dialogueStyle,
    voiceProfile: normalizeVoiceProfile(embedded?.voiceProfile, buildDerivedVoiceProfile({
      displayName,
      categoryId: String(embedded?.categoryId || '').trim() || null,
      personality: profile.personality,
      dialogueStyle,
      background,
      explicitVoiceProfile: embedded?.voiceProfile || {},
    })),
    gender: normalizeGender(embedded?.gender),
    source: {
      type: sourceType,
      path: sourcePath,
      url: null,
    },
    portrait: portraitAsset
      ? {
        path: portraitAsset,
        url: null,
        mimeType: null,
        dataUrl: null,
      }
      : embedded?.portrait && typeof embedded.portrait === 'object'
      ? {
        path: String(embedded.portrait.path || '').trim() || null,
        url: String(embedded.portrait.url || '').trim() || null,
        mimeType: String(embedded.portrait.mimeType || '').trim() || null,
        dataUrl: null,
      }
      : null,
  };
};
