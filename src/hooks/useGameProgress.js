/**
 * useGameProgress - 游戏进度与统计管理 Hook
 * 
 * 管理：
 * - gameStats（成功/失败/总服务数/天数统计）
 * - showRules（规则弹窗）
 * - 自动测试状态（autoTestRef / autoTestRunning / autoTestFnsRef）
 */
import { useState, useRef } from 'react';
import { getGameProgress } from '../utils/storage.js';

export const useGameProgress = () => {
  const [gameStats, setGameStats] = useState(() => {
    const saved = getGameProgress();
    return saved?.stats || {
      successCount: 0,
      failureCount: 0,
      totalServed: 0,
      totalDays: 1
    };
  });
  const [showRules, setShowRules] = useState(false);

  // ========== 自动测试 ==========
  const autoTestRef = useRef(null);
  const [autoTestRunning, setAutoTestRunning] = useState(false);
  const autoTestFnsRef = useRef({});

  return {
    gameStats, setGameStats,
    showRules, setShowRules,
    autoTestRef, autoTestRunning, setAutoTestRunning, autoTestFnsRef,
  };
};

export default useGameProgress;
