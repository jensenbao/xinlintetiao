/**
 * 章节里程碑系统
 * 将 30-50 天的游戏分为 5 个章节，由里程碑条件触发
 * 章节为游戏提供阶段感——玩家知道自己处于故事的哪个阶段
 */

export const CHAPTERS = [
  {
    id: 1,
    title: 'Nameless Bar',
    subtitle: 'In the deepest alley of this city, you lit a single lamp.',
    conditions: {
      auto: true
    },
    theme: {
      weatherBias: ['rainy', 'foggy'],
      customerTypeBias: null,
      atmosphereMood: 'quiet'
    },
    mixingMode: 'strict'
  },
  {
    id: 2,
    title: 'First Returning Guest',
    subtitle: 'Someone remembered the way to this alley.',
    conditions: {
      minDay: 3,
      hasReturnCustomer: true
    },
    theme: {
      weatherBias: ['rainy', 'foggy', 'clear'],
      customerTypeBias: null,
      atmosphereMood: 'warming'
    },
    mixingMode: 'transitional'
  },
  {
    id: 3,
    title: 'Whispers in the Alley',
    subtitle: 'People started mentioning this place in hushed voices.',
    conditions: {
      minDay: 7,
      returnCustomerEscalation: 1
    },
    theme: {
      weatherBias: ['rainy', 'clear', 'foggy'],
      customerTypeBias: ['artistic', 'midlife'],
      atmosphereMood: 'alive'
    },
    mixingMode: 'expressive'
  },
  {
    id: 4,
    title: 'Under Neon Light',
    subtitle: 'This city offers countless destinations, yet some choose only this one.',
    conditions: {
      minDay: 13,
      returnCustomerTurningPoint: 1
    },
    theme: {
      weatherBias: null,
      customerTypeBias: null,
      atmosphereMood: 'intense'
    },
    mixingMode: 'expressive'
  },
  {
    id: 5,
    title: 'The Last Glass',
    subtitle: 'At last, you understand why you are here.',
    conditions: {
      minDay: 20,
      OR_totalCustomersServed: 100
    },
    theme: {
      weatherBias: null,
      customerTypeBias: null,
      atmosphereMood: 'transcendent'
    },
    mixingMode: 'master'
  }
];

/**
 * 章节开场白降级文本
 */
export const FALLBACK_CHAPTER_OPENINGS = {
  1: 'You turned on the bar light. Outside the alley, it was raining.',
  2: 'Tonight\'s visitor does not look like a first-timer.',
  3: 'Someone mentioned this bar while asking for directions.',
  4: 'A line formed outside the door—not too long, not too short.',
  5: 'You look out at the city and suddenly cannot remember what year you first came here.'
};

/**
 * 结局触发条件
 */
export const ENDING_CONDITIONS = [
  { type: 'arc_complete', description: 'At least one returning customer completes their full arc' },
  { type: 'day_limit', description: 'Total days reach 50' },
  { type: 'all_fragments', description: 'All memory fragments unlocked' }
];

/**
 * 回忆碎片触发条件
 */
export const FRAGMENT_TRIGGERS = [
  { type: 'chapter_advance', description: 'Guaranteed fragment trigger on chapter progression' },
  { type: 'milestone', condition: 'totalCustomersServed >= 20', description: 'Serve 20 customers' },
  { type: 'milestone', condition: 'totalCustomersServed >= 50', description: 'Serve 50 customers' },
  { type: 'deep_trust', condition: 'customerTrust >= 0.9', description: 'Any customer reaches 90%+ trust' },
  { type: 'crossroads_resolved', description: 'A returning customer crossroads is resolved' },
  { type: 'perfect_resonance', condition: 'mixingMode !== "strict"', description: 'Obtain "Perfect Resonance"' },
  { type: 'silence_used', condition: 'silenceCount >= 5', description: 'Use silence 5 times in total' },
  { type: 'plain_water', condition: 'plainWaterCount >= 3', description: 'Serve 3 glasses of plain water in total' }
];

/**
 * 章节机制变化提示（固定文本，非AI生成）
 * 在章节转场时展示，告知玩家调酒机制的变化
 */
export const CHAPTER_MECHANIC_HINTS = {
  1: null,
  2: 'Numbers still matter, but they are no longer the only answer.\n'
   + 'Pay attention to the feeling each ingredient conveys—hover to inspect.\n'
   + '"This drink says..." tells you what your drink is expressing.',
  3: 'You no longer need to stare at numbers.\n'
   + 'Only resonance between customer emotion and your drink decides whether it works.\n'
   + 'Use ingredient feeling to compose what you want to say.',
  4: null,
  5: 'No target. No hint.\n'
   + 'In front of you is one person, and beside your hand are these bottles.\n'
   + 'You already know what to do.'
};

/**
 * 过渡期（transitional）调酒失败引导消息
 * 帮助玩家适应从数值匹配到情感共鸣的过渡
 */
export const TRANSITIONAL_FAILURE_HINTS = [
  'Maybe it is time to focus on the attitude your drink conveys—what is it saying?',
  'Numbers are only the skeleton; feeling is the flesh. Try building from ingredient feeling.',
  'Does this drink\'s "attitude" match the customer\'s mood right now?',
  'You do not need perfect precision—the key is direction, not tiny numeric gaps.',
  'Hover ingredients to read their feeling, then think about what this person needs to hear.'
];

/**
 * 获取过渡期失败引导（随机一条）
 */
export const getTransitionalFailureHint = () => {
  return TRANSITIONAL_FAILURE_HINTS[
    Math.floor(Math.random() * TRANSITIONAL_FAILURE_HINTS.length)
  ];
};

/**
 * 结局 fallback 模板（AI 完全不可用时使用）
 */
export const FALLBACK_ENDING_TEMPLATE = (params) => {
  const keyLine = params.keyCustomerName
    ? `You still remember ${params.keyCustomerName}. ${params.keyCustomerOneLiner || 'That person came, and then left.'}\n\n`
    : '';
  return `While cleaning the last glass, your hand paused.

${params.totalDays || '?'} days. ${params.totalCustomers || '?'} people.
Each one pushed open that door with their own story, sat down, and looked at you.
You never asked why they came. You only mixed drinks.

${keyLine}Neon still flickers outside the window. Rain is still falling. This city will not change because of one bar.
But maybe a few people—after finishing that one drink on a certain late night—changed, just a little.

You turn off the bar light.
But you do not lock the door.`.trim();
};

/**
 * 碎片降级文本
 */
export const FALLBACK_FRAGMENTS = {
  vague: 'Something stirs, like silt lifted from the bottom of water. It settles again quickly.',
  hazy: 'A certain room. Light leaks through a gap in the curtain. Someone is speaking, but the words are unclear.',
  clear: 'An old scar on your hand. You remember the knife, the kitchen, and someone calling your name.',
  vivid: 'You remember everything. And still, you choose to remain here.'
};

/**
 * 碎片清晰度与章节的对应关系
 */
export const getFragmentClarity = (chapterId) => {
  if (chapterId <= 2) return 'vague';
  if (chapterId === 3) return 'hazy';
  if (chapterId === 4) return 'clear';
  return 'vivid';
};
