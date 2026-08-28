import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getServerTextApiConfig, loadServerEnv } from './runtime-config.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

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

const TIE_BREAKER_ORDER = [
  'joy',
  'trust',
  'anticipation',
  'surprise',
  'sadness',
  'fear',
  'anger',
  'disgust',
];

const TIE_BREAKER_INDEX = new Map(TIE_BREAKER_ORDER.map((id, index) => [id, index]));

const KEYWORDS = {
  joy: ['joy', 'happy', 'smile', 'hope', 'optimistic', '喜悦', '开心', '高兴', '轻松', '明亮'],
  trust: ['trust', 'rely', 'safe', 'steady', 'support', '信任', '依靠', '可靠', '稳定', '安心'],
  fear: ['fear', 'afraid', 'anxious', 'worry', 'panic', '恐惧', '害怕', '焦虑', '担心', '不安'],
  surprise: ['surprise', 'sudden', 'unexpected', 'shock', 'twist', '惊讶', '突然', '意外', '震惊', '转折'],
  sadness: ['sad', 'lonely', 'loss', 'grief', 'depressed', '悲伤', '难过', '孤独', '失落', '遗憾'],
  disgust: ['disgust', 'reject', 'repel', 'dirty', 'aversion', '厌恶', '反感', '排斥', '恶心', '嫌弃'],
  anger: ['anger', 'angry', 'rage', 'irritated', 'furious', '愤怒', '生气', '恼火', '暴躁', '火气'],
  anticipation: ['anticipation', 'expect', 'future', 'plan', 'prepare', '期待', '盼望', '计划', '下一步', '准备'],
};

const clamp01 = (value) => Math.max(0, Math.min(1, value));

const createUniformWeights = () => {
  const base = 1 / EMOTION_IDS_8.length;
  return Object.fromEntries(EMOTION_IDS_8.map((id) => [id, base]));
};

const normalizeWeights = (weights = {}) => {
  const sanitized = {};
  let sum = 0;

  for (const id of EMOTION_IDS_8) {
    const raw = Number(weights?.[id]);
    const value = Number.isFinite(raw) ? clamp01(raw) : 0;
    sanitized[id] = value;
    sum += value;
  }

  if (sum <= 0) {
    return createUniformWeights();
  }

  const normalized = {};
  for (const id of EMOTION_IDS_8) {
    normalized[id] = sanitized[id] / sum;
  }
  return normalized;
};

const getTop3 = (weights) => {
  return [...EMOTION_IDS_8]
    .sort((a, b) => {
      const diff = (weights[b] || 0) - (weights[a] || 0);
      if (Math.abs(diff) > 1e-12) return diff;
      return (TIE_BREAKER_INDEX.get(a) ?? 99) - (TIE_BREAKER_INDEX.get(b) ?? 99);
    })
    .slice(0, 3);
};

const buildCharacterText = (character = {}) => {
  const parts = [
    character?.displayName,
    character?.profile?.name,
    character?.profile?.appearance,
    character?.profile?.occupation,
    character?.background?.backstory,
    character?.background?.origin,
    character?.dialogueStyle?.tone,
    ...(Array.isArray(character?.profile?.personality) ? character.profile.personality : []),
    ...(Array.isArray(character?.dialogueStyle?.features) ? character.dialogueStyle.features : []),
    ...(Array.isArray(character?.dialogueStyle?.openingLines) ? character.dialogueStyle.openingLines : []),
  ]
    .map((item) => String(item || '').trim())
    .filter(Boolean);

  return parts.join('\n');
};

const inferWeightsFromText = (text) => {
  const lower = String(text || '').toLowerCase();
  const scores = Object.fromEntries(EMOTION_IDS_8.map((id) => [id, 0]));
  const evidence = [];

  for (const emotionId of EMOTION_IDS_8) {
    const keywords = KEYWORDS[emotionId] || [];
    for (const keyword of keywords) {
      const token = String(keyword || '').toLowerCase().trim();
      if (!token) continue;
      if (!lower.includes(token)) continue;

      const weight = token.length >= 4 ? 1.2 : 1.0;
      scores[emotionId] += weight;
      evidence.push({ emotionId, keyword: token, weight });
    }
  }

  const totalScore = EMOTION_IDS_8.reduce((acc, id) => acc + scores[id], 0);
  if (totalScore <= 0) {
    return {
      weights: createUniformWeights(),
      confidence: 0.6,
      rationale: ['No valid emotional cues were detected, so the system fell back to a uniform distribution.'],
      signalCount: 0,
    };
  }

  const padded = {};
  for (const id of EMOTION_IDS_8) {
    padded[id] = scores[id] + 0.01;
  }

  const normalized = normalizeWeights(padded);
  const signalCount = evidence.length;
  const confidenceBase = 0.5 + Math.min(0.35, signalCount * 0.03);
  const confidence = clamp01(confidenceBase);

  const topEvidence = evidence
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 4)
    .map((item) => `${item.emotionId}:${item.keyword}`);

  return {
    weights: normalized,
    confidence,
    rationale: topEvidence.length > 0 ? topEvidence : ['Emotional cues were extracted from the character text.'],
    signalCount,
  };
};

