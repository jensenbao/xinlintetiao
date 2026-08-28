import React, { useEffect, useMemo, useRef, useState } from 'react';
import './TavernEntranceScene.css';

const SPRITE_FRAMES = [
  '/asset/角色/精灵图/1.png',
  '/asset/角色/精灵图/2.png',
  '/asset/角色/精灵图/3.png'
];

const getSpriteWidth = () => {
  if (typeof window === 'undefined') return 220;
  if (window.innerWidth <= 768) return Math.min(window.innerWidth * 0.28, 190);
  return Math.min(window.innerWidth * 0.17, 220);
};

const getStartX = (spriteWidth) => -spriteWidth - 36;
const getEndX = (spriteWidth) => window.innerWidth - spriteWidth - 42;
const getSettledX = (spriteWidth) => window.innerWidth - spriteWidth - 70;
const lerp = (from, to, progress) => from + (to - from) * progress;

const TavernEntranceScene = ({
  onAnimationComplete = null,
  walkDuration = 3200,
  settleDuration = 600,
  frameDuration = 180,
  autoStart = true,
  holdDuration = 2000,
  fadeDuration = 1400
}) => {
  const wrapperRef = useRef(null);
  const animationFrameRef = useRef(0);
  const holdTimeoutRef = useRef(0);
  const [frameIndex, setFrameIndex] = useState(0);
  const [phase, setPhase] = useState('waiting');
  const [spriteWidth, setSpriteWidth] = useState(() => getSpriteWidth());
  const [fadeProgress, setFadeProgress] = useState(0);

  const applyPosition = (x) => {
    if (!wrapperRef.current) return;
    wrapperRef.current.style.transform = `translate3d(${x}px, 0, 0)`;
  };

  useEffect(() => {
    applyPosition(getStartX(spriteWidth));
  }, [spriteWidth]);

  useEffect(() => {
    const handleResize = () => {
      const nextWidth = getSpriteWidth();
      setSpriteWidth(nextWidth);
      if (phase === 'waiting') applyPosition(getStartX(nextWidth));
      if (phase === 'done' || phase === 'fading') applyPosition(getSettledX(nextWidth));
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [phase]);

  useEffect(() => {
    if (!autoStart || phase !== 'waiting') return;
    setFrameIndex(0);
    applyPosition(getStartX(spriteWidth));
    setPhase('walking');
  }, [autoStart, phase, spriteWidth]);

  useEffect(() => {
    if (phase !== 'walking') return undefined;

    const frameTimer = window.setInterval(() => {
      setFrameIndex((prev) => (prev + 1) % SPRITE_FRAMES.length);
    }, frameDuration);
    let frameStopped = false;

    const startX = getStartX(spriteWidth);
    const endX = getEndX(spriteWidth);
    const settledX = getSettledX(spriteWidth);
    const startedAt = performance.now();

    const tick = (now) => {
      const elapsed = now - startedAt;

      if (elapsed <= walkDuration) {
        applyPosition(lerp(startX, endX, elapsed / walkDuration));
        animationFrameRef.current = window.requestAnimationFrame(tick);
        return;
      }

      if (!frameStopped) {
        frameStopped = true;
        window.clearInterval(frameTimer);
        setFrameIndex(0);
      }

      if (elapsed <= walkDuration + settleDuration) {
        applyPosition(lerp(endX, settledX, (elapsed - walkDuration) / settleDuration));
        animationFrameRef.current = window.requestAnimationFrame(tick);
        return;
      }

      applyPosition(settledX);
      setPhase('done');
    };

    applyPosition(startX);
    animationFrameRef.current = window.requestAnimationFrame(tick);

    return () => {
      window.clearInterval(frameTimer);
      window.cancelAnimationFrame(animationFrameRef.current);
    };
  }, [frameDuration, phase, settleDuration, spriteWidth, walkDuration]);

  useEffect(() => {
    if (phase !== 'done') return undefined;

    holdTimeoutRef.current = window.setTimeout(() => {
      setFadeProgress(0);
      setPhase('fading');
    }, holdDuration);

    return () => window.clearTimeout(holdTimeoutRef.current);
  }, [holdDuration, phase]);

  useEffect(() => {
    if (phase !== 'fading') return undefined;

    const startedAt = performance.now();

    const tick = (now) => {
      const elapsed = now - startedAt;
      const progress = Math.min(1, elapsed / fadeDuration);
      setFadeProgress(progress);

      if (progress < 1) {
        animationFrameRef.current = window.requestAnimationFrame(tick);
        return;
      }

      onAnimationComplete?.();
    };

    animationFrameRef.current = window.requestAnimationFrame(tick);

    return () => {
      window.cancelAnimationFrame(animationFrameRef.current);
    };
  }, [fadeDuration, onAnimationComplete, phase]);

  const spriteSrc = useMemo(() => SPRITE_FRAMES[frameIndex], [frameIndex]);

  const handleSceneClick = () => {
    if (phase !== 'waiting') return;
    setFrameIndex(0);
    applyPosition(getStartX(spriteWidth));
    setPhase('walking');
  };

  const sceneOpacity = phase === 'fading' ? 1 - fadeProgress : 1;
  const sceneBrightness = phase === 'fading' ? 1 - fadeProgress * 0.82 : 1;
  const overlayOpacity = phase === 'fading' ? fadeProgress : 0;

  return (
    <div
      className="tavern-entrance-scene"
      role="dialog"
      aria-label="Tavern entrance scene"
      onClick={handleSceneClick}
    >
      <div
        className="tavern-scene-content"
        style={{
          opacity: sceneOpacity,
          filter: `brightness(${sceneBrightness})`
        }}
      >
        <div className="tavern-background" aria-hidden="true">
          <div className="tavern-bg-main" />
          <div className="tavern-bg-foreground" />
        </div>

        <div
          ref={wrapperRef}
          className={`character-entrance-wrapper ${phase}`}
          style={{ width: `${spriteWidth}px` }}
        >
          <img
            className="character-sprite"
            src={spriteSrc}
            alt=""
            draggable={false}
          />
        </div>

        <div className="entrance-hint-text">
          <span>
            {phase === 'waiting'
              ? (autoStart ? 'Entering the tavern...' : 'Click to enter the tavern')
              : phase === 'done'
                ? '...'
                : 'Entering the tavern...'}
          </span>
        </div>
      </div>

      <div
        className="tavern-fade-overlay"
        style={{ opacity: overlayOpacity }}
        aria-hidden="true"
      />
    </div>
  );
};

export default TavernEntranceScene;
