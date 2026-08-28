// 游戏提示面板组件
import React from 'react';
import './GameHintPanel.css';

/**
 * 游戏提示面板
 * @param {Object} props
 * @param {Object} props.hint - 提示内容 { icon, title, message, type }
 * @param {Function} props.onClose - 关闭回调
 */
const GameHintPanel = ({ hint, onClose }) => {
  if (!hint) return null;

  return (
    <div className="game-hint-panel">
      <div className="hint-icon">{hint.icon}</div>
      <div className="hint-content">
        <div className="hint-title">{hint.title}</div>
        <div className="hint-message">{hint.message}</div>
      </div>
      <button className="hint-close" onClick={onClose}>×</button>
    </div>
  );
};

export default GameHintPanel;
