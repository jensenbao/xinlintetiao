// Tutorial completion modal component
import React from 'react';
import './TutorialCompleteModal.css';

/**
 * Tutorial completion screen
 * @param {Object} props
 * @param {Function} props.onContinue - Continue callback
 */
const TutorialCompleteModal = ({ onContinue }) => {
  return (
    <div className="tutorial-complete-overlay">
      <div className="tutorial-complete-modal">
        <div className="tc-header">
          <span className="tc-icon">🌙</span>
          <h2 className="tc-title">Your first night is over</h2>
        </div>

        <div className="tc-skills">
          <h3 className="tc-subtitle">You learned:</h3>
          <div className="tc-skill-list">
            <div className="tc-skill">
              <span className="tc-skill-icon">💬</span>
              <span className="tc-skill-text">Talk with guests and build trust</span>
            </div>
            <div className="tc-skill">
              <span className="tc-skill-icon">🎭</span>
              <span className="tc-skill-text">Read true emotions behind the surface</span>
            </div>
            <div className="tc-skill">
              <span className="tc-skill-icon">🍸</span>
              <span className="tc-skill-text">Mix cocktails based on emotion</span>
            </div>
          </div>
        </div>

        <div className="tc-divider" />

        <div className="tc-narrative">
          <p>The late-night visitor set down the glass and stood up to leave.</p>
          <p>At the door, they looked back once.</p>
          <p>They said nothing, but you feel they will return.</p>
        </div>

        <div className="tc-reward">
          <span className="tc-reward-icon">🎁</span>
          <span className="tc-reward-text">Free mixing unlocked</span>
        </div>

        <div className="tc-teaser">
          <p className="tc-teaser-title">You learned the basics. Next...</p>
          <ul className="tc-teaser-list">
            <li>🌙 Some guests will come back—they remember you</li>
            <li>🍸 Every drink has an attitude—it speaks for you</li>
            <li>📖 Your own story will slowly emerge</li>
          </ul>
          <p className="tc-teaser-footer">No rush. Take it slowly.</p>
        </div>

        <button className="tc-continue-btn" onClick={onContinue}>
          Continue Service
        </button>
      </div>
    </div>
  );
};

export default TutorialCompleteModal;
