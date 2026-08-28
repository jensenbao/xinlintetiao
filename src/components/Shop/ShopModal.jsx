import React, { useState } from 'react';
import { GLASS_TYPES } from '../../data/emotions.js';
import { ICE_TYPES, GARNISH_TYPES, DECORATION_TYPES } from '../../data/addons.js';
import './ShopModal.css';

/**
 * 商店弹窗组件
 * 用于购买解锁酒杯、冰块、配料、装饰
 */
const ShopModal = ({ 
  unlockedItems,
  onPurchase,
  onClose 
}) => {
  const [activeTab, setActiveTab] = useState('glasses');
  const [purchaseConfirm, setPurchaseConfirm] = useState(null);

  // 标签页配置
  const tabs = [
    { id: 'glasses', name: 'Glassware', icon: '🍸' },
    { id: 'ice', name: 'Ice', icon: '🧊' },
    { id: 'garnishes', name: 'Garnish', icon: '🍋' },
    { id: 'decorations', name: 'Decor', icon: '🍒' }
  ];

  // 获取当前标签页的物品列表
  const getItemsForTab = () => {
    switch (activeTab) {
      case 'glasses':
        return Object.values(GLASS_TYPES).map(item => ({
          ...item,
          type: 'glasses',
          isUnlocked: unlockedItems.glasses?.includes(item.id)
        }));
      case 'ice':
        return Object.values(ICE_TYPES).map(item => ({
          ...item,
          type: 'iceTypes',
          isUnlocked: unlockedItems.iceTypes?.includes(item.id)
        }));
      case 'garnishes':
        return Object.values(GARNISH_TYPES).map(item => ({
          ...item,
          type: 'garnishes',
          isUnlocked: unlockedItems.garnishes?.includes(item.id)
        }));
      case 'decorations':
        return Object.values(DECORATION_TYPES).map(item => ({
          ...item,
          type: 'decorations',
          isUnlocked: unlockedItems.decorations?.includes(item.id)
        }));
      default:
        return [];
    }
  };

  // 处理购买
  const handlePurchase = (item) => {
    if (item.isUnlocked) return;
    setPurchaseConfirm(item);
  };

  // 确认购买
  const confirmPurchase = () => {
    if (purchaseConfirm) {
      onPurchase(purchaseConfirm.type, purchaseConfirm.id);
      setPurchaseConfirm(null);
    }
  };

  // 取消购买
  const cancelPurchase = () => {
    setPurchaseConfirm(null);
  };

  const items = getItemsForTab();

  return (
    <div className="shop-modal-overlay" onClick={onClose}>
      <div className="shop-modal" onClick={e => e.stopPropagation()}>
        {/* 头部 */}
        <div className="shop-header">
          <h2 className="shop-title">🏪 Bartender Shop</h2>
          <div className="shop-money">🎁 Free Unlocks</div>
          <button className="shop-close" onClick={onClose}>×</button>
        </div>

        {/* 标签页 */}
        <div className="shop-tabs">
          {tabs.map(tab => (
            <button
              key={tab.id}
              className={`shop-tab ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              <span className="tab-icon">{tab.icon}</span>
              <span className="tab-name">{tab.name}</span>
            </button>
          ))}
        </div>

        {/* 物品列表 */}
        <div className="shop-items">
          {items.map(item => (
            <div 
              key={item.id}
              className={`shop-item ${item.isUnlocked ? 'unlocked' : ''}`}
            >
              <div className="item-icon">{item.icon}</div>
              <div className="item-info">
                <div className="item-name">{item.name}</div>
                <div className="item-description">{item.description}</div>
                {item.compatibleEmotions && (
                  <div className="item-emotions">
                    Compatible emotions: {item.compatibleEmotions.join(', ')}
                  </div>
                )}
                {item.bonus && (
                  <div className="item-bonus">
                    Bonus emotions: {item.bonus.join(', ')}
                  </div>
                )}
              </div>
              <div className="item-action">
                {item.isUnlocked ? (
                  <span className="item-owned">Owned</span>
                ) : (
                  <button 
                    className="item-buy-btn"
                    onClick={() => handlePurchase(item)}
                  >
                    Unlock
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* 提示信息 */}
        <div className="shop-tips">
          <p>💡 Tip: Matching garnish/decor to guest emotions can improve outcomes.</p>
        </div>

        {/* 购买确认弹窗 */}
        {purchaseConfirm && (
          <div className="purchase-confirm-overlay">
            <div className="purchase-confirm-modal">
              <div className="confirm-icon">{purchaseConfirm.icon}</div>
              <h3 className="confirm-title">Confirm Unlock</h3>
              <p className="confirm-text">
                Unlock <strong>{purchaseConfirm.name}</strong>?
              </p>
              <div className="confirm-buttons">
                <button className="confirm-cancel" onClick={cancelPurchase}>Cancel</button>
                <button className="confirm-buy" onClick={confirmPurchase}>Confirm</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ShopModal;
