import { promises as fs } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { getCharacterByName, invalidateLocalCharacterCache } from './local-character-service.mjs';
import { getServerCharacterImageConfig } from './runtime-config.mjs';

const VALID_IDENTIFIER = /^[A-Za-z0-9_-]{2,64}$/;
const CONCEPT_WIDTH = 1920;
const CONCEPT_HEIGHT = 1080;
const PIXEL_WIDTH = 1080;
const PIXEL_HEIGHT = 1920;
const CHROMA_KEY_BACKGROUND = { r: 255, g: 0, b: 255, alpha: 1 };
const DEFAULT_MODEL = 'openai/gpt-5-image-mini';
const DEFAULT_ENDPOINT = 'https://openrouter.ai/api/v1';
const IMAGE_REQUEST_TIMEOUT_MS = 180_000;
const IMAGE_MAX_ATTEMPTS = 2;
const CONCEPT_REFERENCE = path.join('Art-assets', 'Art assets', '\u751f\u56fe\u53c2\u8003', '\u89d2\u8272\u6982\u5ff5\u56fe.png');
const STYLE_REFERENCE = path.join('Art-assets', 'Art assets', '\u751f\u56fe\u53c2\u8003', '\u98ce\u683c\u53c2\u8003.png');

const normalizeIdentifier = (value) => {
  const text = String(value || '').trim();
  return VALID_IDENTIFIER.test(text) ? text.toLowerCase() : '';
};

const ensureDir = async (dir) => {
  await fs.mkdir(dir, { recursive: true });
};

const fileExists = async (target) => {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
};

const removeIfExists = async (target) => {
  if (!target) return false;
  if (!await fileExists(target)) return false;
  await fs.rm(target, { recursive: true, force: true });
  return true;
};

const toRelativePath = (rootDir, filePath) => path.relative(rootDir, filePath).replace(/\\/g, '/');

const dataUrlToBuffer = (dataUrl) => {
  const match = String(dataUrl || '').match(/^data:([^;,]+);base64,(.+)$/);
  if (!match) return null;
  return {
    mimeType: match[1],
    buffer: Buffer.from(match[2], 'base64'),
  };
};

const imageFileToDataUrl = async (filePath) => {
  const ext = path.extname(filePath).toLowerCase();
  const mimeType = ext === '.jpg' || ext === '.jpeg'
    ? 'image/jpeg'
    : ext === '.webp'
      ? 'image/webp'
      : 'image/png';
  const buffer = await fs.readFile(filePath);
  return `data:${mimeType};base64,${buffer.toString('base64')}`;
};

const findLocalSourcePortrait = async (rootDir, code) => {
  const roleDir = path.join(rootDir, 'seeds', 'characters', 'added', code);
  const entries = await fs.readdir(roleDir, { withFileTypes: true }).catch(() => []);
  const candidates = entries
    .filter((entry) => entry.isFile() && /^portrait\.(png|jpe?g|webp)$/i.test(entry.name))
    .map((entry) => path.join(roleDir, entry.name));
  if (candidates.length === 0) return '';
  return imageFileToDataUrl(candidates[0]);
};

const normalizePng = async (inputBuffer, outputPath, {
  width,
  height,
  requireTransparent = true,
  background = requireTransparent
    ? { r: 0, g: 0, b: 0, alpha: 0 }
    : { r: 255, g: 255, b: 255, alpha: 1 },
}) => {
  await ensureDir(path.dirname(outputPath));

  const resized = await sharp(inputBuffer)
    .rotate()
    .resize({
      width,
      height,
      fit: 'contain',
      background,
    })
    .ensureAlpha()
    .png()
    .toBuffer();

  await fs.writeFile(outputPath, resized);
  return resized;
};

