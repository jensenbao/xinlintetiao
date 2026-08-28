/**
 * 游戏初始化副作用 Hook
 * 从 GamePage 提取的所有初始化 useEffect
 */
import { useEffect, useRef } from 'react';
import { saveShortMemory, saveGameSession, getGameSession, clearGameSession, getActiveCharacterIds } from '../utils/storage.js';
import { generateQuickOptions } from '../utils/aiService.js';
import audioManager from '../utils/audioManager.js';
import { generateCustomerWithCharacterPool } from '../utils/aiService.js';

const CHARACTER_ID_PATTERN = /^\d+g?$/i;

const extractCharacterIdFromConfig = (config = {}) => {
  if (!config || typeof config !== 'object') return '';

  const direct = String(config.customCharacterId || '').trim();
  if (CHARACTER_ID_PATTERN.test(direct)) return direct.toLowerCase();

  const idField = String(config.id || '').trim();
  if (CHARACTER_ID_PATTERN.test(idField)) return idField.toLowerCase();

  const avatarCacheKey = String(config.avatarCacheKey || '').trim();
  const fromCacheKey = avatarCacheKey.match(/(?:^|_)(\d+g?)(?:_|$)/i)?.[1] || '';
  if (CHARACTER_ID_PATTERN.test(fromCacheKey)) return fromCacheKey.toLowerCase();

  const voiceCode = String(config.voiceProfile?.code || '').trim();
  if (CHARACTER_ID_PATTERN.test(voiceCode)) return voiceCode.toLowerCase();

  const aliases = Array.isArray(config.aliases) ? config.aliases : [];
  for (const alias of aliases) {
    const candidate = String(alias || '').trim();
    if (CHARACTER_ID_PATTERN.test(candidate)) return candidate.toLowerCase();
  }

  return '';
};

/**
 * @param {Object} ctx - 上下文对象，包含所有需要的 hook 引用和状态
 */
