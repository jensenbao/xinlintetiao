// 动态事件管理 Hook
import { useState, useCallback, useRef } from 'react';
import { generateBarEvent } from '../utils/aiService.js';
import { EVENT_TRIGGER_CONFIG, getAvailableEventTypes, EVENT_CHAINS } from '../data/eventTemplates.js';
import { savePendingChains, getPendingChains } from '../utils/storage.js';

// 先聚焦核心玩法：暂时关闭事件系统（奖励事件/随机事件/事件链）
const EVENTS_ENABLED = false;

/**
 * 动态事件管理 Hook
 * 管理事件的触发、展示和效果应用
 * @returns {Object} 事件相关状态和方法
 */
export const useBarEvents = () => {
  // 当前活跃事件
  const [currentEvent, setCurrentEvent] = useState(null);
  // 是否显示事件通知
  const [showEventNotification, setShowEventNotification] = useState(false);
  // 今日已触发的事件数
  const [dailyEventCount, setDailyEventCount] = useState(0);
  // 最近事件叙述列表（用于去重）
  const recentEventNarrativesRef = useRef([]);
  // 上次触发同类型事件时服务的顾客序号
  const lastTypeTriggeredRef = useRef({});
  // 连续成功/失败计数
  const streakRef = useRef({ success: 0, fail: 0 });
  // 持续性效果（rest_of_day类的效果）
  const [persistentEffects, setPersistentEffects] = useState([]);
  // 🆕 当前生效的物品约束
  const [activeRestrictions, setActiveRestrictions] = useState([]);
  // 🆕 待触发的事件链
  const [pendingChains, setPendingChains] = useState(() => getPendingChains());
  // 已启动的事件链ID（避免重复启动）
  const startedChainsRef = useRef(new Set());

  /**
   * 检查是否应该触发事件
   * @param {Object} context - 上下文信息
   * @param {number} context.day - 当前天数
   * @param {number} context.customerIndex - 当前顾客序号
   * @param {boolean} context.lastWasSuccess - 上次调酒是否成功
   * @returns {boolean} 是否应触发
   */
  const shouldTriggerEvent = useCallback((context) => {
    if (!EVENTS_ENABLED) return false;

    const { day, customerIndex, lastWasSuccess } = context;

    // 更新连续成功/失败计数
    if (lastWasSuccess !== undefined) {
      if (lastWasSuccess) {
        streakRef.current.success += 1;
        streakRef.current.fail = 0;
      } else {
        streakRef.current.fail += 1;
        streakRef.current.success = 0;
      }
    }

    // 已达到每日最大事件数
    if (dailyEventCount >= EVENT_TRIGGER_CONFIG.maxEventsPerDay) {
      return false;
    }

    // 连续成功/失败触发
    if (streakRef.current.success >= EVENT_TRIGGER_CONFIG.streakTrigger.successStreak) {
      return true;
    }
    if (streakRef.current.fail >= EVENT_TRIGGER_CONFIG.streakTrigger.failStreak) {
      return true;
    }

    // 每日最少事件保底（在服务第2位顾客后如果还没触发事件）
    if (dailyEventCount < EVENT_TRIGGER_CONFIG.minEventsPerDay && customerIndex >= 1) {
      return true;
    }

    // 随机概率触发
    return Math.random() < EVENT_TRIGGER_CONFIG.perCustomerChance;
  }, [dailyEventCount]);

  /**
   * 触发事件
   * @param {Object} context - 上下文信息
   * @param {number} context.day - 当前天数
   * @param {number} context.customersServed - 已服务顾客数
   * @param {Object} context.atmosphere - 当前氛围
   * @param {Object} context.currentCustomer - 当前顾客
   * @returns {Object|null} 触发的事件
   */
  const triggerEvent = useCallback(async (context) => {
    if (!EVENTS_ENABLED) return null;

    const { day, customersServed, atmosphere, currentCustomer, forceEvent } = context;

    // 🆕 如果有强制事件（事件链），直接使用，不占用每日随机事件名额
    if (forceEvent) {
      console.log('Triggering chained event:', forceEvent.narrative?.substring(0, 30));
      setCurrentEvent(forceEvent);
      setShowEventNotification(true);
      recentEventNarrativesRef.current = [
        forceEvent.narrative,
        ...recentEventNarrativesRef.current.slice(0, 4)
      ];
      return forceEvent;
    }

    // 获取当天可用的事件类型
    const availableTypes = getAvailableEventTypes(day);

    // 根据连续成功/失败选择事件类型偏好
    let preferredType = null;
    if (streakRef.current.success >= EVENT_TRIGGER_CONFIG.streakTrigger.successStreak) {
      preferredType = 'reward';
      streakRef.current.success = 0; // 重置
    } else if (streakRef.current.fail >= EVENT_TRIGGER_CONFIG.streakTrigger.failStreak) {
      preferredType = 'reward'; // 给予帮助性事件
      streakRef.current.fail = 0;
    }

    // 选择一个可用类型（优先使用偏好类型）
    let selectedType = preferredType;
    if (!selectedType || !availableTypes.includes(selectedType)) {
      // 过滤掉冷却中的类型
      const cooledDownTypes = availableTypes.filter(type => {
        const lastTriggered = lastTypeTriggeredRef.current[type];
        return lastTriggered === undefined || 
               (customersServed - lastTriggered) >= EVENT_TRIGGER_CONFIG.typeCooldown;
      });
      
      if (cooledDownTypes.length > 0) {
        selectedType = cooledDownTypes[Math.floor(Math.random() * cooledDownTypes.length)];
      } else {
        selectedType = availableTypes[Math.floor(Math.random() * availableTypes.length)];
      }
    }

    console.log(`Triggering event of type: ${selectedType}`);

    const event = await generateBarEvent({
      day,
      customersServed,
      atmosphere,
      currentCustomer: currentCustomer?.config,
      recentEvents: recentEventNarrativesRef.current
    });
    if (event) {
      event.id = `event_${event.type}_${Date.now()}`;
      console.log('AI event generated successfully:', event.narrative);
    }

    if (event) {
      setCurrentEvent(event);
      setShowEventNotification(true);
      setDailyEventCount(prev => prev + 1);
      lastTypeTriggeredRef.current[event.type] = customersServed;
      
      // 记录最近事件叙述（保留最近 5 条）
      recentEventNarrativesRef.current = [
        event.narrative,
        ...recentEventNarrativesRef.current.slice(0, 4)
      ];
    }

    return event;
  }, []);

  /**
   * 处理玩家对事件的选择
   * @param {number} choiceIndex - 选择的索引
   * @returns {Object} 选择的效果
   */
  const handleEventChoice = useCallback((choiceIndex) => {
    if (!EVENTS_ENABLED) return null;

    if (!currentEvent || !currentEvent.choices) return null;

    const choice = currentEvent.choices[choiceIndex];
    if (!choice) return null;

    const effect = choice.effect || {};

    // 如果事件是持续性的，记录效果
    if (currentEvent.duration === 'rest_of_day' || currentEvent.duration === 'current_customer') {
      setPersistentEffects(prev => [...prev, {
        eventId: currentEvent.id,
        effects: currentEvent.effects,
        choiceEffect: effect,
        duration: currentEvent.duration
      }]);
    }

    // 🆕 如果事件包含物品约束，激活约束
    const restriction = currentEvent.effects?.itemRestriction;
    if (restriction && restriction.type) {
      const newRestriction = {
        ...restriction,
        eventId: currentEvent.id,
        duration: restriction.duration || currentEvent.duration
      };
      setActiveRestrictions(prev => [...prev, newRestriction]);
      console.log('Activated item restriction:', newRestriction);
    }

    console.log(`🎯 玩家选择: "${choice.text}"`, effect);

    // 延迟关闭通知
    setTimeout(() => {
      setShowEventNotification(false);
      setCurrentEvent(null);
    }, 500);

    return {
      ...currentEvent.effects,
      choiceEffect: effect
    };
  }, [currentEvent]);

  /**
   * 关闭事件通知（无选择时）
   */
  const dismissEvent = useCallback(() => {
    if (!EVENTS_ENABLED) return {};

    setShowEventNotification(false);
    
    // 应用事件的默认效果
    const effects = currentEvent?.effects || {};
    
    setTimeout(() => {
      setCurrentEvent(null);
    }, 300);

    return effects;
  }, [currentEvent]);

  /**
   * 重置每日事件状态（新的一天开始时调用）
   */
  const resetDailyEvents = useCallback(() => {
    if (!EVENTS_ENABLED) return;

    setDailyEventCount(0);
    setCurrentEvent(null);
    setShowEventNotification(false);
    setPersistentEffects([]);
    setActiveRestrictions([]); // 🆕 清除所有物品约束
    lastTypeTriggeredRef.current = {};
    streakRef.current = { success: 0, fail: 0 };
  }, []);

  /**
   * 更新连续成功/失败计数
   * @param {boolean} wasSuccess
   */
  const updateStreak = useCallback((wasSuccess) => {
    if (!EVENTS_ENABLED) return;

    if (wasSuccess) {
      streakRef.current.success += 1;
      streakRef.current.fail = 0;
    } else {
      streakRef.current.fail += 1;
      streakRef.current.success = 0;
    }
  }, []);

  /**
   * 🆕 检查到期的事件链，返回应该触发的事件
   * @param {number} day - 当前天数
   * @returns {Array} 到期的事件列表
   */
  const checkPendingChains = useCallback((day) => {
    if (!EVENTS_ENABLED) return [];

    const due = pendingChains.filter(p => p.triggerDay <= day);
    const remaining = pendingChains.filter(p => p.triggerDay > day);
    
    if (due.length > 0) {
      setPendingChains(remaining);
      savePendingChains(remaining);
      console.log(`Event chain status: ${due.length} due, ${remaining.length} pending`);
    }
    
    return due;
  }, [pendingChains]);

  /**
   * 🆕 尝试启动一个新事件链
   * @param {number} day - 当前天数
   * @returns {Object|null} 事件链的第一个事件
   */
  const tryStartChain = useCallback((day) => {
    if (!EVENTS_ENABLED) return null;

    // 过滤符合条件的事件链
    const available = EVENT_CHAINS.filter(chain => 
      day >= chain.triggerAfterDay && 
      !startedChainsRef.current.has(chain.id) &&
      Math.random() < chain.startProbability
    );

    if (available.length === 0) return null;

    const chain = available[Math.floor(Math.random() * available.length)];
    startedChainsRef.current.add(chain.id);

    console.log(`Starting event chain: ${chain.name} (${chain.id})`);

    // 注册后续事件
    const followUps = chain.events
      .filter(e => e.day_offset > 0)
      .map(e => ({
        chainId: chain.id,
        triggerDay: day + e.day_offset,
        event: e.event
      }));

    if (followUps.length > 0) {
      const updated = [...pendingChains, ...followUps];
      setPendingChains(updated);
      savePendingChains(updated);
    }

    // 返回第一个事件（day_offset === 0）
    const firstEvent = chain.events.find(e => e.day_offset === 0);
    return firstEvent ? { ...firstEvent.event, id: `chain_${chain.id}_${Date.now()}`, chainId: chain.id } : null;
  }, [pendingChains]);

  /**
   * 🆕 清除 current_customer 级别的约束（顾客切换时调用）
   */
  const clearCustomerRestrictions = useCallback(() => {
    if (!EVENTS_ENABLED) return;

    setActiveRestrictions(prev => prev.filter(r => r.duration !== 'current_customer'));
    setPersistentEffects(prev => prev.filter(e => e.duration !== 'current_customer'));
  }, []);

  return {
    // 状态
    currentEvent,
    showEventNotification,
    dailyEventCount,
    persistentEffects,
    activeRestrictions,  // 🆕
    eventsEnabled: EVENTS_ENABLED,

    // 方法
    shouldTriggerEvent,
    triggerEvent,
    handleEventChoice,
    dismissEvent,
    resetDailyEvents,
    updateStreak,
    clearCustomerRestrictions,
    checkPendingChains,
    tryStartChain
  };
};

export default useBarEvents;
