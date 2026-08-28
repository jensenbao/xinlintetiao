const ATTR_LABELS = {
  thickness: 'Body',
  sweetness: 'Sweetness',
  strength: 'Strength'
};

const ATTR_ADJUST_HINTS = {
  thickness: { higher: 'increase body', lower: 'lighten body' },
  sweetness: { higher: 'make it sweeter', lower: 'make it drier' },
  strength: { higher: 'make it stronger', lower: 'make it softer' }
};

const HIT_REWARD_TABLE = {
  3: { tipMultiplier: 1.8, trustGain: 0.18 },
  2: { tipMultiplier: 1.4, trustGain: 0.1 },
  1: { tipMultiplier: 1.15, trustGain: 0.05 },
  0: { tipMultiplier: 1.0, trustGain: 0.02 }
};

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export const getCustomerTop3Emotions = (customerConfig, dynamicReality = []) => {
  if (Array.isArray(customerConfig?.currentEmotionTop3) && customerConfig.currentEmotionTop3.length > 0) {
    return customerConfig.currentEmotionTop3.filter(Boolean).slice(0, 3);
  }

  if (Array.isArray(customerConfig?.emotionAnalysis?.top3) && customerConfig.emotionAnalysis.top3.length > 0) {
    return customerConfig.emotionAnalysis.top3.filter(Boolean).slice(0, 3);
  }

  if (Array.isArray(dynamicReality) && dynamicReality.length > 0) {
    return dynamicReality.filter(Boolean).slice(0, 3);
  }

  if (Array.isArray(customerConfig?.emotionMask?.reality) && customerConfig.emotionMask.reality.length > 0) {
    return customerConfig.emotionMask.reality.filter(Boolean).slice(0, 3);
  }

  return [];
};

export const calculateCocktailServeRewards = ({
  guessedEmotions = [],
  actualTop3 = [],
  surfaceEmotions = [],
  satisfaction = 0.5,
  baseTip = 10,
}) => {
  const guessedSet = Array.from(new Set((Array.isArray(guessedEmotions) ? guessedEmotions : []).filter(Boolean)));
  const top3Set = new Set((Array.isArray(actualTop3) ? actualTop3 : []).filter(Boolean));
  const surfaceSet = new Set((Array.isArray(surfaceEmotions) ? surfaceEmotions : []).filter(Boolean));

  const hitCount = guessedSet.filter((emotionId) => top3Set.has(emotionId)).length;
  const surfaceHitCount = guessedSet.filter((emotionId) => surfaceSet.has(emotionId)).length;

  const tier = HIT_REWARD_TABLE[hitCount] || HIT_REWARD_TABLE[0];
  const extraTrust = Math.min(0.015 * surfaceHitCount, 0.03);
  const qualityCoefficient = clamp(0.6 + Number(satisfaction || 0), 0.6, 1.6);
  const finalTrustGain = tier.trustGain + extraTrust;
  const tipAmount = Math.max(0, Math.round(baseTip * tier.tipMultiplier * qualityCoefficient));

  return {
    hitCount,
    surfaceHitCount,
    baseTrustGain: tier.trustGain,
    extraTrust,
    finalTrustGain,
    tipMultiplier: tier.tipMultiplier,
    qualityCoefficient,
    tipAmount,
  };
};

export const buildStrictJudgmentExplanation = (targetCheck) => {
  const results = Array.isArray(targetCheck?.results) ? targetCheck.results : [];
  if (results.length === 0) {
    return {
      summary: 'No target dimensions to review this round.',
      shortHint: 'Complete emotion guessing before mixing.',
      details: []
    };
  }

  const unmet = results.filter(item => !item.met);
  if (unmet.length === 0) {
    const labels = results.map(item => ATTR_LABELS[item.attr] || item.attr).join(', ');
    return {
      summary: `All dimensions matched (${labels}).`,
      shortHint: 'All target dimensions matched.',
      details: []
    };
  }

  const details = unmet.map((item) => {
    const attr = item.attr;
    const label = ATTR_LABELS[attr] || attr;
    const currentValue = Number(item.currentValue || 0);
    const targetValue = Number(item.value || 0);

    const needHigher = currentValue < targetValue;

    const hints = ATTR_ADJUST_HINTS[attr] || { higher: 'increase a bit', lower: 'decrease a bit' };
    const action = (() => {
      if (item.op === '<=' || item.op === '<') {
        return currentValue > targetValue ? hints.lower : hints.higher;
      }
      if (item.op === '=') {
        return currentValue < targetValue ? hints.higher : hints.lower;
      }
      return needHigher ? hints.higher : hints.lower;
    })();

    return `${label} is off target (goal ${item.op}${targetValue.toFixed(1)}, current ${currentValue.toFixed(1)}). Suggestion: ${action}`;
  });

  return {
    summary: `Matched ${targetCheck?.metCount || 0}/${targetCheck?.totalConditions || results.length} targets.`,
    shortHint: details.slice(0, 2).join('; '),
    details
  };
};
