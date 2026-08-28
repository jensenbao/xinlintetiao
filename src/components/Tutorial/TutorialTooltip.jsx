// Tutorial tooltip component
import React from 'react';
import { TUTORIAL_TOOLTIPS } from '../../data/tutorialData.js';
import './TutorialTooltip.css';

/**
 * Tutorial tooltip
 * @param {Object} props
 * @param {string} props.tooltipId - Tooltip ID (key in TUTORIAL_TOOLTIPS)
 * @param {string} props.position - Position: 'top' | 'bottom' | 'left' | 'right' | 'center'
 * @param {Function} props.onDismiss - Dismiss callback
 */
const TutorialTooltip = ({ tooltipId, position = 'bottom', onDismiss }) => {
  if (!tooltipId) return null;

  const text = TUTORIAL_TOOLTIPS[tooltipId];
  if (!text) return null;

  return (
    <div className={`tutorial-tooltip tooltip-${position}`}>
      <div className="tooltip-content">
        {text.split('\n').map((line, i) => (
          <p key={i} className="tooltip-line">{line}</p>
        ))}
      </div>
      {onDismiss && (
        <button className="tooltip-dismiss" onClick={onDismiss}>
          Got it
        </button>
      )}
    </div>
  );
};

export default TutorialTooltip;
