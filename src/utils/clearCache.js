// 清除localStorage的脚本 - 在浏览器控制台运行或创建清除功能

// 清除所有游戏缓存
export const clearAllGameCache = () => {
  const keys = [
    'bartender_short_memory',
    'bartender_long_memory',
    'bartender_progress',
    'bartender_unlocked',
    'bartender_settings'
  ];
  
  keys.forEach(key => localStorage.removeItem(key));
  console.log('All game cache has been cleared');
};

// 仅清除当前AI的对话记录
export const clearCurrentAIMemory = (aiType) => {
  const memory = JSON.parse(localStorage.getItem('bartender_short_memory') || '{}');
  delete memory[aiType];
  localStorage.setItem('bartender_short_memory', JSON.stringify(memory));
  console.log(`${aiType} conversation history has been cleared`);
};

// 在浏览器控制台直接运行：
// localStorage.clear() 
// 然后刷新页面
