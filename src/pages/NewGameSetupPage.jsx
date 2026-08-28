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

const LOCAL_ADDED_CHARACTER_PATH = 'seeds/characters/added/';
const DEFAULT_CHARACTER_ID = DEFAULT_PRESET_CHARACTER_IDS[0] || '';

const extractLocalAddedIdFromSourcePath = (sourcePath) => {
  const normalizedPath = String(sourcePath || '').replace(/\\/g, '/');
  const markerIndex = normalizedPath.indexOf(LOCAL_ADDED_CHARACTER_PATH);
  if (markerIndex < 0) return '';
  const relativePath = normalizedPath.slice(markerIndex + LOCAL_ADDED_CHARACTER_PATH.length);
  const segments = relativePath.split('/').filter(Boolean);
  return String(segments[0] || '').trim();
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

    if (DEFAULT_CHARACTER_ID) {
      saveActiveCharacterIds([DEFAULT_CHARACTER_ID]);
    }

    let cancelled = false;
    const syncLocalCharacters = async () => {
      try {
        const results = await searchLocalCharacters('', 50);
        const localCustomIds = results
          .map((item) => extractLocalAddedIdFromSourcePath(item?.source?.path))
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

  const activateCharacter = (id) => {
    if (!id) return;
    saveActiveCharacterIds([id]);
    onCharacterPoolChange?.();
  };

  const handleCustomCharacterToggle = (enabled) => {
    if (!enabled) {
      setUseCustomCharacter(false);
      activateCharacter(DEFAULT_CHARACTER_ID);
      return;
    }

    const nextCustomId = selectedCustomCharacterId || customCharacterIds[0] || '';
    if (!nextCustomId) return;
    setUseCustomCharacter(true);
    setSelectedCustomCharacterId(nextCustomId);
    activateCharacter(nextCustomId);
  };

  const handleConfirmStart = () => {
    const selectedId = useCustomCharacter
      ? (selectedCustomCharacterId || customCharacterIds[0])
      : DEFAULT_CHARACTER_ID;
    activateCharacter(selectedId);
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
          <button className="newgame-start-btn" onClick={handleConfirmStart} disabled={loading || !DEFAULT_CHARACTER_ID}>
            {loading ? 'Creating...' : 'Start New Game'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default NewGameSetupPage;