const buildCutoutFromChromaKey = async (inputBuffer, outputPath) => {
  await ensureDir(path.dirname(outputPath));

  const { data, info } = await sharp(inputBuffer)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const result = Buffer.from(data);
  const width = info.width;
  const height = info.height;
  const pixelCount = width * height;
  const visited = new Uint8Array(pixelCount);
  const queue = [];
  const hardDistance = 150;
  const softDistance = 220;

  const getOffset = (x, y) => (y * width + x) * info.channels;
  const getDistance = (offset) => Math.sqrt(
    ((result[offset] - CHROMA_KEY_BACKGROUND.r) ** 2)
    + ((result[offset + 1] - CHROMA_KEY_BACKGROUND.g) ** 2)
    + ((result[offset + 2] - CHROMA_KEY_BACKGROUND.b) ** 2)
  );

  const isLikelyBackground = (offset) => {
    const r = result[offset];
    const g = result[offset + 1];
    const b = result[offset + 2];
    const distance = getDistance(offset);
    const magentaDominant = r > 140 && b > 140 && g < 120;
    return magentaDominant && distance <= hardDistance;
  };

  const enqueueIfBackground = (x, y) => {
    if (x < 0 || x >= width || y < 0 || y >= height) return;
    const pixelIndex = y * width + x;
    if (visited[pixelIndex]) return;
    const offset = getOffset(x, y);
    if (!isLikelyBackground(offset)) return;
    visited[pixelIndex] = 1;
    queue.push(pixelIndex);
  };

  for (let x = 0; x < width; x += 1) {
    enqueueIfBackground(x, 0);
    enqueueIfBackground(x, height - 1);
  }
  for (let y = 0; y < height; y += 1) {
    enqueueIfBackground(0, y);
    enqueueIfBackground(width - 1, y);
  }

  for (let index = 0; index < queue.length; index += 1) {
    const pixelIndex = queue[index];
    const x = pixelIndex % width;
    const y = Math.floor(pixelIndex / width);
    enqueueIfBackground(x - 1, y);
    enqueueIfBackground(x + 1, y);
    enqueueIfBackground(x, y - 1);
    enqueueIfBackground(x, y + 1);
  }

  for (let pixelIndex = 0; pixelIndex < pixelCount; pixelIndex += 1) {
    const offset = pixelIndex * info.channels;
    const alphaIndex = offset + 3;
    if (visited[pixelIndex]) {
      result[offset] = 0;
      result[offset + 1] = 0;
      result[offset + 2] = 0;
      result[alphaIndex] = 0;
      continue;
    }

    const distance = getDistance(offset);
    if (distance >= softDistance) continue;

    const x = pixelIndex % width;
    const y = Math.floor(pixelIndex / width);
    const neighbors = [
      [x - 1, y],
      [x + 1, y],
      [x, y - 1],
      [x, y + 1],
    ];
    const touchesTransparent = neighbors.some(([nx, ny]) => {
      if (nx < 0 || nx >= width || ny < 0 || ny >= height) return false;
      return visited[ny * width + nx] === 1;
    });
    if (!touchesTransparent) continue;

    const ratio = Math.max(0, Math.min(1, (distance - hardDistance) / (softDistance - hardDistance)));
    result[alphaIndex] = Math.round(result[alphaIndex] * ratio);
    if (result[alphaIndex] === 0) {
      result[offset] = 0;
      result[offset + 1] = 0;
      result[offset + 2] = 0;
      continue;
    }

    // Remove magenta spill on partially transparent edge pixels.
    result[offset] = Math.round(result[offset] * ratio);
    result[offset + 2] = Math.round(result[offset + 2] * ratio);
  }

  const cutout = await sharp(result, {
    raw: {
      width: info.width,
      height: info.height,
      channels: info.channels,
    },
  })
    .png()
    .toBuffer();

  await fs.writeFile(outputPath, cutout);
  return cutout;
};

