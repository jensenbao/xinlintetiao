import { promises as fs } from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';
import {
  mapProfileDocumentToCharacter,
} from './character-profile-service.mjs';
import { getServerTextApiConfig, loadServerEnv } from './runtime-config.mjs';

const VALID_IDENTIFIER = /^[A-Za-z0-9_-]{2,64}$/;
const YAML_EXT_RE = /\.(yaml|yml)$/i;
const JSON_EXT_RE = /\.json$/i;
const IMAGE_EXT_RE = /\.(png|jpe?g|webp|gif|bmp)$/i;

const SKIP_DIRS = new Set([
  '.git',
  'node_modules',
  'dist',
  'build',
  'saves',
]);

const cache = {
  localIndex: { ts: 0, entries: [] },
  localContextByFile: new Map(),
  genderByPortraitKey: new Map(),
};

const normalizeIdentifier = (value) => {
  const text = String(value || '').trim();
  if (!text || !VALID_IDENTIFIER.test(text)) return null;
  return text;
};

const normalizeQuery = (value) => {
  const text = String(value || '').trim();
  if (!text || text.length > 128) return null;
  return text;
};

const normalizeCode = (value) => {
  const normalized = normalizeIdentifier(value);
  return normalized ? normalized.toLowerCase() : null;
};

const clamp01 = (value) => Math.max(0, Math.min(1, value));

const toRelativePath = (root, absolutePath) => path.relative(root, absolutePath).replace(/\\/g, '/');

const getFilePriority = (filePath) => {
  if (JSON_EXT_RE.test(filePath)) return 3;
  if (YAML_EXT_RE.test(filePath)) return 1;
  return 0;
};

const shouldIndexCharacterFile = (filePath) => {
  const fileName = String(path.basename(filePath || '')).toLowerCase();
  if (!fileName) return false;
  if (fileName === 'image-generation.json') return false;
  return YAML_EXT_RE.test(fileName) || JSON_EXT_RE.test(fileName);
};

const fileExists = async (target) => {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
};

const getMimeTypeFromPath = (filePath) => {
  const ext = String(path.extname(filePath || '')).toLowerCase();
  if (ext === '.png') return 'image/png';
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.webp') return 'image/webp';
  if (ext === '.gif') return 'image/gif';
  if (ext === '.bmp') return 'image/bmp';
  return 'application/octet-stream';
};

const buildDataUrl = (buffer, mimeType) => {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) return null;
  return `data:${mimeType || 'application/octet-stream'};base64,${buffer.toString('base64')}`;
};

const GENDER_VALUES = new Set(['male', 'female', 'nonbinary', 'unknown']);
const UNKNOWN_GENDER = Object.freeze({
  value: 'unknown',
  confidence: 0,
  source: 'unknown',
  evidence: [],
});

const cloneGender = (value) => ({
  value: String(value?.value || 'unknown').trim() || 'unknown',
  confidence: clamp01(Number(value?.confidence) || 0),
  source: String(value?.source || 'unknown').trim() || 'unknown',
  evidence: Array.isArray(value?.evidence)
    ? value.evidence.map((item) => String(item || '').trim()).filter(Boolean).slice(0, 6)
    : [],
});

const normalizeGenderValue = (value) => {
  const text = String(value || '').trim().toLowerCase();
  if (!text) return null;

  if (/^(male|man|boy|masculine|cis\s*male|cisman|he\/him|he him|m)$/i.test(text)) return 'male';
  if (/^(female|woman|girl|feminine|cis\s*female|ciswoman|she\/her|she her|f)$/i.test(text)) return 'female';
  if (/^(nonbinary|non-binary|nb|enby|agender|genderqueer|genderfluid|they\/them|they them)$/i.test(text)) return 'nonbinary';
  if (/^(unknown|unspecified|n\/a|na|other|prefer not to say)$/i.test(text)) return 'unknown';
  return null;
};