const buildSourceHash = (text) => {
  return createHash('sha1').update(String(text || '')).digest('hex');
};

const buildEmotionPrompt = (characterText) => {
  return `你是情绪分析器。基于角色资料，输出普拉奇克8情绪权重JSON。\n\n角色资料：\n${characterText}\n\n只返回JSON，不要解释：\n{\n  "weights": {\n    "joy": number,\n    "trust": number,\n    "fear": number,\n    "surprise": number,\n    "sadness": number,\n    "disgust": number,\n    "anger": number,\n    "anticipation": number\n  },\n  "confidence": number,\n  "rationale": [string]\n}`;
};

const buildEmotionPromptCompact = (characterText) => {
  return `根据下列角色资料，返回一行JSON，且只包含 weights 与 confidence 两个字段。\n角色资料:\n${characterText}\n\n格式必须是：{"weights":{"joy":0.1,"trust":0.1,"fear":0.1,"surprise":0.1,"sadness":0.1,"disgust":0.1,"anger":0.1,"anticipation":0.2},"confidence":0.8}`;
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

const extractWeightsFromText = (text) => {
  const source = String(text || '');
  if (!source) return null;

  const weights = {};
  const regex = /"(joy|trust|fear|surprise|sadness|disgust|anger|anticipation)"\s*:\s*([0-9]*\.?[0-9]+)/gi;
  let match = regex.exec(source);
  while (match) {
    const key = String(match[1] || '').toLowerCase();
    const value = Number(match[2]);
    if (Number.isFinite(value)) {
      weights[key] = value;
    }
    match = regex.exec(source);
  }

  if (Object.keys(weights).length === 0) return null;

  const confidenceMatch = source.match(/"confidence"\s*:\s*([0-9]*\.?[0-9]+)/i);
  const confidence = confidenceMatch ? Number(confidenceMatch[1]) : undefined;

  return {
    weights,
    confidence,
    rationale: ['extracted_from_partial_model_output'],
  };
};

const hasCompleteWeightSet = (weights) => {
  if (!weights || typeof weights !== 'object') return false;
  for (const emotionId of EMOTION_IDS_8) {
    if (!(emotionId in weights)) return false;
    const value = Number(weights[emotionId]);
    if (!Number.isFinite(value)) return false;
  }
  return true;
};

const callOpenAICompatible = async ({ endpoint, apiKey, model, prompt, maxTokens = 800 }) => {
  const base = String(endpoint || '').replace(/\/$/, '');
  const response = await fetch(`${base}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.2,
      max_tokens: maxTokens,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`emotion_ai_http_${response.status}:${errorText.slice(0, 120)}`);
  }

  const data = await response.json();
  return String(data?.choices?.[0]?.message?.content || '').trim();
};

const callGeminiNative = async ({ endpoint, apiKey, model, prompt }) => {
  const base = String(endpoint || '').replace(/\/$/, '');
  const response = await fetch(`${base}/${model}:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 700,
        candidateCount: 1,
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`emotion_ai_http_${response.status}:${errorText.slice(0, 120)}`);
  }

  const data = await response.json();
  return String(data?.candidates?.[0]?.content?.parts?.find((p) => p?.text)?.text || '').trim();
};

