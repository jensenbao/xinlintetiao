/**
 * useCocktailFlow - 调酒流程管理 Hook
 * 
 * 管理情绪猜测 + 调酒相关的所有状态和辅助方法：
 * - 情绪猜测模式（开始/确认/取消）
 * - 目标三维条件
 * - 当前混合值
 * - 酒态度累计（十字路口系统）
 * - 递酒动画、调酒报告卡片、信任度飞字
 */
import { useState, useCallback } from 'react';

const createDefaultGuessReadiness = () => ({
  canGuess: false,
  trustReady: false,
  turnsReady: false,
  trustLevel: 0,
  playerTurns: 0,
  requiredTrust: 0.3,
  requiredTurns: 2,
  reason: 'Talk a little more first so you can confirm which emotion you want to answer.'
});

export const useCocktailFlow = ({ playSFX = () => {}, addToast = () => {} } = {}) => {
  // ========== 情绪猜测状态 ==========
  const [emotionGuessMode, setEmotionGuessMode] = useState(false);
  const [guessedCorrectly, setGuessedCorrectly] = useState(false);
  const [guessAttempts, setGuessAttempts] = useState(0);
  const [lastCorrectGuesses, setLastCorrectGuesses] = useState([]);
  // ========== 目标条件 ==========
  const [targetConditions, setTargetConditions] = useState([]);
  const [targetHint, setTargetHint] = useState('');

  // ========== 混合值 ==========
  const [currentMixtureValues, setCurrentMixtureValues] = useState({
    thickness: 0, sweetness: 0, strength: 0
  });

  // ========== 酒态度累计（十字路口系统）==========
  const [cocktailAttitudes, setCocktailAttitudes] = useState([]);

  // ========== 动画状态 ==========
  const [showServeAnim, setShowServeAnim] = useState(false);
  const [showCocktailResult, setShowCocktailResult] = useState(null);
  const [emotionFlash, setEmotionFlash] = useState('');
  const [emotionCardAnim, setEmotionCardAnim] = useState('');
  const [trustFlies, setTrustFlies] = useState([]);

  // ========== 辅助方法 ==========

  /** 信任度飞字 */
  const addTrustFly = useCallback((change) => {
    const id = Date.now() + Math.random();
    const text = change > 0 ? `+${Math.round(change * 100)}%` : `${Math.round(change * 100)}%`;
    setTrustFlies(prev => [...prev, { id, text, positive: change > 0 }]);
    setTimeout(() => setTrustFlies(prev => prev.filter(f => f.id !== id)), 1000);
  }, []);

  /** 开始情绪猜测（不设前置门槛） */
  const handleStartEmotionGuess = useCallback(() => {
    setEmotionGuessMode(true);
    playSFX('click');
  }, [playSFX]);

  /** 取消猜测 */
  const handleCancelGuess = useCallback(() => {
    setEmotionGuessMode(false);
  }, []);

  /** 新顾客时重置所有调酒状态 */
  const resetCocktailState = useCallback(() => {
    setEmotionGuessMode(false);
    setGuessedCorrectly(false);
    setGuessAttempts(0);
    setLastCorrectGuesses([]);
    setTargetConditions([]);
    setTargetHint('');
    setCurrentMixtureValues({ thickness: 0, sweetness: 0, strength: 0 });
    setCocktailAttitudes([]);
  }, []);

  /** 递酒时重置界面（立即返回对话界面） */
  const resetForServe = useCallback(() => {
    setGuessedCorrectly(false);
    setEmotionGuessMode(false);
    setTargetConditions([]);
    setTargetHint('');
    setCurrentMixtureValues({ thickness: 0, sweetness: 0, strength: 0 });
  }, []);

  /** 猜对动画 */
  const triggerGuessCorrectAnim = useCallback(() => {
    setEmotionFlash('guess-correct-flash');
    setEmotionCardAnim('guess-correct-flip');
    setTimeout(() => { setEmotionFlash(''); setEmotionCardAnim(''); }, 800);
  }, []);

  /** 猜错动画 */
  const triggerGuessWrongAnim = useCallback(() => {
    playSFX('fail');
    setEmotionCardAnim('guess-wrong-shake');
    setTimeout(() => setEmotionCardAnim(''), 500);
  }, [playSFX]);

  /** 递酒动画 */
  const triggerServeAnim = useCallback(() => {
    setShowServeAnim(true);
    setTimeout(() => setShowServeAnim(false), 1000);
  }, []);

  /** 显示调酒报告卡片 */
  const showResultCard = useCallback((result) => {
    setShowCocktailResult(result);
    setTimeout(() => setShowCocktailResult(null), 2200);
  }, []);

  return {
    // 情绪猜测
    emotionGuessMode, setEmotionGuessMode,
    guessedCorrectly, setGuessedCorrectly,
    guessAttempts, setGuessAttempts,
    lastCorrectGuesses, setLastCorrectGuesses,
    // 目标
    targetConditions, setTargetConditions,
    targetHint, setTargetHint,
    // 混合值
    currentMixtureValues, setCurrentMixtureValues,
    // 酒态度
    cocktailAttitudes, setCocktailAttitudes,
    // 动画
    showServeAnim, showCocktailResult,
    emotionFlash, emotionCardAnim, trustFlies,
    // 方法
    addTrustFly,
    handleStartEmotionGuess,
    handleCancelGuess,
    resetCocktailState,
    resetForServe,
    triggerGuessCorrectAnim,
    triggerGuessWrongAnim,
    triggerServeAnim,
    showResultCard,
  };
};
