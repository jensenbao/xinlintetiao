import sharp from 'sharp';

const [, , inputPath, outputPath] = process.argv;

if (!inputPath || !outputPath) {
  console.error('Usage: node scripts/remove-white-background.mjs <input> <output>');
  process.exit(1);
}

const WHITE_THRESHOLD = 232;
const SOFT_WHITE_THRESHOLD = 200;
const NEUTRAL_THRESHOLD = 32;

const toAlpha = (red, green, blue) => {
  const minChannel = Math.min(red, green, blue);
  const maxChannel = Math.max(red, green, blue);
  const spread = maxChannel - minChannel;

  if (minChannel >= WHITE_THRESHOLD && spread <= NEUTRAL_THRESHOLD) {
    return 0;
  }

  if (minChannel <= SOFT_WHITE_THRESHOLD || spread > NEUTRAL_THRESHOLD * 2) {
    return 255;
  }

  const whitenessRatio = (minChannel - SOFT_WHITE_THRESHOLD) / (WHITE_THRESHOLD - SOFT_WHITE_THRESHOLD);
  const neutralRatio = 1 - Math.min(1, spread / (NEUTRAL_THRESHOLD * 2));
  const fade = Math.max(0, Math.min(1, whitenessRatio * neutralRatio));

  return Math.round(255 * (1 - fade));
};

const image = sharp(inputPath).ensureAlpha();
const metadata = await image.metadata();
const { data, info } = await image.raw().toBuffer({ resolveWithObject: true });

for (let index = 0; index < data.length; index += info.channels) {
  const red = data[index];
  const green = data[index + 1];
  const blue = data[index + 2];
  const originalAlpha = data[index + 3];
  const derivedAlpha = toAlpha(red, green, blue);

  data[index + 3] = Math.min(originalAlpha, derivedAlpha);
}

await sharp(data, {
  raw: {
    width: info.width,
    height: info.height,
    channels: info.channels,
  },
})
  .png()
  .toFile(outputPath);

console.log(`Removed white background from ${inputPath} -> ${outputPath} (${metadata.width}x${metadata.height})`);