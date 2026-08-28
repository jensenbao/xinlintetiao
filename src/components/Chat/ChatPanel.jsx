import React, { useEffect, useRef, useState } from 'react';
import CustomerAvatar from '../Avatar/CustomerAvatar.jsx';
import BalancedPixelText from '../Common/BalancedPixelText.jsx';
import { useTTS } from '../../hooks/useTTS.js';
import './ChatPanel.css';

const BARTENDER_AVATAR_SRC = '/asset/角色/调酒师头像.png';

const TYPEWRITER_INTERVAL_MS = 22;

const TypewriterMessageText = ({ messageId, text }) => {
  const fullText = String(text || '');
  const [visibleLength, setVisibleLength] = useState(0);

  useEffect(() => {
    setVisibleLength(0);
  }, [messageId]);

  useEffect(() => {
    if (!fullText) {
      setVisibleLength(0);
      return undefined;
    }

    if (visibleLength >= fullText.length) {
      return undefined;
    }

    const timer = window.setInterval(() => {
      setVisibleLength((prev) => {
        if (prev >= fullText.length) {
          return prev;
        }
        return Math.min(prev + 1, fullText.length);
      });
    }, TYPEWRITER_INTERVAL_MS);

    return () => window.clearInterval(timer);
  }, [fullText, visibleLength]);

  return <BalancedPixelText text={fullText.slice(0, visibleLength)} />;
};

const ChatMessage = ({ aiConfig, msg, renderMessageContent, enableTypewriter = false }) => (
  <div className={`message ${msg.role === 'player' ? 'player-message' : 'ai-message'}`}>
    <div className="message-avatar">
      {msg.role === 'player' ? (
        <img
          src={BARTENDER_AVATAR_SRC}
          alt="Bartender avatar"
          className="player-avatar-image"
          loading="eager"
        />
      ) : (
        <CustomerAvatar
          avatarBase64={aiConfig.avatarBase64}
          emoji={aiConfig.avatar}
          size={36}
          customerId={aiConfig.id || aiConfig.avatarCacheKey}
          className="chat-message-avatar-image"
        />
      )}
    </div>
    <div className="message-bubble">
      {renderMessageContent(msg, enableTypewriter)}
      {!msg.isThinking && (
        <span className="message-time">
          {new Date(msg.timestamp).toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit'
          })}
        </span>
      )}
    </div>
  </div>
);

