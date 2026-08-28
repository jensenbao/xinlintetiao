/**
 * 章节转场动画组件
 * 全屏展示章节标题、副标题、AI 生成的开场白、机制变化提示
 * 流程：黑屏渐入 → 章节编号 → 标题 → 副标题 → 开场白 → 机制提示 → 渐出
 */
import React, { useState, useEffect } from 'react';
import { CHAPTER_MECHANIC_HINTS } from '../../data/chapterMilestones.js';
import './ChapterTransition.css';

const ChapterTransition = ({ chapter, openingNarrative, onComplete }) => {
  const [phase, setPhase] = useState('fade-in');
  const mechanicHint = CHAPTER_MECHANIC_HINTS[chapter.id] || null;
  const hasMechanic = !!mechanicHint;

  useEffect(() => {
    const timers = [];
    timers.push(setTimeout(() => setPhase('number'), 800));
    timers.push(setTimeout(() => setPhase('title'), 2000));
    timers.push(setTimeout(() => setPhase('subtitle'), 3500));
    if (openingNarrative) {
      timers.push(setTimeout(() => setPhase('narrative'), 5000));
      if (hasMechanic) {
        timers.push(setTimeout(() => setPhase('mechanic'), 9000));
        timers.push(setTimeout(() => setPhase('fade-out'), 13000));
        timers.push(setTimeout(() => onComplete?.(), 14000));
      } else {
        timers.push(setTimeout(() => setPhase('fade-out'), 9000));
        timers.push(setTimeout(() => onComplete?.(), 10000));
      }
    } else {
      if (hasMechanic) {
        timers.push(setTimeout(() => setPhase('mechanic'), 5000));
        timers.push(setTimeout(() => setPhase('fade-out'), 9000));
        timers.push(setTimeout(() => onComplete?.(), 10000));
      } else {
        timers.push(setTimeout(() => setPhase('fade-out'), 6500));
        timers.push(setTimeout(() => onComplete?.(), 7500));
      }
    }
    return () => timers.forEach(clearTimeout);
  }, [openingNarrative, onComplete, hasMechanic]);

  const visiblePhases = (target) => {
    const order = ['number', 'title', 'subtitle', 'narrative', 'mechanic'];
    const currentIdx = order.indexOf(phase);
    const targetIdx = order.indexOf(target);
    return currentIdx >= targetIdx && currentIdx >= 0 && targetIdx >= 0;
  };

  return (
    <div className={`chapter-transition-overlay phase-${phase}`} onClick={() => {
      if (phase !== 'fade-in' && phase !== 'fade-out') {
        setPhase('fade-out');
        setTimeout(() => onComplete?.(), 1000);
      }
    }}>
      <div className="chapter-transition-content">
        <div className={`chapter-number-display ${visiblePhases('number') ? 'visible' : ''}`}>
          Chapter {chapter.id}
        </div>

        <h1 className={`chapter-title-display ${visiblePhases('title') ? 'visible' : ''}`}>
          {chapter.title}
        </h1>

        <p className={`chapter-subtitle-display ${visiblePhases('subtitle') ? 'visible' : ''}`}>
          {chapter.subtitle}
        </p>

        {openingNarrative && (
          <p className={`chapter-narrative-display ${visiblePhases('narrative') ? 'visible' : ''}`}>
            {openingNarrative}
          </p>
        )}

        {mechanicHint && (
          <p className={`chapter-mechanic-hint ${phase === 'mechanic' ? 'visible' : ''}`}>
            {mechanicHint}
          </p>
        )}

        <div className="chapter-skip-hint">Click to skip</div>
      </div>
    </div>
  );
};

export default ChapterTransition;
