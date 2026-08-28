import { promises as fs } from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();
const presetsDir = path.join(rootDir, 'seeds', 'characters', 'presets');
const addedDir = path.join(rootDir, 'seeds', 'characters', 'added');

const toPosix = (value) => String(value || '').replace(/\\/g, '/');

const ensureDir = async (dirPath) => {
  await fs.mkdir(dirPath, { recursive: true });
};

const fileExists = async (filePath) => {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
};

const readDirSafe = async (dirPath) => {
  try {
    return await fs.readdir(dirPath, { withFileTypes: true });
  } catch {
    return [];
  }
};

const moveIfAbsent = async ({ fromPath, toPath, label, logs }) => {
  if (!(await fileExists(fromPath))) return;

  const targetExists = await fileExists(toPath);
  if (targetExists) {
    logs.push(`[skip] ${label} exists: ${toPosix(path.relative(rootDir, toPath))}`);
    return;
  }

  await ensureDir(path.dirname(toPath));
  await fs.rename(fromPath, toPath);
  logs.push(`[move] ${toPosix(path.relative(rootDir, fromPath))} -> ${toPosix(path.relative(rootDir, toPath))}`);
};

const migrateFlatFilesInRoot = async ({ baseDir, profileName, yamlName }) => {
  const logs = [];
  const entries = await readDirSafe(baseDir);

  for (const entry of entries) {
    if (!entry.isFile()) continue;
    const ext = path.extname(entry.name).toLowerCase();
    if (ext !== '.json') continue;

    const roleId = path.basename(entry.name, ext);
    if (!roleId) continue;

    const fromProfile = path.join(baseDir, `${roleId}.json`);
    const fromYaml = path.join(baseDir, `${roleId}.yaml`);
    const fromYml = path.join(baseDir, `${roleId}.yml`);

    const roleDir = path.join(baseDir, roleId);
    const toProfile = path.join(roleDir, profileName);
    const toYaml = path.join(roleDir, yamlName);

    await moveIfAbsent({ fromPath: fromProfile, toPath: toProfile, label: 'profile', logs });

    if (await fileExists(fromYaml)) {
      await moveIfAbsent({ fromPath: fromYaml, toPath: toYaml, label: 'yaml', logs });
    } else if (await fileExists(fromYml)) {
      await moveIfAbsent({ fromPath: fromYml, toPath: toYaml, label: 'yaml', logs });
    }
  }

  return logs;
};

const main = async () => {
  const logs = [];

  logs.push('Migrating preset character assets...');
  logs.push(...await migrateFlatFilesInRoot({
    baseDir: presetsDir,
    profileName: 'profile.json',
    yamlName: 'source.yaml',
  }));

  logs.push('Migrating added character assets...');
  logs.push(...await migrateFlatFilesInRoot({
    baseDir: addedDir,
    profileName: 'profile.json',
    yamlName: 'source.yaml',
  }));

  if (logs.length <= 2) {
    console.log('No migration changes were needed.');
    return;
  }

  for (const line of logs) {
    console.log(line);
  }
};

main().catch((error) => {
  console.error('Character asset migration failed:', error?.message || error);
  process.exitCode = 1;
});