const ChatPanel = ({
  aiConfig,
  dialogueHistory,
  onSendMessage,
  quickOptions = [],
  isLoading = false,
  trustLevel = 0
}) => {
  const [inputValue, setInputValue] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(null);
  const [trustAnim, setTrustAnim] = useState('');
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const chatEndRef = useRef(null);
  const inputRef = useRef(null);
  const lastSpokenSignature = useRef('');
  const speakTimerRef = useRef(null);
  const { speak, stopTTS } = useTTS();
  const personalityTraits = Array.isArray(aiConfig?.personality) ? aiConfig.personality : [];
  const previewTraits = personalityTraits.slice(0, 2);

  useEffect(() => {
    if (!Array.isArray(dialogueHistory) || dialogueHistory.length === 0) {
      return;
    }

    const lastMsg = dialogueHistory[dialogueHistory.length - 1];
    if (lastMsg.role !== 'ai' || lastMsg.isThinking) {
      return;
    }

    const content = String(lastMsg.content || '').trim();
    if (!content || content === '...' || content === '鈥︹€?') {
      return;
    }

    const signature = `${String(lastMsg.id || 'no-id')}::${content}`;
    if (signature === lastSpokenSignature.current) {
      return;
    }

    if (speakTimerRef.current) {
      window.clearTimeout(speakTimerRef.current);
    }

    speakTimerRef.current = window.setTimeout(() => {
      if (isLoading || signature === lastSpokenSignature.current) {
        return;
      }

      lastSpokenSignature.current = signature;
      speak(content, aiConfig);
    }, 450);
  }, [dialogueHistory, aiConfig, speak, isLoading]);

  useEffect(() => () => {
    if (speakTimerRef.current) {
      window.clearTimeout(speakTimerRef.current);
    }
    stopTTS();
  }, [stopTTS]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [dialogueHistory, isLoading, showHistoryModal]);

  useEffect(() => {
    if (!showHistoryModal) {
      return undefined;
    }

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setShowHistoryModal(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showHistoryModal]);

  const handleSend = () => {
    if (!inputValue.trim()) {
      return;
    }

    onSendMessage(inputValue.trim(), 'custom');
    setInputValue('');
    inputRef.current?.focus();
  };

  const handleQuickOption = (option, index) => {
    onSendMessage(option, 'quick');
    setHighlightedIndex(index);
    setTimeout(() => setHighlightedIndex(null), 300);
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const renderMessageContent = (msg, enableTypewriter = false) => {
    if (msg?.isThinking) {
      return <span className="thinking-ellipsis" aria-label="Thinking">……</span>;
    }

    if (enableTypewriter) {
      return <TypewriterMessageText messageId={msg?.id} text={msg?.content} />;
    }

    return <BalancedPixelText text={msg?.content} />;
  };

  const latestPlayerMessage = [...dialogueHistory].reverse().find((msg) => msg.role === 'player');
  const latestAiMessage = [...dialogueHistory].reverse().find((msg) => msg.role === 'ai');
  const stageAiMessage = isLoading
    ? {
        id: 'stage-ai-loading',
        role: 'ai',
        content: '',
        isThinking: true,
        timestamp: Date.now()
      }
    : latestAiMessage;

  return (
    <div className="chat-panel">
      <div className="chat-header">
        <div className="chat-header__identity">
          <div className="ai-avatar">
            <CustomerAvatar
              avatarBase64={aiConfig.avatarBase64}
              emoji={aiConfig.avatar}
              size={48}
              customerId={aiConfig.id || aiConfig.avatarCacheKey}
            />
          </div>
          <div className="ai-info">
            <h3>{aiConfig.name}</h3>
            <div className="ai-personality">
              {previewTraits.map((trait, i) => (
                <span key={i} className="trait-tag">{trait}</span>
              ))}
              {personalityTraits.length > previewTraits.length && (
                <span className="trait-tag trait-tag--more">+{personalityTraits.length - previewTraits.length}</span>
              )}
            </div>
          </div>
        </div>

        <div className="chat-header__actions">
          <div className="trust-indicator">
            <span className="trust-label">Trust</span>
            <div className="trust-bar">
              <div
                className={`trust-fill ${trustAnim}`}
                style={{
                  width: `${trustLevel * 100}%`,
                  backgroundColor: trustLevel < 0.3 ? '#E63946' : trustLevel < 0.6 ? '#FFB703' : '#A855F7'
                }}
              />
            </div>
            <span className="trust-value">{Math.round(trustLevel * 100)}%</span>
          </div>

          <button
            type="button"
            className="chat-profile-btn"
            onClick={() => setShowProfileModal(true)}
          >
            Profile
          </button>

          <button
            type="button"
            className="chat-history-btn"
            onClick={() => setShowHistoryModal(true)}
          >
            Chat History
          </button>
        </div>
      </div>

      <div className="chat-stage">
        <div className="chat-stage__messages">
          {!latestPlayerMessage && !stageAiMessage && (
            <div className="welcome-message">
              <p>Welcome to Resonant Sips</p>
              <p className="subtitle">Learn your guest's true emotions through dialogue, then craft a signature cocktail for them.</p>
            </div>
          )}

          {stageAiMessage && (
            <ChatMessage
              key={stageAiMessage.id || 'stage-ai'}
              aiConfig={aiConfig}
              msg={stageAiMessage}
              renderMessageContent={renderMessageContent}
              enableTypewriter={true}
            />
          )}

          {latestPlayerMessage && (
            <ChatMessage
              key={latestPlayerMessage.id || 'stage-player'}
              aiConfig={aiConfig}
              msg={latestPlayerMessage}
              renderMessageContent={renderMessageContent}
              enableTypewriter={true}
            />
          )}

          <div ref={chatEndRef} />
        </div>
      </div>

      <div className="chat-composer">
        {quickOptions.length > 0 && (
          <div className="quick-options chat-composer__quick-options">
            {quickOptions.map((option, index) => (
              <button
                key={index}
                className={`quick-option ${highlightedIndex === index ? 'active' : ''} ${option === '……' ? 'silence' : ''}`}
                onClick={() => handleQuickOption(option, index)}
                disabled={isLoading}
              >
                {option}
              </button>
            ))}
          </div>
        )}

        <div className="chat-input-container">
          <textarea
            ref={inputRef}
            className="chat-input"
            placeholder="Type your reply... (Enter to send, Shift+Enter for newline)"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyPress={handleKeyPress}
            disabled={isLoading}
            rows={2}
          />
          <button
            className="send-button"
            onClick={handleSend}
            disabled={isLoading || !inputValue.trim()}
          >
            Send
          </button>
        </div>
      </div>

      {showHistoryModal && (
        <div className="chat-history-modal" onClick={() => setShowHistoryModal(false)}>
          <div className="chat-history-modal__panel" onClick={(event) => event.stopPropagation()}>
            <div className="chat-history-modal__header">
              <div className="chat-history-modal__title">Chat History</div>
              <button
                type="button"
                className="chat-history-modal__close"
                onClick={() => setShowHistoryModal(false)}
              >
                Close
              </button>
            </div>

            <div className="chat-history-modal__list">
              {dialogueHistory.length === 0 && (
                <div className="welcome-message">
                  <p>No chat history yet</p>
                  <p className="subtitle">Once you start chatting, full message history will appear here.</p>
                </div>
              )}

              {dialogueHistory.map((msg, index) => (
                <ChatMessage
                  key={`history-msg-${msg.id || index}`}
                  aiConfig={aiConfig}
                  msg={msg}
                  renderMessageContent={renderMessageContent}
                  enableTypewriter={false}
                />
              ))}
            </div>

          </div>
        </div>
      )}

      {showProfileModal && (
        <div className="chat-history-modal" onClick={() => setShowProfileModal(false)}>
          <div className="chat-history-modal__panel chat-profile-modal__panel" onClick={(event) => event.stopPropagation()}>
            <div className="chat-history-modal__header">
              <div className="chat-history-modal__title">Profile</div>
              <button
                type="button"
                className="chat-history-modal__close"
                onClick={() => setShowProfileModal(false)}
              >
                Close
              </button>
            </div>

            <div className="chat-history-modal__list chat-profile-modal__list">
              <div className="chat-profile-modal__section">
                <div className="chat-profile-modal__label">Name</div>
                <div className="chat-profile-modal__value">{aiConfig?.name || 'Unknown Guest'}</div>
              </div>

              {personalityTraits.length > 0 && (
                <div className="chat-profile-modal__section">
                  <div className="chat-profile-modal__label">Personality</div>
                  <div className="chat-profile-modal__traits">
                    {personalityTraits.map((trait, index) => (
                      <span key={`profile-trait-${index}`} className="trait-tag">{trait}</span>
                    ))}
                  </div>
                </div>
              )}

              {aiConfig?.dialogueStyle?.tone && (
                <div className="chat-profile-modal__section">
                  <div className="chat-profile-modal__label">Tone</div>
                  <div className="chat-profile-modal__value">{aiConfig.dialogueStyle.tone}</div>
                </div>
              )}
            </div>

          </div>
        </div>
      )}
    </div>
  );
};

export default ChatPanel;
