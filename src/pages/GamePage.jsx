import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

// 缁勪欢瀵煎叆
import ChatPanel from '../components/Chat/ChatPanel.jsx';
import BartenderPanel from '../components/Bartender/BartenderPanel.jsx';
import TargetDisplay from '../components/Bartender/TargetDisplay.jsx';
import CocktailPreview from '../components/Bartender/CocktailPreview.jsx';
import Toast from '../components/Common/Toast.jsx';
import RulesModal from '../components/Common/RulesModal.jsx';
import { DevPanel } from '../components/DevMode/index.js';
import {
  GameLoadingScreen,
  GameHeader,
  DayEndModal,
  CustomerLeaveOverlay,
  GameHintPanel,
  TavernEntranceScene
} from '../components/Game/index.js';
import AtmosphereOverlay from '../components/Atmosphere/AtmosphereOverlay.jsx';
import EventNotification from '../components/Atmosphere/EventNotification.jsx';
import CustomerAvatar from '../components/Avatar/CustomerAvatar.jsx';
import TutorialTooltip from '../components/Tutorial/TutorialTooltip.jsx';
import TutorialCompleteModal from '../components/Tutorial/TutorialCompleteModal.jsx';
import ReturnCustomerOverlay from '../components/Game/ReturnCustomerOverlay.jsx';
import ChapterTransition from '../components/Game/ChapterTransition.jsx';
import MemoryFragment from '../components/Game/MemoryFragment.jsx';
import EndingScreen from '../components/Game/EndingScreen.jsx';
import BalancedPixelText from '../components/Common/BalancedPixelText.jsx';
import AmbientGameCanvas from '../game/pixi/AmbientGameCanvas.jsx';
import { createGameViewModel } from '../game/viewModel/createGameViewModel.js';
import { getCustomerTop3Emotions } from '../hooks/gameHandlers/helpers.js';
// 鏂版墜寮曞绯荤粺
import AdvancedGuidePopup from '../components/Guide/AdvancedGuidePopup.jsx';
import HelpPanel from '../components/Help/HelpPanel.jsx';

// 鑷畾涔?Hooks
import { useToasts } from '../hooks/useToasts.js';
import { useGameHints } from '../hooks/useGameHints.js';
import { useAudio } from '../hooks/useAudio.js';
import { useBarAtmosphere } from '../hooks/useBarAtmosphere.js';
import { useBarEvents } from '../hooks/useBarEvents.js';
import { useTutorial } from '../hooks/useTutorial.js';
import { useDailyMemory } from '../hooks/useDailyMemory.js';
import { useNarrativeEngine } from '../hooks/useNarrativeEngine.js';
import { useChapterSystem } from '../hooks/useChapterSystem.js';
import { useCocktailFlow } from '../hooks/useCocktailFlow.js';
import { useCustomerFlow } from '../hooks/useCustomerFlow.js';
import { useDialogue } from '../hooks/useDialogue.js';
import { useEmotionSystem } from '../hooks/useEmotionSystem.js';
import { useGameProgress } from '../hooks/useGameProgress.js';
import { useMixingSession } from '../hooks/useMixingSession.js';
// 鎷嗗垎鍑虹殑缂栨帓 hooks
import { useGameInit } from '../hooks/useGameInit.js';
import { useGameHandlers } from '../hooks/useGameHandlers.js';
import { useAutoTest } from '../hooks/useAutoTest.js';
import { useAdvancedGuides } from '../hooks/useAdvancedGuides.js';

// 鏁版嵁瀵煎叆
import { EMOTIONS, INITIAL_UNLOCKED_EMOTIONS, GLASS_TYPES } from '../data/emotions.js';
import { INITIAL_UNLOCKED_INGREDIENTS } from '../data/ingredients.js';
import { TUTORIAL_VISIBLE_EMOTIONS } from '../data/tutorialData.js';
import { clearAllCache, getActiveCharacterIds } from '../utils/storage.js';
import audioManager from '../utils/audioManager.js';
import {
  ensureNpcProfileInActiveSlot,
  queueActiveSlotGameStateSync,
  setActiveNpcId,
  setActiveSlotId as setActiveSlotInRepository
} from '../utils/saveRepository.js';
import './GamePage.css';
import './GamePage.overlays.css';

const CHARACTER_ID_PATTERN = /^[A-Za-z0-9_-]{2,64}$/;
const EMPTY_CUSTOMER_CONFIG = Object.freeze({});

