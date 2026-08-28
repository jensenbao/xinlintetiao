import { API_CONFIG, getActiveAPIType, generateCustomerPrompt } from '../../config/api.js';
import {
  ALL_CATEGORY_IDS,
  getCategoryConfig,
  pickRandom,
  pickRandomMultiple,
  randomInRange,
} from '../../data/aiCustomers.js';
import { getAvatarFromCache, saveAvatarToCache } from '../avatarCache.js';
import {
  analyzeLocalCharacterEmotion,
  getLocalCharacterByName,
} from '../localCharacterRepository.js';
import { EMOTION_IDS_8, normalizeEmotionList } from '../emotionSchema.js';
import { extractCleanJSON, tryRepairTruncatedJSON } from './jsonUtils.js';
import { callDeepSeekAPIHelper } from './sharedApi.js';

const parseCustomerJSON = (response) => {
  if (!response || typeof response !== 'string') {
    console.error('Invalid response:', response);
    return null;
  }

  console.log('Raw response length:', response.length);

  const cleanedResponse = extractCleanJSON(response);
  if (!cleanedResponse) return null;

  try {
    const parsed = JSON.parse(cleanedResponse);
    console.log('JSON parsed successfully');
    return parsed;
  } catch (e) {
    console.log('Direct parse failed, attempting to extract a JSON object...');
  }

  const jsonMatch = cleanedResponse.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      console.log('Successfully extracted JSON from text');
      return parsed;
    } catch (e2) {
      console.log('Customer JSON is incomplete, attempting repair...');
      const repaired = tryRepairTruncatedJSON(jsonMatch[0]);
      if (repaired) {
        console.log('Customer JSON repaired successfully');
        return repaired;
      }
      console.error('JSON parsing failed:', e2.message);
      console.error('Extracted JSON snippet:', jsonMatch[0].substring(0, 300));
      return null;
    }
  }

  const jsonStart = cleanedResponse.match(/\{[\s\S]*/);
  if (jsonStart) {
    const repaired = tryRepairTruncatedJSON(jsonStart[0]);
    if (repaired) {
      console.log('Successfully repaired customer JSON from truncated text');
      return repaired;
    }
  }

  console.error('No JSON object found in response:', cleanedResponse.substring(0, 300));
  return null;
};

const VALID_EMOTION_IDS = [...EMOTION_IDS_8];

const validateEmotions = (emotions, fallbackPool, isRealityEmotion = false) => {
  if (!emotions || !Array.isArray(emotions) || emotions.length === 0) {
    return isRealityEmotion
      ? pickRandomMultiple(fallbackPool, 2, 2)
      : pickRandomMultiple(fallbackPool, 1, 2);
  }

  const validEmotions = normalizeEmotionList(emotions, {
    min: 0,
    max: isRealityEmotion ? 2 : 2,
    fallback: fallbackPool,
  }).filter((emotion) => VALID_EMOTION_IDS.includes(emotion));

  if (validEmotions.length === 0) {
    console.warn('Invalid emotion IDs detected, using fallback values:', emotions);
    return isRealityEmotion
      ? normalizeEmotionList(pickRandomMultiple(fallbackPool, 2, 2), { min: 2, max: 2, fallback: ['fear', 'sadness'] })
      : normalizeEmotionList(pickRandomMultiple(fallbackPool, 1, 2), { min: 1, max: 2, fallback: ['trust'] });
  }

  if (isRealityEmotion) {
    if (validEmotions.length < 2) {
      const additionalEmotions = normalizeEmotionList(pickRandomMultiple(
        fallbackPool.filter((emotion) => !validEmotions.includes(emotion)),
        2 - validEmotions.length,
        2 - validEmotions.length
      ), { min: 2 - validEmotions.length, max: 2 - validEmotions.length, fallback: ['fear', 'sadness'] });
      return [...validEmotions, ...additionalEmotions];
    }

    if (validEmotions.length > 2) {
      return validEmotions.slice(0, 2);
    }

    return validEmotions;
  }

  return validEmotions;
};

const validateTone = (tone, options) => {
  if (!tone || !options.includes(tone)) {
    return pickRandom(options);
  }
  return tone;
};

const validateLength = (length, options) => {
  const validLengths = ['short', 'medium', 'long'];
  if (!length || !validLengths.includes(length)) {
    return pickRandom(options);
  }
  return length;
};

