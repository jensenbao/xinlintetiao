// Tutorial system data

/**
 * Empathy keywords (use empathetic response when player input contains these)
 */
const EMPATHETIC_KEYWORDS = [
  '累', '辛苦', '怎么了', '没关系', '不容易', '加班',
  '关心', '休息', '还好吗', '开心', '难过', '孤独',
  '压力', '陪', '听', '理解', '在意'
];

/**
 * Check whether player input contains empathy keywords
 */
export const isEmpatheticInput = (input) => {
  return EMPATHETIC_KEYWORDS.some(keyword => input.includes(keyword));
};

/**
 * Fixed tutorial dialogue script
 */
export const TUTORIAL_RESPONSES = {
  round1: {
    quickOptions: [
      'Sure. What would you like to drink?',
      'You look pretty tired tonight.',
      'Take a seat. No rush.'
    ],
    default: '...Anything is fine. Whatever works.',
    empathetic: '...How did you know? Fine, just make me one.'
  },
  round2: {
    quickOptions: [
      'Rough day at work?',
      'Did you come alone?',
      'Still out at this hour... that must be hard.',
      '……'
    ],
    default: 'Mm... work stuff. It is nothing major.',
    empathetic: '...It is nothing. Sometimes I get home after a long day and there is no one to talk to.',
    silence: '...You are not going to ask? Most people do.'
  },
  round3: {
    quickOptions: [
      'You can talk here. I am listening.',
      'Sometimes it is okay not to say anything.',
      'Do you work late often?'
    ],
    default: '...Thank you.',
    empathetic: '...No one has said that to me in a long time.'
  }
};

/**
 * Fixed tutorial mixing target
 */
export const TUTORIAL_TARGET = {
  conditions: [
    { attr: 'thickness', op: '>=', value: 1 },
    { attr: 'sweetness', op: '>=', value: 1 },
    { attr: 'strength', op: '<=', value: 3 }
  ],
  hint: 'Fear and sadness call for a warm, not-too-strong drink. Make it fuller and sweeter, so they can feel wrapped in safety.'
};

/**
 * Fixed feedback after tutorial success
 */
export const TUTORIAL_COCKTAIL_FEEDBACK = 
  '...Thank you.\nIt is good, really.\nI have not had a real drink in a long time. The synthetic stuff outside is not the same.';

/**
 * Hints after tutorial mixing failure
 */
export const getTutorialFailHint = (conditions, mixture) => {
  const hints = [];
  for (const cond of conditions) {
    const actual = mixture[cond.attr] || 0;
    const attrNames = { thickness: 'Thickness', sweetness: 'Sweetness', strength: 'Strength' };
    const name = attrNames[cond.attr] || cond.attr;
    
    if (cond.op === '>=' && actual < cond.value) {
      hints.push(`${name} is too low (current ${actual}, need ≥ ${cond.value}). Try adding juice or liqueur.`);
    } else if (cond.op === '<=' && actual > cond.value) {
      hints.push(`${name} is too high (current ${actual}, need ≤ ${cond.value}). Try removing one spirit portion and replacing it with juice.`);
    }
  }
  return hints.length > 0 ? hints.join('\n') : 'The values are still off. Adjust the recipe and try again.';
};

/**
 * 6 emotions visible in tutorial mode (simplified)
 */
export const TUTORIAL_VISIBLE_EMOTIONS = [
  'trust', 'fear', 'sadness', 'joy', 'anger', 'anticipation'
];

/**
 * Tutorial tooltip text
 */
export const TUTORIAL_TOOLTIPS = {
  // Stage 2A: Dialogue
  dialogue_start: '💡 The guest looks like they have something to say. Try replying with the options below, or type your own response.',
  trust_rising: '💡 Trust is rising. The more genuine your conversation, the more the guest opens up.',
  transition_to_emotion: '💡 You can feel something beneath the surface...\n   Their emotions are not as calm as they seem.\n   Try guessing what they truly feel.',

  // Silence intro
  silence_intro: '💡 "..." means silence. Sometimes saying nothing is better than saying anything.\n   You can ignore it for now, and try it again when trust is higher.',

  // Stage 2B: Emotion guess
  emotion_guide_v2: '💡 People in this city are used to wearing masks.\n   "Trust" is what he shows you—but your dialogue suggests more underneath.\n   Choose the 2 emotions you think he is truly hiding.',
  emotion_guide: '💡 The guest appears "trusting" on the surface, but that may not be their real feeling.\n   Based on the dialogue, choose the 2 true emotions you believe are inside.',
  emotion_confirm: '💡 Ready? Click confirm. A correct guess unlocks mixing for this guest.\n   If you are unsure, keep talking and observe their state.',
  emotion_wrong: '💡 Not quite... think again.\n   They said, "After a long day, no one talks to me at home"—what feeling does that suggest?',
  emotion_correct: '🎯 Correct. Their true emotions are "Fear" and "Sadness".\n   Now, mix them a drink.',

  // Stage 2C: Mixing
  target_guide: '💡 The top-right panel shows target conditions. Mix a drink that meets them.\n   Thickness ≥ 1, Sweetness ≥ 1, Strength ≤ 3',
  step_glass: '💡 Start by choosing a glass. A martini glass holds 2 base portions, which is enough here.',
  step_ice: '💡 Choose ice. Ice affects strength. Light ice or no ice both work.',
  step_ingredients: '💡 This is the key step. Read each base liquid\'s 3D attributes.\n   Try: Rum (thick +1, sweet +1, strong +2) + Orange Juice (thick +1, sweet +2, strong 0)\n   Watch the values change on the right.',
  step_extras: '💡 Ingredients and decorations can fine-tune values, or you can skip them for now.',
  step_serve: '💡 All dimensions meet target? Click "Serve" to deliver the drink.\n   If values are still off, reselect your base liquids.',
  
  // Attitude preview lead-in
  attitude_preview: '💡 See that line below?\n   "This drink says..."\n   Every drink has an attitude. You will understand its meaning more over time.\n   For now, serve the drink.'
};

/**
 * Prologue text (5 screens)
 */
export const PROLOGUE_SCREENS = [
  'In this city\nno one needs to speak',
  'AI reads your emotions in three seconds\nmedicine erases your anxiety in ten\neverything gets solved\nefficient, quiet, proper.\nIn a world shaped by AI\npeople seem to have lost what is real',
  'But sometimes\npeople do not want emotions\nto be solved that easily',
  'They follow the sound of rain into the deepest alley\nand push open an unmarked door',
  'You wait behind the bar\nno scanner\nno algorithm\nbut there is real liquor here.\n\nTonight, someone comes again'
];
