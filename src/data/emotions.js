import { EMOTION_IDS_8 } from '../utils/emotionSchema.js';

const TOOL_ASSET_BASE = '/asset/道具';
const icon = (relativePath) => `${TOOL_ASSET_BASE}/${relativePath}`;

export const EMOTIONS = {
  joy: { id: 'joy', name: 'Joy', color: '#FFD166', icon: '😊' },
  trust: { id: 'trust', name: 'Trust', color: '#06D6A0', icon: '🤝' },
  fear: { id: 'fear', name: 'Fear', color: '#7B2CBF', icon: '😨' },
  surprise: { id: 'surprise', name: 'Surprise', color: '#4CC9F0', icon: '😮' },
  sadness: { id: 'sadness', name: 'Sadness', color: '#4361EE', icon: '😢' },
  disgust: { id: 'disgust', name: 'Disgust', color: '#6A994E', icon: '🤢' },
  anger: { id: 'anger', name: 'Anger', color: '#E63946', icon: '😠' },
  anticipation: { id: 'anticipation', name: 'Anticipation', color: '#F77F00', icon: '✨' },
};

export const INITIAL_UNLOCKED_EMOTIONS = [...EMOTION_IDS_8];

export const EMOTION_HINTS = {
  low: {
    joy: 'Their tone sounds a little lighter.',
    trust: 'They seem more willing to lean closer.',
    fear: 'They seem worried about something.',
    surprise: 'They seem caught off guard by something.',
    sadness: 'There is a trace of low mood in their voice.',
    disgust: 'They show clear resistance to certain topics.',
    anger: 'They are holding back irritation.',
    anticipation: 'They seem to be expecting what comes next.',
  },
  medium: {
    joy: 'Their eyes are brighter and their tone is more relaxed.',
    trust: 'They begin sharing more personal, more honest details.',
    fear: 'They hesitate as if repeatedly checking for safety.',
    surprise: 'They pause suddenly, like struck by a memory or message.',
    sadness: 'They noticeably slow down when talking about the past.',
    disgust: 'They clearly avoid continuing certain descriptions.',
    anger: 'Their wording grows sharper around certain people/topics.',
    anticipation: 'They actively discuss plans, possibilities, and next steps.',
  },
  high: {
    joy: 'Their happiness is no longer hidden; even breathing feels lighter.',
    trust: 'They clearly see you as someone they can rely on.',
    fear: 'Their fear has surfaced and needs to be held carefully.',
    surprise: 'Emotion swings are obvious, like after a sudden turn.',
    sadness: 'They are touching their most fragile grief; defenses are thin.',
    disgust: 'Their aversion is strong—they can hardly revisit that memory.',
    anger: 'Their anger is close to erupting.',
    anticipation: 'They strongly expect something from the future, waiting for an answer.',
  },
};

export const EMOTION_COMPATIBILITY = {
  compatible: [
    ['joy', 'trust'],
    ['anticipation', 'joy'],
    ['surprise', 'anticipation'],
    ['sadness', 'trust'],
  ],
  conflict: [
    ['joy', 'sadness'],
    ['trust', 'disgust'],
    ['fear', 'anger'],
    ['anticipation', 'disgust'],
  ],
};

