import React, { useState, useEffect, useRef } from 'react';
import { GLASS_TYPES } from '../../data/emotions.js';
import { ICE_TYPES, GARNISH_TYPES, DECORATION_TYPES } from '../../data/addons.js';
import { INGREDIENTS } from '../../data/ingredients.js';
import './CocktailPreview.css';

/**
 * 酒杯预览组件
 * 显示当前调制中的鸡尾酒视觉效果
 */
const CocktailPreview = ({ 
  recipe = { glass: null, ice: null, ingredients: [], garnish: null, decoration: null },
  totalPortions = 0,
  maxPortions = 3,
  isSuccess = false  // 调酒成功状态
}) => {
  const VISUAL_STAGE_WIDTH = 260;
  const VISUAL_STAGE_HEIGHT = 360;

  // 倒酒动画状态
  const [isPouring, setIsPouring] = useState(false);
  const [portionBump, setPortionBump] = useState(false);
  const [stageScale, setStageScale] = useState(1);
  const prevPortionsRef = useRef(totalPortions);
  const pourTimerRef = useRef(null);
  const bumpTimerRef = useRef(null);
  const visualFrameRef = useRef(null);
  
  // 监听份数变化，触发倒酒动画
  useEffect(() => {
    // 清理之前的定时器
    if (pourTimerRef.current) clearTimeout(pourTimerRef.current);
    if (bumpTimerRef.current) clearTimeout(bumpTimerRef.current);
    
    if (totalPortions > prevPortionsRef.current && totalPortions > 0) {
      // 份数增加，触发倒酒动画
      setIsPouring(true);
      setPortionBump(true);
      
      // 动画持续时间与 CSS 匹配
      pourTimerRef.current = setTimeout(() => setIsPouring(false), 600);
      bumpTimerRef.current = setTimeout(() => setPortionBump(false), 350);
    }
    
    prevPortionsRef.current = totalPortions;
    
    return () => {
      if (pourTimerRef.current) clearTimeout(pourTimerRef.current);
      if (bumpTimerRef.current) clearTimeout(bumpTimerRef.current);
    };
  }, [totalPortions]);

  useEffect(() => {
    const frame = visualFrameRef.current;
    if (!frame) return undefined;

    const updateStageScale = () => {
      const { width, height } = frame.getBoundingClientRect();
      const nextScale = Math.min(
        1,
        width / VISUAL_STAGE_WIDTH,
        height / VISUAL_STAGE_HEIGHT
      );

      setStageScale(Math.max(0.48, Number.isFinite(nextScale) ? nextScale : 1));
    };

    updateStageScale();

    const resizeObserver = new ResizeObserver(updateStageScale);
    resizeObserver.observe(frame);

    return () => resizeObserver.disconnect();
  }, []);

  const glass = GLASS_TYPES[recipe.glass];
  
  // 计算液体填充百分比（每份占比）
  const fillPercent = maxPortions > 0 
    ? Math.min((totalPortions / maxPortions) * 100, 100) 
    : 0;
  
  // 每种原浆的独特颜色
  const INGREDIENT_COLORS = {
    // 基酒类 - 根据实际酒的颜色
    vodka:    { r: 200, g: 220, b: 255, a: 0.5 },   // 透明微蓝
    rum:      { r: 180, g: 130, b: 70, a: 0.75 },   // 琥珀色
    whiskey:  { r: 180, g: 120, b: 50, a: 0.8 },    // 深琥珀
    tequila:  { r: 230, g: 210, b: 130, a: 0.55 },  // 淡金色

    // 果汁类 - 根据水果颜色
    juice_orange:     { r: 255, g: 165, b: 0, a: 0.75 },    // 橙色
    juice_lemon:      { r: 255, g: 245, b: 130, a: 0.6 },   // 淡黄
    juice_cranberry:  { r: 180, g: 40, b: 60, a: 0.75 },    // 深红
    juice_mango:      { r: 255, g: 200, b: 80, a: 0.8 },    // 芒果黄

    // 调味剂类
    soda:         { r: 220, g: 240, b: 255, a: 0.25 },  // 透明气泡
    tonic:        { r: 240, g: 250, b: 220, a: 0.3 },   // 透明微黄
    cream:        { r: 255, g: 253, b: 245, a: 0.9 },   // 奶白
    syrup:        { r: 255, g: 200, b: 100, a: 0.75 },  // 金黄糖浆
    coffee:       { r: 80, g: 50, b: 30, a: 0.9 },      // 咖啡棕

    // 利口酒类
    triple_sec:  { r: 255, g: 180, b: 100, a: 0.6 },   // 橙皮橙
    kahlua:      { r: 60, g: 40, b: 25, a: 0.9 },      // 咖啡深棕
    baileys:     { r: 180, g: 150, b: 120, a: 0.85 },  // 奶油棕
    sambuca:     { r: 240, g: 240, b: 250, a: 0.45 }   // 茴香透明
  };

  // 计算液体颜色（基于原浆混合）
  const getLiquidColor = () => {
    if (!recipe.ingredients || recipe.ingredients.length === 0) {
      return 'rgba(100, 150, 255, 0.3)';
    }
    
    let totalWeight = 0;
    let avgColor = { r: 0, g: 0, b: 0, a: 0 };
    
    recipe.ingredients.forEach(p => {
      // 优先使用原浆专属颜色，其次使用默认颜色
      const color = INGREDIENT_COLORS[p.id] || { r: 150, g: 180, b: 255, a: 0.5 };
      const weight = p.count || 1;
      totalWeight += weight;
      avgColor.r += color.r * weight;
      avgColor.g += color.g * weight;
      avgColor.b += color.b * weight;
      avgColor.a += color.a * weight;
    });
    
    if (totalWeight === 0) return 'rgba(100, 150, 255, 0.3)';
    
    avgColor.r = Math.round(avgColor.r / totalWeight);
    avgColor.g = Math.round(avgColor.g / totalWeight);
    avgColor.b = Math.round(avgColor.b / totalWeight);
    avgColor.a = avgColor.a / totalWeight;
    
    return `rgba(${avgColor.r}, ${avgColor.g}, ${avgColor.b}, ${avgColor.a})`;
  };

  const liquidColor = getLiquidColor();
  const glassType = recipe.glass || 'default';
  const iceIcon = ICE_TYPES[recipe.ice]?.icon || '🧊';
  const decoration = recipe.decoration ? DECORATION_TYPES[recipe.decoration] : null;

  const renderIceLayer = () => {
    if (!recipe.ice || recipe.ice === 'no_ice') return null;

    const iceCount = recipe.ice === 'more_ice' ? 3 : 1;

    return (
      <div
        className={`ice-layer ice-layer--${glassType} ${iceCount > 1 ? 'ice-layer--cluster' : 'ice-layer--single'}`}
      >
        {Array.from({ length: iceCount }, (_, index) => (
          <span key={`${recipe.ice}-${index}`} className={`ice-cube ice-cube--${index + 1}`}>
            {iceIcon}
          </span>
        ))}
      </div>
    );
  };

  const renderDecorationLayer = () => {
    if (!decoration) return null;

    return (
      <div className={`decoration-layer decoration-layer--${glassType} decoration-layer--${decoration.id}`}>
        {decoration.iconImage ? (
          <img
            className="decoration-layer__image"
            src={decoration.iconImage}
            alt={decoration.name}
          />
        ) : (
          decoration.icon
        )}
      </div>
    );
  };

  return (
    <div className="cocktail-preview-container">
      <div className="preview-title">🍹 Mix Preview</div>
      
      <div className={`cocktail-glass-wrapper glass-${glassType} ${isSuccess ? 'success' : ''}`}>
        <div className="cocktail-visual-frame" ref={visualFrameRef}>
          <div
            className="cocktail-visual-stage"
            style={{ '--cocktail-preview-scale': stageScale }}
          >
            {/* 玻璃杯体 */}
            <div className={`glass-body ${isPouring ? 'pouring' : ''}`}>
              {/* 冰块层 */}
              {renderIceLayer()}
              
              {/* 液体层 */}
              <div 
                className={`liquid-layer ${isPouring ? 'pouring' : ''}`}
                style={{ 
                  height: `${fillPercent}%`,
                  background: fillPercent > 0 
                    ? `linear-gradient(180deg, ${liquidColor} 0%, ${liquidColor.replace(/[\d.]+\)$/, '0.95)')} 100%)`
                    : 'transparent'
                }}
              >
                {fillPercent > 0 && (
                  <>
                    <div className="liquid-surface" />
                    <div className="liquid-shine" />
                  </>
                )}
              </div>
              
              {/* 配料装饰 */}
              {recipe.garnish && (
                <div className="garnish-layer">
                  {GARNISH_TYPES[recipe.garnish]?.icon}
                </div>
              )}
              
            </div>

            {/* 装饰物 */}
            {renderDecorationLayer()}
          </div>
        </div>

        {/* 杯型图标 */}
        <div className="glass-type-label">
          {glass?.icon || '🍸'} {glass?.name?.replace(/（.*）/, '') || 'Select Glass'}
        </div>
      </div>
      
      {/* 份数指示 */}
      <div className={`portions-indicator ${totalPortions === maxPortions ? 'full' : ''}`}>
        <span className={`portions-current ${portionBump ? 'bump' : ''}`}>{totalPortions}</span>
        <span className="portions-divider">/</span>
        <span className="portions-max">{maxPortions}</span>
        <span className="portions-label">portions</span>
      </div>
    </div>
  );
};

export default CocktailPreview;
