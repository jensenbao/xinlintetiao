// 开场序幕组件 - 赛博朋克沉浸式打字机效果
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { PROLOGUE_SCREENS } from '../../data/tutorialData.js';
import audioManager from '../../utils/audioManager.js';
import './PrologueScreen.css';

/**
 * 开场序幕 - 打字机式文字揭示 + 赛博朋克视觉
 * @param {Object} props
 * @param {Function} props.onComplete - 完成回调
 */
const PrologueScreen = ({ onComplete }) => {
  const [currentScreen, setCurrentScreen] = useState(0);
  const [displayedText, setDisplayedText] = useState('');
  const [isTyping, setIsTyping] = useState(true);
  const [fadeIn, setFadeIn] = useState(false);
  const [transitioning, setTransitioning] = useState(false);
  const [glitchOut, setGlitchOut] = useState(false);
  const typingRef = useRef(null);
  const charIndexRef = useRef(0);

  const fullText = PROLOGUE_SCREENS[currentScreen] || '';

  // 打字机效果
  useEffect(() => {
    setDisplayedText('');
    charIndexRef.current = 0;
    setIsTyping(true);
    setFadeIn(false);
    setGlitchOut(false);

    const timer = setTimeout(() => setFadeIn(true), 100);

    // 初始化音频并播放开场 BGM
    audioManager.init();
    if (currentScreen === 0) {
      audioManager.playBGM('home');
    }

    // 开始打字
    const startTyping = setTimeout(() => {
      typingRef.current = setInterval(() => {
        if (charIndexRef.current < fullText.length) {
          charIndexRef.current += 1;
          const currentChar = fullText[charIndexRef.current - 1];
          setDisplayedText(fullText.slice(0, charIndexRef.current));
          // 非空白字符时播放打字音效（每2-3个字播一次，避免太密集）
          if (currentChar && currentChar.trim() && charIndexRef.current % 2 === 0) {
            audioManager.playSFX('type');
          }
        } else {
          clearInterval(typingRef.current);
          setIsTyping(false);
        }
      }, 50); // 每字50ms
    }, 400);

    return () => {
      clearTimeout(timer);
      clearTimeout(startTyping);
      if (typingRef.current) clearInterval(typingRef.current);
    };
  }, [currentScreen, fullText]);

  // 跳过打字 / 前进
  const advance = useCallback(() => {
    if (transitioning) return;

    // 如果正在打字，先跳过完成当前文本
    if (isTyping) {
      if (typingRef.current) clearInterval(typingRef.current);
      setDisplayedText(fullText);
      setIsTyping(false);
      return;
    }

    if (currentScreen >= PROLOGUE_SCREENS.length - 1) {
      // 最后一屏 → 故障消失 → 直接触发 onComplete，让主界面 splash 接管
      setTransitioning(true);
      setGlitchOut(true);
      setTimeout(() => {
        onComplete && onComplete();
      }, 500);
      return;
    }

    // 故障转场到下一屏
    setTransitioning(true);
    setGlitchOut(true);
    setTimeout(() => {
      setCurrentScreen(prev => prev + 1);
      setTransitioning(false);
      setGlitchOut(false);
    }, 500);
  }, [currentScreen, transitioning, isTyping, fullText, onComplete]);

  // 键盘事件
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowRight') {
        e.preventDefault();
        advance();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [advance]);

  // 渲染带换行的文本
  const renderText = (text) => {
    return text.split('\n').map((line, i, arr) => (
      <span key={i}>
        {line}
        {i < arr.length - 1 && <br />}
      </span>
    ));
  };

  return (
    <div className="prologue-overlay" onClick={advance}>
      {/* 扫描线 */}
      <div className="prologue-scanlines" />

      {/* 雨滴粒子 */}
      <div className="prologue-rain">
        {Array.from({ length: 60 }).map((_, i) => (
          <div
            key={i}
            className="raindrop"
            style={{
              left: `${Math.random() * 100}%`,
              animationDuration: `${0.6 + Math.random() * 0.8}s`,
              animationDelay: `${Math.random() * 2}s`,
              opacity: 0.1 + Math.random() * 0.25
            }}
          />
        ))}
      </div>

      {/* 霓虹光晕 */}
      <div className="prologue-glow glow-1" />
      <div className="prologue-glow glow-2" />

      {/* 主内容 */}
      <div className={`prologue-content ${fadeIn ? 'visible' : ''} ${glitchOut ? 'glitch-out' : ''}`}>
        <p className="prologue-text">
          {renderText(displayedText)}
          {isTyping && <span className="typing-cursor">▍</span>}
        </p>
      </div>

      {/* 底部提示 */}
      <div className={`prologue-hint ${fadeIn && !isTyping ? 'visible' : ''}`}>
        {currentScreen < PROLOGUE_SCREENS.length - 1
          ? '[ Click to continue ]'
          : '[ Click to start ]'}
      </div>

      {/* 进度条 */}
      <div className="prologue-progress">
        <div
          className="prologue-progress-fill"
          style={{ width: `${((currentScreen + 1) / PROLOGUE_SCREENS.length) * 100}%` }}
        />
      </div>

      {/* 跳过按钮 */}
      <button
        className="prologue-skip"
        onClick={(e) => {
          e.stopPropagation();
          onComplete && onComplete();
        }}
      >
        SKIP
      </button>
    </div>
  );
};

export default PrologueScreen;