export const GLASS_TYPES = {
  martini: {
    id: 'martini',
    name: 'Martini Glass',
    icon: '🍸',
    iconImage: icon('杯型/martini.png'),
    bonus: ['trust', 'joy'],
    description: 'Classic and elegant, suited for balanced emotions',
    maxPortions: 3,
    feeling: 'This glass asks for directness; there is nowhere to hide.',
  },
  highball: {
    id: 'highball',
    name: 'Highball Glass',
    icon: '🥃',
    iconImage: icon('杯型/highball.png'),
    bonus: ['joy', 'anticipation'],
    description: 'Relaxed and easy, suited for positive emotions',
    maxPortions: 3,
    feeling: 'This glass is unhurried: sip slowly, speak slowly.',
  },
  rock: {
    id: 'rock',
    name: 'Rocks Glass',
    icon: '🥛',
    iconImage: icon('杯型/rock.png'),
    bonus: ['sadness', 'fear'],
    description: 'Steady and weighty, suited for complex emotions',
    maxPortions: 3,
    feeling: 'This glass feels like a promise: solid, weighted, restrained.',
  },
};
export const EMOTION_TARGETS = {
  joy: {
    hint: 'Light, slightly sweet, not overly harsh.',
    description: 'Amplify positive emotions with a bright profile.',
    conditions: [
      { attr: 'thickness', op: '>=', value: 1 },
      { attr: 'sweetness', op: '>=', value: 2 },
      { attr: 'strength', op: '<=', value: 2 },
    ],
  },
  trust: {
    hint: 'Balanced profile, stable layers.',
    description: 'Convey a dependable feeling.',
    conditions: [
      { attr: 'thickness', op: '>=', value: 1 },
      { attr: 'sweetness', op: '>=', value: 1 },
      { attr: 'strength', op: '<=', value: 2 },
    ],
  },
  fear: {
    hint: 'Keep it gentle; stabilize first.',
    description: 'Reduce aggression and emphasize steadiness.',
    conditions: [
      { attr: 'thickness', op: '>=', value: 1 },
      { attr: 'sweetness', op: '>=', value: 1 },
      { attr: 'strength', op: '<=', value: 2 },
    ],
  },
  surprise: {
    hint: 'Include a bit of jump and contrast.',
    description: 'Create variation within control.',
    conditions: [
      { attr: 'thickness', op: '=', value: 1 },
      { attr: 'sweetness', op: '>=', value: 1 },
      { attr: 'strength', op: '>=', value: 2 },
    ],
  },
  sadness: {
    hint: 'Softer, with a wrapping comfort.',
    description: 'Let sadness be seen without being overwhelming.',
    conditions: [
      { attr: 'thickness', op: '>=', value: 2 },
      { attr: 'sweetness', op: '>=', value: 1 },
      { attr: 'strength', op: '<=', value: 2 },
    ],
  },
  disgust: {
    hint: 'Keep it clean and crisp, less sweet.',
    description: 'Avoid heaviness; emphasize restraint.',
    conditions: [
      { attr: 'thickness', op: '<=', value: 1 },
      { attr: 'sweetness', op: '<=', value: 1 },
      { attr: 'strength', op: '>=', value: 2 },
    ],
  },
  anger: {
    hint: 'Strong, but not out of control.',
    description: 'Hold anger and direct it into expression.',
    conditions: [
      { attr: 'thickness', op: '<=', value: 1 },
      { attr: 'sweetness', op: '<=', value: 1 },
      { attr: 'strength', op: '>=', value: 3 },
    ],
  },
  anticipation: {
    hint: 'Lifted and forward-moving.',
    description: 'Push expectation toward positive action.',
    conditions: [
      { attr: 'thickness', op: '>=', value: 1 },
      { attr: 'sweetness', op: '>=', value: 2 },
      { attr: 'strength', op: '>=', value: 2 },
    ],
  },
};

export const EMOTION_TASTE_PROTOTYPES = {
  joy: { thickness: 1, sweetness: 2, strength: 1 },
  trust: { thickness: 2, sweetness: 1, strength: 1 },
  fear: { thickness: 0, sweetness: 0, strength: 2 },
  surprise: { thickness: 1, sweetness: 1, strength: 2 },
  sadness: { thickness: 2, sweetness: 0, strength: 1 },
  disgust: { thickness: 1, sweetness: 0, strength: 2 },
  anger: { thickness: 0, sweetness: 0, strength: 3 },
  anticipation: { thickness: 1, sweetness: 2, strength: 2 },
};

export const getHintLevel = (trustLevel) => {
  if (trustLevel >= 0.7) return 'high';
  if (trustLevel >= 0.5) return 'medium';
  if (trustLevel >= 0.3) return 'low';
  return null;
};

export const getEmotionHint = (emotionId, trustLevel) => {
  const level = getHintLevel(trustLevel);
  if (!level) return null;
  return EMOTION_HINTS[level][emotionId] || null;
};

export const checkEmotionCompatibility = (emotions) => {
  if (emotions.length < 2) return 'neutral';

  const emotionIds = emotions.map((emotion) => emotion.id).sort();

  for (const pair of EMOTION_COMPATIBILITY.compatible) {
    const sortedPair = [...pair].sort();
    if (
      emotionIds.length === 2 &&
      emotionIds[0] === sortedPair[0] &&
      emotionIds[1] === sortedPair[1]
    ) {
      return 'compatible';
    }
  }

  for (const pair of EMOTION_COMPATIBILITY.conflict) {
    const sortedPair = [...pair].sort();
    if (
      emotionIds.length === 2 &&
      emotionIds[0] === sortedPair[0] &&
      emotionIds[1] === sortedPair[1]
    ) {
      return 'conflict';
    }
  }

  return 'neutral';
};

export const generateTargetFromEmotion = (emotionId, variance = 1, atmosphereShift = null) => {
  const base = EMOTION_TARGETS[emotionId];
  if (!base) return null;

  const conditions = base.conditions.map((condition) => {
    const actualVariance = condition.op === '=' ? Math.floor(variance / 2) : variance;
    const randomOffset = Math.floor(Math.random() * (actualVariance * 2 + 1)) - actualVariance;

    let value = condition.value + randomOffset;

    if (atmosphereShift && atmosphereShift[condition.attr] !== undefined) {
      value += atmosphereShift[condition.attr];
    }

    return {
      ...condition,
      value
    };
  });

  return {
    emotionId,
    conditions,
    hint: base.hint,
    description: base.description
  };
};
