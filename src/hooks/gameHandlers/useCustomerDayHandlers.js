import { useCallback } from 'react';
import { generateCustomerWithCharacterPool } from '../../utils/aiService.js';
import { clearGameSession, getActiveCharacterIds, getReturnCustomers, saveGameProgress } from '../../utils/storage.js';
import { appendActiveNpcEvent, queueActiveSlotGameStateSync, setActiveNpcId } from '../../utils/saveRepository.js';

export const useCustomerDayHandlers = ({ ctx, refs }) => {
  const { consecutiveSilenceRef, totalSilenceRef } = refs;
  const {
    tutorial, progress, customerFlow, dialogue, emotionSystem, cocktailFlow,
    chapterSystem, playSFX, addToast, clearToasts, aiConfig, trustLevel, setTrustLevel,
    money, atmosphere, resetDailyEvents, clearCustomerRestrictions, checkPendingChains,
    tryStartChain, generateDailyMemoryRecord, recordCustomer, advanceArc,
    evaluateReturnPotential, orchestrateDay, buildReturnCustomerConfig,
    getRecentCrossroadsSummaries, generateAtmosphere, triggerEvent
  } = ctx;

  const resetForNewCustomer = useCallback(() => {
    const nextCustomer = customerFlow.dailyCustomers[customerFlow.currentCustomerIndex + 1] || customerFlow.dailyCustomers[customerFlow.currentCustomerIndex];
    const initTrust = 0;
    setTrustLevel(initTrust);
    dialogue.resetDialogue();
    emotionSystem.resetEmotionState();
    cocktailFlow.resetCocktailState();
    customerFlow.customerSuccessCountRef.current = 0;
    customerFlow.setCustomerSuccessCount(0);
    // 重置顾客酒杯计数
    customerFlow.customerCocktailCountRef.current = 0;
    customerFlow.setCustomerCocktailCount(0);
    // 重置沉默计数
    consecutiveSilenceRef.current = 0;
    totalSilenceRef.current = 0;
    customerFlow.setNextCustomerGenerationFailed(false);
  }, [customerFlow.dailyCustomers, customerFlow.currentCustomerIndex]);

  const switchToNextCustomer = useCallback(() => {
    customerFlow.setShowCustomerLeave(false);
    customerFlow.setCustomerLeaveParting('neutral');
    customerFlow.setCustomersServed(prev => prev + 1);
    const nextCustomersServed = customerFlow.customersServed + 1;
    clearCustomerRestrictions();

    playSFX('door');
    customerFlow.setShowCustomerEnter(true);
    setTimeout(() => customerFlow.setShowCustomerEnter(false), 1200);

    // 判断今日是否结束：总杯数达标，或已服务到当日最后一位顾客
    const reachedDailyCustomerCap = customerFlow.currentCustomerIndex >= customerFlow.MAX_CUSTOMERS_PER_DAY - 1;
    const noNextCustomerInQueue = customerFlow.currentCustomerIndex >= customerFlow.dailyCustomers.length - 1;
    const dailyDone = customerFlow.dailyCocktailCountRef.current >= customerFlow.TARGET_DAILY_COCKTAILS
      || (reachedDailyCustomerCap && noNextCustomerInQueue);
    const shouldEndDayBecauseQueueExhausted = noNextCustomerInQueue
      && !customerFlow.isGeneratingNextCustomer
      && customerFlow.nextCustomerGenerationFailed;

    if (!dailyDone && customerFlow.currentCustomerIndex < customerFlow.dailyCustomers.length - 1) {
      customerFlow.setCurrentCustomerIndex(prev => prev + 1);
      const nextId = customerFlow.dailyCustomers[customerFlow.currentCustomerIndex + 1]?.id;
      if (nextId) setActiveNpcId(nextId);
    } else if (dailyDone || shouldEndDayBecauseQueueExhausted) {
      console.log(`📋 Business closed for today (total drinks: ${customerFlow.dailyCocktailCountRef.current}, guests: ${customerFlow.dailyCustomers.length})`);
      const ctxRef = customerFlow.switchContextRef.current;
      generateDailyMemoryRecord(ctxRef.currentDay, {
        customersServed: nextCustomersServed, successCount: ctxRef.daySuccessCount,
        failureCount: ctxRef.dayFailureCount, totalEarnings: ctxRef.dayEarnings
      }, ctxRef.atmosphere).then(memory => customerFlow.setDailyMemory(memory)).catch(() => {});
      customerFlow.setShowDayEnd(true);
      playSFX('success');
      queueActiveSlotGameStateSync('day_end');
    } else {
      console.log('⏳ Waiting for the next guest to finish generating...');
      customerFlow.setIsLoadingCustomers(true);
      customerFlow.setCustomerLoadingProgress('Next guest arriving...');

      const capturedIndex = customerFlow.currentCustomerIndex;

      customerFlow.waitForCustomerIntervalRef.current = setInterval(() => {
        customerFlow.setDailyCustomers(current => {
          if (capturedIndex < current.length - 1) {
            clearInterval(customerFlow.waitForCustomerIntervalRef.current);
            clearTimeout(customerFlow.waitForCustomerTimeoutRef.current);
            console.log('✅ New guest arrived');
            customerFlow.setIsLoadingCustomers(false);
            customerFlow.setCurrentCustomerIndex(prev => prev + 1);
          }
          return current;
        });
      }, 500);

      customerFlow.waitForCustomerTimeoutRef.current = setTimeout(() => {
        clearInterval(customerFlow.waitForCustomerIntervalRef.current);
        customerFlow.setDailyCustomers(current => {
          if (capturedIndex >= current.length - 1) {
            console.log('⏰ Wait timed out, closing business for the day');
            customerFlow.setIsLoadingCustomers(false);
            const ctxRef = customerFlow.switchContextRef.current;
            generateDailyMemoryRecord(ctxRef.currentDay, {
              customersServed: ctxRef.customersServed, successCount: ctxRef.daySuccessCount,
              failureCount: ctxRef.dayFailureCount, totalEarnings: ctxRef.dayEarnings
            }, ctxRef.atmosphere).then(memory => customerFlow.setDailyMemory(memory)).catch(() => {});
            customerFlow.setShowDayEnd(true);
            playSFX('success');
          }
          return current;
        });
      }, 10000);
    }
  }, [customerFlow.currentCustomerIndex, customerFlow.dailyCustomers.length, customerFlow.customersServed, playSFX, clearCustomerRestrictions, generateDailyMemoryRecord]);

  const handleCustomerLeave = useCallback((reason) => {
    customerFlow.setShowCustomerLeave(true);
    const parting = reason === 'success_complete'
      ? 'satisfied'
      : reason === 'served_complete'
          ? 'neutral'
          : 'neutral';
    customerFlow.setCustomerLeaveParting(parting);
    appendActiveNpcEvent({
      role: 'system',
      type: 'customer_leave',
      content: parting,
      timestamp: Date.now(),
      meta: {
        reason,
        trustLevel
      }
    }).catch(() => {});
    if (aiConfig && !aiConfig.isTutorialCustomer) {
      recordCustomer(aiConfig, dialogue.dialogueHistory, parting, trustLevel);
      if (aiConfig.isReturnCustomer) {
        advanceArc(aiConfig.returnCustomerId, {
          empathyScore: Math.round(trustLevel * 100),
          bestResonance: Math.round(trustLevel * 100),
          keyDialogue: dialogue.dialogueHistory.filter(d => d.role === 'ai').slice(-1)[0]?.content || '',
          bartenderApproach: 'empathetic',
          day: customerFlow.currentDay, trustLevel,
          cocktailAttitudes: cocktailFlow.cocktailAttitudes
        });
      } else {
        evaluateReturnPotential({
          name: aiConfig.name, category: aiConfig.categoryId, backstory: aiConfig.backstory,
          openThreads: [], bestResonance: Math.round(trustLevel * 100), parting,
          dialogueRounds: dialogue.dialogueHistory.length, trustLevel, aiConfig,
          emotionState: emotionSystem.dynamicCustomerEmotions, day: customerFlow.currentDay
        });
      }
    }

    setTimeout(() => switchToNextCustomer(), 1500);
    queueActiveSlotGameStateSync('customer_leave');
  }, [customerFlow.currentCustomerIndex, customerFlow.dailyCustomers.length, customerFlow.currentDay,
    switchToNextCustomer, addToast, aiConfig, dialogue.dialogueHistory, trustLevel,
    emotionSystem.dynamicCustomerEmotions, recordCustomer, advanceArc, evaluateReturnPotential, cocktailFlow.cocktailAttitudes]);
  customerFlow.handleCustomerLeaveRef.current = handleCustomerLeave;

  const handleDevSkipCustomer = useCallback(() => {
    addToast('🔧 [DEV] Skipped the current guest', 'info');
    handleCustomerLeave('success_complete');
  }, [handleCustomerLeave, addToast]);

  // ==================== 天数管理 ====================

  const startNewDay = useCallback(async () => {
    clearToasts();
    // 灯塔系统：每日结算检查
    if (!tutorial.isTutorialMode) {
      try {
        await chapterSystem.processDayEnd(customerFlow.currentDay, {
          trustLevel,
          silenceCount: 0,
          plainWaterCount: 0
        });
      } catch (e) {
        console.warn('⚠️ Chapter system check failed:', e);
      }
    }

    const nextDay = customerFlow.currentDay + 1;
    customerFlow.setDayTransitionText(`Day ${nextDay}`);
    customerFlow.setShowDayTransition(true);

    // 先关闭日结算弹窗
    await new Promise(resolve => setTimeout(resolve, 600));
    customerFlow.setShowDayEnd(false);

    // 转场动画显示 2.5 秒
    await new Promise(resolve => setTimeout(resolve, 2500));

    // 先关闭转场动画，再切到加载状态（防止分支切换导致动画 DOM 重新挂载）
    customerFlow.setShowDayTransition(false);
    await new Promise(resolve => setTimeout(resolve, 300));
    customerFlow.setIsGameReady(false);

    customerFlow.setCurrentDay(nextDay);
    customerFlow.setDayEarnings(0);
    customerFlow.setCustomersServed(0);
    customerFlow.setCurrentCustomerIndex(0);
    // 重置每日成功/失败计数和总杯数
    customerFlow.daySuccessCountRef.current = 0;
    customerFlow.dayFailureCountRef.current = 0;
    customerFlow.dailyCocktailCountRef.current = 0;

    // 保存进度（天数推进时立即持久化，防止刷新丢失）
    saveGameProgress({ day: nextDay, money, stats: progress.gameStats, trustLevel });
    // 清除旧会话（新一天会生成新的会话数据）
    clearGameSession();

    resetDailyEvents();
    const crossroadsSummaries = getRecentCrossroadsSummaries();
    await generateAtmosphere(nextDay, crossroadsSummaries);

    const dueChainEvents = checkPendingChains(nextDay);
    if (dueChainEvents.length > 0) {
      console.log(`📖 Day ${nextDay} has ${dueChainEvents.length} chain events due`);
      setTimeout(() => {
        const chainEvent = dueChainEvents[0];
        if (chainEvent.event) {
          triggerEvent({
            day: nextDay, customersServed: 0, atmosphere, currentCustomer: null,
            forceEvent: { ...chainEvent.event, id: `chain_${chainEvent.chainId}_${Date.now()}` }
          });
        }
      }, 3000);
    } else {
      const chainStart = tryStartChain(nextDay);
      if (chainStart) {
        setTimeout(() => {
          triggerEvent({
            day: nextDay, customersServed: 0, atmosphere, currentCustomer: null, forceEvent: chainStart
          });
        }, 4000);
      }
    }

    const { returnCustomers: scheduledReturnsRaw } = orchestrateDay(nextDay, atmosphere?.weather || 'clear');
    let scheduledReturns = [...(scheduledReturnsRaw || [])];

    // 🆕 DEV：强制指定回头客每天作为首位（用于回头客连贯性测试）
    try {
      const forcedId = localStorage.getItem('bartender_dev_forced_return_customer_id');
      if (forcedId) {
        const pool = getReturnCustomers();
        const forced = pool.find(c => c.id === forcedId);
        if (forced && !scheduledReturns.some(c => c.id === forced.id)) {
          scheduledReturns = [forced, ...scheduledReturns];
          console.log('🧪 [DEV] Forced return guest inserted into today\'s queue:', forced.name);
        }
      }
    } catch { /* ignore */ }
    const initialCustomers = [];

    if (scheduledReturns.length > 0) {
      for (let i = 0; i < scheduledReturns.length && initialCustomers.length < customerFlow.MAX_CUSTOMERS_PER_DAY; i++) {
        try {
          const returnConfig = await buildReturnCustomerConfig(scheduledReturns[i]);
          initialCustomers.push({
            id: `${nextDay}-return-${i}`, type: returnConfig.categoryId, config: returnConfig
          });
          console.log('🔄 Return guest added to today\'s queue:', returnConfig.name);
        } catch (err) {
          console.warn('⚠️ Failed to build return guest:', err);
        }
      }
    }

    const remainingSlots = customerFlow.MAX_CUSTOMERS_PER_DAY - initialCustomers.length;
    const preloaded = [customerFlow.preloadedNextDayCustomer, customerFlow.preloadedSecondCustomer].filter(Boolean);
    for (let i = 0; i < Math.min(preloaded.length, remainingSlots); i++) {
      initialCustomers.push({
        id: `${nextDay}-${initialCustomers.length}`, type: preloaded[i].categoryId, config: preloaded[i]
      });
      console.log('✅ Using preloaded guest for Day', nextDay, `slot ${initialCustomers.length}:`, preloaded[i].name);
    }

    // 角色池补位：优先使用未出现的 activeCharacterIds，不足再随机
    if (initialCustomers.length < customerFlow.MAX_CUSTOMERS_PER_DAY) {
      const activeCharacterIds = getActiveCharacterIds();
      const usedCharacterIds = initialCustomers
        .map((item) => item?.config?.customCharacterId)
        .filter(Boolean);

      while (initialCustomers.length < customerFlow.MAX_CUSTOMERS_PER_DAY) {
        const customer = await generateCustomerWithCharacterPool({
          activeCharacterIds,
          usedCharacterIds
        });
        if (customer.customCharacterId) usedCharacterIds.push(customer.customCharacterId);
        initialCustomers.push({
          id: `${nextDay}-${initialCustomers.length}`,
          type: customer.categoryId,
          config: customer
        });
      }
    }

    customerFlow.setPreloadedNextDayCustomer(null);
    customerFlow.setPreloadedSecondCustomer(null);

    if (initialCustomers.length > 0) {
      customerFlow.setDailyCustomers(initialCustomers);
      customerFlow.setIsLoadingCustomers(false);
    } else {
      customerFlow.setIsLoadingCustomers(true);
      customerFlow.setCustomerLoadingProgress('Creating the first guest of the new day...');
      try {
        const firstCustomer = await generateCustomerWithCharacterPool({
          activeCharacterIds: getActiveCharacterIds()
        });
        customerFlow.setDailyCustomers([{
          id: `${nextDay}-0`, type: firstCustomer.categoryId, config: firstCustomer
        }]);
      } catch (error) {
        console.error('❌ Guest generation failed (custom-character mode only):', error);
        customerFlow.setDailyCustomers([]);
        addToast('No available characters found. Please return to New Game Setup and enable at least one character.', 'error');
      }
      customerFlow.setIsLoadingCustomers(false);
    }

    progress.setGameStats(prev => ({ ...prev, totalDays: nextDay }));
    customerFlow.setIsGameReady(true);
  }, [customerFlow.currentDay, customerFlow.preloadedNextDayCustomer, customerFlow.preloadedSecondCustomer,
    resetDailyEvents, generateAtmosphere, orchestrateDay, buildReturnCustomerConfig, atmosphere, clearToasts]);

  // ==================== 对话 ====================


  return {
    resetForNewCustomer,
    switchToNextCustomer,
    handleCustomerLeave,
    handleDevSkipCustomer,
    startNewDay
  };
};