const completeCustomerConfig = (parsedConfig, categoryConfig) => {
  const thresholds = categoryConfig.trustThresholdRange;
  const normalizedVoice = normalizeRuntimeVoiceProfile({
    name: parsedConfig.name || `${categoryConfig.category} Visitor`,
    categoryId: categoryConfig.id,
    personality: parsedConfig.personality || [],
    dialogueStyle: parsedConfig.dialogueStyle || {},
    backstory: parsedConfig.backstory || '',
    openingLines: parsedConfig.initialDialogue || [],
  });

  const surfaceEmotions = validateEmotions(
    parsedConfig.emotionMask?.surface,
    categoryConfig.surfaceEmotionPool,
    false
  );
  const realEmotions = validateEmotions(
    parsedConfig.emotionMask?.reality,
    categoryConfig.realEmotionPool,
    true
  );

  return {
    id: `${categoryConfig.id}_${Date.now()}`,
    name: parsedConfig.name || `${categoryConfig.category} Visitor`,
    avatar: pickRandom(categoryConfig.avatarOptions),
    personality: parsedConfig.personality || pickRandomMultiple(categoryConfig.personalityPool, 2, 3),
    dialogueStyle: {
      tone: validateTone(normalizedVoice.tone, categoryConfig.toneOptions),
      length: validateLength(parsedConfig.dialogueStyle?.length, categoryConfig.lengthOptions),
      features: normalizedVoice.features.length > 0
        ? normalizedVoice.features
        : pickRandomMultiple(categoryConfig.featurePool, 2, 3),
    },
    emotionMask: {
      surface: surfaceEmotions,
      reality: realEmotions,
      trustThreshold: {
        low: randomInRange(thresholds.low),
        medium: randomInRange(thresholds.medium),
        high: randomInRange(thresholds.high),
      },
    },
    preferences: {
      iceType: pickRandom(categoryConfig.preferredIce),
      garnishes: pickRandomMultiple(categoryConfig.preferredGarnishes, 1, 2),
      decorations: pickRandomMultiple(categoryConfig.preferredDecorations, 1, 2),
    },
    initialDialogue: normalizedVoice.openingLines,
    triggerKeywords: parsedConfig.triggerKeywords || {},
    memoryStyle: pickRandom(categoryConfig.memoryStyleOptions),
    metaphorLevel: pickRandom(categoryConfig.metaphorLevelOptions),
    backstory: normalizedVoice.backstorySummary,
    rawBackstory: parsedConfig.backstory || '',
    voiceProfile: normalizedVoice,
    categoryId: categoryConfig.id,
    isGenerated: true,
  };
};

const CHARACTER_ID_PATTERN = /^[A-Za-z0-9_-]+$/;

