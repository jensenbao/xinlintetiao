// 记忆上下文注入模块
// 当前版本禁用全局背景注入（如世界事件），
// 避免非角色信息干扰口吻。

/**
 * 从记忆库中提取与当前上下文相关的信息
 * @param {Object} currentCustomer - 当前顾客的 aiConfig
 * @returns {string} 注入 Prompt 的上下文文本（约200-500 token）
 */
export const getRelevantMemoryContext = (currentCustomer) => {
  void currentCustomer;
  return '';
};

export default getRelevantMemoryContext;
