/**
 * 十字路口走向决定算法
 * 确定性规则，不依赖 AI
 */

/**
 * 确定十字路口走向
 * @param {Object} crossroads - 十字路口数据
 * @returns {string|null} 选中的选项 ID
 */
export const resolveCrossroads = (crossroads) => {
  const { influenceFactors, options } = crossroads;
  if (!options || options.length < 2) return null;

  // 计算倾向分（正数 = 倾向 option_a/大胆，负数 = 倾向 option_b/保守）
  let leaningScore = 0;

  // 1. 酒的态度累计影响（权重 ~45%）
  const attitudes = influenceFactors.cocktailAttitudes || [];
  attitudes.forEach(influence => {
    switch (influence) {
      case 'push_action':        leaningScore += 2; break;    // 推动行动 → 偏向大胆选择
      case 'empower':            leaningScore += 1.5; break;  // 赋能 → 偏向大胆选择
      case 'encourage_patience': leaningScore -= 1.5; break;  // 耐心 → 偏向保守选择
      case 'accept':             leaningScore -= 1; break;    // 接受 → 偏向保守选择
      case 'neutral':            break;                        // 中性 → 不影响
    }
  });

  // 2. 信任度影响（权重 ~35%）
  // 高信任 = 顾客更愿意冒险（偏向 option_a）
  const trust = influenceFactors.trustAtEnd || 0;
  if (trust >= 0.8) leaningScore += 2;
  else if (trust >= 0.6) leaningScore += 1;
  else if (trust <= 0.3) leaningScore -= 1;

  // 3. 随机性（权重 ~20%）—— 人不是机器，不完全可预测
  // 使用较小的随机范围，避免完全覆盖玩家的选择影响
  leaningScore += (Math.random() - 0.5) * 2;

  // 决定走向
  const chosenIndex = leaningScore >= 0 ? 0 : 1;
  return options[chosenIndex]?.id || options[0].id;
};

/**
 * 预定义的通用十字路口模板（AI 生成失败时使用）
 */
export const FALLBACK_CROSSROADS = {
  workplace: {
    dilemma: 'An important career decision is waiting for you.',
    options: [
      { id: 'option_a', description: 'Take a risk on a new direction' },
      { id: 'option_b', description: 'Stay on the safer current path' }
    ]
  },
  artistic: {
    dilemma: 'Choose between your ideals and reality.',
    options: [
      { id: 'option_a', description: 'Stay true to your own work' },
      { id: 'option_b', description: 'Accept what the market demands' }
    ]
  },
  student: {
    dilemma: 'Two paths are in front of you.',
    options: [
      { id: 'option_a', description: 'Chase what you truly want to do' },
      { id: 'option_b', description: 'Follow the road everyone else takes' }
    ]
  },
  midlife: {
    dilemma: 'The thing you kept avoiding is finally in front of you.',
    options: [
      { id: 'option_a', description: 'Face it head-on and be honest' },
      { id: 'option_b', description: 'Wait a little longer' }
    ]
  }
};

/**
 * 获取降级十字路口模板
 * @param {string} category - 顾客类别
 * @returns {Object} 降级十字路口
 */
export const getFallbackCrossroads = (category) => {
  return FALLBACK_CROSSROADS[category] || FALLBACK_CROSSROADS.workplace;
};
