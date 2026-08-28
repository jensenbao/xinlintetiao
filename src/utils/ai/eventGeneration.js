import {
  DEBUG_CONFIG,
  PROMPT_TYPES,
  generatePrompt,
  getActiveAPIType,
} from '../../config/api.js';
import { extractCleanJSON, tryRepairTruncatedJSON } from './jsonUtils.js';
import { callDeepSeekAPIHelper, callGeminiAPIHelper } from './sharedApi.js';

export const generateBarEvent = async (context) => {
  console.log('⚡ Starting AI event generation...');
  const prompt = generatePrompt(PROMPT_TYPES.GENERATE_EVENT, context);

  if (DEBUG_CONFIG.logPrompts) {
    console.log('=== Event Prompt ===');
    console.log(prompt);
    console.log('====================');
  }

  const response = await callGeminiAPIForEvent(prompt);
  const result = parseEventJSON(response);

  if (!result) {
    throw new Error('event_invalid_json');
  }

  console.log('✅ Event generated successfully:', result.type);
  return result;
};

const callGeminiAPIForEvent = async (prompt) => {
  const apiType = getActiveAPIType();

  if (apiType === 'deepseek') {
    const text = await callDeepSeekAPIHelper(prompt, { temperature: 0.85, max_tokens: 4096 });
    console.log('📥 Raw event generation response:', text);
    return text;
  }

  const text = await callGeminiAPIHelper(prompt, {
    temperature: 0.85,
    topK: 35,
    topP: 0.9,
    maxOutputTokens: 4096,
    candidateCount: 1,
    label: 'Gemini',
  });
  console.log('📥 Raw event generation response:', text);
  return text;
};

const parseEventJSON = (response) => {
  if (!response || typeof response !== 'string') {
    console.warn('⚠️ Event response is empty or not a string:', response);
    return null;
  }

  console.log('🔍 Parsing event JSON, raw length:', response.length);

  const cleaned = extractCleanJSON(response);
  if (!cleaned) return null;

  try {
    const parsed = JSON.parse(cleaned);
    return validateEvent(parsed);
  } catch (e) {
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        return validateEvent(parsed);
      } catch (e2) {
        console.log('⚠️ Event JSON is incomplete, attempting repair...');
        const repaired = tryRepairTruncatedJSON(jsonMatch[0]);
        if (repaired) {
          console.log('✅ Event JSON repaired successfully');
          return validateEvent(repaired);
        }
      }
    }

    const jsonStart = cleaned.match(/\{[\s\S]*/);
    if (jsonStart) {
      const repaired = tryRepairTruncatedJSON(jsonStart[0]);
      if (repaired) {
        console.log('✅ Successfully repaired event JSON from truncated text');
        return validateEvent(repaired);
      }
    }

    console.error('❌ Event JSON parsing failed after all recovery attempts');
    console.error('📄 Raw content:', cleaned.substring(0, 300));
  }
  return null;
};

const validateEvent = (parsed) => {
  const validTypes = ['atmosphere', 'customer', 'challenge', 'reward', 'narrative'];
  const validDurations = ['immediate', 'current_customer', 'rest_of_day'];

  if (!validTypes.includes(parsed?.type)) return null;
  if (!validDurations.includes(parsed?.duration)) return null;
  if (typeof parsed?.narrative !== 'string' || parsed.narrative.length === 0) return null;

  const effects = parsed.effects || {};
  const validatedEffects = {
    atmosphereChange: effects.atmosphereChange || null,
    trustModifier: typeof effects.trustModifier === 'number'
      ? Math.max(-0.1, Math.min(0.1, effects.trustModifier))
      : 0,
    emotionShift: Array.isArray(effects.emotionShift) ? effects.emotionShift : null,
    itemRestriction: effects.itemRestriction || null,
    bonusReward: effects.bonusReward || null,
  };

  let choices = [];
  if (Array.isArray(parsed.choices)) {
    choices = parsed.choices.slice(0, 2).map((choice) => ({
      text: typeof choice.text === 'string' ? choice.text : 'Continue',
      effect: choice.effect || {},
    }));
  }

  return {
    type: parsed.type,
    narrative: parsed.narrative,
    effects: validatedEffects,
    duration: parsed.duration,
    choices,
  };
};
