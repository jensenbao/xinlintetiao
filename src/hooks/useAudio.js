import { useState, useEffect, useCallback } from 'react';
import audioManager from '../utils/audioManager.js';
import { getSettings, saveSettings as persistSettings } from '../utils/storage.js';

/**
 * 音频控制 Hook
 * 统一读写 `bartender_settings`，并兼容旧版 `bartender_audio_settings`
 */
export const useAudio = () => {
  const [isBgmPlaying, setIsBgmPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [bgmVolume, setBgmVolumeState] = useState(0.15);
  const [sfxVolume, setSfxVolumeState] = useState(0.5);

  useEffect(() => {
    try {
      const unifiedSettings = getSettings() || {};
      const legacyRaw = localStorage.getItem('bartender_audio_settings');
      const legacySettings = legacyRaw ? JSON.parse(legacyRaw) : null;

      const nextBgmVolume = unifiedSettings.musicVolume ?? legacySettings?.bgmVolume ?? 0.15;
      const nextSfxVolume = unifiedSettings.sfxVolume ?? legacySettings?.sfxVolume ?? 0.5;
      const nextMuted = unifiedSettings.soundEnabled === false
        ? true
        : (legacySettings?.isMuted ?? false);

      setBgmVolumeState(nextBgmVolume);
      setSfxVolumeState(nextSfxVolume);
      setIsMuted(nextMuted);

      audioManager.setBGMVolume(nextBgmVolume);
      audioManager.setSFXVolume(nextSfxVolume);
      audioManager.setMuted(nextMuted);
    } catch (error) {
      console.error('Failed to load audio settings:', error);
    }
  }, []);

  const saveSettings = useCallback((settings) => {
    const nextSettings = {
      ...getSettings(),
      soundEnabled: !settings.isMuted,
      musicVolume: settings.bgmVolume,
      sfxVolume: settings.sfxVolume
    };

    persistSettings(nextSettings);
    localStorage.setItem('bartender_audio_settings', JSON.stringify(settings));
  }, []);

  const initAudio = useCallback(() => {
    audioManager.init();
  }, []);

  const playBGM = useCallback((track = 'game') => {
    audioManager.init();
    audioManager.playBGM(track);
    setIsBgmPlaying(Boolean(audioManager.bgmAudio && !audioManager.bgmAudio.paused));
  }, []);

  const stopBGM = useCallback(() => {
    audioManager.stopBGM();
    setIsBgmPlaying(false);
  }, []);

  const toggleBGM = useCallback(() => {
    audioManager.init();
    const isPlaying = audioManager.toggleBGM();
    setIsBgmPlaying(isPlaying);
    return isPlaying;
  }, []);

  const playSFX = useCallback((type) => {
    audioManager.init();
    audioManager.playSFX(type);
  }, []);

  const setBgmVolume = useCallback((volume) => {
    setBgmVolumeState(volume);
    audioManager.setBGMVolume(volume);
    saveSettings({ bgmVolume: volume, sfxVolume, isMuted });
  }, [sfxVolume, isMuted, saveSettings]);

  const setSfxVolume = useCallback((volume) => {
    setSfxVolumeState(volume);
    audioManager.setSFXVolume(volume);
    saveSettings({ bgmVolume, sfxVolume: volume, isMuted });
  }, [bgmVolume, isMuted, saveSettings]);

  const setMuted = useCallback((muted) => {
    setIsMuted(muted);
    audioManager.setMuted(muted);
    setIsBgmPlaying(Boolean(audioManager.bgmAudio && !audioManager.bgmAudio.paused));
    saveSettings({ bgmVolume, sfxVolume, isMuted: muted });
  }, [bgmVolume, sfxVolume, saveSettings]);

  const toggleMute = useCallback(() => {
    const nextMuted = !isMuted;
    setMuted(nextMuted);
    return nextMuted;
  }, [isMuted, setMuted]);

  return {
    isBgmPlaying,
    isMuted,
    bgmVolume,
    sfxVolume,
    initAudio,
    playBGM,
    stopBGM,
    toggleBGM,
    playSFX,
    setBgmVolume,
    setSfxVolume,
    setMuted,
    toggleMute
  };
};

export default useAudio;