const normalizeCharacterId = (value) => {
  const text = String(value || '').trim();
  return CHARACTER_ID_PATTERN.test(text) ? text.toLowerCase() : '';
};

const inferStageCharacterId = (config = {}) => {
  const direct = normalizeCharacterId(config?.customCharacterId);
  if (direct) return direct;

  const codeField = normalizeCharacterId(config?.characterCode);
  if (codeField) return codeField;

  const idField = normalizeCharacterId(config?.id);
  if (idField) return idField;

  const voiceCode = normalizeCharacterId(config?.voiceProfile?.code);
  if (voiceCode) return voiceCode;

  const aliases = Array.isArray(config?.aliases) ? config.aliases : [];
  for (const alias of aliases) {
    const matched = normalizeCharacterId(alias);
    if (matched) return matched;
  }

  const cacheKey = String(config?.avatarCacheKey || '').trim();
  const fromCacheKey = cacheKey.match(/(?:^|_)(\d+g?)(?:_|$)/i)?.[1] || '';
  return normalizeCharacterId(fromCacheKey);
};

const getSingleActiveStageCharacterId = () => {
  const active = getActiveCharacterIds();
  if (!Array.isArray(active) || active.length !== 1) return '';
  return normalizeCharacterId(active[0]);
};

/**
 * 娓告垙涓婚〉闈紙鐦﹁韩鐗堬級
 * 鑱岃矗锛欻ook 缂栨帓 + UI 娓叉煋
 * 涓氬姟閫昏緫宸叉媶鍒嗗埌 useGameInit / useGameHandlers / useAutoTest
 */
