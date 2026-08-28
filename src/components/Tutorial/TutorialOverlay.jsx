// Tutorial overlay component
import React from 'react';
import './TutorialOverlay.css';

/**
 * Tutorial overlay layer
 * Covers non-interactive areas with a translucent mask
 * @param {Object} props
 * @param {string[]} props.visibleAreas - Interactive areas ['chat', 'emotion', 'bartender']
 * @param {boolean} props.active - Whether the overlay is active
 */
const TutorialOverlay = ({ visibleAreas = ['chat'], active = true }) => {
  if (!active) return null;

  const isChatVisible = visibleAreas.includes('chat');
  const isEmotionVisible = visibleAreas.includes('emotion');
  const isBartenderVisible = visibleAreas.includes('bartender');

  return (
    <>
      {/* Emotion panel mask */}
      {!isEmotionVisible && (
        <div className="tutorial-mask tutorial-mask-emotion">
          <div className="mask-label">🔒 Unlock after more dialogue</div>
        </div>
      )}

      {/* Mixing panel mask */}
      {!isBartenderVisible && (
        <div className="tutorial-mask tutorial-mask-bartender">
          <div className="mask-label">🔒 Unlock after a correct emotion guess</div>
        </div>
      )}
    </>
  );
};

export default TutorialOverlay;
