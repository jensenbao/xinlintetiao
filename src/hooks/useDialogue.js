/**
 * useDialogue - 对话系统状态管理 Hook
 * 
 * 管理对话历史、加载状态、快捷选项：
 * - dialogueHistory / isLoading / quickOptions
 * - addMessage（带去重ID）
 * - analyzePlayerResponse（回应质量分析）
 * - resetDialogue
 */
import { useState, useRef, useCallback } from 'react';

export const useDialogue = () => {
  const [dialogueHistory, setDialogueHistory] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [quickOptions, setQuickOptions] = useState([]);
  const messageIdRef = useRef(0);

  /** 添加消息（自动生成唯一 ID） */
  const addMessage = useCallback((role, content, _legacyFlag = false, messageMeta = {}) => {
    messageIdRef.current += 1;
    const message = {
      id: `msg-${Date.now()}-${messageIdRef.current}`,
      role,
      content,
      timestamp: Date.now(),
      ...messageMeta,
    };
    setDialogueHistory(prev => [...prev, message]);
    return message.id;
  }, []);

  /** 更新最后一条消息的内容（用于流式输出） */
  const updateLastMessage = useCallback((content) => {
    setDialogueHistory(prev => {
      if (prev.length === 0) return prev;
      const updated = [...prev];
      updated[updated.length - 1] = { ...updated[updated.length - 1], content };
      return updated;
    });
  }, []);

  const updateLastMessageMeta = useCallback((meta = {}) => {
    setDialogueHistory(prev => {
      if (prev.length === 0) return prev;
      const updated = [...prev];
      updated[updated.length - 1] = { ...updated[updated.length - 1], ...meta };
      return updated;
    });
  }, []);

  /** 分析玩家回应质量 */
  const analyzePlayerResponse = useCallback((message, history) => {
    if (message.length < 3) return false;
    const recentPlayerMessages = history
      .filter(h => h.role === 'player')
      .slice(-3)
      .map(h => h.content);
    if (recentPlayerMessages.includes(message)) return false;
    if (/^[\d\s\.,!?。，！？]+$/.test(message)) return false;
    return true;
  }, []);

  /** 重置对话状态 */
  const resetDialogue = useCallback(() => {
    setDialogueHistory([]);
    setQuickOptions([]);
  }, []);

  return {
    dialogueHistory, setDialogueHistory,
    isLoading, setIsLoading,
    quickOptions, setQuickOptions,
    addMessage,
    updateLastMessage,
    updateLastMessageMeta,
    analyzePlayerResponse,
    resetDialogue,
  };
};

export default useDialogue;
