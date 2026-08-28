// 顾客离开动画覆盖层组件
import React from 'react';
import CustomerAvatar from '../Avatar/CustomerAvatar.jsx';
import './CustomerLeaveOverlay.css';

/**
 * 顾客离开动画覆盖层
 * @param {Object} props
 * @param {Object} props.aiConfig - 顾客配置
 * @param {string} props.parting - 离场结果
 */
const CustomerLeaveOverlay = ({ aiConfig, parting = 'neutral' }) => {
  const isSatisfied = parting === 'satisfied';

  return (
    <div className="customer-leave-overlay">
      <div className={`customer-leave-modal ${isSatisfied ? 'satisfied' : 'neutral'}`}>
        <div className="leave-avatar">
          <CustomerAvatar
            avatarBase64={aiConfig?.avatarBase64}
            emoji={aiConfig?.avatar || '👤'}
            size={80}
            customerId={aiConfig?.id || aiConfig?.avatarCacheKey}
          />
        </div>
        <p className="leave-text">
          {isSatisfied ? '😊 The guest leaves satisfied!' : '🚶 The guest has left.'}
        </p>
        <p className="leave-subtext">The next guest is on the way...</p>
      </div>
    </div>
  );
};

export default CustomerLeaveOverlay;