const buildGenderResult = ({ value = 'unknown', confidence = 0, source = 'unknown', evidence = [] } = {}) => {
  const normalizedValue = normalizeGenderValue(value) || 'unknown';
  return {
    value: normalizedValue,
    confidence: normalizedValue === 'unknown' ? clamp01(Math.min(Number(confidence) || 0, 0.49)) : clamp01(Number(confidence) || 0),
    source: String(source || 'unknown').trim() || 'unknown',
    evidence: Array.isArray(evidence)
      ? evidence.map((item) => String(item || '').trim()).filter(Boolean).slice(0, 6)
      : [],
  };
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

const buildFallbackOpeningLines = ({ name, categoryId }) => {
  if (categoryId === 'artistic') {
    return [
      `${name} tonight. I just need something quiet.`,
      'Do you have a drink that settles the room a little?',
      'I am not looking for anything fancy. Just something that lands softly.',
    ];
  }

  if (categoryId === 'workplace') {
    return [
      'Long day. I could use something simple.',
      'Give me something steady. No need to impress me.',
      'I just want a drink and a little quiet, if that is possible.',
    ];
  }

  return [
    `I am ${name}. I could use a drink tonight.`,
    'Something that fits the mood would help.',
    'I do not need much. Just something that feels right.',
  ];
};

const normalizeVoiceProfile = ({
  name,
  categoryId,
  personality = [],
  dialogueStyle = {},
  backstory = '',
  openingLines = [],
  explicit = null,
}) => {
  const source = explicit && typeof explicit === 'object' ? explicit : {};
  const tone = String(source.tone || dialogueStyle?.tone || '').trim().toLowerCase() || 'casual';
  const features = dedupeList([
    ...parseNameList(source.features || []),
    ...parseNameList(dialogueStyle?.features || []),
  ]).slice(0, 5);
  const backstorySummary = String(source.backstorySummary || '').trim() || summarizeBackstory(backstory);
  const normalizedOpeningLines = dedupeList(
    [
      ...(Array.isArray(source.openingLines) ? source.openingLines : []),
      ...(Array.isArray(openingLines) ? openingLines : []),
    ]
      .map((line) => clipText(line, 90))
      .filter(Boolean)
  ).slice(0, 3);

  return {
    tone,
    features,
    openingLines: normalizedOpeningLines.length > 0
      ? normalizedOpeningLines
      : buildFallbackOpeningLines({ name, categoryId }),
    backstorySummary,
    anchors: dedupeList([
      ...parseNameList(source.anchors || []),
      ...buildVoiceAnchors({
        tone,
        features,
        personality,
        backstorySummary,
      }),
    ]).slice(0, 6),
    ttsVoice: String(source.ttsVoice || '').trim() || null,
  };
};

const buildAliases = ({ code, displayName, name, aliasValue }) => {
  return dedupeList([
    ...parseNameList(aliasValue),
    displayName,
    name,
    code,
  ]).slice(0, 10);
};

const getExplicitGender = (data) => {
  const explicit = getFirstValue(data, [
    'gender',
    'sex',
    'profile.gender',
    'profile.sex',
    'identity.gender',
    'identity.sex',
    'character.gender',
    'character.sex',
    'demographics.gender',
    'demographics.sex',
  ]);
  const normalized = normalizeGenderValue(explicit);
  if (!normalized) return null;
  return buildGenderResult({
    value: normalized,
    confidence: normalized === 'unknown' ? 0.2 : 0.99,
    source: 'yaml',
    evidence: [`explicit:${String(explicit).trim()}`],
  });
};

const getPronounGender = (text) => {
  const value = ` ${String(text || '').toLowerCase()} `;
  if (!value.trim()) return null;

  const nonbinaryHits = [
    /\bthey\/them\b/,
    /\bthey them\b/,
    /\bnon[-\s]?binary\b/,
    /\benby\b/,
    /\bagender\b/,
    /\bgenderfluid\b/,
    /\bgenderqueer\b/,
    /\bmx\.\b/,
  ].filter((pattern) => pattern.test(value));
  if (nonbinaryHits.length > 0) {
    return buildGenderResult({
      value: 'nonbinary',
      confidence: 0.92,
      source: 'text_inference',
      evidence: ['pronouns_or_identity_terms'],
    });
  }

  const maleHits = [
    /\bhe\/him\b/,
    /\bhe him\b/,
    /\bhis\b/,
    /\bmr\.\b/,
    /\bman\b/,
    /\bmale\b/,
    /\bboy\b/,
    /\bfather\b/,
    /\bson\b/,
    /\bbrother\b/,
    /\bhusband\b/,
    /\bking\b/,
    /\bprince\b/,
  ].filter((pattern) => pattern.test(value));

  const femaleHits = [
    /\bshe\/her\b/,
    /\bshe her\b/,
    /\bher\b/,
    /\bms\.\b/,
    /\bmiss\b/,
    /\bmrs\.\b/,
    /\bwoman\b/,
    /\bfemale\b/,
    /\bgirl\b/,
    /\bmother\b/,
    /\bdaughter\b/,
    /\bsister\b/,
    /\bwife\b/,
    /\bqueen\b/,
    /\bprincess\b/,
  ].filter((pattern) => pattern.test(value));

  if (maleHits.length === 0 && femaleHits.length === 0) return null;
  if (maleHits.length === femaleHits.length) return null;

  const valueGuess = maleHits.length > femaleHits.length ? 'male' : 'female';
  return buildGenderResult({
    value: valueGuess,
    confidence: 0.85,
    source: 'text_inference',
    evidence: [`pronoun_count:${maleHits.length}/${femaleHits.length}`],
  });
};

const inferGenderFromText = ({ displayName, appearance, backstory, personality = [], occupation, openingLines = [] }) => {
  const evidence = [];
  const scores = {
    male: 0,
    female: 0,
    nonbinary: 0,
  };

  const add = (target, weight, reason) => {
    if (!scores[target]) return;
    scores[target] += weight;
    evidence.push(reason);
  };

  const textParts = [
    displayName,
    appearance,
    backstory,
    occupation,
    ...(Array.isArray(personality) ? personality : []),
    ...(Array.isArray(openingLines) ? openingLines : []),
  ]
    .map((item) => String(item || '').trim())
    .filter(Boolean);

  const combinedText = textParts.join('\n');
  const pronounGender = getPronounGender(combinedText);
  if (pronounGender && pronounGender.value !== 'unknown') {
    return pronounGender;
  }

  const lowerName = String(displayName || '').trim().toLowerCase();
  if (/^(mr|mister)\.?\s/.test(lowerName)) add('male', 1.15, 'name_title:mr');
  if (/^(ms|miss|mrs)\.?\s/.test(lowerName)) add('female', 1.15, 'name_title:ms');
  if (/^(mx)\.?\s/.test(lowerName)) add('nonbinary', 1.15, 'name_title:mx');

  const lowerText = combinedText.toLowerCase();
  if (/\bnon[-\s]?binary\b|\benby\b|\bagender\b|\bgenderfluid\b|\bgenderqueer\b/.test(lowerText)) {
    add('nonbinary', 1.4, 'identity_terms');
  }
  if (/\bman\b|\bmale\b|\bfather\b|\bson\b|\bbrother\b|\bhusband\b|\bking\b|\bprince\b|\bbeard\b|\bmustache\b/.test(lowerText)) {
    add('male', 0.72, 'text_markers:male');
  }
  if (/\bwoman\b|\bfemale\b|\bmother\b|\bdaughter\b|\bsister\b|\bwife\b|\bqueen\b|\bprincess\b|\bpregnan/.test(lowerText)) {
    add('female', 0.72, 'text_markers:female');
  }

  const ranked = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  const [topValue, topScore] = ranked[0] || ['unknown', 0];
  const secondScore = ranked[1]?.[1] || 0;

  if (topScore < 0.7 || topScore - secondScore < 0.35) {
    return buildGenderResult({
      value: 'unknown',
      confidence: Math.min(0.35, topScore),
      source: 'text_inference',
      evidence,
    });
  }

  return buildGenderResult({
    value: topValue,
    confidence: clamp01(0.55 + Math.min(0.3, topScore * 0.18) + Math.min(0.1, (topScore - secondScore) * 0.12)),
    source: 'text_inference',
    evidence,
  });
};

const parsePortraitDataUrl = (dataUrl) => {
  const match = String(dataUrl || '').match(/^data:([^;,]+);base64,(.+)$/);
  if (!match) return null;
  return {
    mimeType: match[1],
    base64: match[2],
  };
};

const extractJsonObject = (text) => {
  const source = String(text || '').trim();
  if (!source) return null;

  try {
    return JSON.parse(source);
  } catch {
    // continue
  }

  const match = source.match(/\{[\s\S]*\}/);
  if (!match) return null;

  try {
    return JSON.parse(match[0]);
  } catch {
    return null;
  }
};

const parseGenderVisionResponse = (raw) => {
  const parsed = extractJsonObject(raw);
  if (!parsed || typeof parsed !== 'object') return null;

  return buildGenderResult({
    value: parsed.gender || parsed.value || 'unknown',
    confidence: Number(parsed.confidence) || 0,
    source: 'image_inference',
    evidence: Array.isArray(parsed.evidence) ? parsed.evidence : (parsed.rationale ? [parsed.rationale] : []),
  });
};

const callOpenAICompatibleVision = async ({ endpoint, apiKey, model, prompt, imageUrl }) => {
  const base = String(endpoint || '').replace(/\/$/, '');
  const response = await fetch(`${base}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.1,
      max_tokens: 180,
      response_format: { type: 'json_object' },
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          { type: 'image_url', image_url: { url: imageUrl } },
        ],
      }],
    }),
  });

  if (!response.ok) return null;
  const data = await response.json();
  return String(data?.choices?.[0]?.message?.content || '').trim();
};

const callGeminiNativeVision = async ({ endpoint, apiKey, model, prompt, mimeType, base64 }) => {
  const base = String(endpoint || '').replace(/\/$/, '');
  const response = await fetch(`${base}/${model}:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      contents: [{
        parts: [
          { text: prompt },
          { inlineData: { mimeType, data: base64 } },
        ],
      }],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 180,
        candidateCount: 1,
        responseMimeType: 'application/json',
      },
    }),
  });

  if (!response.ok) return null;
  const data = await response.json();
  return String(data?.candidates?.[0]?.content?.parts?.find((part) => part?.text)?.text || '').trim();
};

