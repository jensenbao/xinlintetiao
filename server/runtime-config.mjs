import { promises as fs } from 'node:fs';
import path from 'node:path';
import { buildRuntimeApiConfig } from '../shared/runtimeApiConfig.js';

const loadedRoots = new Set();

export const loadServerEnv = async (rootDir) => {
  const root = path.resolve(String(rootDir || '.'));
  if (loadedRoots.has(root)) return;
  loadedRoots.add(root);

  const envPath = path.join(root, '.env.local');
  let raw = '';
  try {
    raw = await fs.readFile(envPath, 'utf8');
  } catch {
    return;
  }

  for (const line of String(raw || '').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const idx = trimmed.indexOf('=');
    if (idx <= 0) continue;

    const key = trimmed.slice(0, idx).trim();
    let value = trimmed.slice(idx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }

    if (!String(process.env[key] || '').trim()) {
      process.env[key] = value;
    }
  }
};

export const getServerRuntimeApiConfig = async (rootDir) => {
  await loadServerEnv(rootDir);
  return buildRuntimeApiConfig({ env: process.env });
};

export const getServerTextApiConfig = async (rootDir) => {
  const config = await getServerRuntimeApiConfig(rootDir);
  if (config.provider === 'deepseek') {
    return {
      type: 'deepseek',
      ...config.deepseek,
    };
  }
  if (config.provider === 'gemini') {
    return {
      type: 'gemini',
      ...config.gemini,
    };
  }
  return null;
};

export const getServerCharacterImageConfig = async (rootDir) => {
  const config = await getServerRuntimeApiConfig(rootDir);
  return config.characterImage;
};
