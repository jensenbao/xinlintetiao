export const EMOTION_IDS_8 = [
  'joy',
  'trust',
  'fear',
  'surprise',
  'sadness',
  'disgust',
  'anger',
  'anticipation',
];

export const EMOTION_NAME_MAP_CN = {
  joy: 'Joy',
  trust: 'Trust',
  fear: 'Fear',
  surprise: 'Surprise',
  sadness: 'Sadness',
  disgust: 'Disgust',
  anger: 'Anger',
  anticipation: 'Anticipation',
};

const LEGACY_TO_PLUTCHIK = {
  nostalgia: 'sadness',
  courage: 'anticipation',
  loneliness: 'sadness',
  relief: 'joy',
  anxiety: 'fear',
  calm: 'trust',
  regret: 'sadness',
  aspiration: 'anticipation',
  pressure: 'fear',
  dependence: 'trust',
  confusion: 'surprise',
  happiness: 'joy',
};

export const normalizeEmotionId = (emotionId) => {
  if (!emotionId) return null;
  const id = String(emotionId).trim();
  if (!id) return null;
  if (EMOTION_IDS_8.includes(id)) return id;
  return LEGACY_TO_PLUTCHIK[id] || null;
};

export const isValidEmotionId = (emotionId) => normalizeEmotionId(emotionId) !== null;

export const normalizeEmotionList = (emotionIds, options = {}) => {
  const {
    min = 0,
    max = Number.POSITIVE_INFINITY,
    fallback = ['trust'],
  } = options;

  const list = Array.isArray(emotionIds) ? emotionIds : [];
  const normalized = [];
  const seen = new Set();

  for (const item of list) {
    const mapped = normalizeEmotionId(item);
    if (!mapped || seen.has(mapped)) continue;
    seen.add(mapped);
    normalized.push(mapped);
    if (normalized.length >= max) break;
  }

  const normalizedFallback = Array.isArray(fallback)
    ? fallback.map((item) => normalizeEmotionId(item)).filter(Boolean)
    : [];

  let cursor = 0;
  while (normalized.length < min && cursor < normalizedFallback.length) {
    const candidate = normalizedFallback[cursor++];
    if (!seen.has(candidate)) {
      seen.add(candidate);
      normalized.push(candidate);
    }
  }

  let safetyIndex = 0;
  while (normalized.length < min && safetyIndex < EMOTION_IDS_8.length) {
    const candidate = EMOTION_IDS_8[safetyIndex++];
    if (!seen.has(candidate)) {
      seen.add(candidate);
      normalized.push(candidate);
    }
  }

  return normalized.slice(0, max);
};
