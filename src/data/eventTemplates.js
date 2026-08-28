import eventTemplatesData from './eventTemplates.json';

export const EVENT_TRIGGER_CONFIG = eventTemplatesData.eventTriggerConfig;
export const EVENT_TYPE_ICONS = eventTemplatesData.eventTypeIcons;
export const EVENT_TYPE_NAMES = eventTemplatesData.eventTypeNames;
export const FALLBACK_EVENTS = eventTemplatesData.fallbackEvents;
export const EVENT_CHAINS = eventTemplatesData.eventChains;

export const getAvailableEventTypes = (day) => {
  if (day <= 3) return EVENT_TRIGGER_CONFIG.dayScaling.day1to3.types;
  if (day <= 7) return EVENT_TRIGGER_CONFIG.dayScaling.day4to7.types;
  return EVENT_TRIGGER_CONFIG.dayScaling.day8plus.types;
};

export const getFallbackEvent = (type, recentEvents = []) => {
  const events = FALLBACK_EVENTS[type];

  if (!events || events.length === 0) {
    return null;
  }

  const available = events.filter((event) => !recentEvents.includes(event.narrative));

  if (available.length === 0) {
    return {
      ...events[Math.floor(Math.random() * events.length)],
      id: `event_${type}_${Date.now()}`
    };
  }

  const selected = available[Math.floor(Math.random() * available.length)];
  return { ...selected, id: `event_${type}_${Date.now()}` };
};
