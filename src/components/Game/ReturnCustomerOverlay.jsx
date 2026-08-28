// 回头客到达通知组件
import React from 'react';
import CustomerAvatar from '../Avatar/CustomerAvatar.jsx';

const PHASE_NAMES = {
  introduction: 'Introduction', escalation: 'Deepening', turning_point: 'Turning Point',
  resolution: 'Resolution', epilogue: 'Epilogue'
};

/**
 * 回头客到达时的通知弹窗
 */
const ReturnCustomerOverlay = ({ customer, onContinue }) => {
  if (!customer) return null;

  const lastMemory = customer.relationship?.sharedHistory?.slice(-1)[0];
  const phaseName = PHASE_NAMES[customer.characterArc?.currentPhase] || 'Unknown';

  return (
    <div className="return-customer-overlay">
      <div className="return-customer-card">
        <div className="rc-header">
          <span className="rc-wave">👋</span>
          <h3 className="rc-title">An old friend has returned</h3>
        </div>

        <div className="rc-info">
          <span className="rc-avatar">
            <CustomerAvatar
              avatarBase64={customer.originalConfig?.avatarBase64}
              emoji={customer.originalConfig?.avatar || '👤'}
              size={48}
              customerId={customer.id}
            />
          </span>
          <div className="rc-details">
            <div className="rc-name">{customer.name}</div>
            <div className="rc-visit">Visit #{(customer.relationship?.totalVisits || 0) + 1} · {phaseName}</div>
          </div>
        </div>

        {lastMemory && (
          <div className="rc-memory">
            <span className="rc-memory-label">💭 Last memory</span>
            <p className="rc-memory-text">{lastMemory.summary}</p>
          </div>
        )}

        <button className="rc-continue-btn" onClick={onContinue}>
          Welcome them
        </button>
      </div>
    </div>
  );
};

// 内联样式通过 GamePage.css 管理
export default ReturnCustomerOverlay;
