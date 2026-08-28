import React, { useEffect, useState } from 'react';
import { getSettings, saveSettings, clearAllCache, getStorageUsage } from '../utils/storage.js';
import { DEBUG_CONFIG, getActiveAPIConfig, getActiveAPIName, getActiveAPIType } from '../config/api.js';
import audioManager from '../utils/audioManager.js';
import './SettingsPage.css';

const SettingsPage = ({ onBack }) => {
  const [settings, setSettings] = useState(getSettings());
  const [storageInfo, setStorageInfo] = useState(getStorageUsage());
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  useEffect(() => {
    localStorage.removeItem('bartender_effects_level');
  }, []);

  const updateSetting = (key, value) => {
    const nextSettings = { ...settings, [key]: value };
    setSettings(nextSettings);
    saveSettings(nextSettings);

    if (key === 'musicVolume') {
      audioManager.setBGMVolume(value);
    }

    if (key === 'sfxVolume') {
      audioManager.setSFXVolume(value);
    }

    if (key === 'soundEnabled') {
      audioManager.setMuted(!value);
    }
  };

  const handleClearCache = () => {
    if (showClearConfirm) {
      clearAllCache();
      setStorageInfo(getStorageUsage());
      setShowClearConfirm(false);
      window.location.reload();
      return;
    }

    setShowClearConfirm(true);
    setTimeout(() => setShowClearConfirm(false), 3000);
  };

  return (
    <div className="settings-page">
      <div className="settings-header">
        <button className="back-button" onClick={onBack}>
          Back
        </button>
        <h1>Settings</h1>
      </div>

      <div className="settings-content">
        <section className="settings-section">
          <h2>Audio</h2>

          <div className="setting-item">
            <div className="setting-info">
              <label>Sound toggle</label>
              <p className="setting-description">Enable or disable game audio</p>
            </div>
            <label className="toggle-switch">
              <input
                type="checkbox"
                checked={settings.soundEnabled}
                onChange={(e) => updateSetting('soundEnabled', e.target.checked)}
              />
              <span className="toggle-slider"></span>
            </label>
          </div>

          <div className="setting-item">
            <div className="setting-info">
              <label>BGM Volume</label>
              <p className="setting-description">Adjust background music volume</p>
            </div>
            <div className="volume-control">
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={settings.musicVolume}
                onChange={(e) => updateSetting('musicVolume', parseFloat(e.target.value))}
                disabled={!settings.soundEnabled}
              />
              <span className="volume-value">{Math.round(settings.musicVolume * 100)}%</span>
            </div>
          </div>

          <div className="setting-item">
            <div className="setting-info">
              <label>SFX Volume</label>
              <p className="setting-description">Adjust button and interaction sound volume</p>
            </div>
            <div className="volume-control">
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={settings.sfxVolume}
                onChange={(e) => updateSetting('sfxVolume', parseFloat(e.target.value))}
                disabled={!settings.soundEnabled}
              />
              <span className="volume-value">{Math.round(settings.sfxVolume * 100)}%</span>
            </div>
          </div>
        </section>

        <section className="settings-section">
          <h2>Storage</h2>

          <div className="storage-info">
            <div className="storage-item">
              <span className="storage-label">Used storage</span>
              <span className="storage-value">{storageInfo?.usedKB} KB</span>
            </div>
            <div className="storage-item">
              <span className="storage-label">Approx. {storageInfo?.usedMB} MB</span>
            </div>
          </div>

          <button
            className={`clear-cache-button ${showClearConfirm ? 'confirm' : ''}`}
            onClick={handleClearCache}
          >
            {showClearConfirm ? 'Click again to confirm' : 'Clear all cache'}
          </button>

          <p className="cache-warning">
            Clearing cache will remove all progress, chat history, and unlocks.
          </p>
        </section>

        {import.meta.env.VITE_DEBUG_MODE === 'true' && (
          <section className="settings-section">
            <h2>AI Configuration</h2>

            <div className="api-status">
              <div className="status-item">
                <span className="status-label">Current mode</span>
                <span className={`status-badge ${getActiveAPIType() === 'none' ? 'mock' : 'gemini'}`}>
                  {getActiveAPIType() === 'none' ? 'Not configured' : getActiveAPIName()}
                </span>
              </div>
              {getActiveAPIType() !== 'none' && (
                <div className="status-item">
                  <span className="status-label">Model</span>
                  <span className="status-badge gemini">
                    {getActiveAPIConfig()?.model || '-'}
                  </span>
                </div>
              )}
            </div>

            <p className="api-info">
              {getActiveAPIType() !== 'none' ? (
                <>
                  Using <strong>{getActiveAPIName()}</strong>
                  ({getActiveAPIConfig()?.model || '-'}).
                </>
              ) : (
                <>
                  No API key configured yet. Add one in <strong>.env.local</strong> and restart.
                </>
              )}
              <br />
              Image generation config is reserved for future integrations.
            </p>
          </section>
        )}

        {import.meta.env.VITE_DEBUG_MODE === 'true' && (
          <section className="settings-section">
            <h2>Debug Options</h2>

            <div className="debug-info">
              <div className="debug-item">
                <span>Show emotion params</span>
                <span className="debug-status">{DEBUG_CONFIG.showEmotionParams ? 'Yes' : 'No'}</span>
              </div>
              <div className="debug-item">
                <span>Show trust level</span>
                <span className="debug-status">{DEBUG_CONFIG.showTrustLevel ? 'Yes' : 'No'}</span>
              </div>
              <div className="debug-item">
                <span>Show recipe compatibility</span>
                <span className="debug-status">{DEBUG_CONFIG.showCompatibility ? 'Yes' : 'No'}</span>
              </div>
              <div className="debug-item">
                <span>Log prompts in console</span>
                <span className="debug-status">{DEBUG_CONFIG.logPrompts ? 'Yes' : 'No'}</span>
              </div>
            </div>

            <p className="debug-info-text">
              Debug options can be changed in <code>src/config/api.js</code>.
            </p>
          </section>
        )}

        <section className="settings-section">
          <h2>About</h2>

          <div className="about-info">
            <p><strong>Resonant Sips</strong></p>
            <p>Version: 0.1.0</p>
            <p className="about-description">
              Talk with AI guests, identify true emotions, and mix tailored cocktails that shift their state.
            </p>
            <p className="tech-stack">
              Stack: React 18 / Vite / LocalStorage
            </p>
          </div>
        </section>
      </div>
    </div>
  );
};

export default SettingsPage;
