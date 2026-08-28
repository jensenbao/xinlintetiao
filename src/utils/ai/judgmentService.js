import { DEBUG_CONFIG, PROMPT_TYPES, generatePrompt, getActiveAPIType } from '../../config/api.js';
import { callDeepSeekAPIHelper, callGeminiAPIHelper } from './sharedApi.js';
import { normalizeEmotionList } from '../emotionSchema.js';

const CJK_RE = /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uac00-\ud7af]/;

const ensureEnglishFeedback = (text) => {
  const normalized = String(text || '').trim();
  if (!normalized) return '';
  if (CJK_RE.test(normalized)) return '';
  return normalized;
};

export const callAIForCocktailJudgmentWithEmotionChange = async (params) => {
  const { aiConfig, trustLevel, emotionState, cocktailRecipe, dialogueHistory } = params;
  
  console.log('🍸⚡ Starting combined call: cocktail judgment + emotion change...');
  const startTime = Date.now();
  
  // 生成合并的 prompt
  const prompt = generatePrompt(PROMPT_TYPES.COCKTAIL_WITH_EMOTION, params);
  
  if (DEBUG_CONFIG.logPrompts) {
    console.log('=== Combined Cocktail+Emotion Prompt ===');
    console.log(prompt);
    console.log('========================================');
  }
  
  const response = await callGeminiAPIForCombinedJudgment(prompt);
  const result = parseCombinedJudgmentJSON(response, params);
  if (!result) {
    throw new Error('combined_judgment_invalid_json');
  }
  
  const elapsed = Date.now() - startTime;
  console.log(`✅ Combined call completed in ${elapsed}ms:`, result);
  
  return result;
};

/**
 * 专门用于合并判断的 API 调用（支持 DeepSeek 和 Gemini）
 */
const callGeminiAPIForCombinedJudgment = async (prompt) => {
  const apiType = getActiveAPIType();
  
  // 使用 DeepSeek
  if (apiType === 'deepseek') {
    const text = await callDeepSeekAPIHelper(prompt, { temperature: 0.4, max_tokens: 4096 });
    console.log('📥 Raw combined judgment response:', text);
    return text;
  }
  
  const text = await callGeminiAPIHelper(prompt, {
    temperature: 0.4,
    topK: 20,
    topP: 0.8,
    maxOutputTokens: 4096,
    candidateCount: 1,
    label: 'Gemini',
  });
  console.log('📥 Raw combined judgment response:', text);
  return text;
};

/**
 * 解析合并判断的 JSON 响应
 */
const parseCombinedJudgmentJSON = (response, params) => {
  if (!response || typeof response !== 'string') {
    return null;
  }
  
  let cleanedResponse = response.trim();
  
  // 移除 markdown 代码块标记
  const codeBlockMatch = cleanedResponse.match(/```(?:json)?\s*([\s\S]*)```/);
  if (codeBlockMatch) {
    cleanedResponse = codeBlockMatch[1].trim();
  }
  
  // 尝试解析
  try {
    const parsed = JSON.parse(cleanedResponse);
    return validateCombinedResult(parsed, params);
  } catch (e) {
    // 尝试提取 JSON 对象
    const jsonMatch = cleanedResponse.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        return validateCombinedResult(parsed, params);
      } catch (e2) {
        return null;
      }
    }
  }
  
  return null;
};

/**
 * 验证并规范化合并结果
 */
const validateCombinedResult = (parsed, params) => {
  const filterValidEmotions = (emotions) => {
    return normalizeEmotionList(emotions, { min: 0, max: 2, fallback: [] });
  };
  
  if (typeof parsed?.success !== 'boolean') return null;
  if (typeof parsed?.satisfaction !== 'number') return null;
  const feedback = ensureEnglishFeedback(parsed?.feedback);
  if (!feedback) return null;
  
  // 解析新情绪
  let newEmotions = null;
  if (parsed.newEmotions) {
    const surface = filterValidEmotions(parsed.newEmotions.surface);
    const reality = filterValidEmotions(parsed.newEmotions.reality);
    
    if (surface.length > 0 || reality.length > 0) {
      newEmotions = {
        surface,
        reality,
      };
    }
  }
  
  if (!newEmotions || newEmotions.surface.length === 0 || newEmotions.reality.length === 0) {
    return null;
  }
  
  return {
    success: parsed.success,
    satisfaction: Math.max(0, Math.min(1, parsed.satisfaction)),
    feedback,
    newEmotions,
  };
};

// ==================== 调酒判断功能 ====================

/**
 * 调用AI判断调酒是否成功
 * @param {Object} params - 包含 aiConfig, trustLevel, emotionState, cocktailRecipe, dialogueHistory
 * @returns {Object} { success: boolean, satisfaction: number, feedback: string, reason: string }
 */
