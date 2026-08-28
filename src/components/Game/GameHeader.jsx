import React, { useState } from 'react';
import CustomerAvatar from '../Avatar/CustomerAvatar.jsx';
import CopyrightModal from '../Common/CopyrightModal.jsx';
import {
  WEATHER_ICONS, WEATHER_NAMES,
  MUSIC_ICONS, MUSIC_NAMES
} from '../../data/atmosphereTemplates.js';
import './GameHeader.css';

const GameHeader = ({
  onBack,
  onShowRules,
  currentDay = 1,
  aiConfig,
  currentCustomerIndex = 0,
  isMuted = false,
  toggleMute,
  sfxVolume = 0.5,
  setSfxVolume,
  playSFX = () => {},
  atmosphere = null,
  onShowHelp
}) => {
  const [showAudioSettings, setShowAudioSettings] = useState(false);
  const [showAtmoDetail, setShowAtmoDetail] = useState(false);
  const [showCopyrightModal, setShowCopyrightModal] = useState(false);

  const atmoModifiers = [];
  if (atmosphere?.modifiers?.targetShift) {
    const shift = atmosphere.modifiers.targetShift;
    if (shift.sweetness) atmoModifiers.push(`Sweet ${shift.sweetness > 0 ? '+' : ''}${shift.sweetness}`);
    if (shift.thickness) atmoModifiers.push(`Body ${shift.thickness > 0 ? '+' : ''}${shift.thickness}`);
    if (shift.strength) atmoModifiers.push(`Strength ${shift.strength > 0 ? '+' : ''}${shift.strength}`);
  }

  return (
    <div className="game-header">
      <div className="header-left">
        <button className="back-button" onClick={onBack} title="Back to home">←</button>
        <button className="header-icon-btn" onClick={onShowRules} title="View rules">?</button>
        {onShowHelp && (
          <button className="header-icon-btn help-icon-btn" onClick={onShowHelp} title="Help">
            📖
          </button>
        )}
      </div>

      <div className="header-center">
        <div className="day-badge">
          <span className="day-icon">📆</span>
          <span className="day-text">Day {currentDay}</span>
        </div>

        <div className="customer-compact">
          <span className="customer-avatar-mini">
            <CustomerAvatar
              avatarBase64={aiConfig?.avatarBase64}
              emoji={aiConfig?.avatar || '👤'}
              size={22}
              customerId={aiConfig?.id || aiConfig?.avatarCacheKey}
            />
          </span>
          <span className="customer-name-mini">{aiConfig?.name || 'Guest'}</span>
          <span className="queue-badge">#{currentCustomerIndex + 1}</span>
        </div>
      </div>

      <div className="header-right">
        <button
          className="audio-btn copyright-btn"
          onClick={() => {
            playSFX('click');
            setShowCopyrightModal(true);
          }}
          title="Copyright notice"
          aria-label="Show copyright notice"
        >
          <span className="copyright-btn-label">Copyright</span>
        </button>

        {atmosphere && (
          <div
            className="atmo-compact"
            onMouseEnter={() => setShowAtmoDetail(true)}
            onMouseLeave={() => setShowAtmoDetail(false)}
          >
            <span className="atmo-icon-btn" title="Today's atmosphere">
              {WEATHER_ICONS[atmosphere.weather] || '🌤'}
              {atmoModifiers.length > 0 && <span className="atmo-dot" />}
            </span>
            {showAtmoDetail && (
              <div className="atmo-detail-panel">
                <div className="atmo-detail-row">
                  {WEATHER_ICONS[atmosphere.weather]} {WEATHER_NAMES[atmosphere.weather] || 'Unknown weather'}
                </div>
                <div className="atmo-detail-row">
                  {MUSIC_ICONS[atmosphere.music] || '🎵'} {MUSIC_NAMES[atmosphere.music] || 'Unknown style'}
                </div>
                {atmoModifiers.length > 0 && (
                  <div className="atmo-detail-modifiers">
                    {atmoModifiers.map((modifier, index) => (
                      <span key={index} className="atmo-modifier-tag">{modifier}</span>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <div className="audio-controls">
          <button
            className={`audio-btn ${isMuted ? 'muted' : ''}`}
            onClick={() => {
              playSFX('click');
              toggleMute && toggleMute();
            }}
            title={isMuted ? 'Unmute' : 'Mute'}
          >
            {isMuted ? '🔇' : '🔊'}
          </button>
          <button
            className="audio-btn settings-btn"
            onClick={() => {
              playSFX('click');
              setShowAudioSettings(!showAudioSettings);
            }}
            title="Volume settings"
          >
            ⚙️
          </button>

          {showAudioSettings && (
            <div className="audio-settings-panel">
              <div className="audio-setting-item">
                <label>🔂 SFX</label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={sfxVolume * 100}
                  onChange={(e) => setSfxVolume && setSfxVolume(e.target.value / 100)}
                />
                <span>{Math.round(sfxVolume * 100)}%</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {showCopyrightModal && (
        <CopyrightModal onClose={() => setShowCopyrightModal(false)} />
      )}
    </div>
  );
};

export default GameHeader;