export const useGameInit = (ctx) => {
  const {
    tutorial, progress, customerFlow, dialogue, emotionSystem,
    cocktailFlow, initAudio, playSFX,
    aiConfig, aiType, trustLevel, setTrustLevel,
    money, setMoney, addToast,
    activeSlotId,
    atmosphere, generateAtmosphere,
    showAtmosphereOverlay, dismissAtmosphereOverlay,
    isBarSceneReady,
    showEventNotification, currentEvent,
    handleEventChoiceAction, handleEventDismissAction,
    startNewDay,
    preloadedFirstCustomer, onCustomerUsed,
    resetForNewCustomer, startConversation
  } = ctx;

  // 首次进入游戏显示规则
  useEffect(() => {
    if (tutorial.isTutorialMode) {
      localStorage.setItem('bartender_has_seen_rules', 'true');
      return;
    }
    const hasSeenRules = localStorage.getItem('bartender_has_seen_rules');
    if (!hasSeenRules) {
      progress.setShowRules(true);
      localStorage.setItem('bartender_has_seen_rules', 'true');
    }
  }, [tutorial.isTutorialMode]);

  // 音频初始化 + 切换到游戏 BGM
  useEffect(() => {
    const handleFirstInteraction = () => {
      initAudio();
      document.removeEventListener('click', handleFirstInteraction);
      document.removeEventListener('keydown', handleFirstInteraction);
    };
    document.addEventListener('click', handleFirstInteraction);
    document.addEventListener('keydown', handleFirstInteraction);
    audioManager.init();
    audioManager.playBGM('home');
    return () => {
      document.removeEventListener('click', handleFirstInteraction);
      document.removeEventListener('keydown', handleFirstInteraction);
    };
  }, [initAudio]);

  // 标记是否从会话恢复（避免恢复后又触发新对话）
  const restoredFromSessionRef = useRef(false);
  // 防止 startConversation 重复触发
  const isStartingConversationRef = useRef(false);

  // 初始化顾客（优先从会话恢复，否则生成新顾客）
  useEffect(() => {
    if (customerFlow.isInitialized.current) return;
    customerFlow.isInitialized.current = true;

    const day = customerFlow.currentDay;

    const initializeFirstCustomer = async () => {
      // 🆕 尝试从会话恢复
      const session = getGameSession();
      const sessionMatchesSlot = !activeSlotId || session?.slotId === activeSlotId;
      if (session && sessionMatchesSlot && session.day === day && session.dailyCustomers?.length > 0) {
        const activeCharacterIds = getActiveCharacterIds();
        const singleActiveId = activeCharacterIds.length === 1
          ? String(activeCharacterIds[0] || '').trim().toLowerCase()
          : '';
        let unresolvedIdCount = 0;
        const restoredCustomers = session.dailyCustomers.map((item) => {
          const originalConfig = item?.config && typeof item.config === 'object' ? item.config : {};
          const inferredId = extractCharacterIdFromConfig(originalConfig) || singleActiveId;
          if (!inferredId) {
            unresolvedIdCount += 1;
            return item;
          }
          return {
            ...item,
            config: {
              ...originalConfig,
              id: inferredId,
              characterCode: inferredId,
              customCharacterId: inferredId,
              avatarCacheKey: originalConfig.avatarCacheKey || `custom_${inferredId}`,
              voiceProfile: {
                ...(originalConfig.voiceProfile || {}),
                code: String(originalConfig.voiceProfile?.code || inferredId).trim().toLowerCase(),
              },
            }
          };
        });
        if (unresolvedIdCount > 0 && !singleActiveId) {
          console.warn('⚠️ Session contains customers without resolvable character IDs, skipping restore to avoid portrait mismatch.');
          clearGameSession();
        } else {
        console.log(`🔄 Restored Day ${day} from session (guest ${session.currentCustomerIndex + 1}/${session.dailyCustomers.length})`);
        customerFlow.setDailyCustomers(restoredCustomers);
        customerFlow.setCurrentCustomerIndex(session.currentCustomerIndex || 0);
        customerFlow.setCustomerSuccessCount(session.customerSuccessCount || 0);
        customerFlow.customerSuccessCountRef.current = session.customerSuccessCount || 0;
        customerFlow.setCustomersServed(session.customersServed || 0);
        customerFlow.setDayEarnings(session.dayEarnings || 0);
        // 恢复对话和情绪状态
        if (session.dialogueHistory?.length > 0) {
          dialogue.setDialogueHistory(session.dialogueHistory);
        }
        if (session.trustLevel !== undefined) {
          setTrustLevel(session.trustLevel);
        }
        if (session.dynamicCustomerEmotions) {
          emotionSystem.setDynamicCustomerEmotions(session.dynamicCustomerEmotions);
        }
        if (session.surfaceEmotions?.length > 0) {
          emotionSystem.setSurfaceEmotions(session.surfaceEmotions);
        }
        if (session.guessedCorrectly) {
          cocktailFlow.setGuessedCorrectly(true);
          if (session.targetConditions) cocktailFlow.setTargetConditions(session.targetConditions);
          if (session.targetHint) cocktailFlow.setTargetHint(session.targetHint);
        }
        restoredFromSessionRef.current = true;
        await generateAtmosphere(day);
        customerFlow.setIsLoadingCustomers(false);
        customerFlow.setIsGameReady(true);
        clearGameSession(); // 恢复成功后清除，后续由自动保存维护
        return;
        }
      }

      console.log(`🔄 Initializing Day ${day}...`);
      await generateAtmosphere(day);

      if (preloadedFirstCustomer) {
        console.log('✅ Using preloaded first guest:', preloadedFirstCustomer.name);
        customerFlow.setDailyCustomers([{
          id: `${day}-0`, type: preloadedFirstCustomer.categoryId, config: preloadedFirstCustomer
        }]);
        onCustomerUsed && onCustomerUsed();
        customerFlow.setIsLoadingCustomers(false);
        customerFlow.setIsGameReady(true);
        return;
      }

      customerFlow.setIsLoadingCustomers(true);
      customerFlow.setCustomerLoadingProgress(`Creating the first guest for Day ${day}...`);
      try {
        const activeCharacterIds = getActiveCharacterIds();
        const firstCustomer = await generateCustomerWithCharacterPool({ activeCharacterIds });
        customerFlow.setDailyCustomers([{
          id: `${day}-0`, type: firstCustomer.categoryId, config: firstCustomer
        }]);
      } catch (error) {
        console.error('❌ Failed to generate the first guest (custom-character mode only):', error);
        const isNoActiveCharacters = error?.message === 'no_active_characters';
        if (isNoActiveCharacters) {
          customerFlow.setDailyCustomers([]);
          customerFlow.setCustomerLoadingProgress('No first guest found. Please return to New Game Setup and add/enable at least one character ID.');
          addToast('No first guest found. Please return to New Game Setup and add/enable at least one character ID.', 'error');
        } else {
          customerFlow.setDailyCustomers([]);
          addToast('Failed to create the first guest. Please check AI settings and try again.', 'error');
        }
      }
      customerFlow.setIsLoadingCustomers(false);
      customerFlow.setIsGameReady(true);
    };

    initializeFirstCustomer();
  }, [preloadedFirstCustomer, onCustomerUsed, activeSlotId]);

  // 顾客变化时开始新对话 + 进阶引导检查
  useEffect(() => {
    if (customerFlow.currentCustomer && customerFlow.dailyCustomers.length > 0 && customerFlow.isGameReady && customerFlow.isInitialized.current && isBarSceneReady) {
      // 如果是从会话恢复的，跳过第一次重置和开场白（状态已恢复）
      if (restoredFromSessionRef.current) {
        restoredFromSessionRef.current = false;
        customerFlow.prevDayRef.current = customerFlow.currentDay;
        customerFlow.prevCustomerIndexRef.current = customerFlow.currentCustomerIndex;
        return;
      }
      const dayChanged = customerFlow.prevDayRef.current !== customerFlow.currentDay;
      const customerChanged = customerFlow.prevCustomerIndexRef.current !== customerFlow.currentCustomerIndex;
      customerFlow.prevDayRef.current = customerFlow.currentDay;
      customerFlow.prevCustomerIndexRef.current = customerFlow.currentCustomerIndex;
      if (dayChanged || customerChanged || dialogue.dialogueHistory.length === 0) {
        // 防止重复触发（dailyCustomers 数组引用变化会导致此 effect 反复执行）
        if (isStartingConversationRef.current) return;
        isStartingConversationRef.current = true;
        resetForNewCustomer();
        startConversation().finally(() => {
          isStartingConversationRef.current = false;
        });

        // 🆕 进阶引导：顾客进入时检查
        if (!tutorial.isTutorialMode && ctx.advancedGuides) {
          const config = customerFlow.currentCustomer?.config;
          setTimeout(() => {
            ctx.advancedGuides.checkGuide('customer_entered', {
              day: customerFlow.currentDay,
              isReturnCustomer: config?.isReturnCustomer || false,
              visit_count: config?.visitCount || 1,
              isFirstTime: !ctx.advancedGuides.hasSeenGuide('return_customer_first')
            });
          }, 2000);
        }
      }
    }
  }, [customerFlow.currentCustomerIndex, customerFlow.currentDay, customerFlow.dailyCustomers, isBarSceneReady]);

  // 🆕 进阶引导：信任度达到阈值
  useEffect(() => {
    if (!tutorial.isTutorialMode && ctx.advancedGuides && trustLevel >= 0.6) {
      ctx.advancedGuides.checkGuide('trust_level_reached', {
        trust: trustLevel,
        customerCount: progress.gameStats?.totalServed || 0
      });
    }
  }, [trustLevel]);

  // 顾客离开判定：总杯数达到上限 或 提前离开（由 handleServeCocktail 中的 willLeave 控制）
  useEffect(() => {
    const cocktailCount = customerFlow.customerCocktailCount;
    if (cocktailCount >= customerFlow.MAX_COCKTAILS_PER_CUSTOMER && !progress.autoTestRunning) {
      const parting = customerFlow.customerSuccessCount > 0 ? 'success_complete' : 'served_complete';
      const timer = setTimeout(() => {
        customerFlow.handleCustomerLeaveRef.current(parting);
      }, 1000);
      return () => clearTimeout(timer);
    }
    if (cocktailCount >= customerFlow.MAX_COCKTAILS_PER_CUSTOMER && progress.autoTestRunning) {
      // 自动测试：不走离场动画，但仍需记录顾客数据和评估回头客
      const config = customerFlow.currentCustomer?.config;
      const parting = customerFlow.customerSuccessCount > 0 ? 'satisfied' : 'neutral';
      if (config && !config.isTutorialCustomer && ctx.recordCustomer && ctx.evaluateReturnPotential) {
        ctx.recordCustomer(config, dialogue.dialogueHistory, parting, trustLevel);
        if (!config.isReturnCustomer) {
          ctx.evaluateReturnPotential({
            name: config.name, category: config.categoryId, backstory: config.backstory,
            openThreads: [], bestResonance: Math.round(trustLevel * 100), parting,
            dialogueRounds: dialogue.dialogueHistory.length, trustLevel, aiConfig: config,
            emotionState: emotionSystem.dynamicCustomerEmotions, day: customerFlow.currentDay
          });
        }
      }
      customerFlow.customerSuccessCountRef.current = 0;
      customerFlow.setCustomerSuccessCount(0);
      customerFlow.customerCocktailCountRef.current = 0;
      customerFlow.setCustomerCocktailCount(0);
      console.log('🤖 [Auto Test] Reset drink counter and recorded guest data');
    }
  }, [customerFlow.customerCocktailCount, progress.autoTestRunning]);

  // 更新快捷选项
  useEffect(() => {
    const options = generateQuickOptions(aiConfig, trustLevel, dialogue.dialogueHistory);
    if (!tutorial.isTutorialMode && options.length > 0) {
      options.push('……');
    }
    dialogue.setQuickOptions(options);
  }, [aiConfig, trustLevel, dialogue.dialogueHistory, tutorial.isTutorialMode]);

  // 自动保存（短期记忆）
  useEffect(() => {
    if (dialogue.dialogueHistory.length > 0 && customerFlow.isInitialized.current) {
      const timer = setTimeout(() => {
        saveShortMemory(aiType, {
          trustLevel,
          dialogueHistory: dialogue.dialogueHistory,
          surfaceEmotions: emotionSystem.surfaceEmotions
        });
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [dialogue.dialogueHistory, trustLevel, emotionSystem.surfaceEmotions, aiType]);

  // 🆕 自动保存游戏会话（对话/顾客队列/状态，用于刷新恢复）
  // 精简顾客数据：剥离 avatarBase64 等大字段，避免超出 localStorage 配额
  useEffect(() => {
    if (!customerFlow.isInitialized.current || tutorial.isTutorialMode) return;
    if (customerFlow.dailyCustomers.length === 0) return;

    const timer = setTimeout(() => {
      try {
        // 精简顾客配置：去掉头像 base64 和过长的对话历史
        const slimCustomers = customerFlow.dailyCustomers.map(c => ({
          id: c.id,
          type: c.type,
          config: c.config ? {
            ...c.config,
            avatarBase64: undefined,  // 去掉 base64 头像（最大的字段）
            initialDialogue: undefined // 去掉初始对话（已在 dialogueHistory 中）
          } : c.config
        }));

        // 对话历史只保留最近 20 条（防止对话太长撑爆配额）
        const trimmedHistory = (dialogue.dialogueHistory || []).slice(-20);

        saveGameSession({
          slotId: activeSlotId || null,
          day: customerFlow.currentDay,
          dailyCustomers: slimCustomers,
          currentCustomerIndex: customerFlow.currentCustomerIndex,
          customerSuccessCount: customerFlow.customerSuccessCount,
          customersServed: customerFlow.customersServed,
          dayEarnings: customerFlow.dayEarnings,
          dialogueHistory: trimmedHistory,
          trustLevel,
          dynamicCustomerEmotions: emotionSystem.dynamicCustomerEmotions,
          surfaceEmotions: emotionSystem.surfaceEmotions,
          guessedCorrectly: cocktailFlow.guessedCorrectly,
          targetConditions: cocktailFlow.targetConditions,
          targetHint: cocktailFlow.targetHint
        });
      } catch (e) {
        console.warn('⚠️ Failed to save session data (possibly over quota):', e.message);
      }
    }, 1000);
    return () => clearTimeout(timer);
  }, [
    activeSlotId, dialogue.dialogueHistory, trustLevel, customerFlow.currentCustomerIndex,
    customerFlow.customerSuccessCount, cocktailFlow.guessedCorrectly,
    customerFlow.dailyCustomers.length, customerFlow.customersServed
  ]);
};