const getAIModelOutput = async ({
  characterText,
  allowPartialModelOutput = true,
  requireCompleteWeightSet = false,
  maxAttempts = 2,
}) => {
  await loadServerEnv(ROOT);
  const ai = await getServerTextApiConfig(ROOT);
  if (!ai || !characterText) return null;

  const prompts = [buildEmotionPrompt(characterText), buildEmotionPromptCompact(characterText)];
  let parsed = null;
  let lastRaw = '';

  for (let attempt = 0; attempt < Math.max(1, maxAttempts); attempt += 1) {
    for (const prompt of prompts) {
      let raw = '';

      if (ai.type === 'deepseek') {
        raw = await callOpenAICompatible({
          endpoint: ai.endpoint,
          apiKey: ai.apiKey,
          model: ai.model,
          prompt,
          maxTokens: 900,
        });
      } else if (ai.type === 'gemini' && ai.openaiCompatible) {
        raw = await callOpenAICompatible({
          endpoint: ai.endpoint,
          apiKey: ai.apiKey,
          model: ai.model,
          prompt,
          maxTokens: 900,
        });
      } else if (ai.type === 'gemini') {
        raw = await callGeminiNative({
          endpoint: ai.endpoint,
          apiKey: ai.apiKey,
          model: ai.model,
          prompt,
        });
      }

      lastRaw = raw;
      parsed = extractJsonObject(raw);
      if (parsed && typeof parsed === 'object') {
        const complete = hasCompleteWeightSet(parsed.weights);
        if (!requireCompleteWeightSet || complete) {
          break;
        }
      }

      if (allowPartialModelOutput) {
        const partial = extractWeightsFromText(raw);
        if (partial) {
          const complete = hasCompleteWeightSet(partial.weights);
          if (!requireCompleteWeightSet || complete) {
            parsed = partial;
            break;
          }
        }
      }
    }

    if (parsed && typeof parsed === 'object') {
      const complete = hasCompleteWeightSet(parsed.weights);
      if (!requireCompleteWeightSet || complete) {
        break;
      }
    }
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new Error(`emotion_ai_invalid_json:${String(lastRaw || '').slice(0, 160)}`);
  }

  if (requireCompleteWeightSet && !hasCompleteWeightSet(parsed.weights)) {
    throw new Error(`emotion_ai_incomplete_weights:${String(lastRaw || '').slice(0, 160)}`);
  }

  return {
    weights: parsed.weights && typeof parsed.weights === 'object' ? parsed.weights : {},
    confidence: parsed.confidence,
    rationale: Array.isArray(parsed.rationale) ? parsed.rationale : [],
  };
};

export const analyzeCharacterEmotion = ({ character, modelOutput = null } = {}) => {
  const characterText = buildCharacterText(character || {});
  const sourceHash = buildSourceHash(characterText);

  let normalizedWeights = null;
  let confidence = null;
  let rationale = null;
  let source = 'heuristic';

  if (modelOutput && typeof modelOutput === 'object' && modelOutput.weights && typeof modelOutput.weights === 'object') {
    normalizedWeights = normalizeWeights(modelOutput.weights);
    const rawConfidence = Number(modelOutput.confidence);
    confidence = Number.isFinite(rawConfidence) ? clamp01(rawConfidence) : 0.6;
    rationale = Array.isArray(modelOutput.rationale)
      ? modelOutput.rationale.map((item) => String(item || '').trim()).filter(Boolean).slice(0, 6)
      : [];
    source = 'model';
  } else {
    const inferred = inferWeightsFromText(characterText);
    normalizedWeights = normalizeWeights(inferred.weights);
    confidence = Number.isFinite(inferred.confidence) ? clamp01(inferred.confidence) : 0.6;
    rationale = inferred.rationale;
  }

  if (characterText.length < 80) {
    confidence = Math.min(confidence, 0.65);
  }

  const top3 = getTop3(normalizedWeights);

  return {
    weights: normalizedWeights,
    top3,
    confidence,
    rationale: Array.isArray(rationale) && rationale.length > 0
      ? rationale
      : ['Finished normalizing the eight-dimensional emotion weights.'],
    source,
    sourceHash,
  };
};

export const analyzeCharacterEmotionWithAI = async ({ character, options = {} } = {}) => {
  const characterText = buildCharacterText(character || {});
  if (!characterText) {
    throw new Error('emotion_ai_missing_character_text');
  }

  const modelOutput = await getAIModelOutput({
    characterText,
    allowPartialModelOutput: options.allowPartialModelOutput === true,
    requireCompleteWeightSet: options.requireCompleteWeightSet !== false,
    maxAttempts: options.maxAttempts,
  });
  if (!modelOutput) {
    throw new Error('emotion_ai_empty_model_output');
  }

  return analyzeCharacterEmotion({ character, modelOutput });
};
