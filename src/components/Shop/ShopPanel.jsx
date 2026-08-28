import React, { useState } from 'react';
import { GLASS_TYPES } from '../../data/emotions.js';
import { ICE_TYPES, GARNISH_TYPES, DECORATION_TYPES } from '../../data/addons.js';
import { INGREDIENTS } from '../../data/ingredients.js';
import './ShopPanel.css';

/**
 * 嵌入式商店面板组件
 * 可嵌入在首页和日结算页面中
 * @param {object} unlockedItems - 已解锁的物品
 * @param {function} onPurchase - 购买回调
 * @param {boolean} compact - 紧凑模式（用于日结算页面）
 */
const ShopPanel = ({ 
  unlockedItems = {},
  onPurchase,
  compact = false
}) => {
  const [activeTab, setActiveTab] = useState('ingredients');
  const [purchaseConfirm, setPurchaseConfirm] = useState(null);

  // 标签页配置
  const tabs = [
    { id: 'ingredients', name: 'Ingredients', icon: '🧪' },
    { id: 'glasses', name: 'Glassware', icon: '🍸' },
    { id: 'ice', name: 'Ice', icon: '🧊' },
    { id: 'garnishes', name: 'Garnish', icon: '🍋' },
    { id: 'decorations', name: 'Decor', icon: '🍒' }
  ];

  // 获取当前标签页的物品列表
  const getItemsForTab = () => {
    switch (activeTab) {
      case 'ingredients':
        return Object.values(INGREDIENTS).map(item => ({
          ...item,
          type: 'ingredients',
          isUnlocked: unlockedItems.ingredients?.includes(item.id)
        }));
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
      onPurchase && onPurchase(purchaseConfirm.type, purchaseConfirm.id);
      setPurchaseConfirm(null);
    }
  };

  // 取消购买
  const cancelPurchase = () => {
    setPurchaseConfirm(null);
  };

  const items = getItemsForTab();

  return (
    <div className={`shop-panel ${compact ? 'compact' : ''}`}>
      {/* 头部 */}
      <div className="shop-panel-header">
        <h3 className="shop-panel-title">🏪 Shop</h3>
        <div className="shop-panel-money">🎁 Free Unlocks</div>
      </div>

      {/* 标签页 */}
      <div className="shop-panel-tabs">
        {tabs.map(tab => (
          <button
            key={tab.id}
            className={`shop-panel-tab ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            <span className="tab-icon">{tab.icon}</span>
            {!compact && <span className="tab-name">{tab.name}</span>}
          </button>
        ))}
      </div>

      {/* 物品列表 */}
      <div className="shop-panel-items">
        {items.map(item => (
          <div 
            key={item.id}
            className={`shop-panel-item ${item.isUnlocked ? 'unlocked' : ''}`}
          >
            <div className="item-icon">{item.icon}</div>
            <div className="item-info">
              <div className="item-name">{item.name}</div>
              {!compact && <div className="item-description">{item.description}</div>}
              
              {/* 原浆特殊显示：三维属性 */}
              {activeTab === 'ingredients' && !compact && (
                <div className="item-stats">
                  <span className="stat-tag" title="Body">🫗 {item.thickness >= 0 ? '+' : ''}{item.thickness}</span>
                  <span className="stat-tag" title="Sweetness">🍬 {item.sweetness >= 0 ? '+' : ''}{item.sweetness}</span>
                  <span className="stat-tag" title="Strength">🔥 +{item.strength}</span>
                </div>
              )}
              
              {!compact && item.compatibleEmotions && (
                <div className="item-emotions">
                  Compatible emotions: {item.compatibleEmotions.join(', ')}
                </div>
              )}
              {!compact && item.bonus && (
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
      {!compact && (
        <div className="shop-panel-tips">
          {activeTab === 'ingredients' ? (
            <p>💡 Tip: Ingredients are the core of mixing. Different ingredients affect body, sweetness, and strength.</p>
          ) : (
            <p>💡 Tip: Matching garnish/decor to guest emotions can improve outcomes.</p>
          )}
        </div>
      )}

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
  );
};

export default ShopPanel;
