const request = async (method, url, body) => {
  const response = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  let data = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    const message = data?.error || `${response.status}`;
    throw new Error(message);
  }

  return data || {};
};

export const getLocalCharacterByName = async (query) => {
  const data = await request('POST', '/api/mcp/character/get_by_name', { query });
  return data.character || null;
};

export const searchLocalCharacters = async (query, limit = 20) => {
  const data = await request('POST', '/api/mcp/character/search', { query, limit });
  return Array.isArray(data.results) ? data.results : [];
};

export const analyzeLocalCharacterEmotion = async (payload = {}) => {
  const data = await request('POST', '/api/mcp/emotion/analyze_character', payload);
  return data?.emotion || null;
};
