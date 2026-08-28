// L2 日记忆系统 Hook
import { useState, useCallback } from 'react';
import { saveDailyMemory, getPlayerProfile, savePlayerProfile, getWorldState, saveWorldState, getRecentDailyMemories } from '../utils/storage.js';
import { API_CONFIG, PROMPT_TYPES, generatePrompt } from '../config/api.js';

/**
 * 日记忆管理 Hook
 * 收集每位顾客的记录，一天结束时生成日记忆
 */
export const useDailyMemory = () => {
  const [todayRecords, setTodayRecords] = useState([]);

  /**
   * 每位顾客离开时调用，记录精简信息
   */
  const recordCustomer = useCallback((customerConfig, dialogueHistory, parting, trustLevel) => {
    // 从对话历史提取最长的 AI 回复作为 memorableQuote
    const aiMessages = dialogueHistory.filter(d => d.role === 'ai');
    const memorableQuote = aiMessages.length > 0
      ? aiMessages.reduce((a, b) => a.content.length > b.content.length ? a : b).content.slice(0, 50)
      : '';

    const record = {
      name: customerConfig.name || 'Unknown Guest',
      category: customerConfig.categoryId || 'workplace',
      realEmotions: customerConfig.emotionMask?.reality || [],
      keyStory: (customerConfig.backstory || '').slice(0, 50) || 'A guest passed through the bar.',
      parting, // 'satisfied' | 'neutral' | 'left_early'
      memorableQuote,
      trustLevel: trustLevel || 0,
      dialogueRounds: dialogueHistory.length
    };

    setTodayRecords(prev => [...prev, record]);
    return record;
  }, []);

  /**
   * 一天结束时调用，生成并保存日记忆
   */
  const generateDailyMemoryRecord = useCallback(async (day, stats, atmosphere, events) => {
    const customerSummaries = todayRecords.map(r => ({
      name: r.name,
      parting: r.parting,
      keyStory: r.keyStory,
      memorableQuote: r.memorableQuote
    }));

    let journalEntry = `Served ${stats.customersServed || todayRecords.length} guests today.`;
    let playerPerformance = { strengths: [], weaknesses: [], growthAreas: [] };
    let openThreads = [];

    // 尝试 AI 生成日记
    try {
      if (API_CONFIG.gemini.enabled && customerSummaries.length > 0) {
        const prompt = generatePrompt(PROMPT_TYPES.GENERATE_DAILY_JOURNAL, {
          day,
          customerSummaries,
          atmosphere,
          events: events || []
        });

        const url = `${API_CONFIG.gemini.endpoint}/${API_CONFIG.gemini.model}:generateContent?key=${API_CONFIG.gemini.apiKey}`;
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.7, maxOutputTokens: 2048, candidateCount: 1 }
          })
        });

        if (response.ok) {
          const data = await response.json();
          const parts = data.candidates?.[0]?.content?.parts;
          if (parts) {
            // 取最后一个 text part
            let text = '';
            for (let i = parts.length - 1; i >= 0; i--) {
              if (parts[i].text) { text = parts[i].text; break; }
            }
            // 解析 JSON
            const cleaned = text.replace(/```(?:json)?\s*([\s\S]*?)```/, '$1').trim();
            const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              const parsed = JSON.parse(jsonMatch[0]);
              if (parsed.journalEntry) journalEntry = parsed.journalEntry;
              if (parsed.playerPerformance) playerPerformance = parsed.playerPerformance;
              if (Array.isArray(parsed.openThreads)) openThreads = parsed.openThreads;
              console.log('Daily journal generated successfully');
            }
          }
        }
      }
    } catch (err) {
      console.error('Daily journal generation failed:', err);
      throw err;
    }

    // 组装完整日记忆
    const dailyMemory = {
      day,
      stats: {
        customersServed: stats.customersServed || todayRecords.length,
        successCount: stats.successCount || 0,
        failureCount: stats.failureCount || 0,
        totalEarnings: stats.totalEarnings || 0,
        avgResonanceScore: 0
      },
      customerRecords: todayRecords,
      journalEntry,
      playerPerformance,
      openThreads
    };

    // 保存日记忆
    saveDailyMemory(dailyMemory);

    // 更新世界状态
    updateWorldState(day, dailyMemory);

    // 每3天更新玩家画像
    if (day % 3 === 0 || day === 1) {
      updatePlayerProfile(day, dailyMemory);
    }

    // 重置今日记录
    setTodayRecords([]);

    return dailyMemory;
  }, [todayRecords]);

  return { todayRecords, recordCustomer, generateDailyMemoryRecord };
};

