import { API_CONFIG } from '../../config/api.js';

export const callDeepSeekAPIHelper = async (prompt, options = {}) => {
  const config = API_CONFIG.deepseek;

  const response = await fetch(config.endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`
    },
    body: JSON.stringify({
      model: config.model,
      messages: [{ role: 'user', content: prompt }],
      temperature: options.temperature || 0.7,
      max_tokens: options.max_tokens || 4096
    })
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    console.error('❌ DeepSeek API error:', errorData);
    throw new Error(`DeepSeek API request failed: ${response.status}`);
  }

  const data = await response.json();

  if (data.choices && data.choices.length > 0) {
    return data.choices[0].message?.content || '';
  }

  throw new Error('DeepSeek returned an unexpected response format');
};

export const callGeminiAPIHelper = async (prompt, options = {}) => {
  const config = API_CONFIG.gemini;

  if (!config.enabled) {
    throw new Error('No API provider is enabled');
  }

  const {
    temperature = 0.7,
    topK = 30,
    topP = 0.88,
    maxOutputTokens = 4096,
    candidateCount = 1,
    frequencyPenalty = 0.4,
    presencePenalty = 0.2,
    label = 'Gemini',
  } = options;

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
        temperature,
        max_tokens: maxOutputTokens,
        frequency_penalty: frequencyPenalty,
        presence_penalty: presencePenalty,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`${label} (OpenAI-compatible) request failed: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    const text = data?.choices?.[0]?.message?.content;
    if (!text) {
      throw new Error(`${label} (OpenAI-compatible) returned an unexpected response format`);
    }

    return String(text);
  }

  const url = `${config.endpoint}/${config.model}:generateContent?key=${config.apiKey}`;
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
        temperature,
        topK,
        topP,
        maxOutputTokens,
        candidateCount,
      },
    }),
  });

  if (!response.ok) {
    const raw = await response.text();
    let errorData = raw;
    try {
      errorData = raw ? JSON.parse(raw) : { message: 'empty_error_body' };
    } catch {
      // Keep raw text when body is not valid JSON.
    }
    console.error(`❌ ${label} API error:`, errorData);
    throw new Error(`${label} API request failed: ${response.status}`);
  }

  const data = await response.json();
  const parts = data?.candidates?.[0]?.content?.parts;
  if (Array.isArray(parts)) {
    for (let i = parts.length - 1; i >= 0; i--) {
      if (parts[i]?.text !== undefined && parts[i]?.text !== null) {
        return String(parts[i].text);
      }
    }
  }

  throw new Error(`${label} returned an unexpected response format`);
};
