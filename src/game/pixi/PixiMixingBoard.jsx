import React, { useMemo } from 'react';
import { GLASS_TYPES } from '../../data/emotions.js';
import { ICE_TYPES, DECORATION_TYPES } from '../../data/addons.js';
import {
  INGREDIENTS,
  INGREDIENT_CATEGORIES,
  getIngredientsByCategory,
  MAX_PORTIONS_PER_INGREDIENT,
  MAX_TOTAL_PORTIONS
} from '../../data/ingredients.js';
import { getTotalPortions } from '../../utils/cocktailMixing.js';
import './PixiMixingBoard.css';

const STEP_COPY = {
  glass: {
    icon: '🍸',
    subtitle: 'Choose the glass first to define the profile.',
    title: 'Step 1 · Glass'
  },
  ice: {
    icon: '🧊',
    subtitle: 'Ice sets the opening temperature and tone.',
    title: 'Step 2 · Ice'
  },
  ingredient: {
    icon: '🥃',
    subtitle: 'Base ingredient ratios define the character.',
    title: 'Step 3 · Ingredients'
  },
  decoration: {
    icon: '✨',
    subtitle: 'Decoration shapes the first impression.',
    title: 'Step 4 · Decoration'
  },
  preview: {
    icon: '🫗',
    subtitle: 'If the drink is ready, serve it.',
    title: 'Step 5 · Serve'
  }
};

const STEP_SEQUENCE = ['glass', 'ice', 'ingredient', 'decoration', 'preview'];

const MODE_COPY = {
  expressive: {
    badge: 'Expressive',
    briefLabel: 'Response Draft',
    emptyBody: 'From Chapter III onward, ingredient feeling matters more than numbers.',
    emptyTitle: 'Let the drink speak first',
    eyebrow: 'Chapter III-IV · Resonance',
    hintLabel: 'Emotional Direction',
    manifesto: 'You are not mixing an answer, but a response.',
    previewLabel: 'Drink Attitude',
    progressLabel: 'Resonance Draft',
    showHint: true,
    showMetrics: false,
    showNumericProgress: false,
    showSignals: true,
    showSuggestions: false,
    signalLabel: 'Current Texture'
  },
  master: {
    badge: 'Master',
    briefLabel: 'Silent Judgment',
    emptyBody: 'Only touch, silence, and your judgment remain here.',
    emptyTitle: 'No single correct answer',
    eyebrow: 'Chapter V · Intuition',
    hintLabel: 'Aftertone Direction',
    manifesto: 'Do not follow formulas blindly—listen to silence itself.',
    previewLabel: 'Aftertaste Sensing',
    progressLabel: 'Intuition Echo',
    showHint: true,
    showMetrics: false,
    showNumericProgress: false,
    showSignals: true,
    showSuggestions: false,
    signalLabel: 'Touch Only'
  },
  strict: {
    badge: 'Strict',
    briefLabel: 'Calibration Tips',
    emptyBody: 'In Chapter I, focus on structure: capacity and three attributes define success.',
    emptyTitle: 'Start with structure',
    eyebrow: 'Chapter I · Calibration',
    hintLabel: 'Target Hint',
    manifesto: 'Calibrate the drink first, then read the person.',
    previewLabel: 'Calibration',
    progressLabel: 'Condition Match',
    showHint: true,
    showMetrics: true,
    showNumericProgress: true,
    showSignals: false,
    showSuggestions: true,
    signalLabel: 'Calibration Signals'
  },
  transitional: {
    badge: 'Transitional',
    briefLabel: 'Attitude Adjustment',
    emptyBody: 'Numbers step back, attitude comes forward.',
    emptyTitle: 'From correct to close',
    eyebrow: 'Chapter II · Drift',
    hintLabel: 'Direction',
    manifesto: 'Not just match conditions—match the person.',
    previewLabel: 'Drift Watch',
    progressLabel: 'Closeness',
    showHint: true,
    showMetrics: true,
    showNumericProgress: true,
    showSignals: true,
    showSuggestions: true,
    signalLabel: 'Attitude Drift'
  }
};

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const describeAxis = (type, value) => {
  if (type === 'thickness') {
    if (value >= 7) return 'Dense and enveloping';
    if (value >= 4) return 'Rich and stable';
    if (value >= 1) return 'Has structure';
    if (value <= -2) return 'Light and transparent';
    return 'Restrained';
  }

  if (type === 'sweetness') {
    if (value >= 7) return 'Almost soothing';
    if (value >= 4) return 'Soft with lingering sweetness';
    if (value >= 1) return 'Slight warmth';
    if (value <= -1) return 'Cool and restrained';
    return 'Neutral and calm';
  }

  if (value >= 7) return 'Sharp and intense';
  if (value >= 4) return 'Clear and forceful';
  if (value >= 1) return 'Lightly energizing';
  return 'Gentle and non-aggressive';
};