const GamePage = ({
  activeSlotId = null,
  onBack,
  onBackToSetup,
  money: appMoney,
  setMoney: setAppMoney,
  unlockedItems: appUnlockedItems,
  setUnlockedItems: setAppUnlockedItems,
  devModeVisible,
  setDevModeVisible,
  devActions,
  preloadedFirstCustomer,
  onCustomerUsed
}) => {
  // ==================== 鍩虹 Hooks ====================

  const { toastList, addToast, removeToast, clearToasts } = useToasts();
  const { gameHint, showGameHint, closeGameHint } = useGameHints();

  const {
    atmosphere, showAtmosphereOverlay,
    generateAtmosphere, dismissAtmosphereOverlay, applyAtmosphereChange
  } = useBarAtmosphere();

  const {
    currentEvent, showEventNotification, dailyEventCount,
    persistentEffects, activeRestrictions,
    shouldTriggerEvent, triggerEvent, handleEventChoice, dismissEvent,
    resetDailyEvents, updateStreak, clearCustomerRestrictions,
    eventsEnabled,
    checkPendingChains, tryStartChain
  } = useBarEvents();

  const tutorial = useTutorial();

  const { todayRecords, recordCustomer, generateDailyMemoryRecord } = useDailyMemory();
  const { evaluateReturnPotential, orchestrateDay, advanceArc, buildReturnCustomerConfig, getRecentCrossroadsSummaries } = useNarrativeEngine();
  const chapterSystem = useChapterSystem();

  // 鏂版墜寮曞绯荤粺
  const advancedGuides = useAdvancedGuides();
  const [showHelp, setShowHelp] = useState(false);
  const [showServeStoryAnim, setShowServeStoryAnim] = useState(false);
  const [serveStoryAnimKey, setServeStoryAnimKey] = useState(0);  
  const [showTavernEntrance, setShowTavernEntrance] = useState(false);
  const [pendingTavernEntrance, setPendingTavernEntrance] = useState(false);
  const tavernEntranceShownDayRef = useRef(null);
  const triggerServeStoryAnim = useCallback(() => {
    setServeStoryAnimKey(Date.now());
    setShowServeStoryAnim(true);
  }, []);

  const audioHook = useAudio();
  const isMuted = audioHook?.isMuted ?? false;
  const sfxVolume = audioHook?.sfxVolume ?? 0.5;
  const playSFX = audioHook?.playSFX ?? (() => {});
  const playBGM = audioHook?.playBGM ?? (() => {});
  const stopBGM = audioHook?.stopBGM ?? (() => {});
  const toggleMute = audioHook?.toggleMute ?? (() => {});
  const setSfxVolume = audioHook?.setSfxVolume ?? (() => {});
  const initAudio = audioHook?.initAudio ?? (() => {});
  const shouldResumeBgmAfterServeAnimRef = useRef(false);
  const serveAnimPrevBgmTrackRef = useRef('home');

  useEffect(() => {
    if (showServeStoryAnim) {
      serveAnimPrevBgmTrackRef.current = audioManager.currentBgmTrack || 'home';
      shouldResumeBgmAfterServeAnimRef.current = !isMuted && Boolean(audioManager.isBgmPlaying || audioManager.bgmAudio);
      stopBGM();
      return;
    }

    if (shouldResumeBgmAfterServeAnimRef.current && !isMuted) {
      playBGM(serveAnimPrevBgmTrackRef.current || 'home');
      shouldResumeBgmAfterServeAnimRef.current = false;
    }
  }, [showServeStoryAnim, isMuted, stopBGM, playBGM]);

  const cocktailFlow = useCocktailFlow({ playSFX, addToast });
  const [recipePreview, setRecipePreview] = useState({
    recipe: { glass: null, ice: null, ingredients: [], garnish: null, decoration: null },
    totalPortions: 0,
    maxPortions: 3
  });
  const customerFlow = useCustomerFlow();
  const dialogue = useDialogue();
  const emotionSystem = useEmotionSystem({ playSFX, showGameHint });
  const progress = useGameProgress();

  // ==================== 鍏变韩鐘舵€?====================

  const [trustLevel, setTrustLevel] = useState(0);
  const money = appMoney ?? 0;
  const setMoney = setAppMoney ?? (() => {});
  const unlockedItems = appUnlockedItems ?? {
    emotions: INITIAL_UNLOCKED_EMOTIONS,
    glasses: ['martini'],
    iceTypes: ['no_ice'],
    garnishes: [],
    decorations: []
  };
  const setUnlockedItems = setAppUnlockedItems ?? (() => {});

  const aiConfig = customerFlow.currentCustomer?.config || EMPTY_CUSTOMER_CONFIG;
  const aiType = aiConfig?.categoryId || aiConfig?.type || 'guest';
  const stagePortraitSrc = aiConfig?.avatarBase64 || '';
  const stageCharacterId = inferStageCharacterId(aiConfig) || getSingleActiveStageCharacterId();
  const isBarSceneReady = !showAtmosphereOverlay && !pendingTavernEntrance && !showTavernEntrance;

  useEffect(() => {
    if (!activeSlotId) return;
    setActiveSlotInRepository(activeSlotId);
    queueActiveSlotGameStateSync('slot_attached');
  }, [activeSlotId]);

  useEffect(() => {
    const npcId = customerFlow.currentCustomer?.id;
    if (!npcId) return;
    setActiveNpcId(npcId);
    ensureNpcProfileInActiveSlot(npcId, customerFlow.currentCustomer?.config || {}).catch(() => {});
    queueActiveSlotGameStateSync('customer_changed');
  }, [customerFlow.currentCustomer?.id]);

  const gameViewModel = useMemo(() => createGameViewModel({
    aiConfig,
    atmosphere,
    currentDay: customerFlow.currentDay,
    currentCustomerIndex: customerFlow.currentCustomerIndex,
    guessedCorrectly: cocktailFlow.guessedCorrectly,
    mixture: cocktailFlow.currentMixtureValues,
    recipePreview,
    showCocktailResult: cocktailFlow.showCocktailResult,
    totalCustomers: customerFlow.dailyCustomers.length,
    trustLevel
  }), [
    aiConfig,
    atmosphere,
    customerFlow.currentCustomerIndex,
    customerFlow.currentDay,
    customerFlow.dailyCustomers.length,
    cocktailFlow.currentMixtureValues,
    cocktailFlow.guessedCorrectly,
    cocktailFlow.showCocktailResult,
    recipePreview,
    trustLevel
  ]);

  const isMixingStage = cocktailFlow.emotionGuessMode || cocktailFlow.guessedCorrectly;
  const handleBackFromMixing = () => {
    mixingSession.handleReset();
    cocktailFlow.setGuessedCorrectly(false);
    cocktailFlow.setEmotionGuessMode(false);
    cocktailFlow.setTargetConditions([]);
    cocktailFlow.setTargetHint('');
    cocktailFlow.setCurrentMixtureValues({ thickness: 0, sweetness: 0, strength: 0 });
    emotionSystem.setSelectedEmotions([]);
  };

  // 馃啎 DevPanel 闇€瑕佺殑娓告垙鍐呰皟璇曚笂涓嬫枃锛圓I璐ㄩ噺娴嬭瘯鍙帮級
  const devGame = {
    aiConfig,
    dialogueHistory: dialogue.dialogueHistory || [],
    emotionState: {
      surface: (emotionSystem.surfaceEmotions || []).map(e => e.id),
      reality: emotionSystem.dynamicCustomerEmotions?.reality?.length > 0
        ? emotionSystem.dynamicCustomerEmotions.reality
        : (aiConfig?.emotionMask?.reality || [])
    },
    mixingMode: chapterSystem.currentChapter?.mixingMode || 'strict',
    chapterId: chapterSystem.chapterState?.currentChapter,
    runChapterCheck: async () => {
      if (!chapterSystem?.processDayEnd) return;
      await chapterSystem.processDayEnd(customerFlow.currentDay, {
        trustLevel,
        silenceCount: 0,
        plainWaterCount: 0
      });
    },
    jumpToChapter: (targetChapterId) => {
      if (!chapterSystem?.devJumpToChapter) return;
      chapterSystem.devJumpToChapter(targetChapterId, customerFlow.currentDay);
    },
    insertReturnCustomerNext: async (returnCustomerId) => {
      if (!returnCustomerId) return;
      const pool = devActions?.getReturnCustomers?.() || [];
      const rc = pool.find(c => c.id === returnCustomerId);
      if (!rc) return;
      const cfg = await buildReturnCustomerConfig(rc);
      const newItem = {
        id: `${customerFlow.currentDay}-devreturn-${Date.now()}`,
        type: cfg.categoryId,
        config: cfg
      };
      customerFlow.setDailyCustomers(prev => {
        const copy = Array.isArray(prev) ? [...prev] : [];
        const insertAt = Math.min(copy.length, (customerFlow.currentCustomerIndex || 0) + 1);
        copy.splice(insertAt, 0, newItem);
        return copy;
      });
    }
  };

  customerFlow.switchContextRef.current = {
    currentDay: customerFlow.currentDay,
    customersServed: customerFlow.customersServed,
    gameStats: progress.gameStats,
    daySuccessCount: customerFlow.daySuccessCountRef.current,
    dayFailureCount: customerFlow.dayFailureCountRef.current,
    dayEarnings: customerFlow.dayEarnings,
    atmosphere
  };

  // ==================== 缂栨帓涓婁笅鏂?====================

  const ctx = {
    tutorial, progress, customerFlow, dialogue, emotionSystem,
    cocktailFlow, chapterSystem, advancedGuides,
    playSFX, addToast, showGameHint, initAudio,
    clearToasts,
    activeSlotId,
    aiConfig, aiType, trustLevel, setTrustLevel,
    money, setMoney, unlockedItems, setUnlockedItems,
    atmosphere, generateAtmosphere,
    showAtmosphereOverlay, dismissAtmosphereOverlay,
    isBarSceneReady,
    showEventNotification, currentEvent,
    eventsEnabled,
    dailyEventCount, triggerEvent, shouldTriggerEvent,
    handleEventChoice, dismissEvent, applyAtmosphereChange,
    resetDailyEvents, updateStreak, clearCustomerRestrictions,
    checkPendingChains, tryStartChain,
    generateDailyMemoryRecord, recordCustomer, advanceArc,
    evaluateReturnPotential, orchestrateDay, buildReturnCustomerConfig,
    getRecentCrossroadsSummaries,
    preloadedFirstCustomer, onCustomerUsed
  };

  // ==================== 涓氬姟 Hooks ====================

  const handlers = useGameHandlers(ctx);

  // 灏?handlers 涔熷姞鍒?ctx 涓緵 useGameInit 鍜?useAutoTest 浣跨敤
  ctx.resetForNewCustomer = handlers.resetForNewCustomer;
  ctx.startConversation = handlers.startConversation;
  ctx.startNewDay = handlers.startNewDay;
  ctx.handleEventChoiceAction = handlers.handleEventChoiceAction;
  ctx.handleEventDismissAction = handlers.handleEventDismissAction;
  ctx.handleServeCocktail = handlers.handleServeCocktail;

  const mixingSession = useMixingSession({
    resetKey: `${customerFlow.currentDay}:${customerFlow.currentCustomerIndex}:${cocktailFlow.guessedCorrectly ? 'mixing' : 'locked'}`,
    targetConditions: cocktailFlow.targetConditions,
    onServeTriggered: triggerServeStoryAnim,
    onServeCocktail: handlers.handleServeCocktail,
    unlockedGlasses: unlockedItems.glasses || ['martini'],
    unlockedIceTypes: unlockedItems.iceTypes || ['no_ice'],
    unlockedIngredients: unlockedItems.ingredients || INITIAL_UNLOCKED_INGREDIENTS,
    unlockedGarnishes: unlockedItems.garnishes || [],
    unlockedDecorations: unlockedItems.decorations || [],
    onMixtureChange: cocktailFlow.setCurrentMixtureValues,
    onRecipeChange: setRecipePreview,
    restrictions: activeRestrictions
  });

  useGameInit(ctx);
  const { handleAutoTest } = useAutoTest(ctx);

  // ==================== 瑕嗙洊灞備紭鍏堢骇绠＄悊 ====================
  // 鍚屼竴鏃堕棿鍙樉绀轰紭鍏堢骇鏈€楂樼殑鍏ㄥ睆瑕嗙洊灞傦紝閬垮厤澶氫釜椤甸潰浜掔浉閬尅
  const activeOverlay = (() => {
    if (chapterSystem.storylineEnabled && chapterSystem.pendingEnding) return 'ending';
    if (chapterSystem.storylineEnabled && chapterSystem.pendingChapterTransition) return 'chapter_transition';
    if (chapterSystem.storylineEnabled && chapterSystem.pendingFragment) return 'memory_fragment';
    if (tutorial.showTutorialComplete) return 'tutorial_complete';
    if (customerFlow.showDayTransition) return 'day_transition';
    if (customerFlow.showDayEnd) return 'day_end';
    if (customerFlow.showReturnCustomerOverlay) return 'return_customer';
    if (customerFlow.showCustomerLeave) return 'customer_leave';
    if (customerFlow.showCustomerEnter) return 'customer_enter';
    return null;
  })();

  // ==================== 娓叉煋 ====================

  // 澶╂暟杞満鍔ㄧ敾锛堢嫭绔嬩簬鍔犺浇/娓告垙鍒嗘敮锛岄伩鍏嶉噸澶嶆寕杞藉鑷存挱鏀句袱娆★級
  const dayTransitionOverlay = activeOverlay === 'day_transition' ? (
    <div className="day-transition-overlay" key="day-transition">
      <div className="day-transition-text">
        <BalancedPixelText text={customerFlow.dayTransitionText} />
      </div>
      <div className="day-transition-line"></div>
    </div>
  ) : null;
  // ???????????????
  const hasHighPriorityOverlay = ['ending', 'chapter_transition', 'memory_fragment', 'tutorial_complete', 'day_transition'].includes(activeOverlay);
  const showNoCustomerRecoveryActions = !customerFlow.isLoadingCustomers
    && customerFlow.dailyCustomers.length === 0
    && String(customerFlow.customerLoadingProgress || '').includes('No first guest found');

  useEffect(() => {
    if (showAtmosphereOverlay || !pendingTavernEntrance || hasHighPriorityOverlay) return;
    setPendingTavernEntrance(false);
    setShowTavernEntrance(true);
  }, [showAtmosphereOverlay, pendingTavernEntrance, hasHighPriorityOverlay]);

  useEffect(() => {
    if (tavernEntranceShownDayRef.current === customerFlow.currentDay) return;
    setPendingTavernEntrance(false);
    setShowTavernEntrance(false);
  }, [customerFlow.currentDay]);

  const handleOpenForBusiness = useCallback(() => {
    dismissAtmosphereOverlay();

    const readyForEntrance = customerFlow.isGameReady
      && !customerFlow.isLoadingCustomers
      && customerFlow.dailyCustomers.length > 0
      && tavernEntranceShownDayRef.current !== customerFlow.currentDay;

    if (!readyForEntrance) {
      return;
    }

    tavernEntranceShownDayRef.current = customerFlow.currentDay;
    setPendingTavernEntrance(true);
  }, [
    customerFlow.currentDay,
    customerFlow.dailyCustomers.length,
    customerFlow.isGameReady,
    customerFlow.isLoadingCustomers,
    dismissAtmosphereOverlay
  ]);

  if ((!customerFlow.isGameReady || customerFlow.dailyCustomers.length === 0 || customerFlow.isLoadingCustomers) && !hasHighPriorityOverlay) {
    return (
      <div className="game-page">
        <AmbientGameCanvas
          viewModel={gameViewModel}
          customerPortraitSrc={stagePortraitSrc}
          customerCharacterId={stageCharacterId}
        />
        <div className="game-page-ui">
          <GameLoadingScreen
            isLoadingCustomers={customerFlow.isLoadingCustomers}
            progress={customerFlow.customerLoadingProgress}
            showRecoveryActions={showNoCustomerRecoveryActions}
            onBack={onBack}
            onBackToSetup={onBackToSetup}
          />
          <AtmosphereOverlay atmosphere={atmosphere} day={customerFlow.currentDay} onStart={handleOpenForBusiness} isVisible={showAtmosphereOverlay && !customerFlow.isLoadingCustomers} />
          {toastList.map(toast => (
            <Toast key={toast.id} message={toast.message} type={toast.type} onClose={() => removeToast(toast.id)} />
          ))}
          {dayTransitionOverlay}
        </div>
      </div>
    );
  }

  return (
    <div className="game-page">
      <AmbientGameCanvas
        viewModel={gameViewModel}
        customerPortraitSrc={stagePortraitSrc}
        customerCharacterId={stageCharacterId}
      />
      <div className="game-page-ui">
      <AtmosphereOverlay atmosphere={atmosphere} day={customerFlow.currentDay} onStart={handleOpenForBusiness} isVisible={showAtmosphereOverlay} />
      {eventsEnabled && (
        <EventNotification event={currentEvent} onChoice={handlers.handleEventChoiceAction} onDismiss={handlers.handleEventDismissAction} isVisible={showEventNotification} />
      )}

      <GameHeader
        onBack={onBack} onShowRules={() => progress.setShowRules(true)} currentDay={customerFlow.currentDay} money={money}
        aiConfig={aiConfig}
        currentCustomerIndex={customerFlow.currentCustomerIndex}
        isMuted={isMuted} toggleMute={toggleMute} sfxVolume={sfxVolume} setSfxVolume={setSfxVolume} playSFX={playSFX} atmosphere={atmosphere}
        onShowHelp={() => setShowHelp(true)}
      />

      <div className={`game-content ${isMixingStage ? 'mixing-mode' : 'dialogue-mode'} ${isMixingStage && !cocktailFlow.guessedCorrectly ? 'guess-step-mode' : ''}`}>
        <div className="left-section">
          {!isMixingStage ? (
            <ChatPanel
              aiConfig={aiConfig} trustLevel={trustLevel} dialogueHistory={dialogue.dialogueHistory}
              onSendMessage={handlers.handleSendMessage} quickOptions={dialogue.quickOptions} isLoading={dialogue.isLoading}
            />
          ) : (
            <BartenderPanel
              session={mixingSession}
              targetConditions={cocktailFlow.targetConditions} targetHint={cocktailFlow.targetHint}
              unlockedGlasses={unlockedItems.glasses || ['martini']}
              unlockedIceTypes={unlockedItems.iceTypes || ['no_ice']}
              unlockedDecorations={unlockedItems.decorations || []}
              disabled={false} hideTargetInPanel={true}
              mixingMode={chapterSystem.currentChapter?.mixingMode || 'strict'}
              guessedCorrectly={cocktailFlow.guessedCorrectly}
              selectedEmotions={emotionSystem.selectedEmotions}
              unlockedEmotions={tutorial.isTutorialMode ? TUTORIAL_VISIBLE_EMOTIONS : unlockedItems.emotions}
              onEmotionSelect={emotionSystem.handleEmotionSelect}
              onCancelEmotionGuess={handleBackFromMixing}
              onConfirmEmotionGuess={handlers.handleConfirmGuess}
              onBackToDialogue={handleBackFromMixing}
            />
          )}
        </div>

        {cocktailFlow.guessedCorrectly && (
          <div className="right-section">
            <div className="target-section">
              {['strict', 'transitional'].includes(chapterSystem.currentChapter?.mixingMode || 'strict') && (
                <TargetDisplay currentValues={cocktailFlow.currentMixtureValues} conditions={cocktailFlow.targetConditions} showHint={true} />
              )}
              <CocktailPreview
                recipe={recipePreview.recipe}
                totalPortions={recipePreview.totalPortions}
                maxPortions={recipePreview.maxPortions}
              />
            </div>
          </div>
        )}

      </div>

      {!isMixingStage && (
        <button
          type="button"
          className="mixing-entry-fab mixing-entry-fab--pad"
          onClick={() => {
            emotionSystem.setSelectedEmotions([]);
            cocktailFlow.handleStartEmotionGuess();
          }}
          disabled={dialogue.isLoading}
          aria-label="Go to mixing station"
        >
          <img
            className="mixing-entry-fab__pad-img"
            src="/asset/道具/pad2.png"
            alt=""
            draggable={false}
          />
        </button>
      )}

      {/* 淇′换搴﹂瀛?*/}
      {cocktailFlow.trustFlies.map(fly => (
        <div key={fly.id} className={`trust-fly ${fly.positive ? 'positive' : 'negative'}`}>{fly.text}</div>
      ))}

      {/* Toast */}
      {toastList.map(toast => (
        <Toast key={toast.id} message={toast.message} type={toast.type} onClose={() => removeToast(toast.id)} />
      ))}

      <GameHintPanel hint={gameHint} onClose={closeGameHint} />
      {progress.showRules && <RulesModal onClose={() => progress.setShowRules(false)} />}

      {cocktailFlow.showServeAnim && <div className="serve-animation">馃嵏</div>}

      {showServeStoryAnim && (
        <div className="serve-story-overlay" role="dialog" aria-label="Serve animation">
          <video
            key={serveStoryAnimKey}
            className="serve-story-video"
            src="/asset/角色/调酒师动画.mp4"
            autoPlay
            playsInline
            onEnded={() => setShowServeStoryAnim(false)}
          />
          <div className="serve-story-fix-tag" aria-hidden="true">
            <span className="serve-story-fix-tag__text">shaking...</span>
          </div>
          <button
            type="button"
            className="serve-story-skip"
            onClick={() => setShowServeStoryAnim(false)}
          >
            skip
          </button>
        </div>
      )}

      {showTavernEntrance && (
        <TavernEntranceScene
          characterName={aiConfig?.name || aiConfig?.displayName || ''}
          onAnimationComplete={() => setShowTavernEntrance(false)}
        />
      )}

      {cocktailFlow.showCocktailResult && (
        <div className={`cocktail-result-card ${cocktailFlow.showCocktailResult.isSuccess ? 'success' : ''}`}>
          <div className="result-icon">{cocktailFlow.showCocktailResult.isSuccess ? '🍸' : '💭'}</div>
          <div className="result-title">{cocktailFlow.showCocktailResult.isSuccess ? 'Drink delivered' : 'No resonance yet'}</div>
          <div className="result-stats">
            <div className={`result-stat ${(cocktailFlow.showCocktailResult.targetCheck?.results || []).some(c => c.attr === 'thickness' && !c.met) ? 'unmet' : 'met'}`}>
              <span className="result-stat-label">Body</span><span className="result-stat-value">{cocktailFlow.showCocktailResult.mixture.thickness?.toFixed(1) || '0'}</span>
            </div>
            <div className={`result-stat ${(cocktailFlow.showCocktailResult.targetCheck?.results || []).some(c => c.attr === 'sweetness' && !c.met) ? 'unmet' : 'met'}`}>
              <span className="result-stat-label">Sweetness</span><span className="result-stat-value">{cocktailFlow.showCocktailResult.mixture.sweetness?.toFixed(1) || '0'}</span>
            </div>
            <div className={`result-stat ${(cocktailFlow.showCocktailResult.targetCheck?.results || []).some(c => c.attr === 'strength' && !c.met) ? 'unmet' : 'met'}`}>
              <span className="result-stat-label">Strength</span><span className="result-stat-value">{cocktailFlow.showCocktailResult.mixture.strength?.toFixed(1) || '0'}</span>
            </div>
          </div>
          <div className="result-recipe-summary">
            {GLASS_TYPES[cocktailFlow.showCocktailResult.glass]?.icon} {GLASS_TYPES[cocktailFlow.showCocktailResult.glass]?.name || ''}
            {cocktailFlow.showCocktailResult.ingredients?.length > 0 && ` · ${cocktailFlow.showCocktailResult.ingredients.length} ingredients`}
          </div>
          {cocktailFlow.showCocktailResult.judgment && (
            <div className="result-judgment">
              <span className="judgment-mode">Mode: {({ strict: 'Strict', transitional: 'Transitional', expressive: 'Resonance', master: 'Master' })[cocktailFlow.showCocktailResult.judgment.mixingMode] || cocktailFlow.showCocktailResult.judgment.mixingMode || '-'}</span>
              {cocktailFlow.showCocktailResult.judgment.resonanceLabel && (
                <span className="judgment-resonance"> · Resonance: {cocktailFlow.showCocktailResult.judgment.resonanceLabel}</span>
              )}
              {cocktailFlow.showCocktailResult.judgment.method && (
                <span className="judgment-method"> · Method: {({ numeric: 'Numeric', hybrid: 'Hybrid', resonance: 'Resonance' })[cocktailFlow.showCocktailResult.judgment.method] || cocktailFlow.showCocktailResult.judgment.method}</span>
              )}
            </div>
          )}
        </div>
      )}

      {/* ==================== 鍏ㄥ睆瑕嗙洊灞傦紙浜掓枼锛屾寜浼樺厛绾у彧鏄剧ず涓€涓級 ==================== */}

      {activeOverlay === 'customer_enter' && (
        <div className="customer-enter-overlay">
          <div className="enter-avatar">
            <CustomerAvatar avatarBase64={aiConfig?.avatarBase64} emoji={aiConfig?.avatar || '馃懁'} size={64} customerId={aiConfig?.id || aiConfig?.avatarCacheKey} />
          </div>
        </div>
      )}

      {activeOverlay === 'customer_leave' && <CustomerLeaveOverlay aiConfig={aiConfig} parting={customerFlow.customerLeaveParting} />}

      {dayTransitionOverlay}

      {activeOverlay === 'day_end' && (
        <DayEndModal
          currentDay={customerFlow.currentDay} customersServed={customerFlow.customersServed}
          successCount={progress.gameStats.successCount} dayEarnings={customerFlow.dayEarnings}
          totalMoney={money} onStartNewDay={handlers.startNewDay} unlockedItems={unlockedItems}
          dailyMemory={customerFlow.dailyMemory}
        />
      )}

      {/* 鏁欏鎻愮ず锛堝皬鍨嬶紝涓嶅崰鍏ㄥ睆锛屽彲涓庡叾浠栧叡瀛橈級 */}
      {tutorial.isTutorialMode && tutorial.activeTooltip && !activeOverlay && (
        <TutorialTooltip tooltipId={tutorial.activeTooltip} position="bottom" onDismiss={tutorial.dismissTooltip} />
      )}

      {activeOverlay === 'tutorial_complete' && (
        <TutorialCompleteModal onContinue={() => { tutorial.completeTutorial(); handlers.startNewDay(); }} />
      )}

      {/* 鐏绯荤粺鍙犲姞灞?*/}
      {chapterSystem.storylineEnabled && activeOverlay === 'chapter_transition' && (
        <ChapterTransition
          chapter={chapterSystem.pendingChapterTransition.chapter}
          openingNarrative={chapterSystem.pendingChapterTransition.openingNarrative}
          onComplete={chapterSystem.dismissChapterTransition}
        />
      )}

      {chapterSystem.storylineEnabled && activeOverlay === 'memory_fragment' && (
        <MemoryFragment
          fragment={chapterSystem.pendingFragment}
          onDismiss={chapterSystem.dismissFragment}
        />
      )}

      {chapterSystem.storylineEnabled && activeOverlay === 'ending' && (
        <EndingScreen
          narrative={chapterSystem.pendingEnding.narrative}
          onFreeMode={() => chapterSystem.enterFreeMode()}
          onNewGame={() => { clearAllCache(); window.location.reload(); }}
        />
      )}

      {/* 杩涢樁寮曞寮圭獥锛堜粎鍦ㄦ病鏈夊叏灞忚鐩栧眰鏃舵樉绀猴級 */}
      {!activeOverlay && advancedGuides.currentGuide && (
        <AdvancedGuidePopup guide={advancedGuides.currentGuide} onDismiss={advancedGuides.dismissGuide} />
      )}

      {/* 甯姪闈㈡澘锛堢敤鎴蜂富鍔ㄦ墦寮€锛屽彲瑕嗙洊鍏朵粬锛?*/}
      {showHelp && <HelpPanel onClose={() => setShowHelp(false)} />}

      <DevPanel
        isVisible={devModeVisible} onClose={() => setDevModeVisible?.(false)}
        money={money} setMoney={setMoney} unlockedItems={unlockedItems} setUnlockedItems={setUnlockedItems}
        trustLevel={trustLevel} setTrustLevel={setTrustLevel}
        currentDay={customerFlow.currentDay} setCurrentDay={customerFlow.setCurrentDay}
        customerRealEmotions={getCustomerTop3Emotions(aiConfig, emotionSystem.dynamicCustomerEmotions.reality)}
        customerSuccessCount={customerFlow.customerSuccessCount} setCustomerSuccessCount={customerFlow.setCustomerSuccessCount}
        onSkipCustomer={handlers.handleDevSkipCustomer} devActions={devActions}
        onAutoTest={handleAutoTest} autoTestRunning={progress.autoTestRunning}
        guessedCorrectly={cocktailFlow.guessedCorrectly} emotionGuessMode={cocktailFlow.emotionGuessMode}
        devGame={devGame}
      />
      </div>
    </div>
  );
};

export default GamePage;