const inferGenderFromPortrait = async ({ rootDir, portrait, character }) => {
  const dataUrl = String(portrait?.dataUrl || '').trim();
  const portraitKey = String(portrait?.path || portrait?.url || dataUrl.slice(0, 96)).trim();
  if (!dataUrl || !portraitKey) return null;

  const cached = cache.genderByPortraitKey.get(portraitKey);
  if (cached && Date.now() - cached.ts < 24 * 60 * 60_000) {
    return cloneGender(cached.value);
  }

  const ai = await getServerTextApiConfig(rootDir);
  if (!ai?.apiKey || !ai?.model) return null;

  const parsedImage = parsePortraitDataUrl(dataUrl);
  if (!parsedImage?.base64 || !parsedImage?.mimeType) return null;

  const prompt = [
    'Analyze this fictional character portrait and infer the most likely gender presentation.',
    'Return JSON only: {"gender":"male|female|nonbinary|unknown","confidence":0.0,"evidence":["short clue"]}.',
    'If the image is ambiguous, stylized, low-detail, or confidence is below 0.75, use "unknown".',
    `Character context: name=${String(character?.displayName || '').trim()}; appearance=${String(character?.profile?.appearance || '').trim()}; backstory=${String(character?.background?.backstory || '').trim().slice(0, 240)}.`,
  ].join('\n');

  let raw = '';
  try {
    if (ai.openaiCompatible) {
      raw = await callOpenAICompatibleVision({
        endpoint: ai.endpoint,
        apiKey: ai.apiKey,
        model: ai.model,
        prompt,
        imageUrl: dataUrl,
      }) || '';
    } else if (ai.type === 'gemini') {
      raw = await callGeminiNativeVision({
        endpoint: ai.endpoint,
        apiKey: ai.apiKey,
        model: ai.model,
        prompt,
        mimeType: parsedImage.mimeType,
        base64: parsedImage.base64,
      }) || '';
    }
  } catch {
    raw = '';
  }

  const parsed = parseGenderVisionResponse(raw);
  if (!parsed) return null;

  const normalized = parsed.confidence >= 0.75
    ? parsed
    : buildGenderResult({
      value: 'unknown',
      confidence: parsed.confidence,
      source: 'image_inference',
      evidence: parsed.evidence,
    });

  cache.genderByPortraitKey.set(portraitKey, { ts: Date.now(), value: normalized });
  return cloneGender(normalized);
};

