import addonsData from './addons.json';

const TOOL_ASSET_BASE = '/asset/道具';
const icon = (relativePath) => `${TOOL_ASSET_BASE}/${relativePath}`;

export const ICE_TYPES = {
  ...addonsData.iceTypes,
  no_ice: {
    ...addonsData.iceTypes.no_ice,
    icon: ''
  },
  normal: {
    ...addonsData.iceTypes.normal,
    iconImage: icon('冰块/normal.png')
  },
  more_ice: {
    ...addonsData.iceTypes.more_ice,
    iconImage: icon('冰块/more_ice.png')
  }
};
export const GARNISH_TYPES = addonsData.garnishTypes;
export const DECORATION_TYPES = {
  ...addonsData.decorationTypes,
  mint: {
    ...addonsData.decorationTypes.mint,
    iconImage: icon('装饰/mint.png')
  },
  lemon_slice: {
    ...addonsData.decorationTypes.lemon_slice,
    iconImage: icon('装饰/lemon.png')
  }
};
export const ADDON_BONUS_CONFIG = addonsData.addonBonusConfig;
export const COMBO_BONUS = addonsData.comboBonus;

export const checkAddonCompatibility = (addonType, addonId, emotions) => {
  let addonData;

  switch (addonType) {
    case 'ice':
      addonData = ICE_TYPES[addonId];
      break;
    case 'garnish':
      addonData = GARNISH_TYPES[addonId];
      break;
    case 'decoration':
      addonData = DECORATION_TYPES[addonId];
      break;
    default:
      return 'neutral';
  }

  if (!addonData) return 'neutral';

  const hasMatch = emotions.some((emotionId) => addonData.compatibleEmotions.includes(emotionId));
  return hasMatch ? 'compatible' : 'neutral';
};

const calculateSingleAddonMatch = (addonData, emotions) => {
  if (!addonData || !addonData.compatibleEmotions) {
    return { matchCount: 0, isPerfect: false };
  }

  const emotionArray = Array.isArray(emotions) ? emotions : [];
  const matchCount = emotionArray.filter((emotion) => addonData.compatibleEmotions.includes(emotion)).length;

  return {
    matchCount,
    isPerfect: matchCount >= 2
  };
};

export const calculateAddonBonus = (recipe, emotions) => {
  let bonus = 0;

  if (recipe.ice && ICE_TYPES[recipe.ice]) {
    const { matchCount, isPerfect } = calculateSingleAddonMatch(ICE_TYPES[recipe.ice], emotions);
    if (matchCount > 0) {
      bonus += isPerfect ? ADDON_BONUS_CONFIG.ice.perfect : ADDON_BONUS_CONFIG.ice.base;
    }
  }

  if (recipe.garnish && GARNISH_TYPES[recipe.garnish]) {
    const { matchCount, isPerfect } = calculateSingleAddonMatch(GARNISH_TYPES[recipe.garnish], emotions);
    if (matchCount > 0) {
      bonus += isPerfect ? ADDON_BONUS_CONFIG.garnish.perfect : ADDON_BONUS_CONFIG.garnish.base;
    }
  }

  if (recipe.decoration && DECORATION_TYPES[recipe.decoration]) {
    const { matchCount, isPerfect } = calculateSingleAddonMatch(DECORATION_TYPES[recipe.decoration], emotions);
    if (matchCount > 0) {
      bonus += isPerfect ? ADDON_BONUS_CONFIG.decoration.perfect : ADDON_BONUS_CONFIG.decoration.base;
    }
  }

  return bonus;
};

export const getAddonBonusDetails = (recipe, emotions) => {
  const details = {
    ice: { matched: false, perfect: false, bonus: 0, name: '' },
    garnish: { matched: false, perfect: false, bonus: 0, name: '' },
    decoration: { matched: false, perfect: false, bonus: 0, name: '' },
    totalBonus: 0
  };

  if (recipe.ice && ICE_TYPES[recipe.ice]) {
    const iceData = ICE_TYPES[recipe.ice];
    const { matchCount, isPerfect } = calculateSingleAddonMatch(iceData, emotions);
    if (matchCount > 0) {
      const addBonus = isPerfect ? ADDON_BONUS_CONFIG.ice.perfect : ADDON_BONUS_CONFIG.ice.base;
      details.ice = { matched: true, perfect: isPerfect, bonus: addBonus, name: iceData.name };
      details.totalBonus += addBonus;
    }
  }

  if (recipe.garnish && GARNISH_TYPES[recipe.garnish]) {
    const garnishData = GARNISH_TYPES[recipe.garnish];
    const { matchCount, isPerfect } = calculateSingleAddonMatch(garnishData, emotions);
    if (matchCount > 0) {
      const addBonus = isPerfect ? ADDON_BONUS_CONFIG.garnish.perfect : ADDON_BONUS_CONFIG.garnish.base;
      details.garnish = { matched: true, perfect: isPerfect, bonus: addBonus, name: garnishData.name };
      details.totalBonus += addBonus;
    }
  }

  if (recipe.decoration && DECORATION_TYPES[recipe.decoration]) {
    const decorationData = DECORATION_TYPES[recipe.decoration];
    const { matchCount, isPerfect } = calculateSingleAddonMatch(decorationData, emotions);
    if (matchCount > 0) {
      const addBonus = isPerfect ? ADDON_BONUS_CONFIG.decoration.perfect : ADDON_BONUS_CONFIG.decoration.base;
      details.decoration = { matched: true, perfect: isPerfect, bonus: addBonus, name: decorationData.name };
      details.totalBonus += addBonus;
    }
  }

  return details;
};

export const calculateAddonPenalty = (recipe, emotions) => {
  let penalty = 0;
  const emotionArray = Array.isArray(emotions) ? emotions : [];

  if (recipe.garnish && GARNISH_TYPES[recipe.garnish]) {
    const garnishMatch = emotionArray.some((emotion) =>
      GARNISH_TYPES[recipe.garnish].compatibleEmotions.includes(emotion)
    );
    if (!garnishMatch) penalty += 5;
  }

  if (recipe.decoration && DECORATION_TYPES[recipe.decoration]) {
    const decorationMatch = emotionArray.some((emotion) =>
      DECORATION_TYPES[recipe.decoration].compatibleEmotions.includes(emotion)
    );
    if (!decorationMatch) penalty += 5;
  }

  return penalty;
};

export const checkComboBonus = (recipe) => {
  const matchedCombos = [];

  for (const [comboId, combo] of Object.entries(COMBO_BONUS)) {
    const { requires } = combo;
    let isMatch = true;

    for (const [key, value] of Object.entries(requires)) {
      if (recipe[key] !== value) {
        isMatch = false;
        break;
      }
    }

    if (isMatch) {
      matchedCombos.push({
        id: comboId,
        ...combo
      });
    }
  }

  return matchedCombos;
};

export const calculateComboBonus = (recipe) => {
  const combos = checkComboBonus(recipe);
  return combos.reduce((total, combo) => total + combo.bonus, 0);
};
