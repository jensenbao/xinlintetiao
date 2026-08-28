/**
 * 进阶引导弹窗组件
 * 在关键时刻弹出，教会玩家进阶玩法
 */
import React, { useEffect, useState } from 'react';
import './AdvancedGuidePopup.css';

const AdvancedGuidePopup = ({ guide, onDismiss }) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), 500);
    return () => clearTimeout(timer);
  }, []);

  if (!guide || !visible) return null;

  const { content } = guide;

  return (
    <>
      <div className="guide-backdrop" onClick={onDismiss} />
      <div className={`guide-popup ${content.style || ''}`}>
        <div className="guide-header">
          <span className="guide-icon">💡</span>
          <h3 className="guide-title">{content.title}</h3>
        </div>
        <div className="guide-body">
          {content.body.split('\n').map((line, i) => (
            <p key={i}>{line}</p>
          ))}
        </div>
        <button className="guide-dismiss" onClick={onDismiss}>
          Got it
        </button>
      </div>
    </>
  );
};

export default AdvancedGuidePopup;