const resolveCharacterGender = async ({ rootDir, character }) => {
  const explicitOrText = cloneGender(character?.gender || UNKNOWN_GENDER);
  if (explicitOrText.value !== 'unknown' && explicitOrText.confidence >= 0.5) {
    return explicitOrText;
  }

  if (!character?.portrait?.dataUrl) {
    return explicitOrText;
  }

  const byImage = await inferGenderFromPortrait({
    rootDir,
    portrait: character.portrait,
    character,
  });

  if (byImage) return byImage;
  return explicitOrText;
};

const scorePortraitCandidate = (name) => {
  const text = String(name || '').toLowerCase();
  let score = 0;
  if (text.startsWith('portrait')) score += 100;
  if (/^1(\.|$)/.test(text)) score += 60;
  if (/^(a|cover|main)(\.|$)/.test(text)) score += 40;
  if (text.includes('character')) score += 20;
  if (text.endsWith('.png')) score += 8;
  if (text.endsWith('.jpg') || text.endsWith('.jpeg')) score += 6;
  if (text.endsWith('.webp')) score += 4;
  return score;
};

const selectPreferredImage = (items) => {
  if (!Array.isArray(items) || items.length === 0) return null;
  const sorted = [...items].sort((a, b) => {
    const scoreDiff = scorePortraitCandidate(b?.name || b?.path) - scorePortraitCandidate(a?.name || a?.path);
    if (scoreDiff !== 0) return scoreDiff;
    const sizeDiff = Number(b?.size || 0) - Number(a?.size || 0);
    if (sizeDiff !== 0) return sizeDiff;
    return String(a?.name || a?.path || '').localeCompare(String(b?.name || b?.path || ''));
  });
  return sorted[0] || null;
};

