/**
 * useEmotionSystem - 情绪系统状态管理 Hook
 * 
 * 管理情绪面板相关的所有状态：
 * - surfaceEmotions（表面情绪列表）
 * - selectedEmotions（玩家选中的情绪）
 * - dynamicCustomerEmotions（动态顾客情绪，每次喝酒后可能变化）
 * - handleEmotionSelect（情绪选择切换）
 * - resetEmotionState
 */
import { useState, useCallback } from 'react';

export const useEmotionSystem = ({ playSFX = () => {} } = {}) => {
  const [surfaceEmotions, setSurfaceEmotions] = useState([]);
  const [selectedEmotions, setSelectedEmotions] = useState([]);
  const [dynamicCustomerEmotions, setDynamicCustomerEmotions] = useState({ surface: [], reality: [] });

  /** 情绪选择切换（最多3个） */
  const handleEmotionSelect = useCallback((emotionId) => {
    if (selectedEmotions.includes(emotionId)) {
      setSelectedEmotions(prev => prev.filter(id => id !== emotionId));
    } else if (selectedEmotions.length < 3) {
      playSFX('select');
      setSelectedEmotions(prev => [...prev, emotionId]);
    }
  }, [selectedEmotions, playSFX]);

  /** 重置所有情绪状态（新顾客时） */
  const resetEmotionState = useCallback(() => {
    setSurfaceEmotions([]);
    setSelectedEmotions([]);
    setDynamicCustomerEmotions({ surface: [], reality: [] });
  }, []);

  return {
    surfaceEmotions, setSurfaceEmotions,
    selectedEmotions, setSelectedEmotions,
    dynamicCustomerEmotions, setDynamicCustomerEmotions,
    handleEmotionSelect,
    resetEmotionState,
  };
};

export default useEmotionSystem;
