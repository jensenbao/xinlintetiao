import preset5738g from '../../../seeds/characters/presets/5738g/profile.json';

export const DEFAULT_PRESET_CHARACTERS = [preset5738g]
  .filter(Boolean)
  .map((item) => ({
    id: String(item.id || '').trim(),
    name: String(item.name || item.character?.displayName || '').trim(),
    lockedUntilUserAdded: item.lockedUntilUserAdded !== false,
    enabledByDefault: item.enabledByDefault !== false,
  }))
  .filter((item) => Boolean(item.id));

const PRESET_BY_ID = new Map(DEFAULT_PRESET_CHARACTERS.map((item) => [item.id, item]));

export const DEFAULT_PRESET_CHARACTER_IDS = DEFAULT_PRESET_CHARACTERS.map((item) => item.id);

export const isPresetCharacterId = (id) => PRESET_BY_ID.has(String(id || '').trim());

export const isPresetCharacterLockedUntilUserAdded = (id) => {
  const item = PRESET_BY_ID.get(String(id || '').trim());
  return Boolean(item?.lockedUntilUserAdded);
};