export const callAIForCocktailJudgment = async (params) => {
  const { aiConfig, trustLevel, emotionState, cocktailRecipe, dialogueHistory } = params;
  
  console.log('🍸 Starting AI cocktail judgment...');
  
  const prompt = generatePrompt(PROMPT_TYPES.COCKTAIL_FEEDBACK, params);
  
  if (DEBUG_CONFIG.logPrompts) {
    console.log('=== Cocktail Judgment Prompt ===');
    console.log(prompt);
    console.log('================================');
  }
  
  const response = await callGeminiAPIForCocktailJudgment(prompt);
  const result = parseCocktailJudgmentJSON(response);
  
  if (!result) {
    throw new Error('cocktail_judgment_invalid_json');
  }

  console.log('✅ AI cocktail judgment succeeded:', result);
  return result;
};

/**
 * 专门用于调酒判断的 API 调用（支持 DeepSeek 和 Gemini）
 */
const callGeminiAPIForCocktailJudgment = async (prompt) => {
  const apiType = getActiveAPIType();
  
  // 使用 DeepSeek
  if (apiType === 'deepseek') {
    const text = await callDeepSeekAPIHelper(prompt, { temperature: 0.5, max_tokens: 4096 });
    console.log('📥 Raw cocktail judgment response:', text);
    return text;
  }
  
  const text = await callGeminiAPIHelper(prompt, {
    temperature: 0.5,
    topK: 20,
    topP: 0.8,
    maxOutputTokens: 4096,
    candidateCount: 1,
    label: 'Gemini',
  });
  console.log('📥 Raw cocktail judgment response:', text);
  return text;
};

/**
 * 解析调酒判断的 JSON 响应
 */
const parseCocktailJudgmentJSON = (response) => {
  if (!response || typeof response !== 'string') {
    return null;
  }
  
  let cleanedResponse = response.trim();
  
  // 移除 markdown 代码块标记
  const codeBlockMatch = cleanedResponse.match(/```(?:json)?\s*([\s\S]*)```/);
  if (codeBlockMatch) {
    cleanedResponse = codeBlockMatch[1].trim();
  }
  
  // 尝试直接解析
  try {
    const parsed = JSON.parse(cleanedResponse);
    return validateCocktailJudgment(parsed);
  } catch (e) {
    // 尝试提取 JSON 对象
    const jsonMatch = cleanedResponse.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        return validateCocktailJudgment(parsed);
      } catch (e2) {
        // JSON 被截断，尝试手动提取字段
        return null;
      }
    }
  }
  
  return null;
};

/**
 * 验证并规范化调酒判断结果
 */
const validateCocktailJudgment = (parsed) => {
  if (typeof parsed?.success !== 'boolean') return null;
  if (typeof parsed?.satisfaction !== 'number') return null;
  if (typeof parsed?.feedback !== 'string' || parsed.feedback.length === 0) return null;

  return {
    success: parsed.success,
    satisfaction: Math.max(0, Math.min(1, parsed.satisfaction)),
    feedback: ensureEnglishFeedback(parsed.feedback),
    reason: typeof parsed.reason === 'string' ? parsed.reason : '',
  };
};

// ==================== 情绪变化功能 ====================

/**
 * 调用AI生成顾客喝酒后的新情绪状态
 * @param {Object} params - 包含 aiConfig, currentEmotions, cocktailEmotions, wasSuccessful, dialogueHistory
 * @returns {Object} { surface: string[], reality: string[] }
 */
export const callAIForEmotionChange = async (params) => {
  const { aiConfig, currentEmotions, cocktailEmotions, wasSuccessful, dialogueHistory } = params;
  
  console.log('🎭 Starting AI emotion-change generation...');
  console.log('📊 Current emotions:', currentEmotions);
  console.log('🍸 Cocktail emotions:', cocktailEmotions);
  console.log('✅ Was successful:', wasSuccessful);
  
  const prompt = generatePrompt(PROMPT_TYPES.EMOTION_CHANGE, {
    aiConfig,
    currentEmotions,
    cocktailEmotions,
    wasSuccessful,
    dialogueHistory
  });
  
  if (DEBUG_CONFIG.logPrompts) {
    console.log('=== Emotion Change Prompt ===');
    console.log(prompt);
    console.log('=============================');
  }
  
  const response = await callGeminiAPIForEmotionChange(prompt);
  const result = parseEmotionChangeJSON(response);
  
  if (!result) {
    throw new Error('emotion_change_invalid_json');
  }

  console.log('✅ AI emotion change generated successfully:', result);
  return result;
};

/**
 * 专门用于情绪变化的 API 调用（支持 DeepSeek 和 Gemini）
 */
const callGeminiAPIForEmotionChange = async (prompt) => {
  const apiType = getActiveAPIType();
  
  // 使用 DeepSeek
  if (apiType === 'deepseek') {
    const text = await callDeepSeekAPIHelper(prompt, { temperature: 0.4, max_tokens: 4096 });
    console.log('📥 Raw emotion-change response:', text);
    return text;
  }
  
  const text = await callGeminiAPIHelper(prompt, {
    temperature: 0.4,
    topK: 20,
    topP: 0.8,
    maxOutputTokens: 4096,
    candidateCount: 1,
    label: 'Gemini',
  });
  console.log('📥 Raw emotion-change response:', text);
  return text;
};

