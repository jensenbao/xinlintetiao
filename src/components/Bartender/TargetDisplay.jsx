import React, { useMemo } from 'react';
import { ATTRIBUTE_RANGES, calculateConditionProgress } from '../../utils/cocktailMixing.js';
import { interpretCocktailAttitude } from '../../utils/cocktailAttitude.js';
import './TargetDisplay.css';

/**
 * 目标三维显示组件
 * 显示浓稠度、甜度、烈度的目标条件和当前值
 */
const TargetDisplay = ({ 
  currentValues = { thickness: 0, sweetness: 0, strength: 0 },
  conditions = [],
  showHint = true
}) => {
  // 按属性分组条件
  const conditionsByAttr = {};
  conditions.forEach(cond => {
    if (!conditionsByAttr[cond.attr]) {
      conditionsByAttr[cond.attr] = [];
    }
    conditionsByAttr[cond.attr].push(cond);
  });

  // 渲染单个属性条
  const renderAttributeBar = (attrId) => {
    const attrConfig = ATTRIBUTE_RANGES[attrId];
    const currentValue = currentValues[attrId] || 0;
    const attrConditions = conditionsByAttr[attrId] || [];
    
    // 检查是否满足该属性的所有条件
    const allConditionsMet = attrConditions.every(cond => {
      const progress = calculateConditionProgress(currentValue, cond);
      return progress.progress === 1;
    });
    
    // 计算进度条位置（将值映射到0-100%）
    const range = attrConfig.max - attrConfig.min;
    const normalizedValue = ((currentValue - attrConfig.min) / range) * 100;
    const clampedValue = Math.max(0, Math.min(100, normalizedValue));
    
    // 生成条件标记
    const conditionMarkers = attrConditions.map((cond, idx) => {
      const markerValue = ((cond.value - attrConfig.min) / range) * 100;
      const clampedMarker = Math.max(0, Math.min(100, markerValue));
      
      return {
        ...cond,
        position: clampedMarker,
        key: `${attrId}-${idx}`
      };
    });

    // 生成条件描述
    const conditionText = attrConditions.map(cond => {
      const opSymbol = { '>=': '≥', '<=': '≤', '>': '>', '<': '<', '=': '=' }[cond.op] || cond.op;
      return `${opSymbol}${cond.value}`;
    }).join(' and ');

    return (
      <div key={attrId} className={`attribute-row ${allConditionsMet ? 'met' : ''}`}>
        <div className="attribute-header">
          <span className="attribute-icon">{attrConfig.icon}</span>
          <span className="attribute-name">{attrConfig.name}</span>
          <span className="attribute-value">{currentValue.toFixed(1)}</span>
          {attrConditions.length > 0 && (
            <span className={`attribute-condition ${allConditionsMet ? 'met' : 'unmet'}`}>
              {conditionText}
              {allConditionsMet ? ' ✓' : ''}
            </span>
          )}
        </div>
        
        <div className="attribute-bar-container">
          <div className="attribute-bar">
            {/* 零点标记 */}
            {attrConfig.min < 0 && (
              <div 
                className="zero-marker"
                style={{ left: `${((0 - attrConfig.min) / range) * 100}%` }}
              />
            )}
            
            {/* 条件区域（高亮满足条件的区域） */}
            {conditionMarkers.map(marker => (
              <div
                key={marker.key}
                className={`condition-zone ${marker.op}`}
                style={getConditionZoneStyle(marker, range, attrConfig)}
              />
            ))}
            
            {/* 条件标记线 */}
            {conditionMarkers.map(marker => (
              <div
                key={`line-${marker.key}`}
                className="condition-marker"
                style={{ left: `${marker.position}%` }}
                title={`${attrConfig.name} ${marker.op} ${marker.value}`}
              >
                <span className="marker-value">{marker.value}</span>
              </div>
            ))}
            
            {/* 当前值指示器 */}
            <div 
              className={`current-value-indicator ${allConditionsMet ? 'met' : ''}`}
              style={{ left: `${clampedValue}%` }}
            >
              <div className="indicator-dot" />
            </div>
            
            {/* 填充条 */}
            <div 
              className={`attribute-fill ${allConditionsMet ? 'met' : ''}`}
              style={{ 
                width: `${clampedValue}%`,
                background: getAttributeColor(attrId, allConditionsMet)
              }}
            />
          </div>
          
          {/* 刻度 */}
          <div className="attribute-scale">
            <span>{attrConfig.min}</span>
            <span>{Math.floor((attrConfig.min + attrConfig.max) / 2)}</span>
            <span>{attrConfig.max}</span>
          </div>
        </div>
      </div>
    );
  };

  // 🆕 实时计算酒的态度
  const hasIngredients = currentValues.thickness !== 0 || currentValues.sweetness !== 0 || currentValues.strength !== 0;
  const attitude = useMemo(() => {
    if (!hasIngredients) return null;
    return interpretCocktailAttitude(currentValues);
  }, [currentValues, hasIngredients]);

  return (
    <div className="target-display">
      <div className="target-header">
        <h4>🎯 Target Profile</h4>
        {showHint && conditions.length === 0 && (
          <span className="no-target-hint">Target appears after emotion selection</span>
        )}
      </div>
      
      <div className="attributes-container">
        {renderAttributeBar('thickness')}
        {renderAttributeBar('sweetness')}
        {renderAttributeBar('strength')}
      </div>
      
      {/* 总体状态 */}
      <div className="target-status">
        {conditions.length > 0 && (
          <StatusIndicator 
            conditions={conditions} 
            currentValues={currentValues} 
          />
        )}
      </div>

      {/* 🆕 酒的态度实时预览 */}
      {attitude && (
        <div className="attitude-realtime">
          <span className="attitude-realtime-label">🍸 This drink says...</span>
          <p className="attitude-realtime-text">"{attitude.summary}"</p>
        </div>
      )}
    </div>
  );
};

