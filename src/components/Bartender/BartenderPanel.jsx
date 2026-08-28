import React from 'react';
import { EMOTIONS } from '../../data/emotions.js';
import PixiMixingBoard from '../../game/pixi/PixiMixingBoard.jsx';
import './BartenderPanel.css';

const BartenderPanel = ({
  session,
  unlockedGlasses = [],
  unlockedIceTypes = [],
  unlockedDecorations = [],
  disabled = false,
  disabledMessage = 'Please guess the guest\'s true emotions first',
  targetHint = '',
  mixingMode = 'strict',
  guessedCorrectly = false,
  selectedEmotions = [],
  unlockedEmotions = [],
  onEmotionSelect,
  onCancelEmotionGuess,
  onConfirmEmotionGuess,
  onBackToDialogue
}) => {
  if (!session) {
    return null;
  }

  if (disabled) {
    return (
      <div className="bartender-panel disabled">
        <div className="bartender-header">
          <h3>{'🍸 Mixing Station'}</h3>
        </div>
        <div className="disabled-overlay">
          <div className="disabled-message">
            <span className="lock-icon">{'\ud83d\udd12'}</span>
            <p>{disabledMessage}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!guessedCorrectly) {
    return (
      <div className="bartender-panel bartender-panel--stage">
        <div className="bartender-header">
          <h3>{'🍸 Mixing Station'}</h3>
        </div>

        <div className="bartender-emotion-step">
          <div className="bartender-emotion-step__header">
            <div>
              <div className="bartender-emotion-step__eyebrow">Step 0/5</div>
              <h4>Confirm emotions before mixing</h4>
              <p>Bring your judgment into the glass. Pick 3 emotions first, then confirm to continue to glass and recipe steps.</p>
            </div>
            <div className="bartender-emotion-step__count">
              {selectedEmotions.length}/3
            </div>
          </div>

          <div className="bartender-emotion-grid">
            {Object.values(EMOTIONS)
              .filter((emotion) => unlockedEmotions.includes(emotion.id))
              .map((emotion) => {
                const isSelected = selectedEmotions.includes(emotion.id);
                return (
                  <button
                    key={emotion.id}
                    className={`bartender-emotion-card ${isSelected ? 'selected' : ''}`}
                    type="button"
                    onClick={() => onEmotionSelect?.(emotion.id)}
                    style={{
                      borderColor: isSelected ? emotion.color : 'rgba(255, 255, 255, 0.12)',
                      boxShadow: isSelected ? `0 0 18px ${emotion.color}40` : 'none'
                    }}
                  >
                    <span className="bartender-emotion-card__icon">{emotion.icon}</span>
                    <span className="bartender-emotion-card__name">{emotion.name}</span>
                  </button>
                );
              })}
          </div>

          <div className="bartender-emotion-step__actions">
            <button className="bartender-emotion-step__ghost" type="button" onClick={onCancelEmotionGuess}>
              Back to dialogue
            </button>
            <button
              className="bartender-emotion-step__confirm"
              type="button"
              onClick={onConfirmEmotionGuess}
              disabled={selectedEmotions.length < 3}
            >
              Confirm guess ({selectedEmotions.length}/3)
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bartender-panel bartender-panel--stage">
      <div className="bartender-header">
        <h3>{'🍸 Mixing Station'}</h3>
        <div className="bartender-header__actions">
          <button className="reset-btn" type="button" onClick={onBackToDialogue} title={'Back to dialogue'}>
            {'\u21a9'}
          </button>
          <button className="reset-btn" type="button" onClick={session.handleReset} title={'Restart'}>
            {'\ud83d\udd04'}
          </button>
        </div>
      </div>

      <div className="bartender-panel__stage-scroll">
        <PixiMixingBoard
          mixingMode={mixingMode}
          session={session}
          targetHint={targetHint}
          unlockedDecorations={unlockedDecorations}
          unlockedGlasses={unlockedGlasses}
          unlockedIceTypes={unlockedIceTypes}
        />
      </div>

      <button className="plain-water-btn" type="button" onClick={session.handleServeWater}>
        {'🥛 Pour plain water'}
      </button>
    </div>
  );
};

export default BartenderPanel;
