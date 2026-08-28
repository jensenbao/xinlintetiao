import React, { Suspense, lazy, startTransition, useCallback, useEffect, useState } from 'react';
import HomePage from './pages/HomePage.jsx';
import { createDevActions } from './components/DevMode/devActions.js';
import {
  getGameProgress,
  getActiveCharacterIds,
  getUnlockedItems,
  saveGameProgress,
  saveUnlockedItems,
} from './utils/storage.js';
import { getActiveAPIConfig, getActiveAPIType, getAPIUnavailableReason } from './config/api.js';
import {
  createSlot,
  hydrateLegacyStorageFromGameState,
  loadSlotGameState,
  migrateFromLocalStorage,
  setActiveSlotId as setActiveSlotInRepository,
  shouldRunMigration,
  syncActiveSlotGameState,
} from './utils/saveRepository.js';
import './App.css';

const GamePage = lazy(() => import('./pages/GamePage.jsx'));
const EncyclopediaPage = lazy(() => import('./pages/EncyclopediaPage.jsx'));
const SettingsPage = lazy(() => import('./pages/SettingsPage.jsx'));
const SaveSlotsPage = lazy(() => import('./pages/SaveSlotsPage.jsx'));
const NewGameSetupPage = lazy(() => import('./pages/NewGameSetupPage.jsx'));
const DevPanel = lazy(() => import('./components/DevMode/DevPanel.jsx'));

const ENCYCLOPEDIA_ENABLED = false;