const listImageFilesInDir = async (dir) => {
  if (!dir || !(await fileExists(dir))) return [];
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isFile() && IMAGE_EXT_RE.test(entry.name))
      .map((entry) => ({
        name: entry.name,
        path: path.join(dir, entry.name),
      }));
  } catch {
    return [];
  }
};

const getPresetCharacterDir = (rootDir) => path.join(rootDir, 'seeds', 'characters', 'presets');
const getAddedCharacterDir = (rootDir) => path.join(rootDir, 'seeds', 'characters', 'added');

const getPresetCharacterAssetDir = (rootDir, code) => {
  const normalized = normalizeCode(code);
  if (!normalized) return null;
  return path.join(getPresetCharacterDir(rootDir), normalized);
};

const getAddedCharacterAssetDir = (rootDir, code) => {
  const normalized = normalizeCode(code);
  if (!normalized) return null;
  return path.join(getAddedCharacterDir(rootDir), normalized);
};

export const invalidateLocalCharacterCache = ({ rootDir, code }) => {
  const normalizedCode = normalizeCode(code);
  if (!rootDir || !normalizedCode) return false;

  const addedCharacterDir = getAddedCharacterAssetDir(rootDir, normalizedCode);
  cache.localIndex.ts = 0;
  cache.localIndex.entries = cache.localIndex.entries.filter((entry) => entry?.code !== normalizedCode);

  if (addedCharacterDir) {
    for (const filePath of cache.localContextByFile.keys()) {
      if (typeof filePath !== 'string') continue;
      if (filePath.startsWith(addedCharacterDir)) {
        cache.localContextByFile.delete(filePath);
      }
    }
  }

  return true;
};

const getPresetCharacterProfilePath = (rootDir, code) => {
  const normalized = normalizeCode(code);
  if (!normalized) return null;
  return path.join(getPresetCharacterDir(rootDir), normalized, 'profile.json');
};

const getLegacyPresetCharacterProfilePath = (rootDir, code) => {
  const normalized = normalizeCode(code);
  if (!normalized) return null;
  return path.join(getPresetCharacterDir(rootDir), `${normalized}.json`);
};

const getAddedCharacterProfilePath = (rootDir, code) => {
  const normalized = normalizeCode(code);
  if (!normalized) return null;
  return path.join(getAddedCharacterDir(rootDir), normalized, 'profile.json');
};

const getLegacyAddedCharacterProfilePath = (rootDir, code) => {
  const normalized = normalizeCode(code);
  if (!normalized) return null;
  return path.join(getAddedCharacterDir(rootDir), `${normalized}.json`);
};

const loadLocalPortrait = async (rootDir, code) => {
  const normalizedCode = normalizeCode(code);
  if (!rootDir || !normalizedCode) return null;

  const candidateDirs = [
    getAddedCharacterAssetDir(rootDir, normalizedCode),
    getPresetCharacterAssetDir(rootDir, normalizedCode),
  ].filter(Boolean);

  for (const dir of candidateDirs) {
    const images = await listImageFilesInDir(dir);
    const preferred = selectPreferredImage(images);
    if (!preferred?.path) continue;
    try {
      const buffer = await fs.readFile(preferred.path);
      const mimeType = getMimeTypeFromPath(preferred.path);
      return {
        path: toRelativePath(rootDir, preferred.path),
        url: null,
        mimeType,
        dataUrl: buildDataUrl(buffer, mimeType),
      };
    } catch {
      // try next candidate
    }
  }

  return null;
};

const resolveOptionalGender = async ({ rootDir, character, inferPortraitGender }) => {
  if (!inferPortraitGender) {
    return cloneGender(character?.gender || UNKNOWN_GENDER);
  }
  return resolveCharacterGender({ rootDir, character });
};