const extractImageSource = (payload) => {
  const candidates = [];
  const message = payload?.choices?.[0]?.message || {};

  const imageEntries = Array.isArray(message.images) ? message.images : [];
  for (const image of imageEntries) {
    candidates.push(image?.image_url?.url, image?.imageUrl?.url, image?.url);
  }

  const content = message.content;
  if (Array.isArray(content)) {
    for (const part of content) {
      candidates.push(part?.image_url?.url, part?.imageUrl?.url, part?.url);
      if (part?.type === 'text') candidates.push(part?.text);
    }
  } else {
    candidates.push(content);
  }

  for (const candidate of candidates) {
    const text = String(candidate || '').trim();
    if (text.startsWith('data:image/')) return text;
    if (/^https?:\/\//i.test(text)) return text;
    const embedded = text.match(/data:image\/[a-zA-Z0-9.+-]+;base64,[A-Za-z0-9+/=\r\n]+/);
    if (embedded) return embedded[0].replace(/\s+/g, '');
  }

  return '';
};

const imageSourceToBuffer = async (source) => {
  const text = String(source || '').trim();
  if (text.startsWith('data:image/')) {
    const parsed = dataUrlToBuffer(text);
    return parsed?.buffer || null;
  }

  if (/^https?:\/\//i.test(text)) {
    const response = await fetch(text);
    if (!response.ok) return null;
    return Buffer.from(await response.arrayBuffer());
  }

  return null;
};

const buildTransparencyDirective = ({ stage, strict = false }) => {
  const header = strict
    ? `CRITICAL ${stage.toUpperCase()} TRANSPARENCY REQUIREMENT:`
    : `${stage} transparency requirement:`;
  const lines = [
    header,
    'Output a PNG with a real alpha channel.',
    'All pixels outside the character silhouette must be fully transparent RGBA(0,0,0,0).',
    'Do not use white, off-white, gray, paper, haze, glow, drop shadow, halo, floor, vignette, or matte edges to fake transparency.',
    'The image must look correct when composited over a checkerboard because the background is truly empty alpha, not painted.',
  ];
  if (strict) {
    lines.push('If you cannot satisfy real alpha transparency, regenerate the image instead of returning any colored or semi-opaque background pixels.');
    lines.push('Keep the outer contour clean with no white fringe, gray fringe, or antialiased matte border.');
  }
  return lines.join('\n');
};

const isRetryableTransparencyError = (error) => {
  const message = String(error?.message || error || '');
  return message.includes('image_model_returned_non_transparent_image')
    || message.includes('image_model_returned_fake_transparent_background');
};

const callOpenRouterImage = async ({ config, prompt, imageUrls }) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), IMAGE_REQUEST_TIMEOUT_MS);
  const content = [
    { type: 'text', text: prompt },
    ...imageUrls.filter(Boolean).map((url) => ({
      type: 'image_url',
      image_url: { url },
    })),
  ];

  let response;
  try {
    response = await fetch(`${config.endpoint}/chat/completions`, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
        'HTTP-Referer': 'http://localhost:5173',
        'X-Title': 'future-bartender-game',
      },
      body: JSON.stringify({
        model: config.model,
        messages: [
          {
            role: 'system',
            content: 'Generate exactly one image. Prioritize faithful character preservation and a real transparent PNG alpha background. Never substitute a white or gray matte background.',
          },
          {
            role: 'user',
            content,
          },
        ],
        modalities: ['image', 'text'],
        stream: false,
      }),
    });
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw new Error('image_model_request_timeout');
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }

  const responseText = await response.text();
  if (!response.ok) {
    throw new Error(`image_model_request_failed:${response.status}:${responseText.slice(0, 500)}`);
  }

  let data = null;
  try {
    data = JSON.parse(responseText);
  } catch {
    throw new Error('image_model_invalid_json');
  }

  const imageSource = extractImageSource(data);
  if (!imageSource) {
    throw new Error('image_model_returned_no_image');
  }

  const buffer = await imageSourceToBuffer(imageSource);
  if (!buffer?.length) {
    throw new Error('image_model_returned_invalid_image');
  }

  return buffer;
};

const generateTransparentImage = async ({
  config,
  basePrompt,
  imageUrls,
  outputPath,
  stage,
  dimensions,
  requireTransparent = true,
  background,
}) => {
  let lastError = null;

  for (let attempt = 1; attempt <= IMAGE_MAX_ATTEMPTS; attempt += 1) {
    const strict = attempt > 1;
    const attemptPrompt = [
      basePrompt,
      ...(
        requireTransparent
          ? ['', buildTransparencyDirective({ stage, strict })]
          : []
      ),
    ].join('\n');

    try {
      const buffer = await callOpenRouterImage({
        config,
        prompt: attemptPrompt,
        imageUrls,
      });
      return await normalizePng(buffer, outputPath, { ...dimensions, requireTransparent, background });
    } catch (error) {
      lastError = error;
      if (requireTransparent && !strict && isRetryableTransparencyError(error)) {
        continue;
      }
      throw error;
    }
  }

  throw lastError || new Error(`image_generation_failed:${stage}`);
};

