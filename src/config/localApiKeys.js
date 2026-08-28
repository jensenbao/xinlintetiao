// Fill keys here. Save file and use directly.
// If a key remains "your api key", it is treated as not configured.

const LOCAL_API_KEYS = {
  deepseek: {
    apiKey: 'your api key',
    model: 'deepseek-chat',
    endpoint: 'https://api.deepseek.com/chat/completions',
  },
  gemini: {
    apiKey: 'your api key',
    model: 'gemini-2.5-flash',
    endpoint: 'https://api.302.ai/v1',
    imageModel: 'gemini-2.5-flash-image',
    imageEndpoint: 'https://generativelanguage.googleapis.com/v1beta/models',
  },
  // Optional: set to 'deepseek' or 'gemini' to force provider.
  // Keep empty to auto-select by available key.
  provider: '',
};

export default LOCAL_API_KEYS;
