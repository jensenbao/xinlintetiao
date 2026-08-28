// Toast 消息管理 Hook
import { useState, useCallback, useRef } from 'react';

/**
 * Toast 消息管理 Hook
 * @returns {Object} Toast 相关状态和方法
 */
export const useToasts = () => {
  const [toastList, setToastList] = useState([]);
  const toastIdRef = useRef(0); // 使用递增计数器确保唯一性

  /**
   * 添加 Toast 消息
   * @param {string} message - 消息内容
   * @param {string} type - 消息类型 ('success' | 'error' | 'warning' | 'info')
   */
  const addToast = useCallback((message, type = 'info') => {
    toastIdRef.current += 1;
    const newToast = {
      id: `toast-${Date.now()}-${toastIdRef.current}`,
      message,
      type
    };
    setToastList(prev => [...prev, newToast]);
  }, []);

  /**
   * 移除指定 Toast
   * @param {number} id - Toast ID
   */
  const removeToast = useCallback((id) => {
    setToastList(prev => prev.filter(toast => toast.id !== id));
  }, []);

  /**
   * 清空所有 Toast
   */
  const clearToasts = useCallback(() => {
    setToastList([]);
  }, []);

  return {
    toastList,
    addToast,
    removeToast,
    clearToasts
  };
};

export default useToasts;