const buildCharacterText = (character) => {
  const profile = character?.profile || {};
  const background = character?.background || {};
  const style = character?.dialogueStyle || {};
  return [
    `Name: ${character?.displayName || profile?.name || character?.code || 'Unknown'}`,
    `Code: ${character?.code || ''}`,
    `Personality: ${(profile?.personality || character?.personality || []).join(', ')}`,
    `Appearance: ${profile?.appearance || ''}`,
    `Occupation: ${profile?.occupation || ''}`,
    `Backstory: ${background?.backstory || character?.backstory || ''}`,
    `Tone: ${style?.tone || ''}`,
  ].filter((line) => !line.endsWith(': ')).join('\n');
};

const buildConceptPrompt = (character) => [
  '根据原始 portrait 生成角色概念图。',
  '角色外观、色彩、材质、形体、细节全部以 portrait 为唯一标准。',
  '角色概念图.png 仅用于四视图排版、镜头角度和版面结构。',
  '只参考角色概念图.png 的视角、人物朝向、构图位置、留白方式和整体版式。',
  '不得参考角色概念图.png 的风格、材质、光影、色彩、装饰、渲染质感和角色设计。',
  '不要修改 portrait 中角色的原始风格和配色。',
  '不要增加额外视图或装饰元素。',
  '背景必须是纯白底，不要棋盘格、网格、透明预览底或任何底纹。',
  '不要添加任何文字。',
  `画布为横向 16:9，最终规范为 ${CONCEPT_WIDTH}x${CONCEPT_HEIGHT}。`,
  '',
  'Character profile:',
  buildCharacterText(character),
].join('\n');

const buildPixelPrompt = (character) => [
  '根据角色概念图，参考风格参考.png，生成该角色的像素风格图。',
  '角色概念图是色彩、角色身份、材质、外观细节和整体设计的唯一标准。',
  '风格参考.png 仅用于姿态、站姿、构图和像素表现方式，不用于角色身份、色彩或设计。',
  '不要把风格参考.png 中的角色设计、颜色、材质或装饰带入结果。',
  '保留角色概念图中的角色身份、造型和配色，输出单个完整角色。',
  '背景必须是纯色品红底，使用接近 #FF00FF 的单一平涂背景，便于后续抠图。',
  '不要透明背景，不要白底，不要灰底，不要黑底。',
  '不要渐变、不要阴影、不要地面、不要光晕、不要任何背景装饰。',
  '不要去色，不要灰度化，不要黑白化，不要把角色改成银白或单色版本。',
  '角色边缘必须清晰，角色本体不得包含与背景相同的颜色。',
  `画布为纵向 9:16，最终规范为 ${PIXEL_WIDTH}x${PIXEL_HEIGHT}。`,
  '',
  'Character profile:',
  buildCharacterText(character),
].join('\n');

