// 游戏提示管理 Hook
import { useState, useCallback } from 'react';
import { GAME_HINTS } from '../data/gameHints.js';

/**
 * 游戏提示管理 Hook
 * @returns {Object} 游戏提示相关状态和方法
 */
export const useGameHints = () => {
  const [gameHint, setGameHint] = useState(null);

  /**
   * 显示游戏提示
   * @param {string} hintType - 提示类型
   */
  const showGameHint = useCallback((hintType) => {
    const hint = GAME_HINTS[hintType];
    if (hint) {
      setGameHint({ ...hint, type: hintType });
      // 5秒后自动关闭
      setTimeout(() => setGameHint(null), 5000);
    }
  }, []);

  /**
   * 关闭当前提示
   */
  const closeGameHint = useCallback(() => {
    setGameHint(null);
  }, []);

  return {
    gameHint,
    showGameHint,
    closeGameHint
  };
};

export default useGameHints;