/**
 * 更新世界状态（纯计算）
 */
function updateWorldState(day, dailyMemory) {
  const state = getWorldState();

  // 注册今天的顾客
  for (const record of dailyMemory.customerRecords) {
    const custId = `${record.category}_${record.name}`;
    if (state.customerRegistry[custId]) {
      state.customerRegistry[custId].visitCount += 1;
      state.customerRegistry[custId].lastVisit = day;
      state.customerRegistry[custId].finalState = record.parting;
    } else {
      state.customerRegistry[custId] = {
        name: record.name,
        firstVisit: day,
        lastVisit: day,
        visitCount: 1,
        finalState: record.parting,
        keyMemory: record.keyStory?.slice(0, 20) || '',
        openThread: null,
        returnable: record.parting === 'satisfied' && record.dialogueRounds >= 4
      };
    }
  }

  // 限制 customerRegistry 100条
  const entries = Object.entries(state.customerRegistry);
  if (entries.length > 100) {
    const toRemove = entries
      .filter(([, v]) => !v.returnable)
      .sort((a, b) => a[1].lastVisit - b[1].lastVisit);
    for (let i = 0; i < entries.length - 100 && i < toRemove.length; i++) {
      delete state.customerRegistry[toRemove[i][0]];
    }
  }

  // openThreads → worldEvents
  for (const thread of dailyMemory.openThreads || []) {
    state.worldEvents.push({ day, event: thread.description, resolved: false });
  }
  // 限制 worldEvents 50条
  while (state.worldEvents.length > 50) {
    const idx = state.worldEvents.findIndex(e => e.resolved);
    if (idx >= 0) state.worldEvents.splice(idx, 1);
    else state.worldEvents.shift();
  }

  // 季节更新
  state.timeline.daysInSeason += 1;
  if (state.timeline.daysInSeason > 30) {
    const seasons = ['spring', 'summer', 'autumn', 'winter'];
    const currentIdx = seasons.indexOf(state.timeline.currentSeason);
    state.timeline.currentSeason = seasons[(currentIdx + 1) % 4];
    state.timeline.daysInSeason = 0;
  }

  saveWorldState(state);
}

/**
 * 更新玩家画像
 */
function updatePlayerProfile(day, dailyMemory) {
  const profile = getPlayerProfile();

  profile.totalDaysPlayed = day;
  profile.totalCustomersServed += dailyMemory.customerRecords.length;
  profile.totalCocktailsMade += dailyMemory.stats.successCount;

  // 更新 customerTypeScores
  for (const record of dailyMemory.customerRecords) {
    const cat = record.category || 'workplace';
    if (profile.proficiency.customerTypeScores[cat]) {
      const s = profile.proficiency.customerTypeScores[cat];
      const score = record.parting === 'satisfied' ? 80 : 50;
      s.avgResonance = Math.round((s.avgResonance * s.count + score) / (s.count + 1));
      s.count += 1;
    }
  }

  // 简单的技能等级计算
  if (profile.totalCocktailsMade >= 50) profile.playStyle.overallSkillLevel = 'master';
  else if (profile.totalCocktailsMade >= 25) profile.playStyle.overallSkillLevel = 'advanced';
  else if (profile.totalCocktailsMade >= 10) profile.playStyle.overallSkillLevel = 'intermediate';

  // 里程碑检查
  const milestoneChecks = [
    { cond: profile.totalCustomersServed === 1, event: 'First Guest', detail: 'The bartender journey began.' },
    { cond: profile.totalCocktailsMade === 10, event: 'Ten Cocktails', detail: 'Your craft has sharpened.' },
    { cond: profile.totalDaysPlayed === 7, event: 'One Week In', detail: 'You have kept the bar running for a full week.' },
    { cond: profile.totalDaysPlayed === 30, event: 'Monthly Legend', detail: 'You stayed with it for an entire month.' }
  ];
  for (const check of milestoneChecks) {
    if (check.cond && !profile.milestones.some(m => m.event === check.event)) {
      profile.milestones.push({ day, event: check.event, detail: check.detail });
    }
  }

  savePlayerProfile(profile);
}

export default useDailyMemory;
