import { useState, useEffect, useMemo, useCallback } from 'react';
import { GLASS_TYPES } from '../data/emotions.js';
import { INGREDIENTS } from '../data/ingredients.js';
import {
  calculateMixture,
  checkTargetConditions,
  getTotalPortions,
  canAddIngredient,
  addPortion,
  removePortion,
  getMixingSuggestions
} from '../utils/cocktailMixing.js';
import { interpretCocktailAttitude } from '../utils/cocktailAttitude.js';
import audioManager from '../utils/audioManager.js';

const MIXING_STEPS = [
  { id: 'glass', name: 'Choose Glass', icon: '🍸' },
  { id: 'ice', name: 'Add Ice', icon: '🧊' },
  { id: 'ingredient', name: 'Mix Ingredients', icon: '🥃' },
  { id: 'decoration', name: 'Add Decoration', icon: '✨' },
  { id: 'preview', name: 'Confirm Serve', icon: '✅' }
];

const createEmptyRecipe = () => ({
  glass: null,
  ice: null,
  ingredients: [],
  garnish: null,
  decoration: null
});

export const useMixingSession = ({
  resetKey,
  targetConditions = [],
  onServeCocktail,
  onServeTriggered,
  unlockedGlasses = [],
  unlockedIceTypes = [],
  unlockedIngredients = [],
  unlockedGarnishes = [],
  unlockedDecorations = [],
  onMixtureChange,
  onRecipeChange,
  restrictions = []
}) => {
  const [currentStep, setCurrentStep] = useState('glass');
  const [recipe, setRecipe] = useState(createEmptyRecipe);
  const [selectedCategory, setSelectedCategory] = useState('spirit');

  const currentStepIndex = MIXING_STEPS.findIndex((step) => step.id === currentStep);

  const currentMixture = useMemo(() => {
    return calculateMixture(recipe.ingredients, recipe.ice, recipe.garnish, recipe.decoration);
  }, [recipe.ingredients, recipe.ice, recipe.garnish, recipe.decoration]);

  const targetCheck = useMemo(() => {
    return checkTargetConditions(currentMixture, targetConditions);
  }, [currentMixture, targetConditions]);

  const suggestions = useMemo(() => {
    return getMixingSuggestions(currentMixture, targetConditions, unlockedIngredients);
  }, [currentMixture, targetConditions, unlockedIngredients]);

  const filteredIngredients = useMemo(() => {
    let ingredients = unlockedIngredients;

    for (const restriction of restrictions) {
      if (restriction.type === 'disable_category') {
        ingredients = ingredients.filter((ingredientId) => {
          const ingredient = INGREDIENTS[ingredientId];

          if (!ingredient) {
            return true;
          }

          if (ingredient.category === restriction.category) {
            return restriction.except?.includes(ingredientId);
          }

          return true;
        });
      }
    }

    return ingredients;
  }, [unlockedIngredients, restrictions]);

  const filteredIceTypes = useMemo(() => {
    let iceTypes = unlockedIceTypes;

    for (const restriction of restrictions) {
      if (restriction.type === 'limit_addon' && restriction.addonType === 'ice') {
        iceTypes = iceTypes.filter((iceId) => restriction.allowedIds?.includes(iceId));
      }
    }

    return iceTypes;
  }, [unlockedIceTypes, restrictions]);

  const disabledIngredientIds = useMemo(() => {
    const disabledIds = new Set();

    for (const restriction of restrictions) {
      if (restriction.type === 'disable_category') {
        unlockedIngredients.forEach((ingredientId) => {
          const ingredient = INGREDIENTS[ingredientId];

          if (ingredient && ingredient.category === restriction.category && !restriction.except?.includes(ingredientId)) {
            disabledIds.add(ingredientId);
          }
        });
      }
    }

    return disabledIds;
  }, [unlockedIngredients, restrictions]);

  const handleSelectGlass = useCallback((glassId) => {
    if (!unlockedGlasses.includes(glassId)) {
      return;
    }

    setRecipe((prev) => ({ ...prev, glass: glassId }));
  }, [unlockedGlasses]);

  const handleSelectIce = useCallback((iceId) => {
    if (!filteredIceTypes.includes(iceId)) {
      return;
    }

    setRecipe((prev) => ({ ...prev, ice: iceId }));

    if (iceId !== 'no_ice') {
      audioManager.playSFX('ice');
    }
  }, [filteredIceTypes]);

  const handleAddIngredient = useCallback((ingredientId) => {
    if (!filteredIngredients.includes(ingredientId)) {
      return;
    }

    const { canAdd, reason } = canAddIngredient(recipe.ingredients, ingredientId, recipe.glass);

    if (!canAdd) {
      console.log('Cannot add:', reason);
      return;
    }

    setRecipe((prev) => ({
      ...prev,
      ingredients: addPortion(prev.ingredients, ingredientId, prev.glass)
    }));

    audioManager.playSFX('pour');
  }, [filteredIngredients, recipe.ingredients, recipe.glass]);

  const handleRemoveIngredient = useCallback((ingredientId) => {
    setRecipe((prev) => ({
      ...prev,
      ingredients: removePortion(prev.ingredients, ingredientId)
    }));
  }, []);

  const handleSelectGarnish = useCallback((garnishId) => {
    if (garnishId && !unlockedGarnishes.includes(garnishId)) {
      return;
    }

    setRecipe((prev) => ({ ...prev, garnish: garnishId }));
  }, [unlockedGarnishes]);

  const handleSelectDecoration = useCallback((decorationId) => {
    if (decorationId && !unlockedDecorations.includes(decorationId)) {
      return;
    }

    setRecipe((prev) => ({ ...prev, decoration: decorationId }));
  }, [unlockedDecorations]);

  const handleNextStep = useCallback(() => {
    const nextIndex = currentStepIndex + 1;

    if (nextIndex < MIXING_STEPS.length) {
      setCurrentStep(MIXING_STEPS[nextIndex].id);
    }
  }, [currentStepIndex]);

  const handlePrevStep = useCallback(() => {
    const previousIndex = currentStepIndex - 1;

    if (previousIndex >= 0) {
      setCurrentStep(MIXING_STEPS[previousIndex].id);
    }
  }, [currentStepIndex]);

  const handleReset = useCallback(() => {
    setCurrentStep('glass');
    setSelectedCategory('spirit');
    setRecipe(createEmptyRecipe());
  }, []);

  useEffect(() => {
    handleReset();
  }, [handleReset, resetKey]);

  const currentAttitude = useMemo(() => {
    if (recipe.ingredients.length === 0) {
      return null;
    }

    return interpretCocktailAttitude(currentMixture, false, recipe);
  }, [currentMixture, recipe]);

  const handleServe = useCallback(() => {
    const glassData = GLASS_TYPES[recipe.glass];
    const requiredPortions = glassData?.maxPortions || 3;
    const currentPortions = getTotalPortions(recipe.ingredients);

    if (currentPortions !== requiredPortions) {
      return;
    }

    onServeTriggered?.();

    const fullRecipe = {
      ...recipe,
      mixture: currentMixture,
      targetCheck,
      cocktailAttitude: currentAttitude,
      timestamp: Date.now()
    };

    onServeCocktail?.(fullRecipe);
    handleReset();
  }, [recipe, currentMixture, targetCheck, currentAttitude, onServeTriggered, onServeCocktail, handleReset]);

  const handleServeWater = useCallback(() => {
    const waterAttitude = interpretCocktailAttitude({ thickness: 0, sweetness: 0, strength: 0 }, true);
    const waterRecipe = {
      glass: 'martini',
      ice: 'no_ice',
      ingredients: [],
      garnish: null,
      decoration: null,
      mixture: { thickness: 0, sweetness: 0, strength: 0 },
      targetCheck: { allMet: false, metCount: 0, satisfaction: 0, conditions: [] },
      cocktailAttitude: waterAttitude,
      isPlainWater: true,
      timestamp: Date.now()
    };

    onServeCocktail?.(waterRecipe);
    handleReset();
  }, [onServeCocktail, handleReset]);

  const canProceed = useCallback(() => {
    switch (currentStep) {
      case 'glass':
        return recipe.glass !== null;
      case 'ice':
        return recipe.ice !== null;
      case 'ingredient': {
        const glassData = GLASS_TYPES[recipe.glass];
        const requiredPortions = glassData?.maxPortions || 2;
        const currentPortions = getTotalPortions(recipe.ingredients);

        return currentPortions === requiredPortions;
      }
      case 'decoration':
        return true;
      case 'preview': {
        const glassData = GLASS_TYPES[recipe.glass];
        const requiredPortions = glassData?.maxPortions || 3;
        const currentPortions = getTotalPortions(recipe.ingredients);
        const isPortionReady = currentPortions === requiredPortions;

        return isPortionReady && (targetCheck.allMet || targetConditions.length === 0);
      }
      default:
        return false;
    }
  }, [currentStep, recipe, targetCheck, targetConditions]);

  useEffect(() => {
    onMixtureChange?.(currentMixture);
  }, [currentMixture, onMixtureChange]);

  useEffect(() => {
    const glassData = GLASS_TYPES[recipe.glass];

    onRecipeChange?.({
      recipe,
      totalPortions: getTotalPortions(recipe.ingredients),
      maxPortions: glassData?.maxPortions || 3
    });
  }, [recipe, onRecipeChange]);

  return {
    canProceed,
    currentAttitude,
    currentMixture,
    currentStep,
    currentStepIndex,
    disabledIngredientIds,
    filteredIceTypes,
    filteredIngredients,
    handleAddIngredient,
    handleNextStep,
    handlePrevStep,
    handleRemoveIngredient,
    handleReset,
    handleSelectDecoration,
    handleSelectGarnish,
    handleSelectGlass,
    handleSelectIce,
    handleServe,
    handleServeWater,
    recipe,
    selectedCategory,
    setRecipe,
    setSelectedCategory,
    steps: MIXING_STEPS,
    suggestions,
    targetCheck
  };
};

export default useMixingSession;