/**
 * 状态指示器子组件
 */
const StatusIndicator = ({ conditions, currentValues }) => {
  const metCount = conditions.filter(cond => {
    const progress = calculateConditionProgress(currentValues[cond.attr] || 0, cond);
    return progress.progress === 1;
  }).length;
  
  const allMet = metCount === conditions.length;
  
  return (
    <div className={`status-indicator ${allMet ? 'success' : 'pending'}`}>
      {allMet ? (
        <>
          <span className="status-icon">✅</span>
          <span className="status-text">Target met! Ready to serve.</span>
        </>
      ) : (
        <>
          <span className="status-icon">⏳</span>
          <span className="status-text">
            Met {metCount}/{conditions.length} conditions
          </span>
        </>
      )}
    </div>
  );
};

/**
 * 获取条件区域样式
 */
const getConditionZoneStyle = (marker, range, attrConfig) => {
  const { op, position } = marker;
  
  switch (op) {
    case '>=':
    case '>':
      return {
        left: `${position}%`,
        right: '0'
      };
    case '<=':
    case '<':
      return {
        left: '0',
        right: `${100 - position}%`
      };
    case '=':
    case '==':
      return {
        left: `${Math.max(0, position - 5)}%`,
        right: `${Math.max(0, 100 - position - 5)}%`
      };
    default:
      return {};
  }
};

/**
 * 获取属性颜色
 */
const getAttributeColor = (attrId, isMet) => {
  const baseColors = {
    thickness: isMet ? 'linear-gradient(90deg, #9B7EBD, #7B5EAD)' : 'linear-gradient(90deg, #6B5E8D, #5B4E7D)',
    sweetness: isMet ? 'linear-gradient(90deg, #FF6B9D, #FF4B7D)' : 'linear-gradient(90deg, #BB5B7D, #9B4B6D)',
    strength: isMet ? 'linear-gradient(90deg, #FF6B6B, #FF4B4B)' : 'linear-gradient(90deg, #BB5B5B, #9B4B4B)'
  };
  
  return baseColors[attrId] || 'linear-gradient(90deg, #666, #555)';
};

export default TargetDisplay;
