/**
 * Game handler composition hook.
 */
import { useRef } from 'react';
import { useCustomerDayHandlers } from './gameHandlers/useCustomerDayHandlers.js';
import { useDialogueHandlers } from './gameHandlers/useDialogueHandlers.js';
import { useServeProgressHandlers } from './gameHandlers/useServeProgressHandlers.js';

export const useGameHandlers = (ctx) => {
  const consecutiveSilenceRef = useRef(0);
  const totalSilenceRef = useRef(0);

  const refs = {
    consecutiveSilenceRef,
    totalSilenceRef
  };

  const customerDayHandlers = useCustomerDayHandlers({ ctx, refs });
  const dialogueHandlers = useDialogueHandlers({ ctx, refs });
  const serveProgressHandlers = useServeProgressHandlers({ ctx });

  return {
    ...customerDayHandlers,
    ...dialogueHandlers,
    ...serveProgressHandlers
  };
};
