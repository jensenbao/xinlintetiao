#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';

const rootDir = process.cwd();
const srcDir = path.join(rootDir, 'src');
const publicDir = path.join(rootDir, 'public');

const FILE_EXTENSIONS = new Set(['.js', '.jsx', '.ts', '.tsx', '.css']);
const issues = [];

const exists = async (filePath) => {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
};

const walkFiles = async (dir) => {
  let entries = [];
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }

  const results = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...await walkFiles(fullPath));
      continue;
    }
    if (!entry.isFile()) continue;
    const ext = path.extname(entry.name).toLowerCase();
    if (FILE_EXTENSIONS.has(ext)) {
      results.push(fullPath);
    }
  }
  return results;
};

const decodeAssetPath = (value) => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

const checkPublicAssetRefs = async (filePath, content) => {
  const regex = /['"`](\/asset\/[^'"`\n]+?)['"`]/g;
  for (const match of content.matchAll(regex)) {
    const rawRef = match[1];
    const normalizedRef = decodeAssetPath(rawRef).replace(/\?.*$/, '').replace(/#.*$/, '');
    const ext = path.extname(normalizedRef);
    if (!ext) {
      // Directory-style references (used as candidate prefixes) are allowed.
      continue;
    }
    const target = path.join(publicDir, normalizedRef.replace(/^\//, ''));
    if (!(await exists(target))) {
      issues.push({
        type: 'missing-public-asset',
        filePath,
        ref: rawRef,
        expected: target,
      });
    }
  }
};

const checkRelativeArtImports = async (filePath, content) => {
  const importRegex = /from\s+['"](\.\.\/\.\.\/Art-assets\/Art assets\/[^'"]+)['"]/g;
  for (const match of content.matchAll(importRegex)) {
    const importRef = match[1];
    const resolved = path.resolve(path.dirname(filePath), importRef);
    if (!(await exists(resolved))) {
      issues.push({
        type: 'missing-art-import',
        filePath,
        ref: importRef,
        expected: resolved,
      });
    }
  }
};

const checkTopLevelLayout = async () => {
  const legacyArtAssets = path.join(rootDir, 'Art assets');
  const normalizedArtAssets = path.join(rootDir, 'Art-assets');
  const hasLegacy = await exists(legacyArtAssets);
  const hasNormalized = await exists(normalizedArtAssets);

  if (hasLegacy && hasNormalized) {
    issues.push({
      type: 'layout-warning',
      filePath: '(repo root)',
      ref: 'Both `Art assets/` and `Art-assets/` exist.',
      expected: 'Keep only one canonical folder when safe migration is planned.',
    });
  }
};

const run = async () => {
  await checkTopLevelLayout();
  const files = await walkFiles(srcDir);
  for (const filePath of files) {
    const content = await fs.readFile(filePath, 'utf8');
    await checkPublicAssetRefs(filePath, content);
    await checkRelativeArtImports(filePath, content);
  }

  const hardFailures = issues.filter((item) => item.type !== 'layout-warning');
  const warnings = issues.filter((item) => item.type === 'layout-warning');

  if (warnings.length > 0) {
    console.log('Path check warnings:');
    for (const warning of warnings) {
      console.log(`- [warning] ${warning.ref}`);
    }
  }

  if (hardFailures.length > 0) {
    console.error('Path check failed with missing runtime assets/imports:');
    for (const failure of hardFailures) {
      console.error(`- [${failure.type}] ${failure.filePath}`);
      console.error(`  ref: ${failure.ref}`);
      console.error(`  expected: ${failure.expected}`);
    }
    process.exit(1);
  }

  console.log('Path check passed: all runtime asset references resolve.');
};

run().catch((error) => {
  console.error('Path check failed unexpectedly:', error?.message || error);
  process.exit(1);
});
