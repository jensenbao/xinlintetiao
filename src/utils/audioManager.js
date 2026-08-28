/**
 * 音频管理器
 * 负责背景音乐和音效的播放控制
 */

class AudioManager {
  constructor() {
    this.audioContext = null;
    this.bgmNode = null;
    this.bgmGainNode = null;
    this.sfxGainNode = null;
    this.bgmVolume = 0.15; // 调小默认 BGM 音量
    this.sfxVolume = 0.5;
    this.isMuted = false;
    this.isBgmPlaying = false;
    this.initialized = false;
    // 🆕 真实 BGM
    this.bgmAudio = null;       // HTMLAudioElement
    this.currentBgmTrack = null; // 当前曲目名
    // 自动播放被阻止时的待播放曲目
    this._pendingBgmTrack = null;
    this._interactionListenerBound = false;
    this._wasPlayingBeforeMute = false;
    this._bgmSwitchTimer = null;
    this._bgmFadeOutTimer = null;
  }

  _clearBgmTimers() {
    if (this._bgmSwitchTimer) {
      clearTimeout(this._bgmSwitchTimer);
      this._bgmSwitchTimer = null;
    }
    if (this._bgmFadeOutTimer) {
      clearInterval(this._bgmFadeOutTimer);
      this._bgmFadeOutTimer = null;
    }
  }

  // 初始化音频上下文（需要用户交互后调用）
  init() {
    if (this.initialized) return;
    
    try {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      
      // 创建主增益节点
      this.bgmGainNode = this.audioContext.createGain();
      this.bgmGainNode.gain.value = this.bgmVolume;
      this.bgmGainNode.connect(this.audioContext.destination);
      
      this.sfxGainNode = this.audioContext.createGain();
      this.sfxGainNode.gain.value = this.sfxVolume;
      this.sfxGainNode.connect(this.audioContext.destination);
      
      this.initialized = true;
      console.log('Audio system initialized successfully');
    } catch (e) {
      console.error('Failed to initialize audio system:', e);
    }
  }

  // 恢复音频上下文（解决自动播放限制）
  async resume() {
    if (this.audioContext && this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }
  }

  // 注册一次性用户交互监听，交互后恢复被阻止的 BGM
  _waitForInteraction() {
    if (this._interactionListenerBound) return;
    this._interactionListenerBound = true;

    const handler = () => {
      this._interactionListenerBound = false;
      document.removeEventListener('click', handler, { capture: true });
      document.removeEventListener('keydown', handler, { capture: true });
      document.removeEventListener('touchstart', handler, { capture: true });

      // 恢复 AudioContext
      this.resume();

      // 恢复被阻止的 BGM
      if (this._pendingBgmTrack) {
        const track = this._pendingBgmTrack;
        this._pendingBgmTrack = null;
        // 如果当前已经有对应的 Audio 元素且还未播放，直接 play
        if (this.bgmAudio && this.currentBgmTrack === track) {
          this.bgmAudio.play().catch(() => {});
        } else {
          this.playBGM(track);
        }
      }
    };

    document.addEventListener('click', handler, { capture: true, once: false });
    document.addEventListener('keydown', handler, { capture: true, once: false });
    document.addEventListener('touchstart', handler, { capture: true, once: false });
  }

  // ==================== 背景音乐（使用真实 MP3/WAV）====================

  // BGM 曲目映射
  static BGM_TRACKS = {
    home: '/audio/Bar_BGM.wav',   // 开场/主界面 (统一氛围音乐)
    game: '/audio/Bar_BGM.wav'    // 游戏内/调酒 (统一氛围音乐)
  };

  _normalizeBgmTrack(track) {
    // 全局仅保留一条 BGM：home 与 game 统一到同一轨道
    if (!track || track === 'game') return 'home';
    return track;
  }

