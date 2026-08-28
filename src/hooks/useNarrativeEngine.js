// AI叙事引擎 Hook
import { useState, useCallback } from 'react';
import { getReturnCustomers, saveReturnCustomers, updateReturnCustomer, getNarrativeState, saveNarrativeState } from '../utils/storage.js';
import { API_CONFIG, PROMPT_TYPES, generatePrompt } from '../config/api.js';
import { saveAvatarToCache, getAvatarFromCache } from '../utils/avatarCache.js';
import { resolveCrossroads } from '../utils/crossroadsResolver.js';

/**
 * 叙事引擎 Hook
 * 管理回头客、角色弧光、叙事编排
 */
export const useNarrativeEngine = () => {
  const [returnCustomerPool, setReturnCustomerPool] = useState(() => getReturnCustomers());
  const [narrativeState, setNarrativeState] = useState(() => getNarrativeState());

  /**
   * 顾客离开时：评估是否应成为回头客
   */
  const evaluateReturnPotential = useCallback((customerRecord) => {
    let score = 0;
    if (customerRecord.openThreads?.length > 0) score += 30;
    if (customerRecord.trustLevel >= 0.7) score += 25;
    if (customerRecord.backstory?.length > 50) score += 15;
    if (customerRecord.parting === 'satisfied') score += 20;
    if (customerRecord.dialogueRounds >= 6) score += 10;

    if (score < 50) return false;
    if (returnCustomerPool.length >= 15) return false;

    const returnCustomer = {
      id: `return_${customerRecord.category}_${customerRecord.name}_${customerRecord.day}`,
      originalConfig: customerRecord.aiConfig,
      name: customerRecord.name,
      category: customerRecord.category,
      relationship: {
        totalVisits: 1,
        intimacy: customerRecord.trustLevel,
        sharedHistory: [{
          day: customerRecord.day,
          summary: `First visit. ${customerRecord.parting === 'satisfied' ? 'Left satisfied' : 'Left for the night'}. ${customerRecord.openThreads?.[0]?.description || ''}`.trim()
        }]
      },
      characterArc: {
        currentPhase: 'introduction',
        phases: [{
          phase: 'introduction',
          day: customerRecord.day,
          state: customerRecord.backstory?.slice(0, 50) || 'First visit',
          emotions: customerRecord.emotionState?.reality || [],
          resolved: true
        }],
        nextVisitSetup: {
          visitReason: 'Wanted to stop by again',
          openingMood: 'casual',
          storyDirection: customerRecord.openThreads?.[0]?.potentialFollowUp || 'Continue the previous conversation',
          suggestedDayGap: 5
        }
      },
      // 🆕 十字路口数据
      crossroads: {
        active: false,
        dilemma: '',
        options: [],
        influenceFactors: {
          cocktailAttitudes: [],
          trustAtEnd: 0,
          dialogueKeywords: []
        },
        resolvedOption: null,
        resolvedDay: null
      },
      emotionTrajectory: [{
        day: customerRecord.day,
        emotions: customerRecord.emotionState || { surface: [], reality: [] }
      }],
      scheduling: {
        nextPossibleDay: customerRecord.day + 1 + Math.floor(Math.random() * 2), // 最早第2天回来
        returnPriority: score,
        weatherCondition: null,
        isScheduled: false,
        missedDays: 0 // 连续未被安排的天数
      }
    };

    const updated = [...returnCustomerPool, returnCustomer];
    setReturnCustomerPool(updated);
    saveReturnCustomers(updated);

    // 🆕 持久化回头客头像（不会被 LRU 淘汰）
    if (customerRecord.aiConfig?.avatarBase64) {
      saveAvatarToCache(`return_${returnCustomer.id}`, customerRecord.aiConfig.avatarBase64, true)
        .catch(err => console.warn('Failed to persist return-customer avatar:', err));
    }

    console.log(`New return customer added: ${returnCustomer.name} (score ${score})`);
    return true;
  }, [returnCustomerPool]);

  /**
   * 每天开始时：决定哪些回头客来访
   */
  const scheduleReturnCustomers = useCallback((day, weather) => {
    const maxReturns = 2; // 每天最多2个回头客
    const minReturns = (day >= 5 && returnCustomerPool.length > 0) ? 1 : 0; // 第5天起保底1个

    // 候选：到了可回访日期 且 未被调度
    const candidates = returnCustomerPool
      .filter(c => c.scheduling.nextPossibleDay <= day && !c.scheduling.isScheduled)
      .sort((a, b) => {
        // 优先级：评分高的先来；超期越久越优先
        const overdueDiff = (day - a.scheduling.nextPossibleDay) - (day - b.scheduling.nextPossibleDay);
        if (overdueDiff !== 0) return overdueDiff > 0 ? -1 : 1;
        return b.scheduling.returnPriority - a.scheduling.returnPriority;
      });

    // 天气不作为硬过滤，只作为排序加权（避免天气不匹配导致全部被排除）
    const scheduled = [];
    for (const candidate of candidates) {
      if (scheduled.length >= maxReturns) break;
      const returnChance = Math.min(0.9, candidate.scheduling.returnPriority / 100 * 0.9 + 0.05);
      if (Math.random() < returnChance) {
        scheduled.push(candidate);
      }
    }

    // 保底机制：第5天起如果有回头客但概率全没中，强制安排优先级最高的
    if (scheduled.length < minReturns && candidates.length > 0) {
      for (const candidate of candidates) {
        if (scheduled.some(s => s.id === candidate.id)) continue;
        scheduled.push(candidate);
        if (scheduled.length >= minReturns) break;
      }
    }

    return scheduled;
  }, [returnCustomerPool]);

  /**
   * 每天开始时：编排叙事节奏
   */
  const orchestrateDay = useCallback((day, weather) => {
    const recentTensions = narrativeState.recentTensions || [];
    let dramaTension = 'low';
    const recentHighCount = recentTensions.slice(-3).filter(t => t === 'high' || t === 'climax').length;
    if (recentHighCount >= 2) {
      dramaTension = 'low';
    } else if (day % 15 === 0) {
      dramaTension = 'climax';
    } else if (day % 7 === 0) {
      dramaTension = 'high';
    } else {
      dramaTension = Math.random() > 0.6 ? 'medium' : 'low';
    }

    const returnCustomers = scheduleReturnCustomers(day, weather);
    const totalCustomers = Math.min(2 + Math.floor(day / 3), 5);
    const newCustomerCount = Math.max(1, totalCustomers - returnCustomers.length);

    const updatedState = {
      ...narrativeState,
      recentTensions: [...recentTensions.slice(-6), dramaTension]
    };
    setNarrativeState(updatedState);
    saveNarrativeState(updatedState);

    return { returnCustomers, dramaTension, newCustomerCount };
  }, [scheduleReturnCustomers, narrativeState]);

  /**
   * 回头客离开时：推进角色弧光
   */
  const advanceArc = useCallback(async (returnCustomerId, interactionSummary) => {
    const customer = returnCustomerPool.find(c => c.id === returnCustomerId);
    if (!customer) return;

    // 更新 relationship
    customer.relationship.totalVisits += 1;
    customer.relationship.intimacy = Math.max(customer.relationship.intimacy, interactionSummary.trustLevel || 0);
    customer.relationship.sharedHistory.push({
      day: interactionSummary.day,
      summary: `Visit ${customer.relationship.totalVisits}: ${interactionSummary.keyDialogue?.slice(0, 30) || 'Shared a long conversation'}`
    });
    if (customer.relationship.sharedHistory.length > 10) {
      customer.relationship.sharedHistory = customer.relationship.sharedHistory.slice(-10);
    }

    // 尝试 AI 推进弧光
    let arcResult = null;
    try {
      if (API_CONFIG.gemini.enabled) {
        const prompt = generatePrompt(PROMPT_TYPES.ADVANCE_CHARACTER_ARC, {
          customerName: customer.name,
          currentPhase: customer.characterArc.currentPhase,
          completedPhases: customer.characterArc.phases,
          ...interactionSummary
        });
        
        const url = `${API_CONFIG.gemini.endpoint}/${API_CONFIG.gemini.model}:generateContent?key=${API_CONFIG.gemini.apiKey}`;
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.6, maxOutputTokens: 1024, candidateCount: 1 }
          })
        });

        if (response.ok) {
          const data = await response.json();
          const parts = data.candidates?.[0]?.content?.parts;
          if (parts) {
            let text = '';
            for (let i = parts.length - 1; i >= 0; i--) {
              if (parts[i].text) { text = parts[i].text; break; }
            }
            const cleaned = text.replace(/```(?:json)?\s*([\s\S]*?)```/, '$1').trim();
            const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              arcResult = JSON.parse(jsonMatch[0]);
              console.log('Character arc advanced successfully:', arcResult.newPhase);
            }
          }
        }
      }
    } catch (err) {
      console.warn('AI-driven arc advancement failed:', err);
    }

    // 降级：简单阶段推进
    if (!arcResult) {
      const phases = ['introduction', 'escalation', 'turning_point', 'resolution', 'epilogue'];
      const currentIdx = phases.indexOf(customer.characterArc.currentPhase);
      const empathy = interactionSummary.empathyScore || 50;
      arcResult = {
        newPhase: empathy >= 70 && currentIdx < phases.length - 1 ? phases[currentIdx + 1] : customer.characterArc.currentPhase,
        newState: 'The story is still unfolding',
        newEmotions: customer.emotionTrajectory[customer.emotionTrajectory.length - 1]?.emotions,
        nextVisitSetup: {
          visitReason: 'Still wants to come back',
          openingMood: 'familiar',
          storyDirection: 'Pick up where the last conversation left off',
          suggestedDayGap: 5
        }
      };
    }

    // 更新弧光
    if (arcResult.newPhase !== customer.characterArc.currentPhase) {
      customer.characterArc.phases.push({
        phase: arcResult.newPhase,
        day: interactionSummary.day,
        state: arcResult.newState || '',
        emotions: arcResult.newEmotions?.reality || [],
        resolved: false
      });
    }
    customer.characterArc.currentPhase = arcResult.newPhase;
    if (arcResult.nextVisitSetup) {
      customer.characterArc.nextVisitSetup = arcResult.nextVisitSetup;
    }

    // 🆕 十字路口处理
    // 1. 如果有活跃的十字路口，在离开时解决
    if (customer.crossroads?.active) {
      // 积累本次的酒态度影响
      customer.crossroads.influenceFactors.cocktailAttitudes = [
        ...(customer.crossroads.influenceFactors.cocktailAttitudes || []),
        ...(interactionSummary.cocktailAttitudes || [])
      ];
      customer.crossroads.influenceFactors.trustAtEnd = interactionSummary.trustLevel || 0;

      // 用确定性算法决定走向
      const resolvedId = resolveCrossroads(customer.crossroads);
      if (resolvedId) {
        customer.crossroads.resolvedOption = resolvedId;
        customer.crossroads.resolvedDay = interactionSummary.day;
        customer.crossroads.active = false;
        // 标记选中的选项
        customer.crossroads.options = customer.crossroads.options.map(o => ({
          ...o,
          wasChosen: o.id === resolvedId
        }));
        const chosenDesc = customer.crossroads.options.find(o => o.id === resolvedId)?.description || '';
        console.log(`Crossroads resolved: ${customer.name} chose "${chosenDesc}"`);
        
        // 在共同记忆中标记
        customer.relationship.sharedHistory.push({
          day: interactionSummary.day,
          summary: `Faced a decision: ${customer.crossroads.dilemma} (Crossroads)`,
          isCrossroads: true
        });
      }
    }

    // 2. 如果 AI 返回了新的十字路口（escalation/turning_point 阶段），激活它
    if (arcResult.crossroads && (arcResult.newPhase === 'escalation' || arcResult.newPhase === 'turning_point')) {
      customer.crossroads = {
        active: true,
        dilemma: arcResult.crossroads.dilemma || '',
        options: (arcResult.crossroads.options || []).map(o => ({
          id: o.id,
          description: o.description,
          consequence: '',
          wasChosen: false
        })),
        influenceFactors: {
          cocktailAttitudes: interactionSummary.cocktailAttitudes || [],
          trustAtEnd: interactionSummary.trustLevel || 0,
          dialogueKeywords: []
        },
        resolvedOption: null,
        resolvedDay: null
      };
      console.log(`Crossroads activated: ${customer.name} - ${arcResult.crossroads.dilemma}`);
    } else if (arcResult.crossroads === undefined && 
               (arcResult.newPhase === 'escalation' || arcResult.newPhase === 'turning_point') &&
               !customer.crossroads?.active && !customer.crossroads?.resolvedOption) {
      throw new Error(`crossroads_missing_for_phase:${customer.id}`);
    }

    // 更新情绪轨迹
    customer.emotionTrajectory.push({
      day: interactionSummary.day,
      emotions: arcResult.newEmotions || customer.emotionTrajectory[customer.emotionTrajectory.length - 1]?.emotions
    });
    if (customer.emotionTrajectory.length > 10) {
      customer.emotionTrajectory = customer.emotionTrajectory.slice(-10);
    }

    // 更新调度（间隔缩短：默认2-3天，AI可建议更长但上限5天）
    const gap = Math.min(5, arcResult.nextVisitSetup?.suggestedDayGap || 3);
    customer.scheduling.nextPossibleDay = interactionSummary.day + Math.max(1, gap);
    customer.scheduling.isScheduled = false;
    customer.scheduling.missedDays = 0;

    // 终章检查
    if (customer.characterArc.currentPhase === 'epilogue') {
      customer.scheduling.nextPossibleDay = 999999;
    }

    updateReturnCustomer(customer.id, customer);
    
    // 更新本地状态
    setReturnCustomerPool(prev => prev.map(c => c.id === customer.id ? customer : c));
  }, [returnCustomerPool]);

  /**
   * 将回头客转为可用的顾客 config
   */
  /**
   * 构建回头客 config（async 以加载缓存头像）
   */
  const buildReturnCustomerConfig = useCallback(async (returnCustomer) => {
    const lastEmotions = returnCustomer.emotionTrajectory[returnCustomer.emotionTrajectory.length - 1]?.emotions;
    
    // 🆕 尝试加载缓存头像
    let avatarBase64 = returnCustomer.originalConfig?.avatarBase64 || null;
    try {
      const cached = await getAvatarFromCache(`return_${returnCustomer.id}`);
      if (cached) avatarBase64 = cached;
    } catch (e) { /* ignore */ }

    return {
      ...returnCustomer.originalConfig,
      isReturnCustomer: true,
      returnCustomerId: returnCustomer.id,
      sharedHistory: returnCustomer.relationship.sharedHistory,
      characterArc: returnCustomer.characterArc,
      visitCount: returnCustomer.relationship.totalVisits + 1,
      intimacy: returnCustomer.relationship.intimacy,
      avatarBase64,
      avatarCacheKey: `return_${returnCustomer.id}`,
      // 🆕 传递已解决的十字路口（用于开场白 prompt 揭示结果）
      crossroads: returnCustomer.crossroads?.resolvedOption ? returnCustomer.crossroads : null,
      emotionMask: {
        ...returnCustomer.originalConfig.emotionMask,
        surface: lastEmotions?.surface || returnCustomer.originalConfig.emotionMask?.surface || ['trust'],
        reality: lastEmotions?.reality || returnCustomer.originalConfig.emotionMask?.reality || ['fear']
      }
    };
  }, []);

  /**
   * 🆕 获取最近已解决的十字路口摘要（用于氛围生成）
   */
  const getRecentCrossroadsSummaries = useCallback(() => {
    const summaries = [];
    for (const customer of returnCustomerPool) {
      if (customer.crossroads?.resolvedOption && customer.crossroads?.dilemma) {
        const chosen = customer.crossroads.options?.find(o => o.id === customer.crossroads.resolvedOption);
        summaries.push(
          `${customer.name} faced "${customer.crossroads.dilemma}" and ultimately chose "${chosen?.description || 'Unknown'}"`
        );
      }
    }
    return summaries.slice(-5); // 最多5条
  }, [returnCustomerPool]);

  return {
    returnCustomerPool,
    evaluateReturnPotential,
    scheduleReturnCustomers,
    orchestrateDay,
    advanceArc,
    buildReturnCustomerConfig,
    getRecentCrossroadsSummaries
  };
};

export default useNarrativeEngine;