const formatSigned = (value) => `${value > 0 ? '+' : ''}${value}`;

const getModeCopy = (mixingMode) => MODE_COPY[mixingMode] || MODE_COPY.strict;

const getCardNote = (state) => {
  if (state === 'locked') {
    return 'Locked';
  }

  if (state === 'restricted') {
    return 'Unavailable in current story state';
  }

  return '';
};

const getStepAvailabilityLabel = ({ currentStep, selectedCategory, unlockedDecorations, unlockedGlasses, unlockedIceTypes, visibleIceTypes }) => {
  if (currentStep === 'glass') {
    return `Unlocked ${unlockedGlasses.length}/${Object.keys(GLASS_TYPES).length} glass types`;
  }

  if (currentStep === 'ice') {
    return `Available ${visibleIceTypes.length}/${Object.keys(ICE_TYPES).length} ice types`;
  }

  if (currentStep === 'ingredient') {
    return `Current category: ${getIngredientsByCategory(selectedCategory).length} ingredients`;
  }

  if (currentStep === 'decoration') {
    return `Unlocked ${unlockedDecorations.length}/${Object.keys(DECORATION_TYPES).length} decorations`;
  }

  return '';
};

const getItemDescription = (mixingMode, item) => {
  const numericSummary = `Body ${formatSigned(item.thickness || 0)} · Sweet ${formatSigned(item.sweetness || 0)} · Strong ${formatSigned(item.strength || 0)}`;
  const feelingSummary = item.feeling || item.description || 'An unnamed flavor direction.';

  if (mixingMode === 'strict') {
    return numericSummary;
  }

  if (mixingMode === 'transitional') {
    return `${numericSummary} · ${feelingSummary}`;
  }

  return feelingSummary;
};

const getGlassDescription = (mixingMode, glass) => {
  const capacityText = `Capacity ${glass.maxPortions || 2}`;
  const styleText = glass.feeling || glass.description || 'Set the posture of the drink first.';

  if (mixingMode === 'strict') {
    return `${capacityText} · ${glass.description || styleText}`;
  }

  if (mixingMode === 'transitional') {
    return `${capacityText} · ${styleText}`;
  }

  return styleText;
};

const getAddonDescription = (mixingMode, item) => {
  const feelingText = item.feeling || item.description || 'Gently tilt the drink in a new direction.';

  if (mixingMode === 'strict') {
    return item.description || feelingText;
  }

  return feelingText;
};

