import { useCallback } from 'react';
import { callAIAPI, callAIForTrustJudgment } from '../../utils/aiService.js';
import { PROMPT_TYPES } from '../../config/api.js';
import { INITIAL_UNLOCKED_INGREDIENTS } from '../../data/ingredients.js';
import { generateSolvableTargetFromEmotionCombo } from '../../utils/cocktailMixing.js';
import { EVENT_TRIGGER_CONFIG } from '../../data/eventTemplates.js';
import { TUTORIAL_RESPONSES, TUTORIAL_TARGET } from '../../data/tutorialData.js';
import { getRelevantMemoryContext } from '../../utils/memoryContext.js';
import { getCustomerTop3Emotions } from './helpers.js';
import {
  appendActiveNpcEvent,
  buildNpcDecisionContext,
  queueActiveSlotGameStateSync
} from '../../utils/saveRepository.js';

export const useDialogueHandlers = ({ ctx, refs }) => {
  const { consecutiveSilenceRef, totalSilenceRef } = refs;
  const {
    tutorial, customerFlow, dialogue, emotionSystem, cocktailFlow,
    playSFX, addToast, showGameHint, aiConfig, trustLevel, setTrustLevel,
    unlockedItems, atmosphere, dailyEventCount, triggerEvent, chapterSystem, eventsEnabled
  } = ctx;

  const startConversation = useCallback(async () => {
    dialogue.setIsLoading(true);
    try {
      const realityEmotions = Array.isArray(aiConfig.emotionMask?.reality) ? aiConfig.emotionMask.reality : [];
      const surfaceEmotionIds = Array.isArray(aiConfig.emotionMask?.surface) ? aiConfig.emotionMask.surface : [];
      emotionSystem.setDynamicCustomerEmotions({ surface: surfaceEmotionIds, reality: realityEmotions });

      if (tutorial.isTutorialMode) {
        dialogue.addMessage('ai', '...Do you have a drink?');
        const initialSurface = surfaceEmotionIds.map(emotionId => ({ id: emotionId }));
        emotionSystem.setSurfaceEmotions(initialSurface);
        dialogue.setQuickOptions(tutorial.getTutorialQuickOptions(1));
        dialogue.setIsLoading(false);
        return;
      }

      const initialPromptType = aiConfig.isReturnCustomer ? PROMPT_TYPES.RETURN_CUSTOMER_INITIAL : PROMPT_TYPES.INITIAL;
      const returnParams = aiConfig.isReturnCustomer ? {
        customer: aiConfig, visitCount: aiConfig.visitCount, sharedHistory: aiConfig.sharedHistory,
        characterArc: aiConfig.characterArc, currentEmotions: realityEmotions,
        visitReason: aiConfig.characterArc?.nextVisitSetup?.visitReason || '',
        intimacy: aiConfig.intimacy || 0, crossroads: aiConfig.crossroads || null
      } : {};

      // 流式输出开场白：先展示思考省略号，避免空白气泡
      dialogue.addMessage('ai', '……', false, { isThinking: true });
      dialogue.setIsLoading(false);

      let gotFirstChunk = false;

      const initialMessage = await callAIAPI(initialPromptType, {
        aiConfig, trustLevel, emotionState: { surface: [], reality: realityEmotions }, ...returnParams
      }, (accumulated) => {
        if (!gotFirstChunk) {
          gotFirstChunk = true;
          dialogue.updateLastMessageMeta?.({ isThinking: false });
        }
        dialogue.updateLastMessage(accumulated);
      });
      dialogue.updateLastMessage(initialMessage);
      dialogue.updateLastMessageMeta?.({ isThinking: false });
      appendActiveNpcEvent({
        role: 'ai',
        type: 'dialogue_opening',
        content: initialMessage,
        timestamp: Date.now()
      }).catch(() => {});

      const initialSurface = surfaceEmotionIds.map(emotionId => ({ id: emotionId }));
      emotionSystem.setSurfaceEmotions(initialSurface);

      customerFlow.generateNextCustomerInBackground();

      // 事件触发点1 已移到 handleSendMessage 中（玩家发送第一条消息后），
      // 避免开场白后挂机也会自动弹出事件
    } catch (error) {
      console.error('Failed to start conversation:', error);
      addToast('AI opening failed. No fallback opening was used.', 'error');
    } finally {
      dialogue.setIsLoading(false);
    }
  }, [aiConfig, trustLevel, tutorial.isTutorialMode]);

  const handleSendMessage = useCallback(async (message, source) => {
    playSFX('click');
    dialogue.addMessage('player', message);
    appendActiveNpcEvent({
      role: 'player',
      type: 'dialogue_player',
      content: message,
      timestamp: Date.now()
    }).catch(() => {});
    dialogue.setIsLoading(true);

    // 教学模式对话处理
    if (tutorial.isTutorialMode && tutorial.tutorialPhase === 'dialogue') {
      // 先用当前轮次获取回复，再推进（advanceTutorial 会递增 round）
      const respondRound = tutorial.dialogueRound; // 递增前的轮次（玩家发消息时所在的轮次）
      const newRound = tutorial.advanceTutorial('dialogue_sent'); // 递增后的轮次

      let response;
      // 处理沉默选项
      if (message === '……') {
        const roundKey = `round${respondRound}`;
        const responses = TUTORIAL_RESPONSES[roundKey];
        response = responses?.silence || responses?.default || '......';
        await new Promise(r => setTimeout(r, 800));
      } else if (source === 'quick') {
        response = tutorial.getTutorialResponse(message, respondRound);
        await new Promise(r => setTimeout(r, 800));
      } else {
        try {
          const realityEmotions = Array.isArray(aiConfig.emotionMask?.reality) ? aiConfig.emotionMask.reality : [];
          const tutorialAiConfig = {
            ...aiConfig, name: 'Lin Che',
            personality: ['a middle-aged person just off work', 'very tired', 'speaks little', 'uses ellipses as pauses', 'only speaks in direct dialogue with no narration or action text'],
            dialogueStyle: { ...aiConfig.dialogueStyle, tone: 'tired', length: 'short', features: ['few words', 'frequent pauses', 'brief replies', 'dialogue only'] }
          };
          response = await callAIAPI(PROMPT_TYPES.RESPONSE, {
            aiConfig: tutorialAiConfig, trustLevel,
            emotionState: { surface: ['trust'], reality: realityEmotions },
            playerInput: message, dialogueHistory: dialogue.dialogueHistory
          });
        } catch (error) {
          console.error('Tutorial AI response failed:', error);
          throw error;
        }
      }
      dialogue.addMessage('ai', response, true);
      playSFX('message');
      setTrustLevel(prev => Math.min(1, prev + 0.10));
      if (newRound < 3) {
        dialogue.setQuickOptions(tutorial.getTutorialQuickOptions(newRound + 1));
      } else {
        dialogue.setQuickOptions([]);
      }
      dialogue.setIsLoading(false);
      return;
    }

    try {
      const currentRealEmotions = emotionSystem.dynamicCustomerEmotions.reality.length > 0
        ? emotionSystem.dynamicCustomerEmotions.reality
        : (Array.isArray(aiConfig.emotionMask?.reality) ? aiConfig.emotionMask.reality : []);
      const currentEmotionState = {
        surface: emotionSystem.surfaceEmotions.map(e => e.id),
        reality: currentRealEmotions
      };
      const localMemoryContext = getRelevantMemoryContext(aiConfig);
      const saveDecisionContext = await buildNpcDecisionContext();
      const runtimeAiConfig = saveDecisionContext?.profile?.initialProfile
        ? { ...aiConfig, ...saveDecisionContext.profile.initialProfile }
        : aiConfig;
      const memoryContext = [localMemoryContext, saveDecisionContext?.memoryContext || '']
        .filter(Boolean)
        .join('\n');

      const promptType = runtimeAiConfig.isReturnCustomer ? PROMPT_TYPES.RETURN_CUSTOMER_RESPONSE : PROMPT_TYPES.RESPONSE;
      const extraParams = runtimeAiConfig.isReturnCustomer ? {
        customer: runtimeAiConfig, visitCount: runtimeAiConfig.visitCount, sharedHistory: runtimeAiConfig.sharedHistory,
        characterArc: runtimeAiConfig.characterArc, realEmotions: currentEmotionState.reality,
        dialogueStyle: runtimeAiConfig.dialogueStyle
      } : {};

      // 流式输出：先显示思考省略号，再逐步更新
      dialogue.addMessage('ai', '……', false, { isThinking: true });
      dialogue.setIsLoading(false); // 隐藏打字指示器，由实际文字替代

      let gotFirstChunk = false;

      const response = await callAIAPI(promptType, {
        aiConfig: runtimeAiConfig, trustLevel, emotionState: currentEmotionState,
        playerInput: message, dialogueHistory: dialogue.dialogueHistory,
        memoryContext, ...extraParams
      }, (accumulated) => {
        // 流式回调：实时更新最后一条消息
        if (!gotFirstChunk) {
          gotFirstChunk = true;
          dialogue.updateLastMessageMeta?.({ isThinking: false });
        }
        dialogue.updateLastMessage(accumulated);
      });

      // 流式结束后用最终清理过的文本覆盖
      dialogue.updateLastMessage(response);
      dialogue.updateLastMessageMeta?.({ isThinking: false });
      appendActiveNpcEvent({
        role: 'ai',
        type: 'dialogue_ai',
        content: response,
        timestamp: Date.now()
      }).catch(() => {});
      playSFX('message');

      const playerMsgCount = dialogue.dialogueHistory.filter(d => d.role === 'player').length + 1;

      // 沉默特殊处理（加入连续沉默递减和惩罚机制）
      if (message === '……') {
        consecutiveSilenceRef.current += 1;
        totalSilenceRef.current += 1;
        const consecutive = consecutiveSilenceRef.current;
        const total = totalSilenceRef.current;

        let silenceChange;
        if (consecutive === 1 && trustLevel >= 0.3) {
          // 第一次沉默：适当的沉默传递默契
          silenceChange = trustLevel >= 0.5 ? 0.04 : 0.02;
        } else if (consecutive === 2 && trustLevel >= 0.4) {
          // 第二次连续沉默：效果减弱
          silenceChange = 0.01;
        } else if (consecutive >= 3) {
          // 第三次及以上连续沉默：开始尴尬，扣信任
          silenceChange = -0.03 * Math.min(consecutive - 2, 3); // 最多扣 -0.09
        } else {
          // 信任度太低时沉默
          silenceChange = -0.02;
        }

        // 总沉默次数过多也会递减（一个顾客内沉默 5 次以上全部扣分）
        if (total > 5 && silenceChange > 0) {
          silenceChange = -0.02;
        }

        setTrustLevel(prev => Math.max(0, Math.min(1, prev + silenceChange)));
        cocktailFlow.addTrustFly(silenceChange);
      } else {
        // 发送了正常消息，重置连续沉默计数
        consecutiveSilenceRef.current = 0;
        try {
          const trustJudgment = await callAIForTrustJudgment({
            aiConfig: runtimeAiConfig, trustLevel, emotionState: currentEmotionState,
            playerInput: message, dialogueHistory: dialogue.dialogueHistory
          });
          if (trustJudgment) {
            let { change, reason } = trustJudgment;
            
            // === 信任度变化后处理：难度校准 + 保护机制 ===
            const metaphorLvl = aiConfig.metaphorLevel || aiConfig.dialogueStyle?.metaphorLevel || 'none';
            const playerMsgNum = dialogue.dialogueHistory.filter(d => d.role === 'player').length;
            
            // 1. 暖场保护：前2轮对话，负面变化减半，且下限为 -0.03
            if (playerMsgNum <= 2 && change < 0) {
              change = Math.max(change * 0.5, -0.03);
              console.log(`🛡️ Early-round protection: negative change softened (round ${playerMsgNum})`);
            }
            
            // 2. 隐喻难度校准：高隐喻顾客的负面变化封顶
            if (metaphorLvl === 'high' && change < 0) {
              change = Math.max(change, -0.05); // 高隐喻顾客单轮最多扣 0.05
              console.log('🎭 Metaphor calibration: capped negative change for high-metaphor guest');
            } else if (metaphorLvl === 'medium' && change < 0) {
              change = Math.max(change, -0.08); // 中隐喻顾客单轮最多扣 0.08
            }
            
            // 3. 底线保护：信任度不会因单次对话从正常区间直接掉到危险区
            if (trustLevel >= 0.2 && trustLevel + change < 0.1) {
              change = 0.1 - trustLevel; // 最多掉到 0.1，不会直接归零
              console.log('🛡️ Safety floor protection: prevented trust from dropping straight into danger');
            }
            
            // 4. 正面倾斜：高隐喻顾客的正面变化略微增加（奖励勇于交流）
            if (metaphorLvl === 'high' && change > 0) {
              change = Math.min(change * 1.2, 0.15); // 正面变化增加20%
            }
            
            if (change !== 0) {
              setTrustLevel(prev => Math.max(0, Math.min(1, prev + change)));
              cocktailFlow.addTrustFly(change);
            }
          }
        } catch (error) {
          console.error('Trust judgment failed:', error);
          throw error;
        }
      }
      // 事件触发点：基于玩家对话行为（非挂机被动触发）
      if (!tutorial.isTutorialMode && eventsEnabled) {
        const playerMsgCount = dialogue.dialogueHistory.filter(d => d.role === 'player').length + 1;

        // 触发点1：第1轮对话后（替代原来开场白后的 setTimeout）
        if (playerMsgCount === 1) {
          const chance = EVENT_TRIGGER_CONFIG.triggerPointChance?.after_greeting || 0.15;
          if (Math.random() < chance && dailyEventCount < EVENT_TRIGGER_CONFIG.maxEventsPerDay) {
            setTimeout(() => {
              triggerEvent({
                day: customerFlow.currentDay, customersServed: customerFlow.customersServed,
                atmosphere, currentCustomer: customerFlow.currentCustomer
              });
            }, 2000);
          }
        }

        // 触发点2：第3轮对话后
        if (playerMsgCount === 3) {
          const chance = EVENT_TRIGGER_CONFIG.triggerPointChance?.after_dialogue_3 || 0.20;
          if (Math.random() < chance && dailyEventCount < EVENT_TRIGGER_CONFIG.maxEventsPerDay) {
            setTimeout(() => {
              triggerEvent({
                day: customerFlow.currentDay, customersServed: customerFlow.customersServed,
                atmosphere, currentCustomer: customerFlow.currentCustomer
              });
            }, 1500);
          }
        }
      }
      queueActiveSlotGameStateSync('dialogue_turn');
    } catch (error) {
      console.error('Failed to send message:', error);
      addToast('AI dialogue failed. No fallback dialogue was used.', 'error');
    } finally {
      dialogue.setIsLoading(false);
    }
  }, [
    aiConfig,
    trustLevel,
    emotionSystem.surfaceEmotions,
    emotionSystem.dynamicCustomerEmotions,
    dialogue.dialogueHistory,
    playSFX,
    showGameHint,
    addToast,
    tutorial.isTutorialMode,
    cocktailFlow.guessReadiness
  ]);

  // ==================== 情绪猜测 ====================

  const handleConfirmGuess = useCallback(() => {
    if (emotionSystem.selectedEmotions.length < 3) { addToast('Please select 3 emotions before confirming.', 'warning'); return; }
    playSFX('click');
    cocktailFlow.setGuessAttempts(prev => prev + 1);

    const customerTop3Emotions = getCustomerTop3Emotions(aiConfig, emotionSystem.dynamicCustomerEmotions.reality);
    const hitGuesses = emotionSystem.selectedEmotions.filter(e => customerTop3Emotions.includes(e));

    cocktailFlow.setGuessedCorrectly(true);
    cocktailFlow.setEmotionGuessMode(false);
    cocktailFlow.setLastCorrectGuesses(emotionSystem.selectedEmotions);
    playSFX('success');
    addToast(`🎯 Guess confirmed (${hitGuesses.length}/3 matched)`, 'success');
    cocktailFlow.triggerGuessCorrectAnim();

    if (tutorial.isTutorialMode) tutorial.advanceTutorial('emotion_guessed');

    if (tutorial.isTutorialMode) {
      cocktailFlow.setTargetConditions(TUTORIAL_TARGET.conditions);
      cocktailFlow.setTargetHint(TUTORIAL_TARGET.hint);
    } else {
      const mixingMode = chapterSystem?.currentChapter?.mixingMode || 'strict';

      // expressive/master：不再依赖数值目标（直接用“态度”调酒）
      if (mixingMode === 'master') {
        cocktailFlow.setTargetConditions([]);
        cocktailFlow.setTargetHint('You no longer need hints. Feel their emotions and answer with a drink.');
      } else if (mixingMode === 'expressive') {
        cocktailFlow.setTargetConditions([]);
        cocktailFlow.setTargetHint('Ignore the target bars. Listen to what this person needs, then let the drink speak.');
      } else {
        const availableIngredients = unlockedItems.ingredients || INITIAL_UNLOCKED_INGREDIENTS;
        const target = generateSolvableTargetFromEmotionCombo(emotionSystem.selectedEmotions, availableIngredients);
        if (target) {
          let finalConditions = target.conditions;
          const atmosphereShift = atmosphere?.modifiers?.targetShift;
          if (atmosphereShift) {
            finalConditions = target.conditions.map(cond => {
              const shift = atmosphereShift[cond.attr];
              return (shift !== undefined && shift !== 0) ? { ...cond, value: cond.value + shift } : cond;
            });
          }
          cocktailFlow.setTargetConditions(finalConditions);
          cocktailFlow.setTargetHint(target.hint);
        }
      }
    }
    showGameHint('emotion_guessed');
  }, [emotionSystem.selectedEmotions, emotionSystem.dynamicCustomerEmotions, emotionSystem.surfaceEmotions, aiConfig, cocktailFlow.guessAttempts, unlockedItems, atmosphere, tutorial, addToast, playSFX, showGameHint, chapterSystem]);

  // ==================== 调酒 ====================


  return {
    startConversation,
    handleSendMessage,
    handleConfirmGuess
  };
};
