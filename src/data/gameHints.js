import gameHintsData from './gameHints.json';

export const GAME_HINTS = gameHintsData.gameHints;

export const getGameHint = (hintType) => {
  return GAME_HINTS[hintType] || null;
};
