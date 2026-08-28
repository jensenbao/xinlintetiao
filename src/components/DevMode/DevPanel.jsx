import React, { useState, useRef, useEffect, useCallback } from 'react';
import { EMOTIONS } from '../../data/emotions.js';
import { callAIForCocktailJudgment } from '../../utils/aiService.js';
import { interpretCocktailAttitude } from '../../utils/cocktailAttitude.js';
import { getRelevantMemoryContext } from '../../utils/memoryContext.js';
import './DevPanel.css';

// 获取情绪的中文名称
const getEmotionName = (emotionId) => {
  if (EMOTIONS[emotionId]) {
    return `${EMOTIONS[emotionId].icon} ${EMOTIONS[emotionId].name}`;
  }
  return emotionId;
};

/**
 * 开发者调试面板
 * 提供金币调整、解锁物品、信任度控制等调试功能
 */
const DevPanel = ({
  // 全局状态
  money,
  setMoney,
  unlockedItems,
  setUnlockedItems,
  // 游戏状态（仅在游戏页面可用）
  trustLevel,
  setTrustLevel,
  currentDay,
  setCurrentDay,
  customerRealEmotions,
  customerSuccessCount,
  setCustomerSuccessCount,
  onSkipCustomer,
  // 面板控制
  isVisible,
  onClose,
  // 调试操作
  devActions,
  // 自动测试
  onAutoTest,
  autoTestRunning,
  guessedCorrectly,
  emotionGuessMode,
  // 🆕 游戏内调试上下文（可选）
  devGame
}) => {
  const [isMinimized, setIsMinimized] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [position, setPosition] = useState({ x: 20, y: 20 });
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [customMoney, setCustomMoney] = useState('');
  const [showEmotions, setShowEmotions] = useState(false);
  const [lockTrust, setLockTrust] = useState(false);
  const [storageInfo, setStorageInfo] = useState({ usedKB: '0' });
  const [returnCustomers, setReturnCustomers] = useState([]);
  const [selectedReturnId, setSelectedReturnId] = useState('');
  const [memoryPreview, setMemoryPreview] = useState('');
  const [abResult, setAbResult] = useState(null);
  const [abRunning, setAbRunning] = useState(false);
  const panelRef = useRef(null);

  // 获取存储使用情况
  useEffect(() => {
    if (isVisible && devActions?.getStorageUsage) {
      const info = devActions.getStorageUsage();
      if (info) setStorageInfo(info);
    }
  }, [isVisible, devActions]);

  // 回头客池刷新
  useEffect(() => {
    if (!isVisible) return;
    if (devActions?.getReturnCustomers) {
      const pool = devActions.getReturnCustomers() || [];
      setReturnCustomers(pool);
      if (!selectedReturnId && pool.length > 0) {
        setSelectedReturnId(pool[0].id);
      }
    }
  }, [isVisible, devActions, selectedReturnId]);

  // 拖拽处理
  const handleMouseDown = useCallback((e) => {
    if (e.target.closest('.dev-panel-header')) {
      setIsDragging(true);
      const rect = panelRef.current.getBoundingClientRect();
      setDragOffset({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      });
    }
  }, []);

  const handleMouseMove = useCallback((e) => {
    if (isDragging) {
      setPosition({
        x: window.innerWidth - e.clientX - (panelRef.current?.offsetWidth || 300) + dragOffset.x,
        y: e.clientY - dragOffset.y
      });
    }
  }, [isDragging, dragOffset]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, handleMouseMove, handleMouseUp]);

  // 金币操作
  const handleAddMoney = (amount) => {
    setMoney(prev => prev + amount);
  };

  const handleSetMoney = () => {
    const amount = parseInt(customMoney, 10);
    if (!isNaN(amount) && amount >= 0) {
      setMoney(amount);
      setCustomMoney('');
    }
  };

  // 解锁操作
  const handleUnlockAll = () => {
    if (devActions?.unlockAllItems) {
      const allUnlocked = devActions.unlockAllItems();
      setUnlockedItems(allUnlocked);
    }
  };

  const handleUnlockCategory = (category) => {
    if (devActions?.unlockCategory) {
      const updated = devActions.unlockCategory(unlockedItems, category);
      setUnlockedItems(updated);
    }
  };

  const handleDiscoverAllCombos = () => {
    if (devActions?.discoverAllCombos) {
      devActions.discoverAllCombos();
    }
  };

  // 信任度操作
  const handleSetTrust = (value) => {
    if (setTrustLevel) {
      setTrustLevel(value);
    }
  };

  // 游戏控制
  const handleCompleteCustomer = () => {
    if (setCustomerSuccessCount) {
      setCustomerSuccessCount(3);
    }
  };

  const handleSkipCustomer = () => {
    if (onSkipCustomer) {
      onSkipCustomer();
    }
  };

  const handleSetDay = (day) => {
    if (setCurrentDay && day >= 1) {
      setCurrentDay(day);
    }
  };

  // 数据操作
  const handleExportData = () => {
    if (devActions?.exportGameData) {
      const data = devActions.exportGameData();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `bartender_save_${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  const handleResetGame = () => {
    if (window.confirm('Reset all game data? This action cannot be undone.')) {
      if (devActions?.clearAllCache) {
        devActions.clearAllCache();
        window.location.reload();
      }
    }
  };

  // 🆕 重置所有（包括教学、序幕、规则等全部 localStorage）
  const handleResetEverything = () => {
    if (window.confirm('⚠️ This will erase all data, including tutorial progress, prologue progress, and saves.\nDo you want to fully reset everything?')) {
      localStorage.clear();
      window.location.reload();
    }
  };

  // ==================== AI质量测试台 ====================

  const refreshReturnCustomers = useCallback(() => {
    if (devActions?.getReturnCustomers) {
      const pool = devActions.getReturnCustomers() || [];
      setReturnCustomers(pool);
      if (pool.length > 0 && !pool.some(c => c.id === selectedReturnId)) {
        setSelectedReturnId(pool[0].id);
      }
    }
  }, [devActions, selectedReturnId]);

  const handleCreateTestReturnCustomer = useCallback(() => {
    if (!devActions?.createTestReturnCustomer) return;
    devActions.createTestReturnCustomer();
    refreshReturnCustomers();
  }, [devActions, refreshReturnCustomers]);

  const handleScheduleSelectedReturnTomorrow = useCallback(() => {
    if (!devActions?.scheduleReturnCustomerOnDay) return;
    if (!selectedReturnId || !currentDay) return;
    devActions.scheduleReturnCustomerOnDay(selectedReturnId, Number(currentDay) + 1);
    refreshReturnCustomers();
  }, [devActions, selectedReturnId, currentDay, refreshReturnCustomers]);

  const handleInsertSelectedReturnNext = useCallback(async () => {
    if (!devGame?.insertReturnCustomerNext) return;
    if (!selectedReturnId) return;
    await devGame.insertReturnCustomerNext(selectedReturnId);
  }, [devGame, selectedReturnId]);

  const handleLockReturnCustomerDailyFirst = useCallback(() => {
    if (!selectedReturnId) return;
    localStorage.setItem('bartender_dev_forced_return_customer_id', selectedReturnId);
  }, [selectedReturnId]);

  const handleClearLockReturnCustomer = useCallback(() => {
    localStorage.removeItem('bartender_dev_forced_return_customer_id');
  }, []);

  const handleJumpToChapter = useCallback((targetChapterId) => {
    if (!devGame?.jumpToChapter) return;
    devGame.jumpToChapter(targetChapterId);
  }, [devGame]);

  const handlePrepareChapterGate = useCallback(async (targetChapterId) => {
    if (!devActions?.prepareChapterGate) return;
    devActions.prepareChapterGate(targetChapterId);
    refreshReturnCustomers();
    if (devGame?.runChapterCheck) {
      await devGame.runChapterCheck();
    }
  }, [devActions, devGame, refreshReturnCustomers]);

  const handleRunChapterCheck = useCallback(async () => {
    if (devGame?.runChapterCheck) {
      await devGame.runChapterCheck();
    }
  }, [devGame]);

  const handleUpdateMemoryPreview = useCallback(() => {
    if (!devGame?.aiConfig) return;
    const ctx = getRelevantMemoryContext(devGame.aiConfig);
    setMemoryPreview(ctx || '(No shared memory or world-state context is available to inject right now.)');
  }, [devGame]);

  const handleRunABFeedback = useCallback(async () => {
    if (!devGame?.aiConfig) return;
    if (!devGame?.emotionState) return;
    if (!Array.isArray(devGame?.dialogueHistory)) return;

    setAbRunning(true);
    setAbResult(null);

    const mixtureA = { thickness: 3, sweetness: -2, strength: 4 };
    const mixtureB = { thickness: -2, sweetness: 3, strength: 0 };
    const attitudeA = interpretCocktailAttitude(mixtureA, false);
    const attitudeB = interpretCocktailAttitude(mixtureB, false);

    const baseParams = {
      aiConfig: devGame.aiConfig,
      trustLevel: trustLevel || 0.5,
      emotionState: devGame.emotionState,
      dialogueHistory: devGame.dialogueHistory,
      isSuccess: true,
      satisfaction: 0.8
    };

    try {
      const [resA, resB] = await Promise.all([
        callAIForCocktailJudgment({
          ...baseParams,
          cocktailRecipe: { mixture: mixtureA, glass: 'martini', ice: 'no_ice', ingredients: [] },
          cocktailAttitude: attitudeA
        }),
        callAIForCocktailJudgment({
          ...baseParams,
          cocktailRecipe: { mixture: mixtureB, glass: 'martini', ice: 'no_ice', ingredients: [] },
          cocktailAttitude: attitudeB
        })
      ]);

      setAbResult({
        A: { mixture: mixtureA, attitude: attitudeA, result: resA },
        B: { mixture: mixtureB, attitude: attitudeB, result: resB }
      });
    } catch (e) {
      setAbResult({ error: String(e?.message || e) });
    } finally {
      setAbRunning(false);
    }
  }, [devGame, trustLevel]);

  if (!isVisible) return null;

  return (
    <div
      ref={panelRef}
      className={`dev-panel ${isMinimized ? 'minimized' : ''}`}
      style={{ right: position.x, top: position.y }}
      onMouseDown={handleMouseDown}
    >
      <div className="dev-panel-header">
        <span className="dev-panel-title">🔧 Developer Tools</span>
        <div className="dev-panel-controls">
          <button
            className="dev-panel-btn minimize"
            onClick={() => setIsMinimized(!isMinimized)}
            title={isMinimized ? 'Expand' : 'Minimize'}
          >
            {isMinimized ? '▢' : '—'}
          </button>
          <button
            className="dev-panel-btn close"
            onClick={onClose}
            title="Close"
          >
            ×
          </button>
        </div>
      </div>

      {!isMinimized && (
        <div className="dev-panel-content">
          {/* 金币部分 */}
          <div className="dev-section">
            <div className="dev-section-header">
              <span>💰 Credits: <strong>{money}</strong></span>
            </div>
            <div className="dev-section-body">
              <div className="dev-btn-group">
                <button onClick={() => handleAddMoney(100)}>+100</button>
                <button onClick={() => handleAddMoney(500)}>+500</button>
                <button onClick={() => handleAddMoney(1000)}>+1000</button>
                <button onClick={() => setMoney(99999)} className="gold">99999</button>
              </div>
              <div className="dev-input-group">
                <input
                  type="number"
                  value={customMoney}
                  onChange={(e) => setCustomMoney(e.target.value)}
                  placeholder="Custom amount"
                  min="0"
                />
                <button onClick={handleSetMoney}>Set</button>
              </div>
            </div>
          </div>

          {/* 解锁部分 */}
          <div className="dev-section">
            <div className="dev-section-header">
              <span>🔓 Unlock Items</span>
            </div>
            <div className="dev-section-body">
              <div className="dev-btn-group">
                <button onClick={() => handleUnlockCategory('glasses')}>All Glasses</button>
                <button onClick={() => handleUnlockCategory('iceTypes')}>All Ice Types</button>
              </div>
              <div className="dev-btn-group">
                <button onClick={() => handleUnlockCategory('garnishes')}>All Garnishes</button>
                <button onClick={() => handleUnlockCategory('decorations')}>All Decorations</button>
              </div>
              <div className="dev-btn-group">
                <button onClick={() => handleUnlockCategory('ingredients')}>All Ingredients</button>
                <button onClick={handleDiscoverAllCombos}>All Combos</button>
              </div>
              <div className="dev-btn-group">
                <button onClick={handleUnlockAll} className="primary">Unlock Everything</button>
              </div>
            </div>
          </div>

          {/* 信任度部分（仅在游戏页面显示） */}
          {setTrustLevel && (
            <div className="dev-section">
              <div className="dev-section-header">
                <span>💖 Trust: <strong>{Math.round((trustLevel || 0) * 100)}%</strong></span>
              </div>
              <div className="dev-section-body">
                <div className="dev-btn-group">
                  <button onClick={() => handleSetTrust(0)}>0%</button>
                  <button onClick={() => handleSetTrust(0.3)}>30%</button>
                  <button onClick={() => handleSetTrust(0.5)}>50%</button>
                  <button onClick={() => handleSetTrust(0.7)}>70%</button>
                  <button onClick={() => handleSetTrust(1)}>100%</button>
                </div>
                <label className="dev-checkbox">
                  <input
                    type="checkbox"
                    checked={lockTrust}
                    onChange={(e) => setLockTrust(e.target.checked)}
                  />
                  <span>Lock trust value (not supported yet)</span>
                </label>
              </div>
            </div>
          )}

          {/* 情绪透视（仅在游戏页面显示） */}
          {customerRealEmotions && customerRealEmotions.length > 0 && (
            <div className="dev-section">
              <div className="dev-section-header">
                <span>👁️ Emotion Inspector</span>
              </div>
              <div className="dev-section-body">
                <button
                  onClick={() => setShowEmotions(!showEmotions)}
                  className={showEmotions ? 'active' : ''}
                >
                  {showEmotions ? 'Hide Top 3 Emotions' : 'Show Top 3 Emotions'}
                </button>
                {showEmotions && (
                  <div className="dev-emotions-reveal">
                    <span>Top 3 emotions: </span>
                    {customerRealEmotions.map((emotion, idx) => (
                      <span key={idx} className="dev-emotion-tag">
                        {getEmotionName(emotion)}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 🤖 自动测试（仅在游戏页面显示） */}
          {onAutoTest && (
            <div className="dev-section">
              <div className="dev-section-header">
                <span>🤖 Auto Test</span>
                {autoTestRunning && <span className="dev-running-badge">Running</span>}
              </div>
              <div className="dev-section-body">
                <div className="dev-auto-status">
                  <span>Status: {
                    autoTestRunning ? '⚡ Auto-running...' :
                    guessedCorrectly ? '🍸 Mixing Mode' :
                    emotionGuessMode ? '🎯 Guess Mode' :
                    '💬 Dialogue Mode'
                  }</span>
                </div>
                <div className="dev-btn-group">
                  <button
                    onClick={() => onAutoTest(false)}
                    className={autoTestRunning ? 'danger' : 'primary'}
                  >
                    {autoTestRunning ? '⏹ Stop' : '▶ Run Once'}
                  </button>
                  <button
                    onClick={() => onAutoTest(true)}
                    className={autoTestRunning ? 'danger' : 'gold'}
                  >
                    {autoTestRunning ? '⏹ Stop' : '🔄 Loop Test'}
                  </button>
                </div>
                <div className="dev-info">
                  <span>Auto-guess emotions → mix → serve</span>
                </div>
              </div>
            </div>
          )}

          {/* 游戏控制（仅在游戏页面显示） */}
          {setCurrentDay && (
            <div className="dev-section">
              <div className="dev-section-header">
                <span>🎮 Game Controls</span>
              </div>
              <div className="dev-section-body">
                <div className="dev-btn-group">
                  <button onClick={handleSkipCustomer}>Skip Guest</button>
                  <button onClick={handleCompleteCustomer}>Complete 3-Drink Goal</button>
                </div>
                <div className="dev-day-control">
                  <span>Day: {currentDay}</span>
                  <button onClick={() => handleSetDay(currentDay - 1)} disabled={currentDay <= 1}>-1</button>
                  <button onClick={() => handleSetDay(currentDay + 1)}>+1</button>
                </div>
                {customerSuccessCount !== undefined && (
                  <div className="dev-info">
                    <span>Current guest progress: {customerSuccessCount}/3</span>
                  </div>
                )}

                {/* 直接跳转章节 */}
                {devGame?.jumpToChapter && (
                  <>
                    <div className="dev-section-subtitle">Jump to Chapter</div>
                    <div className="dev-btn-group">
                      {[1, 2, 3, 4, 5].map(ch => (
                        <button
                          key={ch}
                          onClick={() => handleJumpToChapter(ch)}
                          className={devGame?.chapterId === ch ? 'active' : ''}
                          title={`Jump to Chapter ${ch}`}
                        >
                          Chapter {ch}
                        </button>
                      ))}
                    </div>
                    <div className="dev-info">
                      <span>Jump straight to a chapter without meeting gate conditions. Current: Chapter {devGame?.chapterId || '?'}</span>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* 🧪 AI质量测试台（仅在游戏页面显示） */}
          {devGame && (
            <div className="dev-section">
              <div className="dev-section-header">
                <span>🧪 AI Quality Lab</span>
              </div>
              <div className="dev-section-body">
                <div className="dev-info">
                  <span>
                    Chapter: {devGame.chapterId ?? '-'} · Judgment mode: <strong>{devGame.mixingMode ?? '-'}</strong>
                  </span>
                </div>

                <div className="dev-btn-group">
                  <button onClick={() => handlePrepareChapterGate(2)}>Prep 1→2</button>
                  <button onClick={() => handlePrepareChapterGate(3)}>Prep 2→3</button>
                  <button onClick={() => handlePrepareChapterGate(4)}>Prep 3→4</button>
                  <button onClick={() => handlePrepareChapterGate(5)}>Prep 4→5</button>
                </div>
                <div className="dev-btn-group">
                  <button onClick={handleRunChapterCheck} className="gold">Run Chapter Check</button>
                </div>
                <div className="dev-info">
                  <span>Tip: after preparing a gate, click "Run Chapter Check" to preview the chapter transition and AI opening line immediately.</span>
                </div>

                <hr className="dev-divider" />

                <div className="dev-section-subtitle">Returning Guests (Continuity / Crossroads)</div>
                <div className="dev-input-group">
                  <select value={selectedReturnId} onChange={(e) => setSelectedReturnId(e.target.value)}>
                    {returnCustomers.length === 0 && <option value="">(No returning guests yet)</option>}
                    {returnCustomers.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.name} · {c.characterArc?.currentPhase || 'unknown'} · visits:{c.relationship?.totalVisits || 1}
                      </option>
                    ))}
                  </select>
                  <button onClick={handleCreateTestReturnCustomer}>+Sample</button>
                </div>
                <div className="dev-btn-group">
                  <button onClick={handleScheduleSelectedReturnTomorrow} disabled={!selectedReturnId}>Schedule for Tomorrow</button>
                  <button onClick={handleInsertSelectedReturnNext} disabled={!selectedReturnId}>Insert as Next Today</button>
                </div>
                <div className="dev-btn-group">
                  <button onClick={handleLockReturnCustomerDailyFirst} disabled={!selectedReturnId} className="primary">Lock as First Daily Guest</button>
                  <button onClick={handleClearLockReturnCustomer} className="danger">Clear Lock</button>
                </div>
                <div className="dev-info">
                  <span>When locked, this returning guest is forced in at the start of each day so you can follow a full 3-5 visit arc continuously.</span>
                </div>

                <hr className="dev-divider" />

                <div className="dev-section-subtitle">Memory Injection Preview</div>
                <div className="dev-btn-group">
                  <button onClick={handleUpdateMemoryPreview}>Refresh Preview</button>
                  {memoryPreview && (
                    <button onClick={() => navigator.clipboard?.writeText(memoryPreview)}>Copy</button>
                  )}
                </div>
                {memoryPreview && (
                  <textarea className="dev-textarea" value={memoryPreview} readOnly rows={5} />
                )}

                <hr className="dev-divider" />

                <div className="dev-section-subtitle">A/B Drink Feedback Comparison (same guest, two extreme attitudes)</div>
                <div className="dev-btn-group">
                  <button onClick={handleRunABFeedback} className={abRunning ? 'danger' : 'primary'} disabled={abRunning}>
                    {abRunning ? 'Running...' : 'Run A/B Comparison'}
                  </button>
                </div>
                {abResult?.error && (
                  <div className="dev-info"><span>Error: {abResult.error}</span></div>
                )}
                {abResult && !abResult.error && (
                  <div className="dev-ab-grid">
                    <div className="dev-ab-col">
                      <div className="dev-ab-title">A: Face it directly + acknowledge bitterness</div>
                      <div className="dev-info"><span>Attitude: {abResult.A.attitude.summary}</span></div>
                      <div className="dev-ab-output">{abResult.A.result?.feedback || JSON.stringify(abResult.A.result)}</div>
                    </div>
                    <div className="dev-ab-col">
                      <div className="dev-ab-title">B: Rest first + offer hope</div>
                      <div className="dev-info"><span>Attitude: {abResult.B.attitude.summary}</span></div>
                      <div className="dev-ab-output">{abResult.B.result?.feedback || JSON.stringify(abResult.B.result)}</div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 数据管理 */}
          <div className="dev-section">
            <div className="dev-section-header">
              <span>📦 Data Management</span>
            </div>
            <div className="dev-section-body">
              <div className="dev-btn-group">
                <button onClick={handleExportData}>Export Save</button>
                <button onClick={handleResetGame} className="danger">Reset Game</button>
              </div>
              <div className="dev-btn-group">
                <button onClick={handleResetEverything} className="danger">🗑️ Reset Everything (incl. tutorial/prologue)</button>
              </div>
              <div className="dev-info">
                <span>存储使用: {storageInfo.usedKB} KB</span>
              </div>
            </div>
          </div>

          {/* 快捷键提示 */}
          <div className="dev-footer">
            <span>Ctrl+Shift+D toggles the panel</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default DevPanel;
