import React, { useEffect, useState } from 'react';
import BalancedPixelText from './BalancedPixelText.jsx';
import './Toast.css';

/**
 * Toast提示组件
 * 用于显示调酒成功/失败等临时提示
 */
const Toast = ({ message, type = 'info', duration = 3000, onClose }) => {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false);
      setTimeout(() => {
        onClose && onClose();
      }, 300);
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onClose]);

  const getIcon = () => {
    switch (type) {
      case 'success':
        return '✓';
      case 'error':
        return '×';
      case 'warning':
        return '⚠';
      default:
        return 'ℹ';
    }
  };

  return (
    <div className={`toast ${type} ${visible ? 'show' : 'hide'}`}>
      <span className="toast-icon">{getIcon()}</span>
      <span className="toast-message">
        <BalancedPixelText text={message} />
      </span>
    </div>
  );
};

export default Toast;
