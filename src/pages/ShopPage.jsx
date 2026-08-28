import React, { useState } from 'react';
import ShopPanel from '../components/Shop/ShopPanel.jsx';
import Toast from '../components/Common/Toast.jsx';
import { GLASS_TYPES } from '../data/emotions.js';
import { ICE_TYPES, GARNISH_TYPES, DECORATION_TYPES } from '../data/addons.js';
import { INGREDIENTS } from '../data/ingredients.js';
import './ShopPage.css';

/**
 * 商店独立页面
 * 购买原浆、杯型、冰块、配料、装饰
 */
const ShopPage = ({ onBack, unlockedItems = {}, onShopPurchase }) => {
  const [toastList, setToastList] = useState([]);

  const handlePurchase = (itemType, itemId) => {
    const success = onShopPurchase && onShopPurchase(itemType, itemId);

    if (success !== false) {
      let itemName = itemId;
      if (itemType === 'glasses' && GLASS_TYPES[itemId]) itemName = GLASS_TYPES[itemId].name;
      else if (itemType === 'iceTypes' && ICE_TYPES[itemId]) itemName = ICE_TYPES[itemId].name;
      else if (itemType === 'garnishes' && GARNISH_TYPES[itemId]) itemName = GARNISH_TYPES[itemId].name;
      else if (itemType === 'decorations' && DECORATION_TYPES[itemId]) itemName = DECORATION_TYPES[itemId].name;
      else if (itemType === 'ingredients' && INGREDIENTS[itemId]) itemName = INGREDIENTS[itemId].name;

      setToastList(prev => [...prev, {
        id: Date.now(),
        message: `🎉 Unlocked: ${itemName}`,
        type: 'success'
      }]);
    }
  };

  const handleRemoveToast = (id) => {
    setToastList(prev => prev.filter(t => t.id !== id));
  };

  return (
    <div className="shop-page">
      <div className="shop-page-header">
        <button className="back-button" onClick={onBack}>← Back</button>
        <h1>🛒 Shop</h1>
        <div className="shop-money-display">🎁 All unlocks are free</div>
      </div>

      <div className="shop-page-content">
        <ShopPanel
          unlockedItems={unlockedItems}
          onPurchase={handlePurchase}
        />
      </div>

      {toastList.map(toast => (
        <Toast
          key={toast.id}
          message={toast.message}
          type={toast.type}
          onClose={() => handleRemoveToast(toast.id)}
        />
      ))}
    </div>
  );
};

export default ShopPage;
