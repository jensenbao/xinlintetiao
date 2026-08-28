/**
 * useCustomerFlow - 顾客生命周期管理 Hook
 * 
 * 管理顾客队列、天数系统、预加载、动画状态：
 * - 顾客队列（dailyCustomers、currentCustomerIndex）
 * - 天数与结算（currentDay、dayEarnings、showDayEnd）
 * - 成功计数（customerSuccessCount + ref 同步）
 * - 预加载下一天顾客
 * - 入场/离场/日切换动画状态
 * - 后台生成下一个顾客
 */
import { useState, useRef, useCallback } from 'react';
import { generateCustomerWithCharacterPool } from '../utils/aiService.js';
import { getGameProgress } from '../utils/storage.js';
import { getActiveCharacterIds } from '../utils/storage.js';

const MAX_COCKTAILS_PER_CUSTOMER = 3;    // 每位顾客最多喝3杯
const getDailyCustomerCap = () => Math.max(1, getActiveCharacterIds().length || 0);

export const useCustomerFlow = () => {
  const MAX_CUSTOMERS_PER_DAY = getDailyCustomerCap();
  const TARGET_DAILY_COCKTAILS = MAX_CUSTOMERS_PER_DAY * MAX_COCKTAILS_PER_CUSTOMER;

  // ========== 天数系统 ==========
  const [currentDay, setCurrentDay] = useState(() => {
    const saved = getGameProgress();
    return saved?.day || 1;
  });
  const [dayEarnings, setDayEarnings] = useState(0);
  const [customersServed, setCustomersServed] = useState(0);
  const [showDayEnd, setShowDayEnd] = useState(false);
  const [dailyMemory, setDailyMemory] = useState(null);

  // ========== 顾客队列 ==========
  const [dailyCustomers, setDailyCustomers] = useState([]);
  const [currentCustomerIndex, setCurrentCustomerIndex] = useState(0);
  const [customerSuccessCount, setCustomerSuccessCount] = useState(0);
  const customerSuccessCountRef = useRef(0);
  const [isLoadingCustomers, setIsLoadingCustomers] = useState(true);
  const [customerLoadingProgress, setCustomerLoadingProgress] = useState('');

  // ========== 预加载 ==========
  const [preloadedNextDayCustomer, setPreloadedNextDayCustomer] = useState(null);
  const [preloadedSecondCustomer, setPreloadedSecondCustomer] = useState(null);
  const [isPreloadingNextDay, setIsPreloadingNextDay] = useState(false);
  const [isGeneratingNextCustomer, setIsGeneratingNextCustomer] = useState(false);
  const [nextCustomerGenerationFailed, setNextCustomerGenerationFailed] = useState(false);

  // ========== 动画状态 ==========
  const [showCustomerLeave, setShowCustomerLeave] = useState(false);
  const [customerLeaveParting, setCustomerLeaveParting] = useState('neutral');
  const [showCustomerEnter, setShowCustomerEnter] = useState(false);
  const [showDayTransition, setShowDayTransition] = useState(false);
  const [dayTransitionText, setDayTransitionText] = useState('');
  const [showReturnCustomerOverlay, setShowReturnCustomerOverlay] = useState(null);

  // ========== 初始化 ==========
  const [isGameReady, setIsGameReady] = useState(true);
  const isInitialized = useRef(false);

  // ========== 每日成功/失败计数（仅当天统计） ==========
  const daySuccessCountRef = useRef(0);
  const dayFailureCountRef = useRef(0);

  // ========== 每顾客酒杯计数（成功+失败） & 每日总杯数 ==========
  const customerCocktailCountRef = useRef(0);
  const [customerCocktailCount, setCustomerCocktailCount] = useState(0);
  const dailyCocktailCountRef = useRef(0);

  // ========== 关键 Refs ==========
  const prevDayRef = useRef(currentDay);
  const prevCustomerIndexRef = useRef(currentCustomerIndex);
  const handleCustomerLeaveRef = useRef(null);
  const updateGameProgressRef = useRef(null);
  const waitForCustomerIntervalRef = useRef(null);
  const waitForCustomerTimeoutRef = useRef(null);
  const switchContextRef = useRef({});

  // 当前顾客快捷引用
  const currentCustomer = dailyCustomers[currentCustomerIndex];

  // ========== 后台生成下一个顾客 ==========
  const generateNextCustomerInBackground = useCallback(async () => {
    const nextIndex = currentCustomerIndex + 1;
    if (nextIndex < dailyCustomers.length) {
      setNextCustomerGenerationFailed(false);
      console.log('⏭️ Next guest already exists, skipping generation');
      return;
    }

    // 每日顾客上限 或 总杯数达标 → 预加载下一天
    if (dailyCustomers.length >= MAX_CUSTOMERS_PER_DAY || dailyCocktailCountRef.current >= TARGET_DAILY_COCKTAILS) {
      if (!isPreloadingNextDay && !preloadedNextDayCustomer) {
        console.log('🔄 Today is full, starting preload for the next day\'s guests...');
        setIsPreloadingNextDay(true);
        try {
          const activeCharacterIds = getActiveCharacterIds();
          const usedCharacterIds = dailyCustomers
            .map((item) => item?.config?.customCharacterId)
            .filter(Boolean);

          const first = await generateCustomerWithCharacterPool({
            activeCharacterIds,
            usedCharacterIds,
          });
          const second = await generateCustomerWithCharacterPool({
            activeCharacterIds,
            usedCharacterIds: [...usedCharacterIds, first?.customCharacterId].filter(Boolean),
          });

          setPreloadedNextDayCustomer(first);
          setPreloadedSecondCustomer(second);
          console.log('✅ Preloaded two guests for the next day:', first.name, ',', second.name);
        } catch (error) {
          console.error('❌ Failed to preload next day guests (custom-character mode only):', error);
        } finally {
          setIsPreloadingNextDay(false);
        }
      }
      return;
    }

    console.log('🔄 Starting background generation for the next guest...');
    setIsGeneratingNextCustomer(true);
    setNextCustomerGenerationFailed(false);
    try {
      const activeCharacterIds = getActiveCharacterIds();
      const usedCharacterIds = dailyCustomers
        .map((item) => item?.config?.customCharacterId)
        .filter(Boolean);
      const nextCustomer = await generateCustomerWithCharacterPool({
        activeCharacterIds,
        usedCharacterIds
      });
      const newCustomer = {
        id: `${currentDay}-${nextIndex}`,
        type: nextCustomer.categoryId,
        config: nextCustomer
      };
      setDailyCustomers(prev => [...prev, newCustomer]);
      setNextCustomerGenerationFailed(false);
      console.log('✅ Next guest generated:', newCustomer.config.name);
    } catch (error) {
      setNextCustomerGenerationFailed(true);
      console.error('❌ Background guest generation failed (custom-character mode only):', error);
    } finally {
      setIsGeneratingNextCustomer(false);
    }
  }, [currentCustomerIndex, currentDay, dailyCustomers.length, isPreloadingNextDay, preloadedNextDayCustomer, MAX_CUSTOMERS_PER_DAY, TARGET_DAILY_COCKTAILS]);

  return {
    // 天数
    currentDay, setCurrentDay,
    dayEarnings, setDayEarnings,
    customersServed, setCustomersServed,
    showDayEnd, setShowDayEnd,
    dailyMemory, setDailyMemory,
    // 顾客
    dailyCustomers, setDailyCustomers,
    currentCustomerIndex, setCurrentCustomerIndex,
    currentCustomer,
    customerSuccessCount, setCustomerSuccessCount,
    customerSuccessCountRef,
    isLoadingCustomers, setIsLoadingCustomers,
    customerLoadingProgress, setCustomerLoadingProgress,
    // 预加载
    preloadedNextDayCustomer, setPreloadedNextDayCustomer,
    preloadedSecondCustomer, setPreloadedSecondCustomer,
    isPreloadingNextDay,
    isGeneratingNextCustomer, setIsGeneratingNextCustomer,
    nextCustomerGenerationFailed, setNextCustomerGenerationFailed,
    // 动画
    showCustomerLeave, setShowCustomerLeave,
    customerLeaveParting, setCustomerLeaveParting,
    showCustomerEnter, setShowCustomerEnter,
    showDayTransition, setShowDayTransition,
    dayTransitionText, setDayTransitionText,
    showReturnCustomerOverlay, setShowReturnCustomerOverlay,
    // 初始化
    isGameReady, setIsGameReady,
    isInitialized,
    // Refs
    prevDayRef, prevCustomerIndexRef,
    handleCustomerLeaveRef, updateGameProgressRef,
    waitForCustomerIntervalRef, waitForCustomerTimeoutRef,
    switchContextRef,
    daySuccessCountRef, dayFailureCountRef,
    customerCocktailCountRef, customerCocktailCount, setCustomerCocktailCount,
    dailyCocktailCountRef,
    // 方法
    generateNextCustomerInBackground,
    // 常量
    MAX_CUSTOMERS_PER_DAY,
    MAX_COCKTAILS_PER_CUSTOMER,
    TARGET_DAILY_COCKTAILS,
  };
};