  /**
   * 播放背景音乐
   * @param {string} track - 曲目名：'home' | 'game'，默认 'game'
   */
  playBGM(track = 'game') {
    if (this.isMuted) return;

    this._clearBgmTimers();

    track = this._normalizeBgmTrack(track);

    const src = AudioManager.BGM_TRACKS[track] || AudioManager.BGM_TRACKS.game;

    // 如果已经是同一音源，优先恢复播放而不是重建（避免从头开始）
    if (this.bgmAudio && this.bgmAudio.src.endsWith(src)) {
      this.currentBgmTrack = track;
      if (!this.bgmAudio.paused) {
        this.isBgmPlaying = true;
        return;
      }
      this.bgmAudio.play().then(() => {
        this._pendingBgmTrack = null;
        this.isBgmPlaying = true;
      }).catch(() => {
        this._pendingBgmTrack = track;
        this.isBgmPlaying = false;
        this._waitForInteraction();
      });
      return;
    }

    // 停止当前 BGM
    this.stopBGM();

    try {
      this.bgmAudio = new Audio(src);
      this.bgmAudio.loop = true;
      this.bgmAudio.volume = this.bgmVolume;
      this.currentBgmTrack = track;
      this.isBgmPlaying = false;
      this.bgmAudio.play().then(() => {
        this._pendingBgmTrack = null;
        this.isBgmPlaying = true;
        console.log(`BGM started: ${track} (${src})`);
      }).catch(() => {
        // 自动播放被阻止，等待用户首次交互后恢复
        this._pendingBgmTrack = track;
        this.isBgmPlaying = false;
        this._waitForInteraction();
      });
    } catch (e) {
      console.error('Failed to play BGM:', e);
    }
  }

  /**
   * 切换到另一首 BGM（带淡入淡出）
   */
  switchBGM(track) {
    this._clearBgmTimers();

    track = this._normalizeBgmTrack(track);

    const src = AudioManager.BGM_TRACKS[track] || AudioManager.BGM_TRACKS.game;
    if (this.bgmAudio && this.bgmAudio.src.endsWith(src)) {
      this.playBGM(track);
      return;
    }

    // 淡出当前
    if (this.bgmAudio) {
      const oldAudio = this.bgmAudio;
      this._bgmFadeOutTimer = setInterval(() => {
        if (oldAudio.volume > 0.05) {
          oldAudio.volume = Math.max(0, oldAudio.volume - 0.05);
        } else {
          if (this._bgmFadeOutTimer) {
            clearInterval(this._bgmFadeOutTimer);
            this._bgmFadeOutTimer = null;
          }
          oldAudio.pause();
          oldAudio.src = '';
        }
      }, 50);
    }

    this.bgmAudio = null;
    this.isBgmPlaying = false;

    // 延迟淡入新曲
    this._bgmSwitchTimer = setTimeout(() => {
      this._bgmSwitchTimer = null;
      this.playBGM(track);
      // 淡入
      if (this.bgmAudio) {
        this.bgmAudio.volume = 0;
        const fadeIn = setInterval(() => {
          if (this.bgmAudio && this.bgmAudio.volume < this.bgmVolume - 0.05) {
            this.bgmAudio.volume = Math.min(this.bgmVolume, this.bgmAudio.volume + 0.05);
          } else {
            clearInterval(fadeIn);
            if (this.bgmAudio) this.bgmAudio.volume = this.bgmVolume;
          }
        }, 50);
      }
    }, 600);
  }

  pauseBGM() {
    if (this.bgmAudio && !this.bgmAudio.paused) {
      this.bgmAudio.pause();
    }
    this.isBgmPlaying = false;
  }

  resumeBGM() {
    if (this.isMuted) return;
    if (this.bgmAudio && this.bgmAudio.paused) {
      this.bgmAudio.play().then(() => {
        this._pendingBgmTrack = null;
        this.isBgmPlaying = true;
      }).catch(() => {
        this._pendingBgmTrack = this.currentBgmTrack || 'game';
        this.isBgmPlaying = false;
        this._waitForInteraction();
      });
      return;
    }
    this.playBGM(this.currentBgmTrack || 'game');
  }

  // 停止背景音乐
  stopBGM() {
    this._clearBgmTimers();
    if (this.bgmAudio) {
      this.bgmAudio.pause();
      this.bgmAudio.src = '';
      this.bgmAudio = null;
    }
    this.isBgmPlaying = false;
    this.currentBgmTrack = null;
    this._pendingBgmTrack = null;
    this._wasPlayingBeforeMute = false;
  }

  // 切换背景音乐开关
  toggleBGM() {
    if (this.bgmAudio && !this.bgmAudio.paused) {
      this.pauseBGM();
      return false;
    }
    this.resumeBGM();
    return true;
  }

  // 切换背景音乐静音状态（用于 UI 的开/关按钮）
  toggleBGMMute() {
    if (this.isBgmPlaying) {
      this.stopBGM();
      return false;
    } else {
      this.playBGM(this.currentBgmTrack || 'game');
      return true;
    }
  }

