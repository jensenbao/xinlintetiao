export const extractCleanJSON = (response) => {
  if (!response || typeof response !== 'string') return null;

  let cleaned = response.trim();

  // 方法1：完整的 markdown 代码块（有开头和结尾的 ```）
  const codeBlockMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) {
    cleaned = codeBlockMatch[1].trim();
    console.log('📝 Extracted JSON from a complete code block');
    return cleaned;
  }

  // 方法2：不完整的 markdown 代码块（只有开头的 ```json，没有结尾 - 被截断）
  const startMatch = cleaned.match(/^```(?:json)?\s*([\s\S]*)/);
  if (startMatch) {
    cleaned = startMatch[1].trim();
    cleaned = cleaned.replace(/```\s*$/, '').trim();
    console.log('📝 Extracted JSON from an incomplete code block (possibly truncated)');
    return cleaned;
  }

  return cleaned;
};

export const tryRepairTruncatedJSON = (text) => {
  if (!text) return null;

  let repaired = text.trim();

  repaired = repaired.replace(/,\s*$/, '');

  const quoteCount = (repaired.match(/(?<!\\)"/g) || []).length;
  if (quoteCount % 2 !== 0) {
    repaired += '"';
  }

  const openBraces = (repaired.match(/\{/g) || []).length;
  const closeBraces = (repaired.match(/\}/g) || []).length;
  const openBrackets = (repaired.match(/\[/g) || []).length;
  const closeBrackets = (repaired.match(/\]/g) || []).length;

  for (let i = 0; i < openBrackets - closeBrackets; i++) {
    repaired += ']';
  }

  for (let i = 0; i < openBraces - closeBraces; i++) {
    repaired += '}';
  }

  repaired = repaired.replace(/,\s*([}\]])/g, '$1');

  try {
    return JSON.parse(repaired);
  } catch (e) {
    console.log('⚠️ JSON repair attempt failed:', e.message);
    return null;
  }
};