export const generateCharacterImages = async ({ rootDir, code, force = false }) => {
  const normalizedCode = normalizeIdentifier(code);
  if (!normalizedCode) {
    const error = new Error('invalid_character_code');
    error.code = 'invalid_character_code';
    throw error;
  }

  const runtimeConfig = await getServerCharacterImageConfig(rootDir);
  const config = {
    apiKey: String(runtimeConfig?.apiKey || '').trim(),
    endpoint: String(runtimeConfig?.endpoint || DEFAULT_ENDPOINT).replace(/\/$/, ''),
    model: String(runtimeConfig?.model || DEFAULT_MODEL).trim() || DEFAULT_MODEL,
  };
  if (!config.apiKey) {
    const error = new Error('missing_openrouter_api_key');
    error.code = 'missing_openrouter_api_key';
    throw error;
  }

  const character = await getCharacterByName({
    rootDir,
    query: normalizedCode,
    inferPortraitGender: false,
  });
  if (!character) {
    const error = new Error('character_not_found');
    error.code = 'character_not_found';
    throw error;
  }

  const roleDir = path.join(rootDir, 'seeds', 'characters', 'added', normalizedCode);
  const conceptPath = path.join(roleDir, 'concept.png');
  const pixelPath = path.join(roleDir, 'pixel.png');
  const generationPath = path.join(roleDir, 'image-generation.json');
  const publicCutoutPath = path.join(rootDir, 'public', 'asset', '\u89d2\u8272', 'cutout', `${normalizedCode}_cutout.png`);

  if (
    !force
    && await fileExists(conceptPath)
    && await fileExists(pixelPath)
    && await fileExists(publicCutoutPath)
    && await fileExists(generationPath)
  ) {
    return {
      ok: true,
      skipped: true,
      code: normalizedCode,
      model: config.model,
      files: {
        concept: toRelativePath(rootDir, conceptPath),
        pixel: toRelativePath(rootDir, pixelPath),
        generation: toRelativePath(rootDir, generationPath),
        publicCutout: toRelativePath(rootDir, publicCutoutPath),
      },
    };
  }

  const sourcePortrait = String(character?.portrait?.dataUrl || '').trim()
    || await findLocalSourcePortrait(rootDir, normalizedCode);
  if (!sourcePortrait.startsWith('data:image/')) {
    const error = new Error('missing_source_portrait');
    error.code = 'missing_source_portrait';
    throw error;
  }

  const conceptReferencePath = path.join(rootDir, CONCEPT_REFERENCE);
  const styleReferencePath = path.join(rootDir, STYLE_REFERENCE);
  const conceptReference = await imageFileToDataUrl(conceptReferencePath);
  const styleReference = await imageFileToDataUrl(styleReferencePath);

  const normalizedConcept = await generateTransparentImage({
    config,
    basePrompt: buildConceptPrompt(character),
    imageUrls: [sourcePortrait, conceptReference],
    outputPath: conceptPath,
    stage: 'concept',
    dimensions: { width: CONCEPT_WIDTH, height: CONCEPT_HEIGHT },
    requireTransparent: false,
  });
  const conceptDataUrl = `data:image/png;base64,${normalizedConcept.toString('base64')}`;

  const normalizedPixel = await generateTransparentImage({
    config,
    basePrompt: buildPixelPrompt(character),
    imageUrls: [conceptDataUrl, styleReference, sourcePortrait],
    outputPath: pixelPath,
    stage: 'pixel',
    dimensions: { width: PIXEL_WIDTH, height: PIXEL_HEIGHT },
    requireTransparent: false,
    background: CHROMA_KEY_BACKGROUND,
  });
  await ensureDir(path.dirname(publicCutoutPath));
  await buildCutoutFromChromaKey(normalizedPixel, publicCutoutPath);

  const generation = {
    version: 1,
    code: normalizedCode,
    generatedAt: new Date().toISOString(),
    provider: 'openrouter',
    endpoint: config.endpoint,
    model: config.model,
    dimensions: {
      concept: { width: CONCEPT_WIDTH, height: CONCEPT_HEIGHT, ratio: '16:9' },
      pixel: { width: PIXEL_WIDTH, height: PIXEL_HEIGHT, ratio: '9:16' },
    },
    references: {
      concept: toRelativePath(rootDir, conceptReferencePath),
      style: toRelativePath(rootDir, styleReferencePath),
    },
    files: {
      concept: toRelativePath(rootDir, conceptPath),
      pixel: toRelativePath(rootDir, pixelPath),
      publicCutout: toRelativePath(rootDir, publicCutoutPath),
    },
  };
  await fs.writeFile(generationPath, `${JSON.stringify(generation, null, 2)}\n`, 'utf8');

  return {
    ok: true,
    skipped: false,
    code: normalizedCode,
    model: config.model,
    dimensions: {
      concept: { width: CONCEPT_WIDTH, height: CONCEPT_HEIGHT, ratio: '16:9' },
      pixel: { width: PIXEL_WIDTH, height: PIXEL_HEIGHT, ratio: '9:16' },
    },
    files: {
      concept: toRelativePath(rootDir, conceptPath),
      pixel: toRelativePath(rootDir, pixelPath),
      generation: toRelativePath(rootDir, generationPath),
      publicCutout: toRelativePath(rootDir, publicCutoutPath),
    },
  };
};

export const removeCharacterAssets = async ({ rootDir, code }) => {
  const normalizedCode = normalizeIdentifier(code);
  if (!normalizedCode) {
    const error = new Error('invalid_character_code');
    error.code = 'invalid_character_code';
    throw error;
  }

  const roleDir = path.join(rootDir, 'seeds', 'characters', 'added', normalizedCode);
  const publicCutoutPath = path.join(rootDir, 'public', 'asset', '角色', 'cutout', `${normalizedCode}_cutout.png`);

  const [removedCacheDir, removedCutout] = await Promise.all([
    removeIfExists(roleDir),
    removeIfExists(publicCutoutPath),
  ]);

  invalidateLocalCharacterCache({ rootDir, code: normalizedCode });

  return {
    ok: true,
    code: normalizedCode,
    removed: {
      cacheDir: removedCacheDir,
      publicCutout: removedCutout,
    },
  };
};