  // ==================== 音效 ====================

  // 🆕 真实音效文件映射
  static SFX_FILES = {
    shake: '/audio/Cocktail_shake.mp3',
    pour:  '/audio/Liquid_pouring.mp3',
    serve: '/audio/glass_put on table#4-1770537291602.mp3',
    ice:   '/audio/ice_put.mp3',
    door:  '/audio/door_open.mp3'
  };

  // 🆕 音效缓存（避免重复创建 Audio 元素）
  _sfxCache = {};

  /**
   * 🆕 播放真实 MP3 音效文件
   * @param {string} type - 音效类型
   * @param {number} volume - 音量倍率（相对于 sfxVolume）
   */
  _playFileSFX(type, volume = 1.0) {
    const src = AudioManager.SFX_FILES[type];
    if (!src) return;

    try {
      // 每次新建 Audio 以支持重叠播放
      const audio = new Audio(src);
      audio.volume = Math.min(1, this.sfxVolume * volume);
      audio.play().catch(() => {});
    } catch (e) {
      console.warn('Failed to play sound effect:', type, e);
    }
  }

  // 播放音效
  playSFX(type) {
    if (!this.initialized) this.init();
    if (this.isMuted) return;
    
    this.resume();

    // 🆕 优先使用真实音效文件
    if (AudioManager.SFX_FILES[type]) {
      this._playFileSFX(type);
      return;
    }
    
    switch (type) {
      case 'success':
        this.playSuccessSound();
        break;
      case 'fail':
        this.playFailSound();
        break;
      case 'select':
        this.playSelectSound();
        break;
      case 'click':
        this.playClickSound();
        break;
      case 'glass':
        this.playGlassSound();
        break;
      case 'message':
        this.playMessageSound();
        break;
      case 'type':
        this.playTypeSound();
        break;
      default:
        break;
    }
  }

  // 倒酒音效
  playPourSound() {
    const ctx = this.audioContext;
    const duration = 0.8;
    
    // 使用噪音模拟液体声
    const bufferSize = ctx.sampleRate * duration;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const output = buffer.getChannelData(0);
    
    for (let i = 0; i < bufferSize; i++) {
      // 生成粉红噪音
      output[i] = (Math.random() * 2 - 1) * Math.exp(-i / bufferSize * 3);
    }
    
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 800;
    filter.Q.value = 1;
    
    const gain = ctx.createGain();
    gain.gain.value = 0.3;
    
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGainNode);
    
