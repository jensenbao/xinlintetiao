// 动态事件通知组件
import React, { useState, useEffect } from 'react';
import { EVENT_TYPE_ICONS, EVENT_TYPE_NAMES } from '../../data/eventTemplates.js';
import './EventNotification.css';

/**
 * 事件弹出通知组件
 * 展示突发事件并提供玩家选择
 * @param {Object} props
 * @param {Object} props.event - 事件数据
 * @param {Function} props.onChoice - 玩家选择回调 (choiceIndex)
 * @param {Function} props.onDismiss - 关闭通知回调
 * @param {boolean} props.isVisible - 是否可见
 */
const EventNotification = ({ event, onChoice, onDismiss, isVisible }) => {
  const [fadeIn, setFadeIn] = useState(false);
  const [selectedChoice, setSelectedChoice] = useState(null);

  useEffect(() => {
    if (isVisible) {
      setTimeout(() => setFadeIn(true), 50);
      setSelectedChoice(null);
    } else {
      setFadeIn(false);
    }
  }, [isVisible]);

  if (!isVisible || !event) return null;

  const typeIcon = EVENT_TYPE_ICONS[event.type] || '⚡';
  const typeName = EVENT_TYPE_NAMES[event.type] || 'Event';

  const handleChoice = (index) => {
    setSelectedChoice(index);
    // 延迟一下让动画播放
    setTimeout(() => {
      if (onChoice) onChoice(index);
    }, 400);
  };

  return (
    <div className={`event-notification-overlay ${fadeIn ? 'fade-in' : ''}`}>
      <div className="event-notification-card">
        {/* 事件标题 */}
        <div className="event-header">
          <span className="event-type-icon">{typeIcon}</span>
          <span className="event-type-name">{typeName}</span>
        </div>

        {/* 事件叙述 */}
        <div className="event-narrative">
          <p>"{event.narrative}"</p>
        </div>

        {/* 玩家选择 */}
        {event.choices && event.choices.length > 0 && (
          <div className="event-choices">
            {event.choices.map((choice, index) => (
              <button
                key={index}
                className={`event-choice-btn ${selectedChoice === index ? 'selected' : ''} ${selectedChoice !== null && selectedChoice !== index ? 'not-selected' : ''}`}
                onClick={() => handleChoice(index)}
                disabled={selectedChoice !== null}
              >
                <span className="choice-text">{choice.text}</span>
              </button>
            ))}
          </div>
        )}

        {/* 无选择时的关闭按钮 */}
        {(!event.choices || event.choices.length === 0) && (
          <button className="event-dismiss-btn" onClick={onDismiss}>
            Got it
          </button>
        )}
      </div>
    </div>
  );
};

export default EventNotification;
