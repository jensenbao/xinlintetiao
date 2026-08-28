// Tutorial mode has been removed.
// Keep a stable hook interface so existing game code can run unchanged.
import { useCallback } from 'react';

export const useTutorial = () => {
  const advanceTutorial = useCallback(() => 0, []);
  const getTutorialResponse = useCallback(() => '', []);
  const getTutorialQuickOptions = useCallback(() => [], []);
  const completeTutorial = useCallback(() => {}, []);
  const dismissTooltip = useCallback(() => {}, []);

  return {
    isTutorialMode: false,
    tutorialPhase: 'completed',
    dialogueRound: 0,
    activeTooltip: null,
    visibleAreas: ['chat', 'emotion', 'bartender'],
    guessErrorCount: 0,
    cocktailStep: 'serve',
    showTutorialComplete: false,
    shouldAutoRevealAnswer: false,
    advanceTutorial,
    getTutorialResponse,
    getTutorialQuickOptions,
    completeTutorial,
    dismissTooltip,
  };
};

export default useTutorial;