function App() {
  const [currentPage, setCurrentPage] = useState('home');
  const [money, setMoney] = useState(() => {
    const progress = getGameProgress();
    return progress?.money || 0;
  });
  const [unlockedItems, setUnlockedItems] = useState(() => getUnlockedItems());
  const [preloadedFirstCustomer, setPreloadedFirstCustomer] = useState(null);
  const [isPreloadingCustomer, setIsPreloadingCustomer] = useState(false);
  const [devModeVisible, setDevModeVisible] = useState(false);
  const [activeSlotId, setActiveSlotId] = useState(null);
  const [isEnteringGame, setIsEnteringGame] = useState(false);
  const devActions = createDevActions();

  useEffect(() => {
    const runMigration = async () => {
      try {
        const shouldMigrate = await shouldRunMigration();
        if (!shouldMigrate) return;
        await migrateFromLocalStorage('Migrated Save');
      } catch (error) {
        console.warn('Auto-migration skipped:', error?.message || error);
      }
    };

    runMigration();
  }, []);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === 'd') {
        event.preventDefault();
        setDevModeVisible((prev) => !prev);
        console.log('🔧 Developer mode:', !devModeVisible ? 'ON' : 'OFF');
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [devModeVisible]);

  useEffect(() => {
    if (currentPage !== 'home' || preloadedFirstCustomer || isPreloadingCustomer) {
      return;
    }

    setIsPreloadingCustomer(true);

    Promise.all([
      import('./utils/aiService.js'),
    ])
      .then(async ([aiService]) => {
        const activeCharacterIds = getActiveCharacterIds();
        if (activeCharacterIds.length > 0) {
          const roleId = activeCharacterIds[Math.floor(Math.random() * activeCharacterIds.length)];
          return aiService.generateCustomerFromCharacterId(roleId);
        }
        return null;
      })
      .then((customer) => {
        if (!customer) {
          console.log('ℹ️ No enabled characters configured, skipping home guest preload');
          setPreloadedFirstCustomer(null);
          return;
        }
        setPreloadedFirstCustomer(customer);
        console.log('✅ First guest preloaded:', customer.name);
      })
      .catch((error) => {
        console.error('❌ Failed to preload guest:', error);
        setPreloadedFirstCustomer(null);
      })
      .finally(() => {
        setIsPreloadingCustomer(false);
      });
  }, [currentPage, isPreloadingCustomer, preloadedFirstCustomer]);

  useEffect(() => {
    const progress = getGameProgress() || {};
    saveGameProgress({ ...progress, money });
    if (activeSlotId) {
      syncActiveSlotGameState('money_changed').catch(() => {});
    }
  }, [money, activeSlotId]);

  useEffect(() => {
    saveUnlockedItems(unlockedItems);
    if (activeSlotId) {
      syncActiveSlotGameState('unlocked_changed').catch(() => {});
    }
  }, [unlockedItems, activeSlotId]);

  const checkAIConnectivity = useCallback(async () => {
    const apiType = getActiveAPIType();
    const config = getActiveAPIConfig();
    const endpointHint = config?.endpoint ? ` [endpoint: ${config.endpoint}]` : '';

    if (apiType === 'none' || !config?.apiKey) {
      return { ok: false, message: getAPIUnavailableReason() || 'No available API key is configured.' };
    }

    try {
      let response;

      if (apiType === 'deepseek') {
        response = await fetch(config.endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${config.apiKey}`,
          },
          signal: AbortSignal.timeout(10000),
          body: JSON.stringify({
            model: config.model,
            messages: [{ role: 'user', content: 'Reply with OK.' }],
            max_tokens: 16,
          }),
        });
      } else {
        if (config.openaiCompatible) {
          const endpoint = String(config.endpoint || '').replace(/\/$/, '');
          response = await fetch(`${endpoint}/chat/completions`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${config.apiKey}`,
            },
            signal: AbortSignal.timeout(10000),
            body: JSON.stringify({
              model: config.model,
              messages: [{ role: 'user', content: 'Reply with OK.' }],
              max_tokens: 16,
            }),
          });
        } else {
          const url = `${config.endpoint}/${config.model}:generateContent?key=${config.apiKey}`;

          response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal: AbortSignal.timeout(10000),
            body: JSON.stringify({
              contents: [{ parts: [{ text: 'hi' }] }],
              generationConfig: { maxOutputTokens: 16 },
            }),
          });
        }
      }

      if (response.ok) {
        return { ok: true, message: '' };
      }

      let details = '';
      try {
        const raw = await response.text();
        if (raw) {
          try {
            const parsed = JSON.parse(raw);
            details = parsed?.error?.message_cn || parsed?.error?.message || parsed?.message || raw;
          } catch {
            details = raw;
          }
        }
      } catch {
        // ignore parsing failures
      }

      return {
        ok: false,
        message: `${details || `HTTP ${response.status}`}${endpointHint}`,
      };
    } catch (error) {
      return {
        ok: false,
        message: `${error?.message || 'network_error'}${endpointHint}`,
      };
    }
  }, []);

  const enterGameWithSlot = useCallback(async (slotId) => {
    if (!slotId) return false;
    setIsEnteringGame(true);

    try {
      const connectivity = await checkAIConnectivity();
      if (!connectivity.ok) {
        const details = connectivity.message ? `\n\nReason: ${connectivity.message}` : '';
        window.alert(`AI connection failed. Please check API settings and try again.${details}`);
        return false;
      }

      const gameState = await loadSlotGameState(slotId);
      hydrateLegacyStorageFromGameState(gameState);

      const progress = getGameProgress() || {};
      setMoney(progress.money || 0);
      setUnlockedItems(getUnlockedItems());

      setActiveSlotInRepository(slotId);
      setActiveSlotId(slotId);
      startTransition(() => {
        setCurrentPage('game');
      });
      return true;
    } catch (error) {
      window.alert(`Failed to load save: ${error?.message || 'Unknown error'}`);
      return false;
    } finally {
      setIsEnteringGame(false);
    }
  }, [checkAIConnectivity]);

  const handleOpenNewGameSetup = useCallback(() => {
    if (isEnteringGame) return;
    setPreloadedFirstCustomer(null);
    startTransition(() => {
      setCurrentPage('new_game_setup');
    });
  }, [isEnteringGame]);

  const handleStartNewGame = useCallback(async () => {
    if (isEnteringGame) return;

    const activeCharacterIds = getActiveCharacterIds();
    if (!Array.isArray(activeCharacterIds) || activeCharacterIds.length === 0) {
      window.alert('The bundled default character is unavailable. Please check the local character assets.');
      return;
    }

    try {
      setIsEnteringGame(true);
      setPreloadedFirstCustomer(null);
      const created = await createSlot();
      const slotId = created?.slotId;
      if (!slotId) {
        window.alert('Failed to create a new save.');
        return;
      }

      await enterGameWithSlot(slotId);
    } catch (error) {
      window.alert(`Failed to create a new save: ${error?.message || 'Unknown error'}`);
    } finally {
      setIsEnteringGame(false);
    }
  }, [enterGameWithSlot, isEnteringGame]);

  const handleBackToHome = () => {
    if (activeSlotId) {
      syncActiveSlotGameState('back_to_home').catch(() => {});
    }
    startTransition(() => {
      setCurrentPage('home');
    });
    setPreloadedFirstCustomer(null);
  };

  const handleNavigate = (page) => {
    startTransition(() => {
      setCurrentPage(page);
    });
  };

  const handleToggleDevMode = useCallback(() => {
    setDevModeVisible((prev) => !prev);
    console.log('🔧 Developer mode:', !devModeVisible ? 'ON' : 'OFF');
  }, [devModeVisible]);

  const renderPage = () => {
    switch (currentPage) {
      case 'home':
        return (
          <HomePage
            onNewGame={handleOpenNewGameSetup}
            onLoadGame={() => handleNavigate('save_slots')}
            onNavigate={handleNavigate}
            money={money}
            onToggleDevMode={handleToggleDevMode}
          />
        );
      case 'new_game_setup':
        return (
          <NewGameSetupPage
            onBack={handleBackToHome}
            onConfirmStart={handleStartNewGame}
            onCharacterPoolChange={() => setPreloadedFirstCustomer(null)}
            loading={isEnteringGame}
          />
        );
      case 'save_slots':
        return (
          <SaveSlotsPage
            onBack={handleBackToHome}
            onLoadSlot={(slotId) => enterGameWithSlot(slotId)}
            onCreateAndStart={handleOpenNewGameSetup}
          />
        );
      case 'game':
        return (
          <GamePage
            activeSlotId={activeSlotId}
            onBack={handleBackToHome}
            onBackToSetup={handleOpenNewGameSetup}
            money={money}
            setMoney={setMoney}
            unlockedItems={unlockedItems}
            setUnlockedItems={setUnlockedItems}
            devModeVisible={devModeVisible}
            setDevModeVisible={setDevModeVisible}
            devActions={devActions}
            preloadedFirstCustomer={preloadedFirstCustomer}
            onCustomerUsed={() => setPreloadedFirstCustomer(null)}
          />
        );
      case 'encyclopedia':
        return ENCYCLOPEDIA_ENABLED
          ? <EncyclopediaPage onBack={handleBackToHome} />
          : (
            <HomePage
              onNewGame={handleOpenNewGameSetup}
              onLoadGame={() => handleNavigate('save_slots')}
              onNavigate={handleNavigate}
              money={money}
              onToggleDevMode={handleToggleDevMode}
            />
          );
      case 'settings':
        return <SettingsPage onBack={handleBackToHome} />;
      default:
        return (
          <HomePage
            onNewGame={handleOpenNewGameSetup}
            onLoadGame={() => handleNavigate('save_slots')}
            onNavigate={handleNavigate}
            money={money}
            onToggleDevMode={handleToggleDevMode}
          />
        );
    }
  };

  return (
    <div className="app">
      <Suspense
        fallback={(
          <div className="app-loading">
            <div className="app-loading__panel">Loading...</div>
          </div>
        )}
      >
        {renderPage()}

        {currentPage !== 'game' && devModeVisible && (
          <DevPanel
            isVisible={devModeVisible}
            onClose={() => setDevModeVisible(false)}
            money={money}
            setMoney={setMoney}
            unlockedItems={unlockedItems}
            setUnlockedItems={setUnlockedItems}
            devActions={devActions}
          />
        )}
      </Suspense>
    </div>
  );
}

export default App;