const buildCards = ({ currentStep, session, unlockedDecorations, unlockedGlasses, unlockedIceTypes, mixingMode, maxPortions, totalPortions }) => {
  if (currentStep === 'glass') {
    return Object.values(GLASS_TYPES).map((glass) => {
      const isUnlocked = unlockedGlasses.includes(glass.id);

      return {
        active: session.recipe.glass === glass.id,
        description: getGlassDescription(mixingMode, glass),
        disabled: !isUnlocked,
        icon: glass.icon,
        iconImage: glass.iconImage,
        id: glass.id,
        label: glass.name,
        note: getCardNote(isUnlocked ? '' : 'locked'),
        onClick: isUnlocked ? () => session.handleSelectGlass(glass.id) : null
      };
    });
  }

  if (currentStep === 'ice') {
    return Object.values(ICE_TYPES).map((ice) => {
      const isUnlocked = unlockedIceTypes.includes(ice.id);
      const isAvailable = session.filteredIceTypes.includes(ice.id);
      const disabledState = !isUnlocked ? 'locked' : (!isAvailable ? 'restricted' : '');

      return {
        active: session.recipe.ice === ice.id,
        description: getAddonDescription(mixingMode, ice),
        disabled: !isAvailable,
        icon: ice.icon,
        iconImage: ice.iconImage,
        id: ice.id,
        label: ice.name,
        note: getCardNote(disabledState),
        onClick: isAvailable ? () => session.handleSelectIce(ice.id) : null
      };
    });
  }

  if (currentStep === 'ingredient') {
    return getIngredientsByCategory(session.selectedCategory)
      .filter((ingredient) => session.filteredIngredients.includes(ingredient.id))
      .map((ingredient) => {
        const count = session.recipe.ingredients.find((portion) => portion.id === ingredient.id)?.count || 0;
        const isRestricted = session.disabledIngredientIds.has(ingredient.id);
        const isMaxed = count >= MAX_PORTIONS_PER_INGREDIENT || totalPortions >= maxPortions;

        return {
          active: count > 0,
          badge: count > 0 ? String(count) : '',
          description: getItemDescription(mixingMode, ingredient),
          disabled: isRestricted || isMaxed,
          icon: ingredient.icon,
          iconImage: ingredient.iconImage,
          id: ingredient.id,
          label: ingredient.name,
          onClick: () => session.handleAddIngredient(ingredient.id),
          onSecondaryAction: count > 0 ? () => session.handleRemoveIngredient(ingredient.id) : null,
          secondaryLabel: '−'
        };
      });
  }

  if (currentStep === 'decoration') {
    return [{ id: null, icon: '➖', name: 'Skip', feeling: 'Stay restrained and add nothing here.' }, ...Object.values(DECORATION_TYPES).filter((item) => unlockedDecorations.includes(item.id))]
      .map((item) => ({
        active: session.recipe.decoration === item.id,
        description: getAddonDescription(mixingMode, item),
        icon: item.icon,
        iconImage: item.iconImage,
        id: item.id ?? 'skip-decoration',
        label: item.name,
        onClick: () => session.handleSelectDecoration(item.id ?? null)
      }));
  }

  return session.recipe.ingredients
    .filter((portion) => Boolean(INGREDIENTS[portion.id]))
    .map((portion) => ({
      active: false,
      description: `Added ${portion.count}`,
      icon: INGREDIENTS[portion.id].icon,
      iconImage: INGREDIENTS[portion.id].iconImage,
      id: portion.id,
      label: INGREDIENTS[portion.id].name,
      onClick: null
    }));
};

const buildSignals = (mixture, totalPortions) => {
  if (!totalPortions) {
    return [];
  }

  return [
    { key: 'thickness', label: 'Body', text: describeAxis('thickness', mixture.thickness || 0), value: Number(mixture.thickness || 0) },
    { key: 'sweetness', label: 'Sweetness', text: describeAxis('sweetness', mixture.sweetness || 0), value: Number(mixture.sweetness || 0) },
    { key: 'strength', label: 'Strength', text: describeAxis('strength', mixture.strength || 0), value: Number(mixture.strength || 0) }
  ];
};

