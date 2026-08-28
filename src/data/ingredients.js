import ingredientsData from './ingredients.json';

const TOOL_ASSET_BASE = '/asset/道具';
const icon = (relativePath) => `${TOOL_ASSET_BASE}/${relativePath}`;

export const BASE_SPIRITS = {
  ...ingredientsData.baseSpirits,
  vodka: {
    ...ingredientsData.baseSpirits.vodka,
    iconImage: icon('Spirit/vodka.png')
  },
  rum: {
    ...ingredientsData.baseSpirits.rum,
    iconImage: icon('Spirit/rum.png')
  },
  whiskey: {
    ...ingredientsData.baseSpirits.whiskey,
    iconImage: icon('Spirit/whiskey.png')
  },
  tequila: {
    ...ingredientsData.baseSpirits.tequila,
    iconImage: icon('Spirit/tequila.png')
  }
};
export const JUICES = {
  ...ingredientsData.juices,
  juice_orange: {
    ...ingredientsData.juices.juice_orange,
    iconImage: icon('Juice/juice_orange.png')
  },
  juice_lemon: {
    ...ingredientsData.juices.juice_lemon,
    iconImage: icon('Juice/juice_lemon.png')
  },
  juice_cranberry: {
    ...ingredientsData.juices.juice_cranberry,
    iconImage: icon('Juice/juice_cranberry.png')
  },
  juice_mango: {
    ...ingredientsData.juices.juice_mango,
    iconImage: icon('Juice/juice_mango.png')
  }
};
export const MIXERS = {
  ...ingredientsData.mixers,
  soda: {
    ...ingredientsData.mixers.soda,
    iconImage: icon('Mixer/soda.png')
  },
  tonic: {
    ...ingredientsData.mixers.tonic,
    iconImage: icon('Mixer/tonic.png')
  },
  syrup: {
    ...ingredientsData.mixers.syrup,
    iconImage: icon('Mixer/syrup.png')
  },
  cream: {
    ...ingredientsData.mixers.cream,
    iconImage: icon('Mixer/cream.png')
  },
  coffee: {
    ...ingredientsData.mixers.coffee,
    iconImage: icon('Mixer/coffee.png')
  }
};
export const LIQUEURS = {
  ...ingredientsData.liqueurs,
  triple_sec: {
    ...ingredientsData.liqueurs.triple_sec,
    iconImage: icon('Liqueur/triple_sec.png')
  },
  kahlua: {
    ...ingredientsData.liqueurs.kahlua,
    iconImage: icon('Liqueur/kahlua.png')
  },
  baileys: {
    ...ingredientsData.liqueurs.baileys,
    iconImage: icon('Liqueur/baileys.png')
  },
  sambuca: {
    ...ingredientsData.liqueurs.sambuca,
    iconImage: icon('Liqueur/sambuca.png')
  }
};

export const INGREDIENTS = {
  ...BASE_SPIRITS,
  ...JUICES,
  ...MIXERS,
  ...LIQUEURS
};

export const getIngredientsByCategory = (category) => {
  return Object.values(INGREDIENTS).filter((ingredient) => ingredient.category === category);
};

export const INGREDIENT_CATEGORIES = ingredientsData.ingredientCategories;
export const INITIAL_UNLOCKED_INGREDIENTS = ingredientsData.initialUnlockedIngredients;
export const MAX_PORTIONS_PER_INGREDIENT = ingredientsData.maxPortionsPerIngredient;
export const MAX_TOTAL_PORTIONS = ingredientsData.maxTotalPortions;
