import defaultCharacterRegistry from '../../../seeds/characters/defaults.json';
import captainQuick from '../../../seeds/characters/presets/captain-quick/character.json';
import aquabyte98 from '../../../seeds/characters/presets/aquabyte-98/character.json';

const PRESET_MANIFEST_BY_SLUG = new Map([
  [captainQuick.slug, captainQuick],
  [aquabyte98.slug, aquabyte98],
]);

export const DEFAULT_PRESET_CHARACTERS = defaultCharacterRegistry.defaultCharacterSlugs
  .map((slug) => PRESET_MANIFEST_BY_SLUG.get(slug))
  .filter(Boolean)
  .map((item) => ({
    id: String(item.id || '').trim(),
    slug: String(item.slug || '').trim(),
    name: String(item.displayName || item.character?.displayName || '').trim(),
    lockedUntilUserAdded: item.lockedUntilUserAdded !== false,
  }))
  .filter((item) => Boolean(item.id));

const PRESET_BY_ID = new Map(DEFAULT_PRESET_CHARACTERS.map((item) => [item.id, item]));

export const DEFAULT_PRESET_CHARACTER_IDS = DEFAULT_PRESET_CHARACTERS.map((item) => item.id);

export const isPresetCharacterId = (id) => PRESET_BY_ID.has(String(id || '').trim());

export const isPresetCharacterLockedUntilUserAdded = (id) => {
  const item = PRESET_BY_ID.get(String(id || '').trim());
  return Boolean(item?.lockedUntilUserAdded);
};
