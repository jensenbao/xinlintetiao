export const generateQuickOptions = (aiConfig, trustLevel, dialogueHistory) => {
  // 使用 categoryId 匹配（兼容模板顾客的 id 和生成顾客的 categoryId）
  const category = aiConfig.categoryId || aiConfig.id || 'workplace';
  
  const baseOptions = {
    workplace: {
      low: [
        "How has work been lately?",
        "You look a bit tired.",
        "How was your day?"
      ],
      medium: [
        "Has the pressure been heavy?",
        "Is something bothering you?",
        "Who are you outside of work?"
      ],
      high: [
        "What kind of life do you really want?",
        "If no one judged you, what would you choose?",
        "What can I do for you tonight?"
      ]
    },
    artistic: {
      low: [
        "What you said makes me want to hear more.",
        "That phrasing is unusual. Why that word?",
        "Sounds like you're carrying a lot."
      ],
      medium: [
        "I may not fully get it yet, but I'm listening.",
        "Those things you mentioned... are they happening now?",
        "Do you want to talk about the past or the present?"
      ],
      high: [
        "What you really mean—have you said it out loud yet?",
        "If you said your feelings directly, what would they be?",
        "I feel like you've been circling around something."
      ]
    },
    student: {
      low: [
        "No rush, take your time.",
        "What happened?",
        "You look like something's weighing on you."
      ],
      medium: [
        "What are you most worried about?",
        "Have you talked to anyone about this?",
        "I'm here. You can keep talking."
      ],
      high: [
        "You've already been trying really hard.",
        "No matter what, coming here was a good step.",
        "Let me stay with you for a while."
      ]
    },
    midlife: {
      low: [
        "Have a seat and take a drink.",
        "How was it outside today?",
        "How long have you been coming here?"
      ],
      medium: [
        "Have you been carrying this for a long time?",
        "Have you ever told anyone about it?",
        "If you're tired, it's okay to pause."
      ],
      high: [
        "What matters most to you now?",
        "If time rewound, what would you tell your younger self?",
        "Some detours are still part of the road."
      ]
    },
    // 兼容旧的模板顾客ID
    newbie: {
      low: [
        "Don't worry, take it slow.",
        "What happened?",
        "You look like you need someone to listen."
      ],
      medium: [
        "What are you most afraid of?",
        "Has anyone stayed with you through this?",
        "I'll be right here."
      ],
      high: [
        "You've already been brave.",
        "No matter the outcome, coming here was enough.",
        "Let me face this with you."
      ]
    }
  };
  
  const level = trustLevel < 0.3 ? 'low' : trustLevel < 0.6 ? 'medium' : 'high';
  const options = baseOptions[category]?.[level] || baseOptions.workplace[level] || baseOptions.workplace.low;
  
  // 从对话历史中提取上下文，为高隐喻顾客动态调整一个选项
  const metaphorLvl = aiConfig.metaphorLevel || 'none';
  if (metaphorLvl === 'high' && dialogueHistory && dialogueHistory.length > 0) {
    const lastAiMsg = [...dialogueHistory].reverse().find(d => d.role === 'ai');
    if (lastAiMsg && lastAiMsg.content) {
      // 如果顾客最后一句话很长或含有比喻词，追加一个"请解释"类选项
      const hasMetaphor = /像|如同|仿佛|好比|似乎|大概|也许|或许|……/.test(lastAiMsg.content);
      if (hasMetaphor) {
        const contextualOption = trustLevel < 0.5 
          ? "What you just said... could you explain it a little more?" 
          : "I've been thinking about what you just said.";
        // 替换最后一个选项为上下文相关选项
        const result = [...options];
        result[result.length - 1] = contextualOption;
        return result;
      }
    }
  }
  
  return [...options];
};

// 随机中文名池（避免 AI 不可用时总出现同一个人）