/**
 * 解析情绪变化的 JSON 响应
 */
const parseEmotionChangeJSON = (response) => {
  if (!response || typeof response !== 'string') {
    return null;
  }
  
  let cleanedResponse = response.trim();
  
  // 移除 markdown 代码块标记
  const codeBlockMatch = cleanedResponse.match(/```(?:json)?\s*([\s\S]*)```/);
  if (codeBlockMatch) {
    cleanedResponse = codeBlockMatch[1].trim();
  }
  
  // 尝试直接解析
  try {
    const parsed = JSON.parse(cleanedResponse);
    return validateEmotionChangeResult(parsed);
  } catch (e) {
    // 尝试提取 JSON 对象
    const jsonMatch = cleanedResponse.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        return validateEmotionChangeResult(parsed);
      } catch (e2) {
        console.log('⚠️ Emotion-change JSON parsing failed');
        return null;
      }
    }
  }
  
  return null;
};

/**
 * 验证并规范化情绪变化结果
 */
const validateEmotionChangeResult = (parsed) => {
  const surface = normalizeEmotionList(parsed.surface, { min: 0, max: 1, fallback: [] });
  const reality = normalizeEmotionList(parsed.reality, { min: 0, max: 2, fallback: [] });
  
  // 确保至少有一个情绪
  if (surface.length === 0 && reality.length === 0) {
    return null;
  }
  
  return {
    surface,
    reality,
  };
};

// ==================== 对话信任度判断功能 ====================

/**
 * 调用AI判断对话是否影响信任度
 * @param {Object} params - 包含 aiConfig, trustLevel, emotionState, playerInput, dialogueHistory
 * @returns {Object} { change: number, reason: string }
 */
export const callAIForTrustJudgment = async (params) => {
  const { aiConfig, trustLevel, emotionState, playerInput, dialogueHistory } = params;
  
  console.log('💬 Starting AI trust judgment for dialogue...');
  console.log('📝 Player input:', playerInput);
  console.log('📊 Current trust level:', trustLevel);
  
  const prompt = generatePrompt(PROMPT_TYPES.TRUST_JUDGMENT, {
    aiConfig,
    trustLevel,
    emotionState,
    playerInput,
    dialogueHistory
  });
  
  if (DEBUG_CONFIG.logPrompts) {
    console.log('=== Trust Judgment Prompt ===');
    console.log(prompt);
    console.log('=============================');
  }
  
  const response = await callGeminiAPIForTrustJudgment(prompt);
  const result = parseTrustJudgmentJSON(response);
  
  if (!result) {
    throw new Error('trust_judgment_invalid_json');
  }

  console.log('✅ AI trust judgment succeeded:', result);
  return result;
};

/**
 * 专门用于信任度判断的 API 调用（支持 DeepSeek 和 Gemini）
 */
const callGeminiAPIForTrustJudgment = async (prompt) => {
  const apiType = getActiveAPIType();
  
  // 使用 DeepSeek
  if (apiType === 'deepseek') {
    const text = await callDeepSeekAPIHelper(prompt, { temperature: 0.3, max_tokens: 2048 });
    console.log('📥 Raw trust-judgment response:', text);
    return text;
  }
  
  const text = await callGeminiAPIHelper(prompt, {
    temperature: 0.3,
    topK: 15,
    topP: 0.7,
    maxOutputTokens: 2048,
    candidateCount: 1,
    label: 'Gemini',
  });
  console.log('📥 Raw trust-judgment response:', text);
  return text;
};

/**
 * 解析信任度判断的 JSON 响应
 */
const parseTrustJudgmentJSON = (response) => {
  if (!response || typeof response !== 'string') {
    return null;
  }
  
  let cleanedResponse = response.trim();
  
  // 移除 markdown 代码块标记
  const codeBlockMatch = cleanedResponse.match(/```(?:json)?\s*([\s\S]*)```/);
  if (codeBlockMatch) {
    cleanedResponse = codeBlockMatch[1].trim();
  }
  
  // 尝试直接解析
  try {
    const parsed = JSON.parse(cleanedResponse);
    return validateTrustJudgmentResult(parsed);
  } catch (e) {
    // 尝试提取 JSON 对象
    const jsonMatch = cleanedResponse.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        return validateTrustJudgmentResult(parsed);
      } catch (e2) {
        // JSON不完整，尝试修复
        return null;
      }
    }

    return null;
  }
};

/**
 * 验证并规范化信任度判断结果
 */
const validateTrustJudgmentResult = (parsed) => {
  if (typeof parsed?.change !== 'number') return null;
  
  let change = Math.max(-0.15, Math.min(0.15, parsed.change));
  
  if (typeof parsed?.reason !== 'string' || parsed.reason.length === 0) return null;
  
  return {
    change,
    reason: parsed.reason
  };
};

// 生成快捷追问选项
