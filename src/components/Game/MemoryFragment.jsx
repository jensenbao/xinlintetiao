/**
 * 回忆碎片展示组件
 * 根据清晰度（vague/hazy/clear/vivid）有不同的视觉效果
 */
import React from 'react';
import './MemoryFragment.css';

const MemoryFragment = ({ fragment, onDismiss }) => {
  if (!fragment) return null;

  return (
    <div className={`memory-fragment-overlay`} onClick={onDismiss}>
      <div className={`memory-fragment clarity-${fragment.clarity}`} onClick={e => e.stopPropagation()}>
        <div className="fragment-header">
          <span className="fragment-icon">◈</span>
          <span className="fragment-label">Memory Fragment</span>
          <span className="fragment-clarity-badge">{
            fragment.clarity === 'vague' ? 'Vague' :
            fragment.clarity === 'hazy' ? 'Hazy' :
            fragment.clarity === 'clear' ? 'Clear' : 'Vivid'
          }</span>
        </div>
        <p className="fragment-text">{fragment.content}</p>
        <button className="fragment-dismiss" onClick={onDismiss}>
          Continue
        </button>
      </div>
    </div>
  );
};

/**
 * 小型碎片展示（用在 DayEndModal 中）
 */
export const MemoryFragmentInline = ({ fragment }) => {
  if (!fragment) return null;

  return (
    <div className={`memory-fragment-inline clarity-${fragment.clarity}`}>
      <div className="fragment-header-inline">
        <span className="fragment-icon">◈</span>
        <span className="fragment-label">Memory Fragment</span>
      </div>
      <p className="fragment-text-inline">{fragment.content}</p>
    </div>
  );
};

export default MemoryFragment;
