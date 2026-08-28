/**
 * 结局画面组件
 * 全屏逐段展示 AI 生成的结局文本
 * 结束后提供 "继续经营" 和 "新的故事" 两个选项
 */
import React, { useState, useEffect } from 'react';
import './EndingScreen.css';

const EndingScreen = ({ narrative, onFreeMode, onNewGame }) => {
  const [visibleParagraphs, setVisibleParagraphs] = useState(0);
  const [showActions, setShowActions] = useState(false);

  const paragraphs = narrative ? narrative.split('\n\n').filter(p => p.trim()) : [];

  useEffect(() => {
    if (paragraphs.length === 0) return;

    const timers = [];
    for (let i = 0; i < paragraphs.length; i++) {
      timers.push(setTimeout(() => {
        setVisibleParagraphs(i + 1);
      }, (i + 1) * 3000));
    }

    // 显示操作按钮
    timers.push(setTimeout(() => {
      setShowActions(true);
    }, (paragraphs.length + 1) * 3000));

    return () => timers.forEach(clearTimeout);
  }, [paragraphs.length]);

  return (
    <div className="ending-screen">
      <div className="ending-content">
        {paragraphs.map((p, i) => (
          <p
            key={i}
            className={`ending-paragraph ${i < visibleParagraphs ? 'visible' : ''}`}
          >
            {p}
          </p>
        ))}
      </div>

      <div className={`ending-actions ${showActions ? 'visible' : ''}`}>
        <button className="ending-btn ending-btn-continue" onClick={onFreeMode}>
          <span className="ending-btn-label">Keep Running the Bar</span>
          <span className="ending-btn-hint">The bar stays open after the ending.</span>
        </button>
        <button className="ending-btn ending-btn-new" onClick={onNewGame}>
          <span className="ending-btn-label">A New Story</span>
          <span className="ending-btn-hint">A different city, different people, a different you.</span>
        </button>
      </div>
    </div>
  );
};

export default EndingScreen;