const buildReading = ({ maxPortions, mixingMode, modeCopy, session, signals, totalPortions }) => {
  const metCount = session.targetCheck?.metCount || 0;
  const satisfaction = Math.round((session.targetCheck?.satisfaction || 0) * 100);
  const totalConditions = session.targetCheck?.totalConditions || 0;

  if (!session.recipe.glass && totalPortions === 0) {
    return {
      body: modeCopy.emptyBody,
      footnote: 'This step sets the tone for chapter feedback.',
      title: modeCopy.emptyTitle
    };
  }

  if (mixingMode === 'strict') {
    if (session.targetCheck?.allMet && totalConditions > 0 && totalPortions === maxPortions) {
      return {
        body: 'Conditions, capacity, and structure are aligned. You can serve now.',
        footnote: `Current capacity ${totalPortions}/${maxPortions}.`,
        title: 'Calibrated'
      };
    }

    return {
      body: totalConditions > 0
        ? `Matched ${metCount}/${totalConditions} conditions. One more step to stabilize.`
        : 'Build the base structure first.',
      footnote: `Capacity ${totalPortions}/${maxPortions}. In strict mode, each step is measurable.`,
      title: totalPortions < maxPortions ? `${Math.max(maxPortions - totalPortions, 0)} more portions needed` : 'Drink is stable'
    };
  }

  if (mixingMode === 'transitional') {
    return {
      body: session.currentAttitude?.baseSummary || 'Numbers step back, but attitude must stay coherent.',
      footnote: totalConditions > 0
        ? `Closeness ${satisfaction}% · Match ${metCount}/${totalConditions}`
        : 'You are not just correct; you are becoming closer.',
      title: session.currentAttitude?.feelingSummary || (session.targetCheck?.allMet ? 'Direction is close' : 'Don’t focus on numbers only')
    };
  }

  if (mixingMode === 'expressive') {
    return {
      body: session.currentAttitude?.baseSummary || 'You are composing a response that can be drunk.',
      footnote: signals.length > 0
        ? `Current texture: ${signals.map((signal) => signal.text).join(' · ')}`
        : 'Ingredient feeling speaks earlier than condition matching.',
      title: session.currentAttitude?.feelingSummary || 'Emotion is taking shape'
    };
  }

  return {
    body: session.currentAttitude?.feelingSummary || 'Master mode won’t decide for you; it only makes outcomes more honest.',
    footnote: signals.length > 0
      ? `Now only this remains: ${signals.map((signal) => signal.text).join(' · ')}.`
      : 'No explicit formula remains, only intuition.',
    title: session.currentAttitude?.baseSummary || 'A bet on true understanding'
  };
};

const buildAdviceItems = ({ mixingMode, session }) => {
  if (mixingMode === 'strict' || mixingMode === 'transitional') {
    if (session.suggestions?.length > 0) {
      return session.suggestions.slice(0, 3).map((suggestion, index) => ({
        key: `${suggestion.type}-${index}`,
        note: suggestion.recommended ? `Consider: ${suggestion.recommended}` : '',
        tone: suggestion.type,
        text: suggestion.message
      }));
    }

    return [{
      key: 'stable',
      note: '',
      text: 'No extra correction needed now. Keep this direction.',
      tone: 'success'
    }];
  }

  if (session.currentAttitude?.feelingSummary) {
    return [{
      key: 'feeling',
      note: session.currentAttitude.baseSummary || '',
      text: `This drink now feels like: ${session.currentAttitude.feelingSummary}`,
      tone: 'hint'
    }];
  }

  return [{
    key: 'listen',
    note: '',
    text: 'Don’t rush to be correct. First, hear where the drink wants to go.',
    tone: 'hint'
  }];
};