const enrichCharacterWithPortrait = async ({ rootDir, character, inferPortraitGender = true }) => {
  if (!character || typeof character !== 'object') return character;

  const existingDataUrl = String(character?.portrait?.dataUrl || '').trim();
  if (existingDataUrl) {
    return {
      ...character,
      gender: await resolveOptionalGender({ rootDir, character, inferPortraitGender }),
    };
  }

  const localPortrait = await loadLocalPortrait(rootDir, character.code);
  if (localPortrait) {
    return {
      ...character,
      portrait: localPortrait,
      gender: await resolveOptionalGender({
        rootDir,
        inferPortraitGender,
        character: {
          ...character,
          portrait: localPortrait,
        },
      }),
    };
  }

  return {
    ...character,
    gender: await resolveOptionalGender({ rootDir, character, inferPortraitGender }),
  };
};

const findLocalProfileByCode = async (rootDir, code) => {
  const normalizedCode = normalizeCode(code);
  if (!normalizedCode) return null;

  const profileCandidates = [
    getAddedCharacterProfilePath(rootDir, normalizedCode),
    getLegacyAddedCharacterProfilePath(rootDir, normalizedCode),
    getPresetCharacterProfilePath(rootDir, normalizedCode),
    getLegacyPresetCharacterProfilePath(rootDir, normalizedCode),
  ].filter(Boolean);

  for (const candidate of profileCandidates) {
    if (!(await fileExists(candidate))) continue;
    try {
      return await loadProfileCharacterFromFile(rootDir, candidate, normalizedCode);
    } catch {
      // try next profile candidate
    }
  }

  return null;
};

