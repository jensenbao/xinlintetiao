import {
  DEBUG_CONFIG,
  PROMPT_TYPES,
  generatePrompt,
  getActiveAPIType,
} from '../../config/api.js';
import { normalizeEmotionList } from '../emotionSchema.js';
import { extractCleanJSON, tryRepairTruncatedJSON } from './jsonUtils.js';
import { callDeepSeekAPIHelper, callGeminiAPIHelper } from './sharedApi.js';

export const generateDailyAtmosphere = async (day, recentAtmospheres = [], recentCrossroadsSummaries = []) => {
  console.log(`Starting atmosphere generation for day ${day}...`);
  const prompt = generatePrompt(PROMPT_TYPES.GENERATE_ATMOSPHERE, {
    day,
    recentAtmospheres,
    recentCrossroadsSummaries,
  });

  if (DEBUG_CONFIG.logPrompts) {
    console.log('=== Atmosphere Prompt ===');
    console.log(prompt);
    console.log('========================');
  }

  const response = await callGeminiAPIForAtmosphere(prompt);
  const result = parseAtmosphereJSON(response);
  if (!result) {
    throw new Error('atmosphere_invalid_json');
  }

  console.log('Atmosphere generated successfully:', result.weather, result.lighting);
  return result;
};

const callGeminiAPIForAtmosphere = async (prompt) => {
  const apiType = getActiveAPIType();

  if (apiType === 'deepseek') {
    const text = await callDeepSeekAPIHelper(prompt, { temperature: 0.8, max_tokens: 4096 });
    console.log('Atmosphere raw response:', text.substring(0, 200));
    return text;
  }

  const text = await callGeminiAPIHelper(prompt, {
    temperature: 0.8,
    topK: 35,
    topP: 0.9,
    maxOutputTokens: 4096,
    candidateCount: 1,
    label: 'Gemini',
  });
  console.log('Atmosphere raw response:', text.substring(0, 200));
  return text;
};

const parseAtmosphereJSON = (response) => {
  if (!response || typeof response !== 'string') {
    console.warn('Atmosphere response is empty or not a string');
    return null;
  }

  console.log('Parsing atmosphere JSON, raw length:', response.length);

  const cleaned = extractCleanJSON(response);
  if (!cleaned) return null;

  try {
    const parsed = JSON.parse(cleaned);
    return validateAtmosphere(parsed);
  } catch (e) {
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        return validateAtmosphere(parsed);
      } catch (e2) {
        console.log('JSON is incomplete, attempting repair...');
        const repaired = tryRepairTruncatedJSON(jsonMatch[0]);
        if (repaired) {
          console.log('JSON repaired successfully');
          return validateAtmosphere(repaired);
        }
      }
    }

    const jsonStart = cleaned.match(/\{[\s\S]*/);
    if (jsonStart) {
      const repaired = tryRepairTruncatedJSON(jsonStart[0]);
      if (repaired) {
        console.log('Successfully repaired JSON from truncated text');
        return validateAtmosphere(repaired);
      }
    }

    console.error('Atmosphere JSON parsing failed after all recovery attempts');
    console.error('Raw content:', cleaned.substring(0, 300));
  }
  return null;
};

const validateAtmosphere = (parsed) => {
  const validWeathers = ['clear', 'rainy', 'stormy', 'foggy', 'snowy', 'heatwave'];
  const validTimesOfDay = ['evening', 'night', 'late_night', 'dawn'];
  const validLighting = ['bright', 'dim_warm', 'neon', 'candlelight', 'flickering'];
  const validMusic = ['jazz_slow', 'electronic', 'classical', 'silence', 'lo_fi'];
  const validCrowdLevels = ['empty', 'sparse', 'moderate', 'crowded'];
  if (!validWeathers.includes(parsed?.weather)) return null;
  if (!validTimesOfDay.includes(parsed?.timeOfDay)) return null;
  if (!validLighting.includes(parsed?.lighting)) return null;
  if (!validMusic.includes(parsed?.music)) return null;
  if (!validCrowdLevels.includes(parsed?.crowdLevel)) return null;

  const modifiers = parsed.modifiers || {};
  const trustBonus = typeof modifiers.trustBonus === 'number'
    ? Math.max(-0.03, Math.min(0.05, modifiers.trustBonus))
    : 0;

  const emotionBias = normalizeEmotionList(modifiers.emotionBias, {
    min: 1,
    max: 2,
    fallback: ['trust'],
  });

  const targetShift = modifiers.targetShift || {};
  const clampShift = (value) => typeof value === 'number' ? Math.max(-1, Math.min(1, Math.round(value))) : 0;

  const customerCountMod = typeof modifiers.customerCountMod === 'number'
    ? Math.max(-2, Math.min(3, Math.round(modifiers.customerCountMod)))
    : 0;

  return {
    weather: parsed.weather,
    timeOfDay: parsed.timeOfDay,
    season: parsed.season || 'autumn',
    lighting: parsed.lighting,
    music: parsed.music,
    crowdLevel: parsed.crowdLevel,
    scent: typeof parsed.scent === 'string' ? parsed.scent : '',
    narrative: typeof parsed.narrative === 'string' ? parsed.narrative : 'The bar feels especially quiet tonight.',
    modifiers: {
      trustBonus,
      emotionBias,
      targetShift: {
        thickness: clampShift(targetShift.thickness),
        sweetness: clampShift(targetShift.sweetness),
        strength: clampShift(targetShift.strength),
      },
      customerCountMod,
    },
  };
};
