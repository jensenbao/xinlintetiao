import { useCallback } from 'react';
import { callAIForCocktailJudgment } from '../../utils/aiService.js';
import { saveCocktailRecipe, saveDiscoveredCombo, saveGameProgress, saveUnlockedItems } from '../../utils/storage.js';
import { EMOTIONS, GLASS_TYPES } from '../../data/emotions.js';
import { DECORATION_TYPES, GARNISH_TYPES, ICE_TYPES, checkComboBonus } from '../../data/addons.js';
import { checkTargetConditions } from '../../utils/cocktailMixing.js';
import { interpretCocktailAttitude, getAttitudeInfluence } from '../../utils/cocktailAttitude.js';
import { RESONANCE_EFFECTS, judgeCocktail } from '../../utils/cocktailJudgment.js';
import { TUTORIAL_COCKTAIL_FEEDBACK, TUTORIAL_TARGET } from '../../data/tutorialData.js';
import { buildStrictJudgmentExplanation, calculateCocktailServeRewards, getCustomerTop3Emotions } from './helpers.js';
import { appendActiveNpcEvent, queueActiveSlotGameStateSync } from '../../utils/saveRepository.js';

// 先聚焦核心玩法：暂时关闭图鉴联动（黄金组合发现）
const ENCYCLOPEDIA_ENABLED = false;
const BASE_COCKTAIL_TIP = 10;
const clamp01 = (value) => Math.max(0, Math.min(1, value));
const RESULT_CARD_LEAVE_DELAY_SUCCESS = 2600;
const RESULT_CARD_LEAVE_DELAY_FAILURE = 3400;
const estimateDialogueDisplayDelay = (text) => {
  const normalized = String(text || '').replace(/\s+/g, ' ').trim();
  if (!normalized) return 1800;

  const punctuationCount = (normalized.match(/[，。！？,.!?…]/g) || []).length;
  const charDelay = normalized.length * 85;
  const punctuationDelay = punctuationCount * 180;

  return Math.max(1800, Math.min(5200, 900 + charDelay + punctuationDelay));
};

