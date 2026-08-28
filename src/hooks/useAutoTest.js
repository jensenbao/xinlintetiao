/**
 * 自动测试 Hook
 * 从 GamePage 提取的 Dev 自动测试逻辑
 */
import { useCallback } from 'react';
import { EMOTIONS, GLASS_TYPES } from '../data/emotions.js';
import { INITIAL_UNLOCKED_INGREDIENTS } from '../data/ingredients.js';
import { generateSolvableTarget, checkTargetConditions, calculateMixture } from '../utils/cocktailMixing.js';

/**
 * @param {Object} ctx - 上下文对象
 */
export const useAutoTest = (ctx) => {
  const {
    progress, customerFlow, dialogue, emotionSystem,
    cocktailFlow, tutorial,
    playSFX, addToast,
    aiConfig, trustLevel, setTrustLevel,
    unlockedItems, atmosphere,
    showAtmosphereOverlay, dismissAtmosphereOverlay,
    showEventNotification, currentEvent,
    handleEventChoiceAction, handleEventDismissAction,
    handleServeCocktail, startNewDay
  } = ctx;

  progress.autoTestFnsRef.current.stopAutoTest = () => {
    if (progress.autoTestRef.current) { clearTimeout(progress.autoTestRef.current); progress.autoTestRef.current = null; }
    progress.setAutoTestRunning(false);
  };

  progress.autoTestFnsRef.current.dismissAll = () => {
    let dismissed = false;
    if (showAtmosphereOverlay) { dismissAtmosphereOverlay(); dismissed = true; }
    if (showEventNotification && currentEvent?.choices?.length > 0) {
      const idx = Math.floor(Math.random() * currentEvent.choices.length);
      handleEventChoiceAction(idx); dismissed = true;
    } else if (showEventNotification) { handleEventDismissAction(); dismissed = true; }
    if (progress.showRules) { progress.setShowRules(false); dismissed = true; }
    if (customerFlow.showDayEnd) { startNewDay(); dismissed = true; }
    if (customerFlow.showReturnCustomerOverlay) { customerFlow.setShowReturnCustomerOverlay(null); dismissed = true; }
    if (tutorial.showTutorialComplete) { tutorial.completeTutorial?.(); dismissed = true; }
    return dismissed;
  };

  progress.autoTestFnsRef.current.serveCocktail = (conditions, loop) => {
    addToast('🤖 [Auto Test] Mixing a cocktail...', 'info');
    const availIngr = unlockedItems.ingredients || INITIAL_UNLOCKED_INGREDIENTS;
    const glass = (unlockedItems.glasses || ['martini'])[0];
    const maxPortions = GLASS_TYPES[glass]?.maxPortions || 2;
    let bestPortions = [], bestMet = -1;
    for (let a = 0; a < 50; a++) {
      const portions = []; let total = 0;
      const count = 1 + Math.floor(Math.random() * Math.min(3, availIngr.length));
      const shuffled = [...availIngr].sort(() => Math.random() - 0.5);
      for (let i = 0; i < count && total < maxPortions; i++) {
        const c = Math.min(1 + Math.floor(Math.random() * 3), maxPortions - total);
        if (c > 0) { portions.push({ id: shuffled[i], count: c }); total += c; }
      }
      while (total < maxPortions && portions.length > 0) { portions[0].count++; total++; }
      const mix = calculateMixture(portions);
      const chk = checkTargetConditions(mix, conditions);
      if (chk.metCount > bestMet) { bestMet = chk.metCount; bestPortions = portions; }
      if (chk.allMet) break;
    }
    const finalMix = calculateMixture(bestPortions);
    const finalChk = checkTargetConditions(finalMix, conditions);
    const recipe = { glass, ice: (unlockedItems.iceTypes || ['no_ice'])[0], ingredients: bestPortions, garnish: null, decoration: null, mixture: finalMix, targetCheck: finalChk, timestamp: Date.now() };
    progress.autoTestRef.current = setTimeout(() => {
      addToast(`🤖 [Auto Test] Serving the drink! (${finalChk.allMet ? 'target met' : 'target missed'})`, finalChk.allMet ? 'success' : 'warning');
      handleServeCocktail(recipe);
      if (loop) progress.autoTestRef.current = setTimeout(() => progress.autoTestFnsRef.current.runRound(true), 4000);
      else progress.setAutoTestRunning(false);
    }, 1000);
  };

  progress.autoTestFnsRef.current.runRound = (loop) => {
    if (progress.autoTestFnsRef.current.dismissAll()) {
      progress.autoTestRef.current = setTimeout(() => progress.autoTestFnsRef.current.runRound(loop), 2000); return;
    }
    if (dialogue.isLoading) {
      progress.autoTestRef.current = setTimeout(() => progress.autoTestFnsRef.current.runRound(loop), 1500); return;
    }
    const realEmotions = emotionSystem.dynamicCustomerEmotions.reality.length > 0
      ? emotionSystem.dynamicCustomerEmotions.reality : (aiConfig?.emotionMask?.reality || []);
    if (realEmotions.length === 0) { addToast('🔧 [Auto Test] Unable to read guest emotions', 'error'); progress.autoTestFnsRef.current.stopAutoTest(); return; }
    if (cocktailFlow.guessedCorrectly) { progress.autoTestFnsRef.current.serveCocktail(cocktailFlow.targetConditions, loop); return; }

    addToast('🤖 [Auto Test] Guessing emotions...', 'info');
    cocktailFlow.setEmotionGuessMode(true);
    emotionSystem.setSelectedEmotions([]);
    progress.autoTestRef.current = setTimeout(() => {
      emotionSystem.setSelectedEmotions([...realEmotions]);
      progress.autoTestRef.current = setTimeout(() => {
        cocktailFlow.setGuessedCorrectly(true);
        cocktailFlow.setEmotionGuessMode(false);
        cocktailFlow.setLastCorrectGuesses(realEmotions);
        playSFX('success');
        addToast(`🤖 [Auto Test] Correct guess: ${realEmotions.map(e => EMOTIONS[e]?.name).join(', ')}`, 'success');
        const target = generateSolvableTarget(realEmotions[0], unlockedItems.ingredients || INITIAL_UNLOCKED_INGREDIENTS);
        if (target) {
          let conds = target.conditions;
          const shift = atmosphere?.modifiers?.targetShift;
          if (shift) conds = conds.map(c => { const s = shift[c.attr]; return (s !== undefined && s !== 0) ? { ...c, value: c.value + s } : c; });
          cocktailFlow.setTargetConditions(conds);
          cocktailFlow.setTargetHint(target.hint);
          progress.autoTestRef.current = setTimeout(() => progress.autoTestFnsRef.current.serveCocktail(conds, loop), 1500);
        }
        setTrustLevel(prev => Math.min(1, prev + 0.1));
      }, 1000);
    }, 1000);
  };

  const handleAutoTest = useCallback((loop = false) => {
    if (progress.autoTestRunning) { progress.autoTestFnsRef.current.stopAutoTest(); return; }
    progress.setAutoTestRunning(true);
    addToast(`🤖 [Auto Test] ${loop ? 'Loop mode started' : 'Single run started'}`, 'info');
    progress.autoTestFnsRef.current.runRound(loop);
  }, [progress.autoTestRunning, addToast]);

  return { handleAutoTest };
};
