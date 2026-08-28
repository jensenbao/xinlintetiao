// 每日氛围开场展示组件 - 优化版
import React, { useState, useEffect } from 'react';
import {
  WEATHER_ICONS, WEATHER_NAMES,
  MUSIC_ICONS, MUSIC_NAMES,
  LIGHTING_ICONS, LIGHTING_NAMES,
  CROWD_ICONS, CROWD_NAMES
} from '../../data/atmosphereTemplates.js';
import './AtmosphereOverlay.css';

// 先聚焦核心循环：暂时不展示“今晚影响”
const ATMOSPHERE_EFFECTS_ENABLED = false;

/**
 * 氛围开场展示叠加层
 * 每天开始时展示当日氛围描述和影响
 */
const AtmosphereOverlay = ({ atmosphere, day, onStart, isVisible }) => {
  const [phase, setPhase] = useState(0); // 0=hidden, 1=bg, 2=header, 3=narrative, 4=tags, 5=effects, 6=button
  const [narrativeText, setNarrativeText] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  useEffect(() => {
    if (!isVisible || !atmosphere) {
      setPhase(0);
      setNarrativeText('');
      return;
    }

    // 错开依次显示各元素
    const timers = [
      setTimeout(() => setPhase(1), 100),
      setTimeout(() => setPhase(2), 500),
      setTimeout(() => {
        setPhase(3);
        setIsTyping(true);
        // 打字机效果显示叙述文字
        const text = atmosphere.narrative || '';
        let idx = 0;
        const typeTimer = setInterval(() => {
          idx += 1;
          setNarrativeText(text.slice(0, idx));
          if (idx >= text.length) {
            clearInterval(typeTimer);
            setIsTyping(false);
          }
        }, 35);
        return () => clearInterval(typeTimer);
      }, 900),
      setTimeout(() => setPhase(4), 1800),
      setTimeout(() => setPhase(5), 2200),
      setTimeout(() => setPhase(6), 2600),
    ];

    return () => timers.forEach(t => clearTimeout(t));
  }, [isVisible, atmosphere]);

  if (!isVisible || !atmosphere) return null;

  const weatherIcon = WEATHER_ICONS[atmosphere.weather] || '🌙';
  const weatherName = WEATHER_NAMES[atmosphere.weather] || 'Unknown';
  const musicIcon = MUSIC_ICONS[atmosphere.music] || '🎵';
  const musicName = MUSIC_NAMES[atmosphere.music] || 'Unknown';
  const lightingIcon = LIGHTING_ICONS[atmosphere.lighting] || '💡';
  const lightingName = LIGHTING_NAMES[atmosphere.lighting] || 'Unknown';
  const crowdIcon = CROWD_ICONS[atmosphere.crowdLevel] || '👥';
  const crowdName = CROWD_NAMES[atmosphere.crowdLevel] || 'Unknown';

  const modifiers = atmosphere.modifiers || {};
  const effects = [];

  if (modifiers.trustBonus > 0) {
    effects.push({ text: `Guests open up more easily`, detail: `Trust +${Math.round(modifiers.trustBonus * 100)}%`, positive: true });
  } else if (modifiers.trustBonus < 0) {
    effects.push({ text: `Guests are more guarded`, detail: `Trust ${Math.round(modifiers.trustBonus * 100)}%`, positive: false });
  }

  if (modifiers.targetShift) {
    const { thickness, sweetness, strength } = modifiers.targetShift;
    if (sweetness > 0) effects.push({ text: 'Preference: sweeter drinks', detail: `Sweetness +${sweetness}`, positive: true });
    if (sweetness < 0) effects.push({ text: 'Preference: drier/bitter drinks', detail: `Sweetness ${sweetness}`, positive: false });
    if (thickness > 0) effects.push({ text: 'Preference: fuller body', detail: `Body +${thickness}`, positive: true });
    if (thickness < 0) effects.push({ text: 'Preference: lighter body', detail: `Body ${thickness}`, positive: false });
    if (strength > 0) effects.push({ text: 'Preference: stronger drinks', detail: `Strength +${strength}`, positive: true });
    if (strength < 0) effects.push({ text: 'Preference: milder drinks', detail: `Strength ${strength}`, positive: false });
  }

  // 根据天气决定粒子类型
  const isRain = ['rainy', 'stormy'].includes(atmosphere.weather);
  const isSnow = atmosphere.weather === 'snowy';
  const isFog = atmosphere.weather === 'foggy';

  return (
    <div className={`atmosphere-overlay ${phase >= 1 ? 'fade-in' : ''}`}>
      {/* 天气粒子效果 */}
      {(isRain || isSnow) && (
        <div className="atmo-weather-particles">
          {Array.from({ length: isRain ? 40 : 25 }).map((_, i) => (
            <div
              key={i}
              className={`weather-particle ${isRain ? 'rain' : 'snow'}`}
              style={{
                left: `${Math.random() * 100}%`,
                animationDuration: isRain ? `${0.5 + Math.random() * 0.6}s` : `${3 + Math.random() * 4}s`,
                animationDelay: `${Math.random() * 2}s`,
                opacity: 0.15 + Math.random() * 0.3,
              }}
            />
          ))}
        </div>
      )}

      {/* 雾效果 */}
      {isFog && <div className="atmo-fog" />}

      <div className="atmosphere-card">
        {/* 天气与日期 */}
        <div className={`atmosphere-header ${phase >= 2 ? 'show' : ''}`}>
          <span className="atmosphere-weather-icon">{weatherIcon}</span>
          <div className="atmosphere-day-label">Day {day}</div>
          <h2 className="atmosphere-day-title">{weatherName} Night</h2>
        </div>

        {/* 叙述文字 - 打字机效果 */}
        <div className={`atmosphere-narrative ${phase >= 3 ? 'show' : ''}`}>
          <p>"{narrativeText}{isTyping && <span className="narrative-cursor">▍</span>}"</p>
        </div>

        {/* 气味描述 */}
        {atmosphere.scent && (
          <div className={`atmosphere-scent ${phase >= 4 ? 'show' : ''}`}>
            <span className="scent-icon">👃</span>
            <span className="scent-text">{atmosphere.scent}</span>
          </div>
        )}

        {/* 环境标签 */}
        <div className={`atmosphere-tags ${phase >= 4 ? 'show' : ''}`}>
          <span className="atmo-tag" style={{ transitionDelay: '0s' }}>{musicIcon} {musicName}</span>
          <span className="atmo-tag" style={{ transitionDelay: '0.1s' }}>{lightingIcon} {lightingName}</span>
          <span className="atmo-tag" style={{ transitionDelay: '0.2s' }}>{crowdIcon} {crowdName}</span>
        </div>

        {/* 今晚特效 */}
        {ATMOSPHERE_EFFECTS_ENABLED && effects.length > 0 && (
          <div className={`atmosphere-effects ${phase >= 5 ? 'show' : ''}`}>
            <div className="effects-header">
              <span className="effects-title">Tonight's Effects</span>
            </div>
            <div className="effects-grid">
              {effects.map((effect, index) => (
                <div key={index} className={`effect-chip ${effect.positive ? 'positive' : 'negative'}`}>
                  <span className="effect-text">{effect.text}</span>
                  <span className="effect-detail">{effect.detail}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 开始营业按钮 */}
        <button
          className={`start-business-btn ${phase >= 6 ? 'show' : ''}`}
          onClick={onStart}
        >
          <span className="btn-text">Open for Business</span>
          <span className="btn-glow" />
        </button>
      </div>
    </div>
  );
};

export default AtmosphereOverlay;