export const useServeProgressHandlers = ({ ctx }) => {
  const {
    tutorial, progress, customerFlow, dialogue, emotionSystem, cocktailFlow,
    chapterSystem, playSFX, addToast, showGameHint, aiConfig, aiType,
    trustLevel, setTrustLevel, money, setMoney, unlockedItems, setUnlockedItems,
    atmosphere, shouldTriggerEvent, triggerEvent, updateStreak, handleEventChoice,
    dismissEvent, applyAtmosphereChange, currentEvent, eventsEnabled
  } = ctx;

  const tryTriggerEventAfterServe = useCallback(async (isSuccess) => {
    if (!eventsEnabled) return;

    const context = {
      day: customerFlow.currentDay, customerIndex: customerFlow.currentCustomerIndex, lastWasSuccess: isSuccess
    };
    if (shouldTriggerEvent(context)) {
      await triggerEvent({
        day: customerFlow.currentDay, customersServed: customerFlow.customersServed,
        atmosphere, currentCustomer: customerFlow.currentCustomer
      });
    }
  }, [eventsEnabled, customerFlow.currentDay, customerFlow.currentCustomerIndex, customerFlow.customersServed, atmosphere, customerFlow.currentCustomer, shouldTriggerEvent, triggerEvent]);

  const handleServeCocktail = useCallback(async (recipe) => {
    playSFX('shake');
    cocktailFlow.triggerServeAnim();
    cocktailFlow.resetForServe();
    emotionSystem.setSelectedEmotions([]);
    dialogue.setIsLoading(true);

    try {
      saveCocktailRecipe({ aiType, aiName: aiConfig.name, ...recipe });

      if (ENCYCLOPEDIA_ENABLED) {
        const matchedCombos = checkComboBonus(recipe);
        matchedCombos.forEach(combo => {
          const isNew = saveDiscoveredCombo(combo.id, {
            name: combo.name, icon: combo.icon, description: combo.description, bonus: combo.bonus, requires: combo.requires
          });
          if (isNew) addToast(`🎊 Golden combo discovered: ${combo.icon} ${combo.name}! Added to the codex.`, 'success');
        });
      }

      const currentEmotions = {
        surface: emotionSystem.dynamicCustomerEmotions.surface.length > 0
          ? emotionSystem.dynamicCustomerEmotions.surface : (aiConfig?.emotionMask?.surface || []),
        reality: emotionSystem.dynamicCustomerEmotions.reality.length > 0
          ? emotionSystem.dynamicCustomerEmotions.reality : (aiConfig?.emotionMask?.reality || [])
      };

      const cocktailAttitude = recipe.cocktailAttitude || interpretCocktailAttitude(recipe.mixture || {}, recipe.isPlainWater, recipe);
      const attitudeInfluence = getAttitudeInfluence(cocktailAttitude);
      cocktailFlow.setCocktailAttitudes(prev => [...prev, attitudeInfluence]);

      // 白水特殊处理
      if (recipe.isPlainWater) {
        const waterTrustChange = trustLevel >= 0.6 ? 0.08 : trustLevel >= 0.3 ? 0.05 : 0.03;
        setTrustLevel(prev => Math.min(1, prev + waterTrustChange));
        cocktailFlow.addTrustFly(waterTrustChange);
        const waterFeedback = await callAIForCocktailJudgment({
          aiConfig, trustLevel, emotionState: currentEmotions,
          cocktailRecipe: { ...recipe, mixture: { thickness: 0, sweetness: 0, strength: 0 } },
          dialogueHistory: dialogue.dialogueHistory, isSuccess: true, satisfaction: 0.6, cocktailAttitude
        });
        dialogue.addMessage('ai', waterFeedback.feedback, true);
        playSFX('serve');
        dialogue.setIsLoading(false);
        return;
      }

      const mixingMode = chapterSystem?.currentChapter?.mixingMode || 'strict';
      const mixture = recipe.mixture || {};

      // 统一判定系统：strict/transitional/expressive/master
      const customerState = {
        realEmotions: currentEmotions.reality,
        dialogueContext: (dialogue.dialogueHistory || [])
          .slice(-4)
          .map(d => `${d.role === 'player' ? 'Bartender' : aiConfig.name}: ${d.content}`)
          .join(' ')
      };

      const judgment = await judgeCocktail({
        mixture,
        targetConditions: cocktailFlow.targetConditions,
        attitude: cocktailAttitude,
        customerState,
        mixingMode
      });

      const targetCheck = judgment?.targetCheck
        || recipe.targetCheck
        || checkTargetConditions(mixture, cocktailFlow.targetConditions);

      const isSuccess = judgment?.success === true;
      const satisfaction = typeof judgment?.satisfaction === 'number'
        ? judgment.satisfaction
        : (targetCheck?.satisfaction || 0.5);
      const strictExplanation = buildStrictJudgmentExplanation(targetCheck);
      const guessedEmotions = Array.isArray(cocktailFlow.lastCorrectGuesses) ? cocktailFlow.lastCorrectGuesses : [];
      const actualTop3 = getCustomerTop3Emotions(aiConfig, currentEmotions.reality);
      const rewardBreakdown = calculateCocktailServeRewards({
        guessedEmotions,
        actualTop3,
        surfaceEmotions: currentEmotions.surface,
        satisfaction,
        baseTip: BASE_COCKTAIL_TIP,
      });

      // 教学模式
      if (tutorial.isTutorialMode) {
        if (isSuccess) {
          dialogue.addMessage('ai', TUTORIAL_COCKTAIL_FEEDBACK, true);
          playSFX('success');
          tutorial.advanceTutorial('cocktail_served');
        } else {
          playSFX('fail');
          tutorial.advanceTutorial('cocktail_failed');
          cocktailFlow.setGuessedCorrectly(true);
          cocktailFlow.setTargetConditions(TUTORIAL_TARGET.conditions);
          cocktailFlow.setTargetHint(TUTORIAL_TARGET.hint);
        }
        dialogue.setIsLoading(false);
        return;
      }

      // AI 反馈
      const aiResult = await callAIForCocktailJudgment({
        aiConfig, trustLevel, emotionState: currentEmotions,
        cocktailRecipe: { ...recipe, mixture: recipe.mixture, glass: recipe.glass, ice: recipe.ice, garnish: recipe.garnish, decoration: recipe.decoration },
        dialogueHistory: dialogue.dialogueHistory, isSuccess, satisfaction, cocktailAttitude,
        judgmentExplanation: strictExplanation
      });
      const feedback = aiResult.feedback;

      dialogue.addMessage('ai', feedback, true);
      appendActiveNpcEvent({
        role: 'ai',
        type: 'cocktail_feedback',
        content: feedback,
        meta: {
          isSuccess,
          satisfaction
        },
        timestamp: Date.now()
      }).catch(() => {});
      playSFX('serve');
      const feedbackDisplayDelay = estimateDialogueDisplayDelay(feedback);
      window.setTimeout(() => {
        customerFlow.updateGameProgressRef.current(isSuccess, recipe, satisfaction, rewardBreakdown);
        queueActiveSlotGameStateSync('serve_result');
        cocktailFlow.addTrustFly(rewardBreakdown.finalTrustGain);
        addToast(
          `🎁 Hit ${rewardBreakdown.hitCount}/3, surface hit ${rewardBreakdown.surfaceHitCount}, tip +${rewardBreakdown.tipAmount}, trust +${Math.round(rewardBreakdown.finalTrustGain * 100)}%`,
          rewardBreakdown.hitCount >= 2 ? 'success' : 'info'
        );
        cocktailFlow.showResultCard({
          isSuccess,
          mixture: mixture || {},
          targetCheck,
          glass: recipe.glass,
          ingredients: recipe.ingredients,
          rewards: rewardBreakdown,
          judgment: {
            mixingMode,
            method: judgment?.method || null,
            resonance: judgment?.resonance || null,
            resonanceLabel: judgment?.resonance
              ? (RESONANCE_EFFECTS[judgment.resonance]?.label || judgment.resonance)
              : null
          }
        });

        const leaveReason = isSuccess ? 'success_complete' : 'served_complete';
        const leaveDelay = isSuccess ? RESULT_CARD_LEAVE_DELAY_SUCCESS : RESULT_CARD_LEAVE_DELAY_FAILURE;
        window.setTimeout(() => customerFlow.handleCustomerLeaveRef.current?.(leaveReason), leaveDelay);
      }, feedbackDisplayDelay);

      // 情绪变化
      {
        const allEmotionIds = Object.keys(EMOTIONS);
        const positivePool = ['joy', 'trust', 'anticipation', 'surprise'];
        const negativePool = ['fear', 'sadness', 'anger', 'disgust'];
        const currentReality = [...currentEmotions.reality];
        const emotionsToReplace = currentReality.filter(e => guessedEmotions.includes(e));
        const emotionsToKeep = currentReality.filter(e => !guessedEmotions.includes(e));
        const replacementPool = isSuccess ? positivePool : negativePool;
        let newReality = [...emotionsToKeep];
        for (let i = 0; i < emotionsToReplace.length; i++) {
          const available = replacementPool.filter(e => !newReality.includes(e) && !currentReality.includes(e));
          if (available.length > 0) newReality.push(available[Math.floor(Math.random() * available.length)]);
          else {
            const fallback = allEmotionIds.filter(e => !newReality.includes(e) && !currentReality.includes(e));
            if (fallback.length > 0) newReality.push(fallback[Math.floor(Math.random() * fallback.length)]);
            else { const last = allEmotionIds.filter(e => !newReality.includes(e)); newReality.push(last[Math.floor(Math.random() * last.length)]); }
          }
        }
        while (newReality.length < 2) {
          const fill = allEmotionIds.filter(e => !newReality.includes(e));
          newReality.push(fill[Math.floor(Math.random() * fill.length)]);
        }
        emotionSystem.setDynamicCustomerEmotions(prev => ({ ...prev, reality: newReality }));
        cocktailFlow.setLastCorrectGuesses([]);
      }
    } catch (error) {
      console.error('Failed to serve drink:', error);
      addToast('AI cocktail flow failed. No fallback response was used.', 'error');
    } finally {
      dialogue.setIsLoading(false);
    }
  }, [aiConfig, aiType, trustLevel, dialogue.dialogueHistory, emotionSystem.dynamicCustomerEmotions,
    cocktailFlow.targetConditions, cocktailFlow.lastCorrectGuesses, unlockedItems, playSFX, showGameHint, addToast, tryTriggerEventAfterServe, chapterSystem, tutorial]);

  // ==================== 进度 & 事件 & 商店 ====================

  const updateGameProgress = useCallback((isSuccess, recipe, satisfaction = 0.5, rewardBreakdown = null) => {
    const newStats = {
      ...progress.gameStats,
      totalServed: progress.gameStats.totalServed + 1,
      successCount: isSuccess ? progress.gameStats.successCount + 1 : progress.gameStats.successCount,
      failureCount: isSuccess ? progress.gameStats.failureCount : progress.gameStats.failureCount + 1
    };
    progress.setGameStats(newStats);
    updateStreak(isSuccess);

    // 递增每日成功/失败计数（用于当天统计）
    if (isSuccess) {
      customerFlow.daySuccessCountRef.current += 1;
    } else {
      customerFlow.dayFailureCountRef.current += 1;
    }

    // 递增顾客酒杯计数 & 每日总杯数
    customerFlow.customerCocktailCountRef.current += 1;
    customerFlow.setCustomerCocktailCount(customerFlow.customerCocktailCountRef.current);
    customerFlow.dailyCocktailCountRef.current += 1;

    const trustDelta = rewardBreakdown?.finalTrustGain;
    const tipAmount = rewardBreakdown?.tipAmount || 0;
    const nextTrustLevel = trustDelta === undefined
      ? trustLevel
      : clamp01(trustLevel + trustDelta);
    const nextMoney = money + tipAmount;

    if (trustDelta !== undefined) {
      setTrustLevel(prev => clamp01(prev + trustDelta));
    } else if (!isSuccess) {
      setTrustLevel(prev => Math.max(0, prev - 0.1));
    }

    if (tipAmount > 0) {
      setMoney(prev => prev + tipAmount);
    }

    if (!isSuccess) {
      showGameHint('cocktail_failed');
    }

    if (isSuccess) {
      const newSuccessCount = customerFlow.customerSuccessCountRef.current + 1;
      customerFlow.customerSuccessCountRef.current = newSuccessCount;
      customerFlow.setCustomerSuccessCount(newSuccessCount);

      const newUnlocked = { ...unlockedItems, successCount: newStats.successCount };
      if (newStats.successCount % 5 === 0 && newUnlocked.glasses.length < 4) {
        const allGlasses = Object.keys(GLASS_TYPES);
        const nextGlass = allGlasses.find(g => !newUnlocked.glasses.includes(g));
        if (nextGlass) {
          newUnlocked.glasses.push(nextGlass);
        }
      }
      setUnlockedItems(newUnlocked);
      saveUnlockedItems(newUnlocked);
    }
    saveGameProgress({ day: customerFlow.currentDay, money: nextMoney, stats: newStats, trustLevel: nextTrustLevel });
  }, [progress.gameStats, aiConfig, customerFlow.currentDay, money, trustLevel, customerFlow.customerSuccessCount,
    unlockedItems, atmosphere, setMoney, setUnlockedItems, showGameHint, updateStreak]);
  customerFlow.updateGameProgressRef.current = updateGameProgress;

  const handleEventChoiceAction = useCallback((choiceIndex) => {
    const result = handleEventChoice(choiceIndex);
    if (!result) return;
    const choiceEffect = result.choiceEffect || {};
    const trustChange = (result.trustModifier || 0) + (choiceEffect.trustModifier || 0);
    if (trustChange !== 0) {
      setTrustLevel(prev => Math.max(0, Math.min(1, prev + trustChange)));
    }
    const atmosphereChange = result.atmosphereChange || choiceEffect.atmosphereChange;
    if (atmosphereChange) applyAtmosphereChange(atmosphereChange);
  }, [handleEventChoice, currentEvent, setTrustLevel, applyAtmosphereChange]);

  const handleEventDismissAction = useCallback(() => {
    const effects = dismissEvent();
    if (effects?.trustModifier) setTrustLevel(prev => Math.max(0, Math.min(1, prev + effects.trustModifier)));
  }, [dismissEvent]);

  const handleShopPurchase = useCallback((itemType, itemId) => {
    const newUnlocked = { ...unlockedItems };
    if (!newUnlocked[itemType]) newUnlocked[itemType] = [];
    if (!newUnlocked[itemType].includes(itemId)) newUnlocked[itemType].push(itemId);
    setUnlockedItems(newUnlocked);
    saveUnlockedItems(newUnlocked);
    playSFX('success');
  }, [unlockedItems, setUnlockedItems, playSFX]);


  return {
    tryTriggerEventAfterServe,
    handleServeCocktail,
    updateGameProgress,
    handleEventChoiceAction,
    handleEventDismissAction,
    handleShopPurchase
  };
};
