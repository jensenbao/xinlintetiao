import { generateCharacterImages } from '../server/character-image-service.mjs';

try {
  const result = await generateCharacterImages({
    rootDir: process.cwd(),
    code: '0055g',
    force: true,
  });
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  const message = error && error.message ? error.message : String(error);
  console.log(`GEN_ERROR ${message}`);
  if (error && error.stack) {
    console.log(error.stack);
  }
  process.exit(1);
}