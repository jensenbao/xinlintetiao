export const normalizeApiKey = (raw) => {
  const value = String(raw || '').trim();
  if (!value) return '';

  const lower = value.toLowerCase();
  if (lower === 'your api key' || lower === 'your_api_key' || lower === 'your-api-key') {
    return '';
  }

  return value;
};

export const isOpenAICompatibleEndpoint = (endpoint) => {
  const value = String(endpoint || '').trim().toLowerCase();
  if (!value) return false;
  return value.includes('/v1') || value.includes('api.302.ai');
};

const readValue = (source, key) => String(source?.[key] ?? '').trim();

const pickConfiguredValue = ({ localFirst = false, localValue = '', envValue = '', fallback = '' }) => {
  if (localFirst) return String(localValue || envValue || fallback).trim();
  return String(envValue || localValue || fallback).trim();
};

export const buildRuntimeApiConfig = ({ env = {}, localApiKeys = null } = {}) => {
  const local = localApiKeys || {};

  const localDeepseekApiKey = normalizeApiKey(local?.deepseek?.apiKey);
  const localGeminiApiKey = normalizeApiKey(local?.gemini?.apiKey);
  const envDeepseekApiKey = normalizeApiKey(readValue(env, 'VITE_DEEPSEEK_API_KEY'));
  const envGeminiApiKey = normalizeApiKey(readValue(env, 'VITE_GEMINI_API_KEY'));
  const openrouterApiKey = normalizeApiKey(
    readValue(env, 'VITE_OPENROUTER_API_KEY') || readValue(env, 'OPENROUTER_API_KEY')
  );

  const deepseekApiKey = localDeepseekApiKey || envDeepseekApiKey;
  const geminiApiKey = localGeminiApiKey || envGeminiApiKey;
  const preferLocalDeepseekConfig = Boolean(localDeepseekApiKey);
  const preferLocalGeminiConfig = Boolean(localGeminiApiKey);

  const requestedProvider = String(
    local?.provider || readValue(env, 'VITE_AI_PROVIDER')
  ).trim().toLowerCase();

  const deepseekModel = pickConfiguredValue({
    localFirst: preferLocalDeepseekConfig,
    localValue: local?.deepseek?.model,
    envValue: readValue(env, 'VITE_DEEPSEEK_MODEL'),
    fallback: 'deepseek-chat',
  });
  const deepseekEndpoint = pickConfiguredValue({
    localFirst: preferLocalDeepseekConfig,
    localValue: local?.deepseek?.endpoint,
    envValue: readValue(env, 'VITE_DEEPSEEK_ENDPOINT'),
    fallback: 'https://api.deepseek.com/chat/completions',
  });

  const geminiModel = pickConfiguredValue({
    localFirst: preferLocalGeminiConfig,
    localValue: local?.gemini?.model,
    envValue: readValue(env, 'VITE_GEMINI_MODEL'),
    fallback: 'gemini-2.5-flash',
  });
  const geminiEndpoint = pickConfiguredValue({
    localFirst: preferLocalGeminiConfig,
    localValue: local?.gemini?.endpoint,
    envValue: readValue(env, 'VITE_GEMINI_ENDPOINT'),
    fallback: 'https://generativelanguage.googleapis.com/v1/models',
  });

  const characterImageModel = (
    readValue(env, 'VITE_CHARACTER_IMAGE_MODEL') ||
    readValue(env, 'VITE_IMAGE_GEN_MODEL') ||
    'google/gemini-3.1-flash-image-preview'
  );
  const characterImageEndpoint = (
    readValue(env, 'VITE_CHARACTER_IMAGE_ENDPOINT') ||
    readValue(env, 'VITE_IMAGE_GEN_ENDPOINT') ||
    'https://openrouter.ai/api/v1'
  ).replace(/\/$/, '');

  const remoteTtsEndpoint = (
    readValue(env, 'VITE_REMOTE_TTS_ENDPOINT') ||
    readValue(env, 'VITE_GEMINI_TTS_ENDPOINT') ||
    readValue(env, 'VITE_GEMINI_ENDPOINT') ||
    'https://openrouter.ai/api/v1'
  ).replace(/\/$/, '');
  const remoteTtsApiKey = normalizeApiKey(
    readValue(env, 'VITE_REMOTE_TTS_API_KEY') ||
    openrouterApiKey ||
    envGeminiApiKey
  );
  const remoteTtsVoice = (
    readValue(env, 'VITE_REMOTE_TTS_VOICE') ||
    readValue(env, 'VITE_GEMINI_TTS_VOICE') ||
    'alloy'
  ).trim();
  const remoteTtsFormat = (
    readValue(env, 'VITE_REMOTE_TTS_FORMAT') ||
    readValue(env, 'VITE_GEMINI_TTS_FORMAT') ||
    'pcm16'
  ).trim().toLowerCase();
  const remoteTtsModel = (
    readValue(env, 'VITE_REMOTE_TTS_MODEL') ||
    readValue(env, 'VITE_GEMINI_TTS_MODEL') ||
    'openai/gpt-audio-mini'
  ).trim();
  const remoteTtsEnabled = String(env?.VITE_ENABLE_REMOTE_TTS ?? '1') !== '0';
  const ttsStrictTextSync = String(env?.VITE_TTS_STRICT_TEXT_SYNC ?? '1') !== '0';
  const ttsDebug = String(env?.VITE_TTS_DEBUG ?? '1') !== '0';

  const resolveProvider = () => {
    if (requestedProvider === 'deepseek' && deepseekApiKey) return 'deepseek';
    if (requestedProvider === 'gemini' && geminiApiKey) return 'gemini';
    if (deepseekApiKey) return 'deepseek';
    if (geminiApiKey) return 'gemini';
    return 'none';
  };

  const activeProvider = resolveProvider();

  const deepseek = {
    enabled: activeProvider === 'deepseek' && !!deepseekApiKey,
    apiKey: deepseekApiKey,
    model: deepseekModel,
    endpoint: deepseekEndpoint,
    openaiCompatible: true,
  };

  const gemini = {
    enabled: activeProvider === 'gemini' && !!geminiApiKey,
    apiKey: geminiApiKey,
    model: geminiModel,
    endpoint: geminiEndpoint,
    openaiCompatible: isOpenAICompatibleEndpoint(geminiEndpoint),
  };

  return {
    provider: activeProvider,
    requestedProvider,
    deepseek,
    gemini,
    characterImage: {
      enabled: !!characterImageModel && !!openrouterApiKey,
      apiKey: openrouterApiKey,
      model: characterImageModel,
      endpoint: characterImageEndpoint,
      openaiCompatible: isOpenAICompatibleEndpoint(characterImageEndpoint),
    },
    remoteTts: {
      enabled: remoteTtsEnabled && !!remoteTtsApiKey && !!remoteTtsModel,
      apiKey: remoteTtsApiKey,
      endpoint: remoteTtsEndpoint,
      model: remoteTtsModel,
      voice: remoteTtsVoice,
      format: remoteTtsFormat,
      strictTextSync: ttsStrictTextSync,
      debug: ttsDebug,
      openaiCompatible: isOpenAICompatibleEndpoint(remoteTtsEndpoint),
    },
  };
};
