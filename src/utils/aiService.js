// AI对话API服务
import { API_CONFIG, getActiveAPIType, generatePrompt, PROMPT_TYPES, DEBUG_CONFIG } from '../config/api.js';

export {
  generateCustomer,
  generateCustomerFromCharacterId,
  generateCustomerWithCharacterPool,
  generateDailyCustomers,
} from './ai/customerGeneration.js';
export { generateDailyAtmosphere } from './ai/atmosphereGeneration.js';
export { generateBarEvent } from './ai/eventGeneration.js';

/**
 * 🆕 后处理：去除 AI 回复中的动作描写/旁白，只保留台词
 * 策略：
 * 1. 如果回复中有引号包裹的内容，提取引号内的台词
 * 2. 去除常见的动作描写前缀（如"她轻叹一声，"）
 */
const stripNarration = (text) => {
  if (!text) return text;

  // 策略1：如果有中文引号包裹的台词，提取引号内容
  // 匹配 "..." 或 「...」
  const quoteMatches = text.match(/["\u201c]([^"\u201d]+)["\u201d]/g);
  if (quoteMatches && quoteMatches.length > 0) {
    // 提取所有引号内的内容
    const dialogues = quoteMatches
      .map(q => q.replace(/["\u201c\u201d]/g, '').trim())
      .filter(d => d.length > 0);
    if (dialogues.length > 0 && dialogues.join('').length > 5) {
      return dialogues.join('');
    }
  }

  // 策略2：去除开头的动作描写
  // 匹配模式：中文名字/代词 + 动作描写 + 逗号/句号，然后才是台词
  const narrationPrefix = /^[\u4e00-\u9fff·]{1,8}(?:轻轻|微微|缓缓|默默|静静|悄悄)?(?:地)?(?:叹了口气|轻叹|叹息|低头|抬头|望向|看着|目光|微笑|苦笑|摇头|点头|沉默|停顿|放下|拿起|转身|靠|坐|站|笑了笑|眯起眼|低声|抿嘴|咬唇|皱眉|耸肩|摆手|挥手|揉|捏|握|攥|垂|拢)[^。！？…]*[，,。\.]\s*/;
  let cleaned = text.replace(narrationPrefix, '');

  // 如果几乎全被清掉了，返回原文
  if (cleaned.length < 5) return text;

  return cleaned;
};

const CJK_RE = /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uac00-\ud7af]/;
const MAX_DIALOGUE_CHARS = 420;

const ensureEnglishOnlyDialogue = (text) => {
  const normalized = String(text || '').trim();
  if (!normalized) return 'I need a moment to find the right words.';
  if (CJK_RE.test(normalized)) {
    return 'I need a moment to find the right words.';
  }
  return normalized;
};

const clampDialogueLength = (text, { preferEllipsis = false } = {}) => {
  const normalized = String(text || '').trim();
  if (normalized.length <= MAX_DIALOGUE_CHARS) {
    return normalized;
  }

  const sliced = normalized.slice(0, MAX_DIALOGUE_CHARS);
  const lastSentenceEnd = Math.max(
    sliced.lastIndexOf('.'),
    sliced.lastIndexOf('!'),
    sliced.lastIndexOf('?'),
    sliced.lastIndexOf('…')
  );
  const safeCut = lastSentenceEnd > 180 ? sliced.slice(0, lastSentenceEnd + 1) : sliced;
  const finalText = safeCut.trim().replace(/[.!?…]+$/g, '');
  return `${finalText}${preferEllipsis ? '...' : '.'}`;
};

const finalizeDialogueText = (text, { preferEllipsis = false } = {}) => {
  let normalized = String(text || '').trim();
  normalized = normalized.replace(/^(我说|我回答|林澈说|林澈|苏瑾说|苏瑾|小夏说|小夏|我：|回复：|["“])\s*/g, '');
  normalized = normalized.replace(/["”]$/g, '');
  normalized = normalized.replace(/\*+([^*]+)\*+/g, '$1');
  normalized = stripNarration(normalized).trim();
  normalized = ensureEnglishOnlyDialogue(normalized);
  normalized = clampDialogueLength(normalized, { preferEllipsis });

  if (!/[.!?…]$/.test(normalized)) {
    normalized += preferEllipsis ? '...' : '.';
  }

  return normalized;
};

// 调用AI API（支持流式响应）
// onStreamChunk: (fullText, newChunk) => void - 可选的流式回调函数
export const callAIAPI = async (type, params, onStreamChunk = null) => {
  const apiType = getActiveAPIType();
  const prompt = generatePrompt(type, params);

  if (apiType === 'none') {
    throw new Error('No available API key is configured. Please update .env.local first.');
  }
  
  if (DEBUG_CONFIG.logPrompts) {
    console.log('=== AI Prompt ===');
    console.log('Type:', type);
    console.log('API Type:', apiType);
    console.log('Streaming:', !!onStreamChunk);
    console.log('Prompt:', prompt);
    console.log('================');
  }
  
  try {
    if (apiType === 'deepseek') {
      // DeepSeek API（支持流式）
      return await callDeepSeekAPI(prompt, onStreamChunk);
    } else if (apiType === 'gemini') {
      // Google Gemini API（支持流式）
      return await callGeminiAPI(prompt, onStreamChunk);
    } else if (apiType === 'xunfei') {
      // Xunfei Spark API
      return await callXunfeiAPI(prompt);
    } else if (apiType === 'baidu') {
      // Baidu ERNIE API
      return await callBaiduAPI(prompt);
    }
  } catch (error) {
    console.error('AI API call failed:', error);
    throw error;
  }
};

// DeepSeek API调用（支持流式响应）
const callDeepSeekAPI = async (prompt, onStreamChunk = null) => {
  const config = API_CONFIG.deepseek;
  
  try {
    // 如果提供了流式回调，使用流式API
    if (onStreamChunk) {
      return await callDeepSeekAPIStreaming(prompt, onStreamChunk);
    }
    
    console.log('DeepSeek API request started');
    console.log('Prompt length:', prompt.length, 'characters');
    
    const response = await fetch(config.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`
      },
      body: JSON.stringify({
        model: config.model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.75,
        max_tokens: 4096
      })
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('DeepSeek API error:', errorData);
      throw new Error(`DeepSeek API request failed: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    
    if (DEBUG_CONFIG.logPrompts) {
      console.log('=== DeepSeek Response ===');
      console.log('Full Response:', data);
      if (data.usage) {
        console.log('Token usage:', data.usage);
      }
      console.log('========================');
    }

    // 提取回应文本
    if (data.choices && data.choices.length > 0) {
      let text = data.choices[0].message?.content || '';
      console.log('DeepSeek raw response:', text);

      text = finalizeDialogueText(text);
      console.log('Final response:', text);

      if (!text || text.trim().length === 0) {
        throw new Error('API returned empty content');
      }

      return text;
    }
    
    console.error('Unexpected response format:', data);
    throw new Error('DeepSeek returned an invalid response format');
  } catch (error) {
    console.error('DeepSeek API request failed:', error);
    throw error;
  }
};

// DeepSeek 流式API调用
const callDeepSeekAPIStreaming = async (prompt, onStreamChunk) => {
  const config = API_CONFIG.deepseek;
  
  console.log('DeepSeek streaming API request started');
  console.log('Prompt length:', prompt.length, 'characters');
  
  const response = await fetch(config.endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`
    },
    body: JSON.stringify({
      model: config.model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.75,
      max_tokens: 4096,
      stream: true
    })
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    console.error('DeepSeek streaming API error:', errorText);
    throw new Error(`DeepSeek API request failed: ${response.status}`);
  }
  
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let fullText = '';
  let buffer = '';
  
  try {
    while (true) {
      const { done, value } = await reader.read();
      
      if (done) {
        console.log('Streaming response completed, total length:', fullText.length);
        break;
      }
      
      // 解码并添加到缓冲区
      buffer += decoder.decode(value, { stream: true });
      
      // 处理SSE格式的数据（以 "data: " 开头的行）
      const lines = buffer.split('\n');
      buffer = lines.pop() || ''; // 保留不完整的行
      
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const jsonStr = line.slice(6).trim();
          if (jsonStr && jsonStr !== '[DONE]') {
            try {
              const data = JSON.parse(jsonStr);
              if (data.choices?.[0]?.delta?.content) {
                const chunk = data.choices[0].delta.content;
                fullText += chunk;
                
                // 调用回调函数，传递当前累积的文本
                if (onStreamChunk) {
                  onStreamChunk(fullText, chunk);
                }
              }
            } catch (e) {
              // 忽略解析错误，可能是不完整的JSON
            }
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
  
  let text = finalizeDialogueText(fullText);
  
  console.log('Final streaming response:', text);
  return text;
};

// Google Gemini API调用（支持流式响应）
const callGeminiAPI = async (prompt, onStreamChunk = null) => {
  const config = API_CONFIG.gemini;
  try {
    if (config.openaiCompatible) {
      return await callGeminiViaOpenAICompatible(prompt, onStreamChunk);
    }

    // 如果提供了流式回调，使用流式API
    if (onStreamChunk) {
      return await callGeminiAPIStreaming(prompt, onStreamChunk);
    }

    const url = `${config.endpoint}/${config.model}:generateContent?key=${config.apiKey}`;

    console.log('Gemini API request started');
    console.log('Prompt length:', prompt.length, 'characters');

    const requestBody = {
      contents: [{
        parts: [{
          text: prompt
        }]
      }],
      generationConfig: {
        temperature: 0.75,
        topK: 30,
        topP: 0.88,
        maxOutputTokens: 4096,
        candidateCount: 1,
        thinkingConfig: { thinkingBudget: 0 }
      }
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      cache: 'no-store',
      body: JSON.stringify(requestBody)
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      console.error('Gemini API error:', errorData);
      throw new Error(`Gemini API request failed: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    
    if (DEBUG_CONFIG.logPrompts) {
      console.log('=== Gemini Response ===');
      console.log('Full Response:', data);
      if (data.usageMetadata) {
        console.log('Token usage:', data.usageMetadata);
      }
      console.log('=====================');
    }
    
    // 提取回应文本
    if (data.candidates && data.candidates.length > 0) {
      const candidate = data.candidates[0];
      
      // 检查截断原因
      console.log('Dialogue finishReason:', candidate.finishReason);
      
      // 检查是否被安全过滤阻止
      if (candidate.finishReason === 'SAFETY') {
        console.warn('Response was blocked by safety filters');
        console.log('Safety ratings:', candidate.safetyRatings);
        throw new Error('The response was blocked by safety filters. Try adjusting the prompt.');
      }
      
      // 检查是否因token限制被截断
      if (candidate.finishReason === 'MAX_TOKENS') {
        console.warn('Dialogue response was truncated by the token limit');
      }
      
      if (candidate.content && candidate.content.parts && candidate.content.parts.length > 0) {
        let text = candidate.content.parts[0].text;
        console.log('Gemini raw response:', text);
        
        text = text.trim();
        
        // 检查句子是否完整
        const hasProperEnding = /[。！？.!?]$/.test(text);
        
        if (!hasProperEnding) {
          console.warn('Detected an incomplete sentence:', text);
          
          // 扩展的不完整词列表
          const incompleteWords = [
            '还', '有', '很', '的', '地', '得',
            '下的', '中的', '上的', '时的',
            '让', '使', '而', '但', '却',
            '感觉', '觉得', '认为', '希望',
            '口感', '味道', '氛围',
          ];
          
          // 检查是否以不完整词结尾
          let isIncomplete = incompleteWords.some(word => {
            return text.endsWith(word) || text.endsWith(word + '。');
          });
          
          if (isIncomplete) {
            console.log('Detected a common incomplete pattern, attempting repair...');
            
            // 找到最后一个句号或逗号之前的内容
            const lastPeriod = text.lastIndexOf('。');
            const lastComma = text.lastIndexOf('，');
            
            if (lastPeriod > 0) {
              // 有完整句子，直接截取到句号
              text = text.substring(0, lastPeriod + 1);
              console.log('Trimmed to the previous sentence ending');
            } else if (lastComma > text.length * 0.3) {
              // 有逗号且位置合理，截取到逗号前加句号
              text = text.substring(0, lastComma) + '。';
              console.log('Trimmed to the previous comma position');
            } else {
              // 找不到合适的截断点，删除不完整的词
              for (const word of incompleteWords) {
                if (text.endsWith(word)) {
                  // 移除不完整词，查找前面的字
                  const withoutWord = text.substring(0, text.length - word.length).trim();
                  // 如果移除后还有内容，并且以有效字符结尾
                  if (withoutWord.length > 5 && /[\u4e00-\u9fa5a-zA-Z]$/.test(withoutWord)) {
                    text = withoutWord + '.';
                    console.log('Removed incomplete ending and added a period');
                    break;
                  }
                }
              }
            }
          } else {
            // 没有检测到特定不完整词，说明句子本身是完整的，只是缺少标点
            // 直接添加省略号或句号，保留原始内容
            const lastChar = text[text.length - 1];
            
            // 如果以逗号结尾，可能是省略效果
            if (lastChar === '，' || lastChar === ',') {
              text = text.substring(0, text.length - 1) + '……';
              console.log('Converted trailing comma to ellipsis');
            } else if (/[\u4e00-\u9fa5a-zA-Z0-9]/.test(lastChar)) {
              // 以正常字符结尾，添加省略号表示未尽之意
              text = text + '……';
              console.log('Added ellipsis');
            } else {
              text = text + '.';
              console.log('Added period');
            }
          }
        }
        
        text = finalizeDialogueText(text, { preferEllipsis: true });
        
        console.log('Final response:', text);
        
        if (!text || text.trim().length === 0) {
          throw new Error('API returned empty content');
        }
        
        return text;
      }
    }
    
    console.error('Unexpected response format:', data);
    throw new Error('Gemini returned an invalid response format');
  } catch (error) {
    console.error('Gemini API request failed:', error);
    throw error;
  }
};

const callGeminiViaOpenAICompatible = async (prompt, onStreamChunk = null) => {
  const config = API_CONFIG.gemini;
  const endpoint = String(config.endpoint || '').replace(/\/$/, '');
  const url = `${endpoint}/chat/completions`;

  if (onStreamChunk) {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.75,
        max_tokens: 4096,
        frequency_penalty: 0.4,
        presence_penalty: 0.2,
        stream: true,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gemini (OpenAI-compatible) request failed: ${response.status} ${errorText}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullText = '';
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const payload = line.slice(6).trim();
          if (!payload || payload === '[DONE]') continue;
          try {
            const data = JSON.parse(payload);
            const chunk = data?.choices?.[0]?.delta?.content || '';
            if (!chunk) continue;
            fullText += chunk;
            onStreamChunk(fullText, chunk);
          } catch {
            // ignore parse errors
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    return finalizeDialogueText(fullText);
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.75,
      max_tokens: 4096,
      frequency_penalty: 0.4,
      presence_penalty: 0.2,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini (OpenAI-compatible) request failed: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  let text = data?.choices?.[0]?.message?.content || '';
  text = finalizeDialogueText(text);
  if (!text) throw new Error('Gemini (OpenAI-compatible) returned empty content');
  return text;
};

// Google Gemini 流式API调用
const callGeminiAPIStreaming = async (prompt, onStreamChunk) => {
  const config = API_CONFIG.gemini;
  const url = `${config.endpoint}/${config.model}:streamGenerateContent?key=${config.apiKey}&alt=sse`;

  console.log('Gemini streaming API request started');
  console.log('Prompt length:', prompt.length, 'characters');

  const requestBody = {
    contents: [{
      parts: [{
        text: prompt
      }]
    }],
    generationConfig: {
      temperature: 0.75,
      topK: 30,
      topP: 0.88,
      maxOutputTokens: 4096,
      candidateCount: 1,
      thinkingConfig: { thinkingBudget: 0 }
    }
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(requestBody)
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    console.error('Gemini streaming API error:', errorText);
    throw new Error(`Gemini API request failed: ${response.status}`);
  }
  
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let fullText = '';
  let buffer = '';
  
  try {
    while (true) {
      const { done, value } = await reader.read();
      
      if (done) {
        console.log('Streaming response completed, total length:', fullText.length);
        break;
      }
      
      // 解码并添加到缓冲区
      buffer += decoder.decode(value, { stream: true });
      
      // 处理SSE格式的数据（以 "data: " 开头的行）
      const lines = buffer.split('\n');
      buffer = lines.pop() || ''; // 保留不完整的行
      
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const jsonStr = line.slice(6).trim();
          if (jsonStr && jsonStr !== '[DONE]') {
            try {
              const data = JSON.parse(jsonStr);
              if (data.candidates?.[0]?.content?.parts?.[0]?.text) {
                const chunk = data.candidates[0].content.parts[0].text;
                fullText += chunk;
                
                // 调用回调函数，传递当前累积的文本
                if (onStreamChunk) {
                  onStreamChunk(fullText, chunk);
                }
              }
            } catch (e) {
              // 忽略解析错误，可能是不完整的JSON
            }
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
  
  let text = finalizeDialogueText(fullText);
  
  console.log('Final streaming response:', text);
  return text;
};

// 讯飞星火API调用（WebSocket）
const callXunfeiAPI = async (prompt) => {
  // TODO: 实现讯飞星火API调用
  // 这里需要WebSocket连接和签名验证
  console.warn('Xunfei Spark API is not implemented yet');
  throw new Error('xunfei_api_not_implemented');
};

// 百度文心一言API调用
const callBaiduAPI = async (prompt) => {
  const config = API_CONFIG.baidu;
  
  try {
    // 1. 获取access_token
    const tokenResponse = await fetch(
      `https://aip.baidubce.com/oauth/2.0/token?grant_type=client_credentials&client_id=${config.apiKey}&client_secret=${config.secretKey}`,
      { method: 'POST' }
    );
    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;
    
    // 2. 调用对话API
    const response = await fetch(
      `${config.endpoint}?access_token=${accessToken}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          messages: [
            { role: 'user', content: prompt }
          ]
        })
      }
    );
    
    const data = await response.json();
    return data.result || '...';
  } catch (error) {
    console.error('Baidu API request failed:', error);
    throw error;
  }
};

export {
  callAIForCocktailJudgmentWithEmotionChange,
  callAIForCocktailJudgment,
  callAIForEmotionChange,
  callAIForTrustJudgment,
} from './ai/judgmentService.js';
export { generateQuickOptions } from './ai/quickOptions.js';