const PixiMixingBoard = ({
  mixingMode = 'strict',
  session,
  targetHint = '',
  unlockedDecorations = [],
  unlockedGlasses = [],
  unlockedIceTypes = []
}) => {
  const modeCopy = getModeCopy(mixingMode);
  const stepCopy = STEP_COPY[session.currentStep] || STEP_COPY.glass;
  const totalPortions = getTotalPortions(session.recipe.ingredients);
  const currentGlass = session.recipe.glass ? GLASS_TYPES[session.recipe.glass] : null;
  const maxPortions = currentGlass?.maxPortions || MAX_TOTAL_PORTIONS;

  const cards = useMemo(() => buildCards({
    currentStep: session.currentStep,
    mixingMode,
    maxPortions,
    session,
    totalPortions,
    unlockedDecorations,
    unlockedGlasses,
    unlockedIceTypes
  }), [maxPortions, mixingMode, session, totalPortions, unlockedDecorations, unlockedGlasses, unlockedIceTypes]);

  const signals = useMemo(() => buildSignals(session.currentMixture, totalPortions), [session.currentMixture, totalPortions]);

  const reading = useMemo(() => buildReading({
    maxPortions,
    mixingMode,
    modeCopy,
    session,
    signals,
    totalPortions
  }), [maxPortions, mixingMode, modeCopy, session, signals, totalPortions]);

  const adviceItems = useMemo(() => buildAdviceItems({ mixingMode, session }), [mixingMode, session]);
  const availabilityLabel = useMemo(() => getStepAvailabilityLabel({
    currentStep: session.currentStep,
    selectedCategory: session.selectedCategory,
    unlockedDecorations,
    unlockedGlasses,
    unlockedIceTypes,
    visibleIceTypes: session.filteredIceTypes
  }), [session.currentStep, session.filteredIceTypes, session.selectedCategory, unlockedDecorations, unlockedGlasses, unlockedIceTypes]);

  const summaryText = modeCopy.showNumericProgress && session.targetCheck?.totalConditions > 0
    ? `Match ${session.targetCheck.metCount || 0}/${session.targetCheck.totalConditions || 0} · ${reading.body}`
    : reading.body;
  const summaryChips = [
    currentGlass?.name || 'No glass',
    session.recipe.ice ? (ICE_TYPES[session.recipe.ice]?.name || 'Ice') : 'No ice selected',
    `${totalPortions}/${maxPortions}${modeCopy.showMetrics ? ' portions' : ' selections'}`,
    ...(session.recipe.decoration ? [DECORATION_TYPES[session.recipe.decoration]?.name].filter(Boolean) : [])
  ];

  const showPreviousAction = session.currentStepIndex > 0;
  const prioritizeCards = ['glass', 'ice'].includes(session.currentStep);
  const visibleAdviceItems = prioritizeCards ? adviceItems.slice(0, 1) : adviceItems;
  const compactInsights = true;

  const insightPanel = (
    <div className={`pixi-mixing-board__insight-grid ${compactInsights ? 'compact' : ''}`}>
      {modeCopy.showHint && targetHint && (
        <div className="pixi-mixing-board__hint" role="note" aria-label="Target hint">
          <div className="pixi-mixing-board__hint-label">{modeCopy.hintLabel}</div>
          <div className="pixi-mixing-board__hint-text">{targetHint}</div>
        </div>
      )}

      <div className="pixi-mixing-board__brief" role="status" aria-label="Mode briefing">
        <div className="pixi-mixing-board__brief-label">{modeCopy.briefLabel}</div>
        <div className="pixi-mixing-board__brief-list">
          {visibleAdviceItems.map((item) => (
            <div key={item.key} className={`pixi-mixing-board__brief-item ${item.tone}`}>
              <div className="pixi-mixing-board__brief-text">{item.text}</div>
              {item.note && <div className="pixi-mixing-board__brief-note">{item.note}</div>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <div className={`pixi-mixing-board pixi-mixing-board--${mixingMode}`} aria-label="Mixing stage board">
      <div className="pixi-mixing-board__mode-strip">
        <div className="pixi-mixing-board__mode-badge">{modeCopy.badge}</div>
        <div className="pixi-mixing-board__mode-manifesto">{modeCopy.manifesto}</div>
      </div>

      <div className="pixi-mixing-board__header">
        <div>
          <div className="pixi-mixing-board__eyebrow">{modeCopy.eyebrow}</div>
          <div className="pixi-mixing-board__title-row">
            <div className="pixi-mixing-board__title">{stepCopy.title}</div>
            <div className="pixi-mixing-board__step-counter">{session.currentStepIndex + 1}/{STEP_SEQUENCE.length}</div>
          </div>
          <div className="pixi-mixing-board__subtitle-row">
            <div className="pixi-mixing-board__subtitle">{stepCopy.subtitle}</div>
            {availabilityLabel && <div className="pixi-mixing-board__availability">{availabilityLabel}</div>}
          </div>
        </div>
        <button className="pixi-mixing-board__ghost-btn pixi-mixing-board__ghost-btn--header-reset" type="button" onClick={session.handleReset}>↺ Reset</button>
      </div>

      <div className="pixi-mixing-board__step-rail" aria-label="Mixing steps">
        {STEP_SEQUENCE.map((stepId, index) => {
          const stepMeta = STEP_COPY[stepId];
          const isActive = session.currentStep === stepId;
          const isCompleted = index < session.currentStepIndex;

          return (
            <div key={stepId} className={`pixi-mixing-board__step-pill ${isActive ? 'active' : ''} ${isCompleted ? 'completed' : ''}`}>
              <span className="pixi-mixing-board__step-icon">{stepMeta.icon}</span>
              <span className="pixi-mixing-board__step-label">{stepMeta.title.replace(/^Step\s+\d+\s+·\s+/, '')}</span>
            </div>
          );
        })}
      </div>

      <div className="pixi-mixing-board__body pixi-mixing-board__body--controls-only">
        <div className="pixi-mixing-board__controls">
          <div className="pixi-mixing-board__summary-strip">
            <div className="pixi-mixing-board__summary-main">
              <div className="pixi-mixing-board__summary-kicker">{modeCopy.progressLabel}</div>
              <div className="pixi-mixing-board__summary-title">{reading.title}</div>
              <div className="pixi-mixing-board__summary-text">{summaryText}</div>
            </div>
            <div className="pixi-mixing-board__summary-tags">
              {summaryChips.map((chip) => (
                <span key={chip} className="pixi-mixing-board__summary-chip">{chip}</span>
              ))}
            </div>
          </div>

          <div className="pixi-mixing-board__control-scroll">
            {session.currentStep === 'ingredient' && insightPanel}

            {session.currentStep === 'ingredient' && (
              <div className="pixi-mixing-board__tabs">
                {INGREDIENT_CATEGORIES.map((category) => (
                  <button
                    key={category.id}
                    type="button"
                    className={`pixi-mixing-board__tab ${session.selectedCategory === category.id ? 'active' : ''}`}
                    onClick={() => session.setSelectedCategory(category.id)}
                  >
                    <span>{category.icon}</span>
                    <span>{category.name}</span>
                  </button>
                ))}
              </div>
            )}

            <div className="pixi-mixing-board__cards">
              {cards.length > 0 ? cards.map((card) => (
                <div key={card.id} className={`pixi-mixing-board__card ${card.active ? 'active' : ''} ${card.disabled ? 'disabled' : ''}`}>
                  <button type="button" className="pixi-mixing-board__card-main" disabled={card.disabled || !card.onClick} onClick={card.onClick || undefined}>
                    <div className="pixi-mixing-board__card-top">
                      {(card.iconImage || card.icon) && (
                        <span className="pixi-mixing-board__card-icon">
                          {card.iconImage ? (
                            <img className="pixi-mixing-board__card-icon-image" src={card.iconImage} alt={`${card.label} icon`} />
                          ) : (
                            card.icon
                          )}
                        </span>
                      )}
                      {card.badge && <span className="pixi-mixing-board__card-badge">{card.badge}</span>}
                    </div>
                    <div className="pixi-mixing-board__card-title">{card.label}</div>
                    <div className="pixi-mixing-board__card-desc">{card.description}</div>
                    {card.note && <div className="pixi-mixing-board__card-note">{card.note}</div>}
                  </button>
                  {card.onSecondaryAction && (
                    <button type="button" className="pixi-mixing-board__card-secondary" onClick={card.onSecondaryAction}>
                      {card.secondaryLabel}
                    </button>
                  )}
                </div>
              )) : (
                <div className="pixi-mixing-board__empty">{"\u5f53\u524d\u6b65\u9aa4\u6682\u65e0\u53ef\u5c55\u793a\u5185\u5bb9。"}</div>
              )}
            </div>

            {false && insightPanel}
          </div>
        </div>
      </div>

      <div className={`pixi-mixing-board__footer ${showPreviousAction ? '' : 'single-action'}`}>
        {showPreviousAction && (
          <div className="pixi-mixing-board__footer-left">
            <button type="button" className="pixi-mixing-board__ghost-btn" onClick={session.handlePrevStep}>← Previous</button>
          </div>
        )}
        <div className="pixi-mixing-board__footer-right">
          {session.currentStep === 'preview' ? (
            <button type="button" className="pixi-mixing-board__primary-btn" onClick={session.handleServe}>🍸 Serve</button>
          ) : (
            <button type="button" className="pixi-mixing-board__primary-btn" onClick={session.handleNextStep} disabled={!session.canProceed()}>
              Next →
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default PixiMixingBoard;