const parseNameList = (value) => {
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

const getPathValue = (data, dottedPath) => {
  if (!data || typeof data !== 'object') return undefined;
  const parts = dottedPath.split('.');
  let cursor = data;
  for (const part of parts) {
    if (!cursor || typeof cursor !== 'object') return undefined;
    cursor = cursor[part];
  }
  return cursor;
};

const getFirstValue = (data, paths) => {
  for (const dottedPath of paths) {
    const value = getPathValue(data, dottedPath);
    if (value !== undefined && value !== null && value !== '') return value;
  }
  return undefined;
};

const normalizeCodeCandidate = (value) => {
  const text = String(value || '').trim();
  if (!text) return null;
  if (VALID_IDENTIFIER.test(text)) return text.toLowerCase();
  return null;
};

const GENERIC_CHARACTER_FILE_STEMS = new Set([
  'profile',
  'source',
  'portrait',
  'character',
  'index',
  'image-generation',
]);

const guessCodeFromFile = (filePath) => {
  const stem = path.basename(filePath, path.extname(filePath));
  const parent = path.basename(path.dirname(filePath));
  const normalizedStem = String(stem || '').trim().toLowerCase();
  const parentCode = normalizeCodeCandidate(parent);

  if (parentCode && GENERIC_CHARACTER_FILE_STEMS.has(normalizedStem)) {
    return parentCode;
  }

  const stemCode = normalizeCodeCandidate(stem);
  if (stemCode) return stemCode;

  if (parentCode) return parentCode;

  const match = stem.toLowerCase().match(/([0-9]{3,}[a-z]?)/);
  if (match) return match[1];
  return null;
};

const mapYamlToCharacter = ({ data, code, sourceType, sourcePath = null, sourceUrl = null }) => {
  const codeValue = normalizeCode(code) || normalizeCode(getFirstValue(data, ['code', 'id', 'character.code'])) || 'unknown';
  const displayName = String(getFirstValue(data, ['name', 'character.name', 'profile.name']) || codeValue).trim();
  const personalityValue = getFirstValue(data, [
    'personality',
    'character.personality',
    'profile.personality',
    'traits.personality',
  ]);
  const appearanceValue = getFirstValue(data, [
    'appearance',
    'character.appearance',
    'profile.appearance',
  ]);

  const dialogueTone = String(getFirstValue(data, [
    'dialogueStyle.tone',
    'dialogue.style',
    'voice.tone',
  ]) || '').trim();

  const dialogueFeatures = parseNameList(getFirstValue(data, [
    'dialogueStyle.features',
    'dialogue.features',
    'voice.features',
  ]));

  const openingLinesRaw = getFirstValue(data, [
    'initialDialogue',
    'dialogue.opening',
    'openingLines',
  ]);
  const openingLines = Array.isArray(openingLinesRaw)
    ? openingLinesRaw.map((line) => String(line || '').trim()).filter(Boolean)
    : [];
  const backstory = String(getFirstValue(data, ['backstory', 'story', 'bio', 'character.backstory']) || '').trim();
  const occupation = String(getFirstValue(data, ['occupation', 'job', 'profile.occupation']) || '').trim();
  const personality = parseNameList(personalityValue);
  const aliases = buildAliases({
    code: codeValue,
    displayName,
    name: String(getFirstValue(data, ['profile.name']) || '').trim(),
    aliasValue: getFirstValue(data, [
      'aliases',
      'alias',
      'profile.aliases',
      'character.aliases',
      'names.aliases',
      'names.nicknames',
      'nickname',
      'nicknames',
    ]),
  });
  const voiceProfile = normalizeVoiceProfile({
    name: displayName,
    categoryId: String(getFirstValue(data, ['categoryId', 'category', 'character.category']) || '').trim() || null,
    personality,
    dialogueStyle: {
      tone: dialogueTone,
      features: dialogueFeatures,
    },
    backstory,
    openingLines,
    explicit: getFirstValue(data, ['voiceProfile', 'voice.profile']),
  });
  const explicitGender = getExplicitGender(data);
  const inferredGender = explicitGender || inferGenderFromText({
    displayName,
    appearance: appearanceValue,
    backstory,
    occupation,
    personality,
    openingLines,
  });

  return {
    code: codeValue,
    displayName,
    categoryId: String(getFirstValue(data, ['categoryId', 'category', 'character.category']) || '').trim() || null,
    aliases,
    profile: {
      name: displayName,
      age: getFirstValue(data, ['age', 'profile.age', 'character.age']) ?? null,
      personality,
      appearance: String(appearanceValue || '').trim(),
      occupation,
    },
    background: {
      backstory,
      origin: String(getFirstValue(data, ['origin', 'hometown', 'profile.origin']) || '').trim(),
    },
    dialogueStyle: {
      tone: dialogueTone,
      features: dialogueFeatures,
      openingLines,
    },
    voiceProfile,
    gender: inferredGender || cloneGender(UNKNOWN_GENDER),
    source: {
      type: sourceType,
      path: sourcePath,
      url: sourceUrl,
    },
  };
};

const loadYamlCharacterFromFile = async (rootDir, filePath, codeHint = null) => {
  const stat = await fs.stat(filePath);
  const cached = cache.localContextByFile.get(filePath);
  if (cached && cached.mtimeMs === stat.mtimeMs) {
    return cached.character;
  }

  const raw = await fs.readFile(filePath, 'utf8');
  const data = YAML.parse(raw);
  const code = normalizeCode(codeHint) || guessCodeFromFile(filePath);
  const character = mapYamlToCharacter({
    data,
    code,
    sourceType: 'local',
    sourcePath: toRelativePath(rootDir, filePath),
  });

  cache.localContextByFile.set(filePath, { mtimeMs: stat.mtimeMs, character });
  return character;
};

const loadProfileCharacterFromFile = async (rootDir, filePath, codeHint = null) => {
  const stat = await fs.stat(filePath);
  const cached = cache.localContextByFile.get(filePath);
  if (cached && cached.mtimeMs === stat.mtimeMs) {
    return cached.character;
  }

  const raw = await fs.readFile(filePath, 'utf8');
  const doc = JSON.parse(raw);
  const code = normalizeCode(codeHint) || guessCodeFromFile(filePath);
  const character = mapProfileDocumentToCharacter({
    doc,
    code,
    sourcePath: toRelativePath(rootDir, filePath),
  });

  cache.localContextByFile.set(filePath, { mtimeMs: stat.mtimeMs, character });
  return character;
};

const loadCharacterFromFile = async (rootDir, filePath, codeHint = null) => {
  if (JSON_EXT_RE.test(filePath)) {
    return loadProfileCharacterFromFile(rootDir, filePath, codeHint);
  }
  return loadYamlCharacterFromFile(rootDir, filePath, codeHint);
};

const walkCharacterFiles = async (startDir) => {
  const stack = [startDir];
  const files = [];

  while (stack.length > 0) {
    const current = stack.pop();
    let entries = [];
    try {
      entries = await fs.readdir(current, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      const entryPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (!SKIP_DIRS.has(entry.name)) {
          stack.push(entryPath);
        }
        continue;
      }

      if (entry.isFile() && shouldIndexCharacterFile(entry.name)) {
        files.push(entryPath);
      }
    }
  }

  return files;
};

const buildLocalIndex = async (rootDir) => {
  const now = Date.now();
  if (now - cache.localIndex.ts < 30_000 && cache.localIndex.entries.length > 0) {
    return cache.localIndex.entries;
  }

  const candidateRoots = [
    getPresetCharacterDir(rootDir),
    getAddedCharacterDir(rootDir),
    path.join(rootDir, 'story', 'repo'),
    path.join(rootDir, 'storyworld', 'repo'),
  ];

  const existingRoots = [];
  for (const dir of candidateRoots) {
    if (await fileExists(dir)) existingRoots.push(dir);
  }

  const entryByCode = new Map();
  const fallbackEntries = [];
  for (const baseDir of existingRoots) {
    const characterFiles = await walkCharacterFiles(baseDir);
    for (const filePath of characterFiles) {
      const code = guessCodeFromFile(filePath);
      const nextEntry = { code, filePath, baseDir };
      if (!code) {
        fallbackEntries.push(nextEntry);
        continue;
      }

      const prev = entryByCode.get(code);
      if (!prev) {
        entryByCode.set(code, nextEntry);
        continue;
      }

      const prevPriority = getFilePriority(prev.filePath);
      const nextPriority = getFilePriority(filePath);
      if (nextPriority > prevPriority) {
        entryByCode.set(code, nextEntry);
      }
    }
  }

  const entries = [...entryByCode.values(), ...fallbackEntries];

  cache.localIndex = { ts: now, entries };
  return entries;
};

const findLocalByCode = async (rootDir, code) => {
  const normalizedCode = normalizeCode(code);
  if (!normalizedCode) return null;

  const localIndex = await buildLocalIndex(rootDir);
  const matched = localIndex.find((item) => item.code === normalizedCode);
  if (!matched?.filePath) return null;

  try {
    return await loadCharacterFromFile(rootDir, matched.filePath, normalizedCode);
  } catch {
    return null;
  }
};

const matchText = (value, keyword) => String(value || '').toLowerCase().includes(keyword);

const findLocalByName = async (rootDir, nameOrCode) => {
  const keyword = String(nameOrCode || '').trim().toLowerCase();
  if (!keyword) return null;

  const localIndex = await buildLocalIndex(rootDir);
  for (const entry of localIndex) {
    const localCode = String(entry.code || '').toLowerCase();
    if (localCode && localCode === keyword) {
      return loadCharacterFromFile(rootDir, entry.filePath, entry.code);
    }
  }

  for (const entry of localIndex) {
    try {
      const character = await loadCharacterFromFile(rootDir, entry.filePath, entry.code);
      if (matchText(character?.displayName, keyword) || matchText(character?.profile?.name, keyword)) {
        return character;
      }
    } catch {
      // ignore broken yaml file
    }
  }

  return null;
};

export const getCharacterByName = async ({ rootDir, query, inferPortraitGender = true }) => {
  await loadServerEnv(rootDir);
  const normalizedQuery = normalizeQuery(query);
  if (!normalizedQuery) {
    const error = new Error('invalid_character_query');
    error.code = 'invalid_character_query';
    throw error;
  }

  const byCodeFromProfile = await findLocalProfileByCode(rootDir, normalizedQuery);
  if (byCodeFromProfile) {
    return enrichCharacterWithPortrait({ rootDir, character: byCodeFromProfile, inferPortraitGender });
  }

  const byCode = await findLocalByCode(rootDir, normalizedQuery);
  if (byCode) {
    return enrichCharacterWithPortrait({ rootDir, character: byCode, inferPortraitGender });
  }

  const byName = await findLocalByName(rootDir, normalizedQuery);
  if (byName) {
    return enrichCharacterWithPortrait({ rootDir, character: byName, inferPortraitGender });
  }

  return null;
};

export const searchCharacters = async ({ rootDir, query = '', limit = 20 }) => {
  await loadServerEnv(rootDir);
  const keyword = String(query || '').trim().toLowerCase();
  const cappedLimit = Math.min(Math.max(Number(limit) || 20, 1), 50);
  const results = [];
  const seenCodes = new Set();

  const pushResult = (item) => {
    const code = String(item?.code || '').toLowerCase();
    if (!code || seenCodes.has(code)) return;
    seenCodes.add(code);
    results.push(item);
  };

  const localIndex = await buildLocalIndex(rootDir);
  for (const entry of localIndex) {
    if (results.length >= cappedLimit) break;
    const localCode = String(entry.code || '').toLowerCase();
    if (!localCode) continue;
    if (keyword && !localCode.includes(keyword)) {
      try {
        const character = await loadCharacterFromFile(rootDir, entry.filePath, entry.code);
        const byName = matchText(character?.displayName, keyword) || matchText(character?.profile?.name, keyword);
        if (!byName) continue;
        pushResult({
          code: character.code,
          displayName: character.displayName,
          source: character.source,
        });
      } catch {
        continue;
      }
    } else {
      pushResult({
        code: localCode,
        displayName: localCode,
        source: {
          type: 'local',
          path: toRelativePath(rootDir, entry.filePath),
          url: null,
        },
      });
    }
  }

  return results;
};
