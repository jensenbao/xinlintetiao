import React, { useState } from 'react';
import { getCocktailRecipes, getUnlockedItems, getDiscoveredCombos } from '../utils/storage.js';
import { EMOTIONS, GLASS_TYPES } from '../data/emotions.js';
import { COMBO_BONUS, ICE_TYPES, GARNISH_TYPES, DECORATION_TYPES } from '../data/addons.js';
import './EncyclopediaPage.css';

/**
 * Encyclopedia page
 * Features: view unlocked emotions, glasses, AI guests, and recipe history
 */
const EncyclopediaPage = ({ onBack }) => {
  const [activeTab, setActiveTab] = useState('emotions');
  const unlockedItems = getUnlockedItems();
  const recipes = getCocktailRecipes();
  const discoveredCombos = getDiscoveredCombos();
  const totalCombos = Object.keys(COMBO_BONUS).length;
  const discoveredCount = Object.keys(discoveredCombos).length;

  // Render emotion encyclopedia
  const renderEmotions = () => {
    return (
      <div className="encyclopedia-grid">
        {Object.values(EMOTIONS).map(emotion => {
          const isUnlocked = unlockedItems.emotions.includes(emotion.id);
          return (
            <div key={emotion.id} className={`encyclopedia-card ${isUnlocked ? 'unlocked' : 'locked'}`}>
              {!isUnlocked && <div className="lock-badge">🔒</div>}
              <div className="card-icon" style={{ opacity: isUnlocked ? 1 : 0.3 }}>
                {emotion.icon}
              </div>
              <h3 className="card-title">{isUnlocked ? emotion.name : '???'}</h3>
              {isUnlocked && (
                <div className="card-color" style={{ backgroundColor: emotion.color }}></div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  // Render glass encyclopedia
  const renderGlasses = () => {
    return (
      <div className="encyclopedia-grid">
        {Object.values(GLASS_TYPES).map(glass => {
          const isUnlocked = unlockedItems.glasses.includes(glass.id);
          return (
            <div key={glass.id} className={`encyclopedia-card large ${isUnlocked ? 'unlocked' : 'locked'}`}>
              {!isUnlocked && <div className="lock-badge">🔒</div>}
              <div className="card-icon large">{glass.icon}</div>
              <h3 className="card-title">{isUnlocked ? glass.name : '???'}</h3>
              {isUnlocked && (
                <>
                  <p className="card-description">{glass.description}</p>
                  <div className="card-bonus">
                    <strong>Bonus emotions:</strong>
                    {glass.bonus.map(emotionId => EMOTIONS[emotionId].name).join(', ')}
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  // Render recipe history
  const renderRecipes = () => {
    if (recipes.length === 0) {
      return (
        <div className="empty-state">
          <p className="empty-icon">📝</p>
          <p>No mixing records yet</p>
          <p className="empty-hint">Start playing and craft your first cocktail.</p>
        </div>
      );
    }

    // Group by guest name
    const groupedRecipes = recipes.reduce((acc, recipe) => {
      const customerName = recipe.aiName || 'Unknown Guest';
      if (!acc[customerName]) acc[customerName] = [];
      acc[customerName].push(recipe);
      return acc;
    }, {});

    return (
      <div className="recipes-container">
        {Object.entries(groupedRecipes).map(([customerName, customerRecipes]) => {
          return (
            <div key={customerName} className="recipe-group">
              <h3 className="recipe-group-title">
                👤 {customerName}
              </h3>
              <div className="recipe-list">
                {customerRecipes.slice(-10).reverse().map((recipe, index) => (
                  <div key={index} className="recipe-card">
                    <div className="recipe-header">
                      <span className="recipe-date">
                        {new Date(recipe.timestamp).toLocaleDateString('en-US', { 
                          month: 'short', 
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </span>
                      {recipe.targetCheck?.allMet !== undefined && (
                        <span className={`recipe-badge ${recipe.targetCheck.allMet ? 'success' : 'failed'}`}>
                          {recipe.targetCheck.allMet ? '✓ Success' : '✗ Failed'}
                        </span>
                      )}
                    </div>
                    <div className="recipe-content">
                      {/* Glass */}
                      <div className="recipe-item">
                        <strong>🥃 Glass:</strong>
                        {GLASS_TYPES[recipe.glass]?.icon} {GLASS_TYPES[recipe.glass]?.name || 'Unknown'}
                      </div>
                      
                      {/* Three dimensions */}
                      {recipe.mixture && (
                        <div className="recipe-mixture">
                          <strong>📊 Dimensions:</strong>
                          <div className="mixture-values">
                            <span className="mixture-item">
                              Body {recipe.mixture.thickness?.toFixed(1) || '0.0'}
                            </span>
                            <span className="mixture-item">
                              Sweetness {recipe.mixture.sweetness?.toFixed(1) || '0.0'}
                            </span>
                            <span className="mixture-item">
                              Strength {recipe.mixture.strength?.toFixed(1) || '0.0'}
                            </span>
                          </div>
                        </div>
                      )}
                      
                      {/* Add-on combo */}
                      <div className="recipe-addons">
                        {recipe.ice && recipe.ice !== 'no_ice' && (
                          <span className="addon-tag ice">
                            {ICE_TYPES[recipe.ice]?.icon} {ICE_TYPES[recipe.ice]?.name}
                          </span>
                        )}
                        {recipe.garnish && (
                          <span className="addon-tag garnish">
                            {GARNISH_TYPES[recipe.garnish]?.icon} {GARNISH_TYPES[recipe.garnish]?.name}
                          </span>
                        )}
                        {recipe.decoration && (
                          <span className="addon-tag decoration">
                            {DECORATION_TYPES[recipe.decoration]?.icon} {DECORATION_TYPES[recipe.decoration]?.name}
                          </span>
                        )}
                      </div>
                      
                      {/* Satisfaction */}
                      {recipe.targetCheck?.satisfaction !== undefined && (
                        <div className="recipe-satisfaction">
                          <strong>💯 Satisfaction:</strong>
                          <div className="satisfaction-bar">
                            <div 
                              className="satisfaction-fill" 
                              style={{ width: `${recipe.targetCheck.satisfaction * 100}%` }}
                            />
                          </div>
                          <span className="satisfaction-value">
                            {Math.round(recipe.targetCheck.satisfaction * 100)}%
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  // Helper: get item name
  const getItemName = (type, id) => {
    switch (type) {
      case 'ice': return ICE_TYPES[id]?.name || id;
      case 'garnish': return GARNISH_TYPES[id]?.name || id;
      case 'decoration': return DECORATION_TYPES[id]?.name || id;
      case 'glass': return GLASS_TYPES[id]?.name || id;
      default: return id;
    }
  };

  const getItemIcon = (type, id) => {
    switch (type) {
      case 'ice': return ICE_TYPES[id]?.icon || '';
      case 'garnish': return GARNISH_TYPES[id]?.icon || '';
      case 'decoration': return DECORATION_TYPES[id]?.icon || '';
      case 'glass': return GLASS_TYPES[id]?.icon || '';
      default: return '';
    }
  };

  // Render golden combo encyclopedia
  const renderCombos = () => {
    return (
      <div className="encyclopedia-grid combos">
        {Object.entries(COMBO_BONUS).map(([comboId, combo]) => {
          const isDiscovered = !!discoveredCombos[comboId];
          const comboData = discoveredCombos[comboId];
          
          return (
            <div key={comboId} className={`encyclopedia-card combo-card ${isDiscovered ? 'unlocked' : 'locked'}`}>
              {!isDiscovered && <div className="lock-badge">🔒</div>}
              <div className="card-icon combo-icon" style={{ opacity: isDiscovered ? 1 : 0.3 }}>
                {combo.icon}
              </div>
              <h3 className="card-title">{isDiscovered ? combo.name : '???'}</h3>
              {isDiscovered && (
                <>
                  <p className="combo-description">{combo.description}</p>
                  <div className="combo-bonus-value">+{combo.bonus}</div>
                  <div className="combo-requires">
                    {Object.entries(combo.requires).map(([type, id]) => (
                      <span key={type} className="require-item">
                        {getItemIcon(type, id)} {getItemName(type, id)}
                      </span>
                    ))}
                  </div>
                  <div className="combo-stats">
                    <span className="discover-date">
                      Discovered on {new Date(comboData.discoveredAt).toLocaleDateString('en-US')}
                    </span>
                    <span className="use-count">
                      Used {comboData.count} times
                    </span>
                  </div>
                </>
              )}
              {!isDiscovered && (
                <p className="combo-hint">Try different item combinations to discover it</p>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  // Total glass count
  const totalGlasses = Object.keys(GLASS_TYPES).length;

  return (
    <div className="encyclopedia-page">
      <div className="encyclopedia-header">
        <button className="back-button" onClick={onBack}>
          ← Back
        </button>
        <h1>📚 Encyclopedia</h1>
      </div>

      <div className="encyclopedia-tabs">
        <button 
          className={activeTab === 'emotions' ? 'active' : ''} 
          onClick={() => setActiveTab('emotions')}
        >
          🎭 Emotions ({unlockedItems.emotions.length}/12)
        </button>
        <button 
          className={activeTab === 'glasses' ? 'active' : ''} 
          onClick={() => setActiveTab('glasses')}
        >
          🥃 Glasses ({unlockedItems.glasses?.length || 0}/{totalGlasses})
        </button>
        <button 
          className={activeTab === 'recipes' ? 'active' : ''} 
          onClick={() => setActiveTab('recipes')}
        >
          📝 Recipe History ({recipes.length})
        </button>
        <button 
          className={activeTab === 'combos' ? 'active' : ''} 
          onClick={() => setActiveTab('combos')}
        >
          ✨ Golden Combos ({discoveredCount}/{totalCombos})
        </button>
      </div>

      <div className="encyclopedia-content">
        {activeTab === 'emotions' && renderEmotions()}
        {activeTab === 'glasses' && renderGlasses()}
        {activeTab === 'recipes' && renderRecipes()}
        {activeTab === 'combos' && renderCombos()}
      </div>
    </div>
  );
};

export default EncyclopediaPage;