    source.start();
  }

  // 摇酒音效
  playShakeSound() {
    const ctx = this.audioContext;
    
    // 播放多次短促的撞击声
    for (let i = 0; i < 6; i++) {
      setTimeout(() => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        
        osc.type = 'square';
        osc.frequency.value = 200 + Math.random() * 100;
        
        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        gain.gain.exponentialDecayTo = 0.01;
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.05);
        
        osc.connect(gain);
        gain.connect(this.sfxGainNode);
        
        osc.start();
        osc.stop(ctx.currentTime + 0.05);
      }, i * 80);
    }
  }

  // 递酒音效（玻璃碰撞）
  playServeSound() {
    const ctx = this.audioContext;
    
    // 玻璃轻碰声
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1200, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 0.1);
    
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
    
    osc.connect(gain);
    gain.connect(this.sfxGainNode);
    
    osc.start();
    osc.stop(ctx.currentTime + 0.3);
  }

  // 成功音效
  playSuccessSound() {
    const ctx = this.audioContext;
    
    // 上升的和弦
    const notes = [523.25, 659.25, 783.99]; // C5, E5, G5
    
    notes.forEach((freq, i) => {
      setTimeout(() => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        
        osc.type = 'sine';
        osc.frequency.value = freq;
        
        gain.gain.setValueAtTime(0.2, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
        
        osc.connect(gain);
        gain.connect(this.sfxGainNode);
        
        osc.start();
        osc.stop(ctx.currentTime + 0.5);
      }, i * 100);
    });
  }

  // 失败音效
  playFailSound() {
    const ctx = this.audioContext;
    
    // 下降的音调
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(400, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(150, ctx.currentTime + 0.4);
    
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
    
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 1000;
    
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGainNode);
    
    osc.start();
    osc.stop(ctx.currentTime + 0.4);
  }

  // 选择音效 - 柔和的滴答声
  playSelectSound() {
    const ctx = this.audioContext;
    
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    
    osc.type = 'sine';
    osc.frequency.value = 440; // 更低的频率，听起来更舒适
    
    filter.type = 'lowpass';
    filter.frequency.value = 600;
    
    gain.gain.setValueAtTime(0.06, ctx.currentTime); // 降低音量
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.08);
    
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGainNode);
    
    osc.start();
    osc.stop(ctx.currentTime + 0.08);
  }

  // 点击音效 - 更轻柔的点击
  playClickSound() {
    const ctx = this.audioContext;
    
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    
    osc.type = 'sine';
    osc.frequency.value = 350; // 更低的频率
    
    filter.type = 'lowpass';
    filter.frequency.value = 500;
    
    gain.gain.setValueAtTime(0.04, ctx.currentTime); // 更小的音量
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.04);
    
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGainNode);
    
    osc.start();
    osc.stop(ctx.currentTime + 0.04);
  }

  // 玻璃杯选择音效
  playGlassSound() {
    const ctx = this.audioContext;
    
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(2000, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1500, ctx.currentTime + 0.15);
    
    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
    
    osc.connect(gain);
    gain.connect(this.sfxGainNode);
    
    osc.start();
    osc.stop(ctx.currentTime + 0.2);
  }

  // 消息提示音 - 更柔和的提示
  playMessageSound() {
    const ctx = this.audioContext;
    
    // 单音柔和提示
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    
    osc.type = 'sine';
    osc.frequency.value = 330; // 更低更柔和的频率
    
    filter.type = 'lowpass';
    filter.frequency.value = 500;
    
    gain.gain.setValueAtTime(0.04, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.12);
    
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGainNode);
    
    osc.start();
    osc.stop(ctx.currentTime + 0.12);
  }

  // 打字机音效 - 机械键盘咔嗒声
  playTypeSound() {
    const ctx = this.audioContext;
    if (!ctx) return;

    const now = ctx.currentTime;

    // 用短促的噪音脉冲模拟机械键盘的"咔"声
    const bufferSize = Math.floor(ctx.sampleRate * 0.025); // 25ms
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
      // 快速衰减的噪音 → 模拟撞击
      const envelope = Math.exp(-i / (bufferSize * 0.08));
      data[i] = (Math.random() * 2 - 1) * envelope;
    }

    const source = ctx.createBufferSource();
    source.buffer = buffer;

    // 带通滤波：截取中高频段 → 听起来像塑料/金属碰撞
    const bandpass = ctx.createBiquadFilter();
    bandpass.type = 'bandpass';
    bandpass.frequency.value = 3000 + Math.random() * 2000; // 3000-5000Hz 随机
    bandpass.Q.value = 1.5;

    // 高通去掉闷声
    const highpass = ctx.createBiquadFilter();
    highpass.type = 'highpass';
    highpass.frequency.value = 1500;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.7 + Math.random() * 0.3, now); // 响亮的机械键盘音
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

    source.connect(bandpass);
    bandpass.connect(highpass);
    highpass.connect(gain);
    gain.connect(this.sfxGainNode);

    source.start(now);
    source.stop(now + 0.03);
  }

  // ==================== 音量控制 ====================

  setBGMVolume(volume) {
    this.bgmVolume = Math.max(0, Math.min(1, volume));
    if (this.bgmGainNode) {
      this.bgmGainNode.gain.value = this.bgmVolume;
    }
    // 同步到 HTMLAudioElement
    if (this.bgmAudio) {
      this.bgmAudio.volume = this.bgmVolume;
    }
  }

  setSFXVolume(volume) {
    this.sfxVolume = Math.max(0, Math.min(1, volume));
    if (this.sfxGainNode) {
      this.sfxGainNode.gain.value = this.sfxVolume;
    }
  }

  setMuted(muted) {
    if (this.isMuted === muted) return;

    this.isMuted = muted;

    if (muted) {
      this._wasPlayingBeforeMute = Boolean(this.bgmAudio && !this.bgmAudio.paused);
      this.pauseBGM();
      return;
    }

    if (this._wasPlayingBeforeMute) {
      this.resumeBGM();
    }
    this._wasPlayingBeforeMute = false;
  }

  // 获取当前状态
  getState() {
    return {
      isBgmPlaying: this.isBgmPlaying,
      isMuted: this.isMuted,
      bgmVolume: this.bgmVolume,
      sfxVolume: this.sfxVolume
    };
  }
}

// 单例模式
const audioManager = new AudioManager();

export default audioManager;