const hashCharacterId = (text) => {
  const value = String(text || '');
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = ((hash << 5) - hash + value.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
};

const splitListLikeText = (value) => {
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

const dedupeList = (items) => {
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

  const slice = text.slice(0, max);
  const lastPunctuation = Math.max(
    slice.lastIndexOf('. '),
    slice.lastIndexOf('! '),
    slice.lastIndexOf('? '),
    slice.lastIndexOf('。'),
    slice.lastIndexOf('！'),
    slice.lastIndexOf('？')
  );

  if (lastPunctuation >= Math.floor(max * 0.5)) {
    return slice.slice(0, lastPunctuation + 1).trim();
  }

  return `${slice.trim()}...`;
};

const summarizeBackstory = (value) => {
  const text = normalizeWhitespace(value);
  if (!text) return '';

  const sentences = text
    .split(/(?<=[.!?。！？])\s+/)
    .map((item) => item.trim())
    .filter(Boolean);

  const summary = sentences.slice(0, 2).join(' ');
  return clipText(summary || text, 220);
};

const resolvePortraitDataUrl = (source) => {
  const direct = String(source?.portraitDataUrl || source?.avatarBase64 || '').trim();
  if (direct.startsWith('data:image/')) return direct;

  const portraitDataUrl = String(source?.portrait?.dataUrl || '').trim();
  return portraitDataUrl.startsWith('data:image/') ? portraitDataUrl : '';
};

const DEFAULT_DIALOGUE_FEATURES = {
  formal: ['措辞克制', '少用比喻', '回答直接'],
  tired: ['短句', '停顿多', '不展开长篇解释'],
  cynical: ['句子偏短', '带一点防备', '少说空话'],
  poetic: ['允许少量意象', '不要堆砌修辞', '说人话'],
  dreamy: ['慢一点', '语气轻', '句子别太飘'],
  melancholic: ['轻声', '短句', '少抒情'],
  casual: ['口语化', '自然接话', '少解释'],
  nervous: ['短句', '偶尔犹豫', '反应快'],
  excited: ['口语化', '节奏快', '句子偏短'],
};

const DEFAULT_CATEGORY_FEATURES = {
  workplace: ['回答务实', '少修辞', '不主动长篇倾诉'],
  artistic: ['保留一点画面感', '但先像人在说话', '避免整段抒情'],
  student: ['口语直接', '句子偏短', '反应真实'],
  midlife: ['说慢一点', '多用具体经历', '少抽象感慨'],
};

const FEATURE_NORMALIZATION_RULES = [
  { pattern: /诗|poetic|quote|典故/i, replacement: '保留一点意象，但不要整段抒情' },
  { pattern: /意识流|stream/i, replacement: '可以有跳跃感，但句子要像真实说话' },
  { pattern: /隐喻|metaphor/i, replacement: '比喻要少，用一句就够' },
  { pattern: /停顿|ellipsis/i, replacement: '偶尔停顿' },
  { pattern: /简短|短句|brief|short/i, replacement: '短句' },
  { pattern: /直接|direct/i, replacement: '回答直接' },
  { pattern: /口语|casual/i, replacement: '口语化' },
];

const normalizeFeatureText = (feature) => {
  const text = normalizeWhitespace(feature);
  if (!text) return '';

  const matched = FEATURE_NORMALIZATION_RULES.find((rule) => rule.pattern.test(text));
  return matched ? matched.replacement : text;
};

const normalizeDialogueFeatures = ({ features, tone, categoryId }) => {
  const normalized = dedupeList((features || []).map(normalizeFeatureText)).slice(0, 5);
  if (normalized.length >= 3) return normalized;

  const toneDefaults = DEFAULT_DIALOGUE_FEATURES[tone] || [];
  const categoryDefaults = DEFAULT_CATEGORY_FEATURES[categoryId] || [];
  return dedupeList([...normalized, ...toneDefaults, ...categoryDefaults]).slice(0, 5);
};

const buildVoiceAnchors = ({ tone, features, personality = [], backstorySummary = '' }) => {
  const anchors = [
    '优先像人当面说话，不要像旁白或设定文案',
    '多说具体感受、物件或场景，少说抽象判断',
  ];

  if (tone === 'poetic' || tone === 'dreamy' || tone === 'melancholic') {
    anchors.push('可以有一点画面感，但每次最多一句，不要连续抒情');
  } else {
    anchors.push('少用修辞和解释，尽量自然接话');
  }

  if ((personality || []).some((trait) => /gentle|温柔|轻|nostalg/i.test(String(trait || '')))) {
    anchors.push('语气轻一点，但不要写成散文');
  }

  if (/ocean|water|fish|robot|machine|ruin|海|水|机械|废墟/i.test(backstorySummary)) {
    anchors.push('如果要提自己的经历，优先提具体物件或环境，不要抽象抒情');
  }

  anchors.push(...(features || []).map((feature) => `说话特征：${feature}`));
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

const normalizeRuntimeVoiceProfile = ({
  name,
  categoryId,
  personality = [],
  dialogueStyle = {},
  backstory = '',
  openingLines = [],
}) => {
  const tone = String(dialogueStyle?.tone || '').trim().toLowerCase() || 'casual';
  const backstorySummary = summarizeBackstory(backstory);
  const features = normalizeDialogueFeatures({
    features: splitListLikeText(dialogueStyle?.features),
    tone,
    categoryId,
  });
  const normalizedOpeningLines = dedupeList(
    (Array.isArray(openingLines) ? openingLines : [])
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
    anchors: buildVoiceAnchors({
      tone,
      features,
      personality,
      backstorySummary,
    }),
  };
};

export const generateCustomer = async (categoryId) => {
  const categoryConfig = getCategoryConfig(categoryId);
  const prompt = generateCustomerPrompt(categoryConfig);

  console.log('Starting customer generation, category:', categoryConfig.category);

  const response = await callGeminiAPIForCustomer(prompt);
  const parsed = parseCustomerJSON(response);
  if (!parsed) {
    throw new Error('customer_generation_invalid_json');
  }

  const customer = completeCustomerConfig(parsed, categoryConfig);

  console.log('Customer generated successfully:', customer.name);

  customer.avatarBase64 = null;
  return customer;
};

export const generateCustomerFromCharacterId = async (characterId) => {
  const roleId = String(characterId || '').trim().toLowerCase();
  if (!CHARACTER_ID_PATTERN.test(roleId)) {
    throw new Error('invalid_character_id');
  }

  const context = await getLocalCharacterByName(roleId);
  if (!context) {
    throw new Error('character_not_found');
  }

  const emotionAnalysis = await analyzeLocalCharacterEmotion({
    query: roleId,
    character: context,
  });
  if (!emotionAnalysis || typeof emotionAnalysis !== 'object') {
    throw new Error('character_emotion_analysis_failed');
  }

  const mappedCategoryId = String(context?.categoryId || '').trim();
  const categoryId = ALL_CATEGORY_IDS.includes(mappedCategoryId)
    ? mappedCategoryId
    : (ALL_CATEGORY_IDS[hashCharacterId(roleId) % ALL_CATEGORY_IDS.length] || 'workplace');

  const categoryConfig = getCategoryConfig(categoryId);
  const personality = splitListLikeText(context?.profile?.personality);
  const dialogueFeatures = splitListLikeText(context?.dialogueStyle?.features);
  const openingLines = Array.isArray(context?.dialogueStyle?.openingLines)
    ? context.dialogueStyle.openingLines.map((line) => String(line || '').trim()).filter(Boolean)
    : [];
  const contextVoiceProfile = context?.voiceProfile && typeof context.voiceProfile === 'object'
    ? context.voiceProfile
    : {};
  const normalizedVoice = normalizeRuntimeVoiceProfile({
    name: context?.displayName || roleId,
    categoryId,
    personality,
    dialogueStyle: {
      tone: contextVoiceProfile.tone || context?.dialogueStyle?.tone || undefined,
      features: Array.isArray(contextVoiceProfile.features) && contextVoiceProfile.features.length > 0
        ? contextVoiceProfile.features
        : dialogueFeatures,
    },
    backstory: context?.background?.backstory || '',
    openingLines: Array.isArray(contextVoiceProfile.openingLines) && contextVoiceProfile.openingLines.length > 0
      ? contextVoiceProfile.openingLines
      : openingLines,
  });

  const base = completeCustomerConfig({
    name: context?.displayName || roleId,
    personality,
    dialogueStyle: {
      tone: normalizedVoice.tone,
      length: 'medium',
      features: normalizedVoice.features,
    },
    backstory: normalizedVoice.backstorySummary || `A character from the roster, ${roleId}, came to the bar tonight.`,
    initialDialogue: normalizedVoice.openingLines,
  }, categoryConfig);

  // Lock runtime identity to the selected character code so all downstream
  // consumers (stage portrait / avatar cache / UI headers) stay in sync.
  base.id = roleId;
  base.characterCode = roleId;
  base.customCharacterId = roleId;
  base.isCustomCharacter = true;
  base.customCharacterSource = context?.source || null;
  base.aliases = Array.isArray(context?.aliases) ? context.aliases : [];
  base.avatarCacheKey = `custom_${roleId}`;
  base.voiceProfile = {
    ...normalizedVoice,
    code: roleId,
  };
  base.gender = String(context?.gender?.value || 'unknown').trim() || 'unknown';
  base.genderInfo = context?.gender || { value: 'unknown', confidence: 0, source: 'unknown', evidence: [] };
  base.rawBackstory = context?.background?.backstory || '';

  if (emotionAnalysis && typeof emotionAnalysis === 'object') {
    const top3 = Array.isArray(emotionAnalysis.top3)
      ? normalizeEmotionList(emotionAnalysis.top3, { min: 0, max: 3, fallback: [] })
      : [];

    if (top3.length > 0) {
      const surface = normalizeEmotionList(top3.slice(0, 2), { min: 1, max: 2, fallback: ['trust'] });
      const reality = normalizeEmotionList(top3, { min: 2, max: 2, fallback: ['fear', 'sadness'] });
      base.emotionMask = {
        ...(base.emotionMask || {}),
        surface,
        reality,
      };
    }

    base.emotionAnalysis = emotionAnalysis;
    base.currentEmotionWeights = emotionAnalysis.weights || null;
    base.currentEmotionTop3 = top3;
  }

  const portraitDataUrl = resolvePortraitDataUrl(context);
  base.avatarBase64 = portraitDataUrl || null;
  if (base.avatarBase64) {
    await saveAvatarToCache(base.avatarCacheKey, base.avatarBase64);
  } else {
    const cachedAvatar = await getAvatarFromCache(base.avatarCacheKey);
    base.avatarBase64 = cachedAvatar || null;
  }

  return base;
};

export const generateCustomerWithCharacterPool = async ({
  activeCharacterIds = [],
  usedCharacterIds = []
} = {}) => {
  const validIds = Array.isArray(activeCharacterIds)
    ? activeCharacterIds
      .map((item) => String(item || '').trim())
      .filter((item) => CHARACTER_ID_PATTERN.test(item))
    : [];

  if (validIds.length === 0) {
    throw new Error('no_active_characters');
  }

  const used = new Set((Array.isArray(usedCharacterIds) ? usedCharacterIds : []).map((item) => String(item || '').trim()));

  const remainingCustom = validIds.filter((id) => !used.has(id));
  const candidatePool = remainingCustom.length > 0 ? remainingCustom : validIds;
  const chosen = pickRandom(candidatePool);
  return generateCustomerFromCharacterId(chosen);
};

const callGeminiAPIForCustomer = async (prompt) => {
  const apiType = getActiveAPIType();

  if (apiType === 'deepseek') {
    const text = await callDeepSeekAPIHelper(prompt, { temperature: 0.9, max_tokens: 8192 });
    console.log('Customer generation raw response length:', text?.length, 'characters');
    console.log('Customer generation response preview:', text?.substring(0, 100));
    return text;
  }

  const config = API_CONFIG.gemini;

  if (!config.enabled) {
    throw new Error('No API is enabled');
  }

  const url = `${config.endpoint}/${config.model}:generateContent?key=${config.apiKey}`;

  if (config.openaiCompatible) {
    const endpoint = String(config.endpoint || '').replace(/\/$/, '');
    const response = await fetch(`${endpoint}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.9,
        max_tokens: 8192,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gemini (OpenAI-compatible) request failed: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    const text = data?.choices?.[0]?.message?.content;
    if (!text) {
      throw new Error('Gemini (OpenAI-compatible) returned an invalid response format');
    }
    return text;
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      contents: [{
        parts: [{
          text: prompt,
        }],
      }],
      generationConfig: {
        temperature: 0.9,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 8192,
        candidateCount: 1,
      },
    }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    console.error('Gemini API error:', errorData);
    throw new Error(`Gemini API request failed: ${response.status}`);
  }

  const data = await response.json();

  if (data.candidates && data.candidates.length > 0) {
    const candidate = data.candidates[0];

    console.log('📊 finishReason:', candidate.finishReason);
    if (candidate.finishReason && candidate.finishReason !== 'STOP') {
      console.warn('Response was truncated, reason:', candidate.finishReason);
    }

    if (candidate.content && candidate.content.parts && candidate.content.parts.length > 0) {
      const text = candidate.content.parts[0].text;
      console.log('Gemini raw response length:', text?.length, 'characters');
      console.log('Gemini response preview:', text?.substring(0, 100));
      return text;
    }
  }

  console.error('Unexpected response structure:', JSON.stringify(data).substring(0, 500));
  throw new Error('Gemini returned an invalid response format');
};

export const generateDailyCustomers = async (day, onProgress) => {
  const count = Math.min(2 + Math.floor(day / 3), 5);
  const customers = [];

  console.log(`Starting generation for day ${day}: ${count} customers...`);

  const shuffledCategories = [...ALL_CATEGORY_IDS].sort(() => Math.random() - 0.5);

  for (let i = 0; i < count; i++) {
    const categoryId = shuffledCategories[i % shuffledCategories.length];

    if (onProgress) {
      onProgress(i + 1, count, `Creating customer ${i + 1}...`);
    }

    const customer = await generateCustomer(categoryId);
    customers.push({
      id: `${day}-${i}`,
      type: customer.categoryId || categoryId,
      config: customer,
    });

    if (i < count - 1) {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }

  console.log(`Customer generation for day ${day} completed: ${customers.length} total`);
  return customers;
};
