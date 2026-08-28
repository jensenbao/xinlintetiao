/**
 * 帮助面板组件
 * 分类展示游戏机制，随时可查阅
 */
import React, { useState } from 'react';
import { HELP_SECTIONS } from '../../data/helpContent.js';
import './HelpPanel.css';

const HelpPanel = ({ onClose }) => {
  const [activeSection, setActiveSection] = useState('basics');
  const [activeSubsection, setActiveSubsection] = useState('core_loop');

  const currentSection = HELP_SECTIONS.find(s => s.id === activeSection);
  const currentContent = currentSection?.subsections.find(s => s.id === activeSubsection);

  return (
    <div className="help-panel-overlay" onClick={onClose}>
      <div className="help-panel" onClick={e => e.stopPropagation()}>
        <header className="help-header">
          <h2>Help</h2>
          <button className="help-close" onClick={onClose}>✕</button>
        </header>

        <div className="help-body">
          <nav className="help-nav">
            {HELP_SECTIONS.map(section => (
              <div key={section.id} className="help-nav-section">
                <button
                  className={`help-nav-title ${activeSection === section.id ? 'active' : ''}`}
                  onClick={() => {
                    setActiveSection(section.id);
                    setActiveSubsection(section.subsections[0].id);
                  }}
                >
                  {section.icon} {section.title}
                </button>
                {activeSection === section.id && (
                  <div className="help-nav-subsections">
                    {section.subsections.map(sub => (
                      <button
                        key={sub.id}
                        className={`help-nav-sub ${activeSubsection === sub.id ? 'active' : ''}`}
                        onClick={() => setActiveSubsection(sub.id)}
                      >
                        {sub.title}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </nav>

          <article className="help-content">
            {currentContent && (
              <>
                <h3>{currentContent.title}</h3>
                <div className="help-text">
                  {currentContent.content.split('\n').map((line, i) => (
                    <p key={i}>{line}</p>
                  ))}
                </div>
              </>
            )}
          </article>
        </div>
      </div>
    </div>
  );
};

export default HelpPanel;
