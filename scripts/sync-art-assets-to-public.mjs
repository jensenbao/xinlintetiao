#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';

const rootDir = process.cwd();
const sourceRoot = path.join(rootDir, 'Art-assets', 'Art assets');
const targetRoot = path.join(rootDir, 'public', 'asset');
const srcRoot = path.join(rootDir, 'src');
const manifestPath = path.join(rootDir, 'scripts', '.assets-sync-manifest.json');

// Canonical workflow:
// 1) Team manages assets in Art-assets/Art assets/*
// 2) Runtime reads from public/asset/*
// 3) This script mirrors runtime-facing media and prunes stale generated copies.
const SYNC_EXTS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp', '.svg', '.mp4', '.webm', '.ttf', '.otf']);
const LEGACY_PRUNE_DIRS = ['UI', '生图参考'];
const SCAN_SOURCE_EXTS = new Set(['.js', '.jsx', '.ts', '.tsx', '.css']);
const ALWAYS_SYNC_TARGET_PREFIXES = ['道具/', '场景/', '按钮/'];
const SOURCE_RULES = [
  // Runtime mapping: start menu UI source becomes legacy runtime path `/asset/按钮/*`.
  { sourcePrefix: 'UI/开始界面/', targetPrefix: '按钮/' },
  // Keep direct directory mapping for runtime categories.
  { sourcePrefix: '道具/', targetPrefix: '道具/' },
  { sourcePrefix: '场景/', targetPrefix: '场景/' },
  { sourcePrefix: '角色/', targetPrefix: '角色/' },
  { sourcePrefix: '预览/', targetPrefix: '预览/' },
  { sourcePrefix: '字体/', targetPrefix: '字体/' },
];

const exists = async (filePath) => {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
};

const walkFiles = async (dir) => {
  const out = [];
  const stack = [dir];
  while (stack.length > 0) {
    const current = stack.pop();
    let entries = [];
    try {
      entries = await fs.readdir(current, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(fullPath);
      } else if (entry.isFile()) {
        out.push(fullPath);
      }
    }
  }
  return out;
};

const walkCodeFiles = async (dir) => {
  const files = await walkFiles(dir);
  return files.filter((filePath) => SCAN_SOURCE_EXTS.has(path.extname(filePath).toLowerCase()));
};

const shouldSync = (filePath) => {
  const ext = path.extname(filePath).toLowerCase();
  return SYNC_EXTS.has(ext);
};

const copyIfNeeded = async (src, dest) => {
  const srcStat = await fs.stat(src);
  const destExists = await exists(dest);
  if (destExists) {
    const destStat = await fs.stat(dest);
    if (destStat.size === srcStat.size && destStat.mtimeMs >= srcStat.mtimeMs) {
      return false;
    }
  }

  await fs.mkdir(path.dirname(dest), { recursive: true });
  await fs.copyFile(src, dest);
  return true;
};

const normalizeSlashes = (value) => value.replace(/\\/g, '/');

const mapSourceToTarget = (relativePath) => {
  const normalized = normalizeSlashes(relativePath);
  for (const rule of SOURCE_RULES) {
    if (normalized.startsWith(rule.sourcePrefix)) {
      return `${rule.targetPrefix}${normalized.slice(rule.sourcePrefix.length)}`;
    }
  }
  return null;
};

const collectReferencedAssetTargets = async () => {
  const referenced = new Set();
  const codeFiles = await walkCodeFiles(srcRoot);

  const assetRegex = /['"`](\/asset\/[^'"`\n]+?)['"`]/g;
  for (const codeFile of codeFiles) {
    let content = '';
    try {
      content = await fs.readFile(codeFile, 'utf8');
    } catch {
      continue;
    }

    for (const match of content.matchAll(assetRegex)) {
      const rawRef = match[1];
      const normalized = normalizeSlashes(rawRef).replace(/^\/asset\//, '').replace(/\?.*$/, '').replace(/#.*$/, '');
      if (!normalized) continue;
      const ext = path.extname(normalized).toLowerCase();
      if (!ext) continue;
      referenced.add(normalized);
    }
  }

  return referenced;
};

const readManifest = async () => {
  if (!(await exists(manifestPath))) return new Set();
  try {
    const text = await fs.readFile(manifestPath, 'utf8');
    const parsed = JSON.parse(text);
    if (!Array.isArray(parsed.files)) return new Set();
    return new Set(parsed.files.map((item) => normalizeSlashes(item)));
  } catch {
    return new Set();
  }
};

const writeManifest = async (files) => {
  const sorted = [...files].sort();
  const payload = JSON.stringify({ files: sorted }, null, 2);
  await fs.writeFile(manifestPath, `${payload}\n`, 'utf8');
};

const removeIfExists = async (targetPath) => {
  try {
    await fs.unlink(targetPath);
    return true;
  } catch {
    return false;
  }
};

const removeLegacyDirectories = async () => {
  let removed = 0;
  for (const relativeDir of LEGACY_PRUNE_DIRS) {
    const fullPath = path.join(targetRoot, relativeDir);
    try {
      await fs.rm(fullPath, { recursive: true, force: true });
      removed += 1;
    } catch {
      // Ignore cleanup failures; sync should still proceed.
    }
  }
  return removed;
};

const run = async () => {
  if (!(await exists(sourceRoot))) {
    console.log('[assets:sync] source directory not found, skip:', sourceRoot);
    return;
  }

  let copiedCount = 0;
  const referencedTargets = await collectReferencedAssetTargets();
  const desiredTargets = new Set();
  const sourceFiles = await walkFiles(sourceRoot);
  for (const srcFile of sourceFiles) {
    if (!shouldSync(srcFile)) continue;
    const relativePath = path.relative(sourceRoot, srcFile);
    const targetRelativePath = mapSourceToTarget(relativePath);
    if (!targetRelativePath) continue;

    const normalizedTargetRelative = normalizeSlashes(targetRelativePath);
    const isAlwaysSynced = ALWAYS_SYNC_TARGET_PREFIXES.some((prefix) => normalizedTargetRelative.startsWith(prefix));
    const isDirectlyReferenced = referencedTargets.has(normalizedTargetRelative);
    if (!isAlwaysSynced && !isDirectlyReferenced) {
      continue;
    }

    desiredTargets.add(normalizedTargetRelative);

    const destFile = path.join(targetRoot, normalizedTargetRelative);
    if (await copyIfNeeded(srcFile, destFile)) {
      copiedCount += 1;
    }
  }

  const previousManifest = await readManifest();
  let removedCount = 0;
  for (const oldRelativePath of previousManifest) {
    if (desiredTargets.has(oldRelativePath)) continue;
    const staleTarget = path.join(targetRoot, oldRelativePath);
    if (await removeIfExists(staleTarget)) {
      removedCount += 1;
    }
  }

  const cleanedLegacyDirCount = await removeLegacyDirectories();
  await writeManifest(desiredTargets);
  console.log(
    `[assets:sync] done, copied/updated ${copiedCount} file(s), removed stale ${removedCount} file(s), cleaned legacy dirs ${cleanedLegacyDirCount}.`
  );
};

run().catch((error) => {
  console.error('[assets:sync] failed:', error?.message || error);
  process.exit(1);
});
