import React, { useEffect, useState } from 'react';
import {
  getCustomCharacterIds,
  saveActiveCharacterIds,
  saveCustomCharacterIds,
} from '../utils/storage.js';
import {
  DEFAULT_PRESET_CHARACTER_IDS,
  isPresetCharacterId,
} from '../config/defaultCharacters/index.js';
import { searchLocalCharacters } from '../utils/localCharacterRepository.js';
import './NewGameSetupPage.css';

const LOCAL_CUSTOM_CHARACTER_PATH = 'seeds/characters/custom/';
const HAS_DEFAULT_CHARACTERS = DEFAULT_PRESET_CHARACTER_IDS.length > 0;

const isLocalCustomCharacterSource = (sourcePath) => {
  const normalizedPath = String(sourcePath || '').replace(/\\/g, '/');
  return normalizedPath.includes(LOCAL_CUSTOM_CHARACTER_PATH);
};

const NewGameSetupPage = ({ onBack, onConfirmStart, onCharacterPoolChange, loading = false }) => {
  const [useCustomCharacter, setUseCustomCharacter] = useState(false);
  const [customCharacterIds, setCustomCharacterIds] = useState([]);
  const [selectedCustomCharacterId, setSelectedCustomCharacterId] = useState('');
  const [scanningCharacters, setScanningCharacters] = useState(true);

  useEffect(() => {
    const savedCustomIds = getCustomCharacterIds().filter((id) => !isPresetCharacterId(id));
    setCustomCharacterIds(savedCustomIds);
    setSelectedCustomCharacterId(savedCustomIds[0] || '');

    if (HAS_DEFAULT_CHARACTERS) {
      saveActiveCharacterIds(DEFAULT_PRESET_CHARACTER_IDS);
    }

    let cancelled = false;
    const syncLocalCharacters = async () => {
      try {
        const results = await searchLocalCharacters('', 50);
        const localCustomIds = results
          .filter((item) => isLocalCustomCharacterSource(item?.source?.path))
          .map((item) => String(item?.code || '').trim())
          .filter(Boolean);
        const merged = saveCustomCharacterIds([
          ...DEFAULT_PRESET_CHARACTER_IDS,
          ...localCustomIds,
        ]);
        const availableCustomIds = merged.filter((id) => !isPresetCharacterId(id));

        if (cancelled) return;
        setCustomCharacterIds(availableCustomIds);
        setSelectedCustomCharacterId((current) => (
          availableCustomIds.includes(current) ? current : (availableCustomIds[0] || '')
        ));
      } catch {
        // Keep the locally stored custom-character list if the local scan is unavailable.
      } finally {
        if (!cancelled) setScanningCharacters(false);
      }
    };

    syncLocalCharacters();
    return () => {
      cancelled = true;
    };
  }, []);

  const activateCharacters = (ids) => {
    const normalized = Array.isArray(ids) ? ids.filter(Boolean) : [];
    if (normalized.length === 0) return;
    saveActiveCharacterIds(normalized);
    onCharacterPoolChange?.();
  };

  const handleCustomCharacterToggle = (enabled) => {
    if (!enabled) {
      setUseCustomCharacter(false);
      activateCharacters(DEFAULT_PRESET_CHARACTER_IDS);
      return;
    }

    const nextCustomId = selectedCustomCharacterId || customCharacterIds[0] || '';
    if (!nextCustomId) return;
    setUseCustomCharacter(true);
    setSelectedCustomCharacterId(nextCustomId);
    activateCharacters([nextCustomId]);
  };

  const handleConfirmStart = () => {
    const selectedIds = useCustomCharacter
      ? [selectedCustomCharacterId || customCharacterIds[0]]
      : DEFAULT_PRESET_CHARACTER_IDS;
    activateCharacters(selectedIds);
    onConfirmStart?.();
  };

  const customOptionDisabled = loading || scanningCharacters || customCharacterIds.length === 0;

  return (
    <div className="newgame-setup-page">
      <div className="newgame-setup-panel">
        <h1 className="newgame-setup-title">New Game Setup</h1>
        <p className="newgame-setup-desc">
          Choose whether to include a local custom character in this run.
        </p>

        <section className="newgame-role-panel">
          <div className="newgame-role-title">Optional Custom Character</div>
          <p className="newgame-role-hint">Leave this option off to enter the game directly with the built-in story character.</p>

          <div className="newgame-mode-list">
            <label className={`newgame-mode-option${useCustomCharacter ? ' is-selected' : ''}${customOptionDisabled ? ' is-disabled' : ''}`}>
              <input
                type="checkbox"
                checked={useCustomCharacter}
                onChange={(event) => handleCustomCharacterToggle(event.target.checked)}
                disabled={customOptionDisabled}
              />
              <span className="newgame-mode-copy">
                <span className="newgame-mode-title">Add a Custom Character</span>
                <span className="newgame-mode-description">
                  {scanningCharacters
                    ? 'Checking local custom characters...'
                    : customCharacterIds.length > 0
                      ? 'Choose one of the custom characters already stored locally.'
                      : 'No local custom characters are currently available.'}
                </span>
              </span>
              <span className="newgame-mode-badge">Optional</span>
            </label>
          </div>

        </section>

        <div className="newgame-actions">
          <button className="newgame-back-btn" onClick={onBack} disabled={loading}>Back</button>
          <button className="newgame-start-btn" onClick={handleConfirmStart} disabled={loading || !HAS_DEFAULT_CHARACTERS}>
            {loading ? 'Creating...' : 'Start New Game'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default NewGameSetupPage;
