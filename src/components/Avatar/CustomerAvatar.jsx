// 顾客头像组件 - 图片优先 + emoji 降级 + 异步监听
import React, { useState, useEffect } from 'react';
import './CustomerAvatar.css';

/**
 * 顾客头像组件
 * @param {Object} props
 * @param {string|null} props.avatarBase64 - base64 图片数据
 * @param {string} props.emoji - 降级用 emoji
 * @param {number} props.size - 尺寸（px），默认 48
 * @param {string} props.customerId - 顾客 ID（用于监听异步生成完成事件）
 * @param {string} props.className - 额外 CSS 类名
 */
const CustomerAvatar = ({ avatarBase64, emoji = '👤', size = 48, customerId, className = '' }) => {
  const [imageSrc, setImageSrc] = useState(avatarBase64);
  const resolvedSrc = imageSrc
    ? (String(imageSrc).startsWith('data:') ? imageSrc : `data:image/png;base64,${imageSrc}`)
    : null;

  // 挂载时：如果没有 avatarBase64 但有 customerId，主动从 IndexedDB 缓存加载
  useEffect(() => {
    if (imageSrc || !customerId) return;

    import('../../utils/avatarCache.js').then(({ getAvatarFromCache }) => {
      getAvatarFromCache(customerId).then(data => {
        if (data) setImageSrc(data);
      });
    }).catch(() => {});
  }, [customerId]); // 只在 customerId 变化时查一次

  // 监听异步头像生成完成事件（头像正在后台生成中的场景）
  useEffect(() => {
    if (imageSrc) return;

    const handleAvatarReady = (e) => {
      if (e.detail.customerId === customerId) {
        import('../../utils/avatarCache.js').then(({ getAvatarFromCache }) => {
          getAvatarFromCache(customerId).then(data => {
            if (data) setImageSrc(data);
          });
        });
      }
    };

    window.addEventListener('avatar-ready', handleAvatarReady);
    return () => window.removeEventListener('avatar-ready', handleAvatarReady);
  }, [customerId, imageSrc]);

  // avatarBase64 prop 变化时更新
  useEffect(() => {
    if (avatarBase64) setImageSrc(avatarBase64);
  }, [avatarBase64]);

  if (resolvedSrc) {
    return (
      <div
        className={`customer-avatar-img has-image ${className}`}
        style={{ width: size, height: size }}
      >
        <img
          src={resolvedSrc}
          onError={() => setImageSrc(null)}
          alt="customer avatar"
          width={size}
          height={size}
          loading="lazy"
        />
      </div>
    );
  }

  // 降级：emoji
  return (
    <div
      className={`customer-avatar-img emoji-fallback ${className}`}
      style={{ width: size, height: size, fontSize: size * 0.6 }}
    >
      {emoji}
    </div>
  );
};

export default CustomerAvatar;
