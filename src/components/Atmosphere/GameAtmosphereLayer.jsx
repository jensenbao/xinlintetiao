/**
 * 游戏页面动态氛围层
 * 纯视觉装饰，不参与任何游戏逻辑
 * 根据天气和灯光数据渲染对应的粒子和光效
 */
import React, { useMemo } from 'react';
import './GameAtmosphereLayer.css';

const GameAtmosphereLayer = ({ weather = 'clear', lighting = 'warm' }) => {
  const isRain = ['rainy', 'stormy'].includes(weather);
  const isSnow = weather === 'snowy';
  const isFog = weather === 'foggy';
  const isStorm = weather === 'stormy';
  const isHeat = weather === 'heatwave';
  const isReduced = false;

  const aircraftPositions = useMemo(
    () =>
      Array.from({ length: 3 }).map((_, i) => ({
        delay: i * 7,
        top: 12 + Math.random() * 18,
      })),
    []
  );

  return (
    <div className={`game-atmosphere-layer lighting-${lighting}`}>
      <div className="game-scanlines" />

      <div className="game-neon-lines">
        <div className="game-neon-line" />
        <div className="game-neon-line" />
        <div className="game-neon-line" />
      </div>

      <div className="game-glow-orbs">
        <div className="game-glow game-glow-1" />
        <div className="game-glow game-glow-2" />
      </div>

      {!isReduced && (
        <div className="city-silhouette-layer">
          <div className="city-skyline" />

          {aircraftPositions.map((pos, i) => (
            <div
              key={`aircraft-${i}`}
              className="aircraft-light"
              style={{
                animationDelay: `${pos.delay}s`,
                top: `${pos.top}%`,
              }}
            />
          ))}

          <div className="distant-neon-glow" />
        </div>
      )}

      {!isReduced && (
        <>
          {isRain && (
            <div className={`game-rain ${isStorm ? 'heavy' : ''}`}>
              {Array.from({ length: isStorm ? 35 : 20 }).map((_, i) => (
                <div
                  key={`rain-${i}`}
                  className="game-raindrop"
                  style={{
                    left: `${Math.random() * 100}%`,
                    animationDuration: `${0.6 + Math.random() * 0.5}s`,
                    animationDelay: `${Math.random() * 2}s`,
                    opacity: 0.08 + Math.random() * 0.12,
                  }}
                />
              ))}
            </div>
          )}

          {isSnow && (
            <div className="game-snow">
              {Array.from({ length: 15 }).map((_, i) => (
                <div
                  key={`snow-${i}`}
                  className="game-snowflake"
                  style={{
                    left: `${Math.random() * 100}%`,
                    animationDuration: `${4 + Math.random() * 5}s`,
                    animationDelay: `${Math.random() * 3}s`,
                    opacity: 0.06 + Math.random() * 0.1,
                    width: `${2 + Math.random() * 3}px`,
                    height: `${2 + Math.random() * 3}px`,
                  }}
                />
              ))}
            </div>
          )}

          {isFog && <div className="game-fog" />}
          {isStorm && <div className="game-lightning" />}
          {isHeat && <div className="game-heatwave" />}
        </>
      )}
    </div>
  );
};

export default GameAtmosphereLayer;
