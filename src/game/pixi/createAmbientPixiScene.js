import { Application, Container, Graphics } from 'pixi.js';

const LIGHTING_THEMES = {
  warm: {
    accent: '#06ffa5',
    background: '#070b16',
    glow: '#ffb366',
    haze: '#1b2034',
    line: '#41ffd6',
  },
  cold: {
    accent: '#7fd6ff',
    background: '#050913',
    glow: '#76a8ff',
    haze: '#11192d',
    line: '#7fd6ff',
  },
  neon: {
    accent: '#ff5ab3',
    background: '#060611',
    glow: '#06ffa5',
    haze: '#190b22',
    line: '#ff4b8e',
  },
  candlelight: {
    accent: '#ffc76b',
    background: '#0b0704',
    glow: '#ffae47',
    haze: '#20110c',
    line: '#ffc76b',
  },
  dim: {
    accent: '#8a95c8',
    background: '#04060c',
    glow: '#55607e',
    haze: '#0d1220',
    line: '#7d89b6',
  },
};

const LIGHT_COLUMNS = [
  { alpha: 0.1, speed: 132, width: 1, xRatio: 0.15, yOffsetRatio: 0.0 },
  { alpha: 0.07, speed: 104, width: 1, xRatio: 0.39, yOffsetRatio: 0.44 },
  { alpha: 0.06, speed: 118, width: 1, xRatio: 0.63, yOffsetRatio: 0.71 },
];

const DEFAULT_THEME = LIGHTING_THEMES.warm;
const DARK_BASE = 0x03050a;
const WHITE = 0xffffff;

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const parseHexColor = (value) => {
  if (typeof value !== 'string') {
    return DARK_BASE;
  }

  return Number.parseInt(value.replace('#', ''), 16);
};

const mixColor = (from, to, amount) => {
  const ratio = clamp(amount, 0, 1);
  const fromRed = (from >> 16) & 0xff;
  const fromGreen = (from >> 8) & 0xff;
  const fromBlue = from & 0xff;
  const toRed = (to >> 16) & 0xff;
  const toGreen = (to >> 8) & 0xff;
  const toBlue = to & 0xff;

  const red = Math.round(fromRed + (toRed - fromRed) * ratio);
  const green = Math.round(fromGreen + (toGreen - fromGreen) * ratio);
  const blue = Math.round(fromBlue + (toBlue - fromBlue) * ratio);

  return (red << 16) | (green << 8) | blue;
};

const randomBetween = (min, max) => min + Math.random() * (max - min);

const getEffectsLevel = () => {
  return 'full';
};

const prefersReducedMotion = () => {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }

  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
};

const drawVerticalGradient = (graphics, width, height, topColor, bottomColor, steps = 22) => {
  const stepHeight = height / steps;

  for (let index = 0; index < steps; index += 1) {
    const ratio = index / Math.max(steps - 1, 1);
    const y = index * stepHeight;

    graphics
      .rect(0, y, width, Math.ceil(stepHeight) + 1)
      .fill({ alpha: 1, color: mixColor(topColor, bottomColor, ratio) });
  }
};

const drawBand = (graphics, width, yStart, yEnd, color, alpha, steps = 12) => {
  const height = Math.max(yEnd - yStart, 1);
  const stepHeight = height / steps;

  for (let index = 0; index < steps; index += 1) {
    const ratio = index / Math.max(steps - 1, 1);
    const y = yStart + index * stepHeight;
    const localAlpha = alpha * (1 - ratio) * (1 - ratio * 0.35);

    graphics
      .rect(0, y, width, Math.ceil(stepHeight) + 1)
      .fill({ alpha: localAlpha, color });
  }
};

const drawGlowOrb = (graphics, x, y, radius, color, alpha) => {
  for (let index = 4; index >= 1; index -= 1) {
    const scale = 1 + index * 0.35;
    const localAlpha = alpha / (index * 1.5);

    graphics
      .circle(x, y, radius * scale)
      .fill({ alpha: localAlpha, color });
  }
};

const drawGrid = (graphics, width, height, color, alphaScale) => {
  for (let x = 0; x <= width; x += 72) {
    graphics.rect(x, 0, 1, height).fill({ alpha: 0.048 * alphaScale, color });
  }

  for (let y = 0; y <= height; y += 72) {
    graphics.rect(0, y, width, 1).fill({ alpha: 0.032 * alphaScale, color });
  }

  for (let y = 0; y <= height; y += 6) {
    graphics.rect(0, y, width, 1).fill({ alpha: 0.008 * alphaScale, color: WHITE });
  }
};

const drawSkyline = (graphics, width, height, color) => {
  const baseColor = mixColor(color, DARK_BASE, 0.76);
  const windowColor = mixColor(color, WHITE, 0.4);
  const floorY = height;
  let cursor = -40;
  let index = 0;

  graphics
    .rect(0, height * 0.72, width, height * 0.28)
    .fill({ alpha: 0.18, color: DARK_BASE });

  while (cursor < width + 40) {
    const buildingWidth = width * [0.05, 0.08, 0.06, 0.09, 0.04, 0.07][index % 6];
    const buildingHeight = height * [0.18, 0.25, 0.14, 0.32, 0.21, 0.16][index % 6];
    const top = floorY - buildingHeight;

    graphics
      .rect(cursor, top, buildingWidth, buildingHeight)
      .fill({ alpha: 0.42, color: baseColor });

    if (index % 2 === 0) {
      const windowWidth = Math.max(buildingWidth * 0.12, 4);
      const windowHeight = Math.max(height * 0.008, 3);

      for (let row = 0; row < 4; row += 1) {
        const windowY = top + 16 + row * (windowHeight + 10);

        if (windowY + windowHeight > floorY - 8) {
          break;
        }

        graphics
          .rect(cursor + buildingWidth * 0.18, windowY, windowWidth, windowHeight)
          .fill({ alpha: 0.12, color: windowColor });

        graphics
          .rect(cursor + buildingWidth * 0.52, windowY + 4, windowWidth, windowHeight)
          .fill({ alpha: 0.08, color: windowColor });
      }
    }

    cursor += buildingWidth * 0.82;
    index += 1;
  }
};

const createLine = (container) => {
  const node = new Graphics();

  container.addChild(node);

  return {
    node,
    phase: randomBetween(0, Math.PI * 2),
    y: 0,
  };
};

const createParticleNode = (container) => {
  const node = new Graphics();

  container.addChild(node);

  return node;
};

const destroyGraphicsList = (list, container) => {
  list.forEach((item) => {
    container.removeChild(item.node);
    item.node.destroy();
  });
};

const createRainParticle = (container, width, height, color, isStorm) => {
  const node = createParticleNode(container);
  const length = randomBetween(isStorm ? 18 : 14, isStorm ? 28 : 22);
  const alpha = randomBetween(isStorm ? 0.18 : 0.12, isStorm ? 0.32 : 0.22);

  node.rect(0, 0, 1, length).fill({ alpha, color });

  return {
    drift: randomBetween(-16, -6),
    height: length,
    node,
    speed: randomBetween(isStorm ? 460 : 330, isStorm ? 640 : 470),
    width: 1,
    x: randomBetween(0, width),
    y: randomBetween(-height, height),
  };
};

const createSnowParticle = (container, width, height, color) => {
  const node = createParticleNode(container);
  const radius = randomBetween(1.2, 3);
  const alpha = randomBetween(0.18, 0.36);

  node.circle(0, 0, radius).fill({ alpha, color });

  return {
    amplitude: randomBetween(12, 28),
    node,
    phase: randomBetween(0, Math.PI * 2),
    speed: randomBetween(22, 48),
    x: randomBetween(0, width),
    y: randomBetween(-height, height),
  };
};

const createDustParticle = (container, width, height, color, alphaRange = [0.04, 0.12]) => {
  const node = createParticleNode(container);
  const radius = randomBetween(1.2, 3.6);
  const alpha = randomBetween(alphaRange[0], alphaRange[1]);

  node.circle(0, 0, radius).fill({ alpha, color });

  return {
    drift: randomBetween(-8, 12),
    node,
    phase: randomBetween(0, Math.PI * 2),
    speed: randomBetween(10, 24),
    x: randomBetween(0, width),
    y: randomBetween(0, height),
  };
};

const getTheme = (viewModel) => {
  const lighting = viewModel?.atmosphere?.lighting || 'warm';

  return LIGHTING_THEMES[lighting] || DEFAULT_THEME;
};

const createAmbientPixiScene = async ({ host, viewModel }) => {
  const app = new Application();

  await app.init({
    antialias: true,
    autoDensity: true,
    backgroundAlpha: 0,
    preference: 'webgl',
    resizeTo: host,
  });

  app.canvas.classList.add('pixi-game-canvas__canvas');
  host.replaceChildren(app.canvas);

  const staticLayer = new Graphics();
  const skylineLayer = new Graphics();
  const weatherLayer = new Container();
  const lineLayer = new Container();
  const dustLayer = new Container();
  const glowLayer = new Container();
  const stormFlashLayer = new Graphics();

  app.stage.addChild(staticLayer);
  app.stage.addChild(skylineLayer);
  app.stage.addChild(glowLayer);
  app.stage.addChild(lineLayer);
  app.stage.addChild(weatherLayer);
  app.stage.addChild(dustLayer);
  app.stage.addChild(stormFlashLayer);

  const glowNodes = [
    {
      anchorX: 0.08,
      anchorY: 0.78,
      alpha: 0.18,
      colorKey: 'haze',
      node: new Graphics(),
      phase: 0,
      pulse: 0.06,
      radius: 0.17,
    },
    {
      anchorX: 0.86,
      anchorY: 0.18,
      alpha: 0.16,
      colorKey: 'glow',
      node: new Graphics(),
      phase: Math.PI / 3,
      pulse: 0.08,
      radius: 0.14,
    },
  ];

  glowNodes.forEach(({ node }) => glowLayer.addChild(node));

  const state = {
    dustParticles: [],
    effectsLevel: getEffectsLevel(),
    lastHeight: 0,
    lighting: viewModel?.atmosphere?.lighting || 'warm',
    lastWidth: 0,
    lightningCooldown: randomBetween(3.8, 7.4),
    lightningWindow: 0,
    lines: LIGHT_COLUMNS.map(() => createLine(lineLayer)),
    motionReduced: prefersReducedMotion(),
    theme: getTheme(viewModel),
    time: 0,
    viewModel,
    weather: viewModel?.atmosphere?.weather || 'clear',
    weatherParticles: [],
  };

  const redrawStaticScene = () => {
    const { width, height } = app.screen;
    const accentColor = parseHexColor(state.theme.accent);
    const backgroundColor = parseHexColor(state.theme.background);
    const glowColor = parseHexColor(state.theme.glow);
    const lineColor = parseHexColor(state.theme.line);
    const reduced = state.effectsLevel === 'reduced' || state.motionReduced;

    staticLayer.clear();
    skylineLayer.clear();
    stormFlashLayer.clear();

    drawVerticalGradient(staticLayer, width, height, mixColor(backgroundColor, accentColor, 0.06), DARK_BASE);
    drawBand(staticLayer, width, 0, height * 0.18, accentColor, reduced ? 0.045 : 0.07);
    drawBand(staticLayer, width, height * 0.74, height, DARK_BASE, 0.3);
    drawGrid(staticLayer, width, height, lineColor, reduced ? 0.75 : 1);
    drawGlowOrb(staticLayer, width * 0.16, height * 0.16, width * 0.12, glowColor, 0.08);
    drawGlowOrb(staticLayer, width * 0.82, height * 0.14, width * 0.09, accentColor, 0.07);

    if (!reduced) {
      drawSkyline(skylineLayer, width, height, glowColor);
    }

    if (state.weather === 'foggy') {
      drawGlowOrb(staticLayer, width * 0.3, height * 0.62, width * 0.16, WHITE, 0.045);
      drawGlowOrb(staticLayer, width * 0.72, height * 0.56, width * 0.14, WHITE, 0.032);
    }

    if (state.weather === 'heatwave') {
      drawBand(staticLayer, width, 0, height * 0.22, mixColor(glowColor, 0xff8a47, 0.45), 0.08, 16);
    }

    glowNodes.forEach((glow) => {
      glow.node.clear();
      drawGlowOrb(
        glow.node,
        0,
        0,
        Math.max(width * glow.radius, 140),
        parseHexColor(state.theme[glow.colorKey]),
        glow.alpha
      );
      glow.node.x = width * glow.anchorX;
      glow.node.y = height * glow.anchorY;
    });

    state.lines.forEach((line, index) => {
      const config = LIGHT_COLUMNS[index];
      const lineHeight = height * (0.84 + index * 0.06);

      line.node.clear();
      line.node.rect(0, 0, config.width, lineHeight).fill({ alpha: config.alpha, color: lineColor });
      line.node.x = width * config.xRatio;
      line.y = -lineHeight + height * config.yOffsetRatio;
      line.node.y = line.y;
    });
  };

  const rebuildParticles = () => {
    const { width, height } = app.screen;
    const lineColor = parseHexColor(state.theme.line);
    const glowColor = parseHexColor(state.theme.glow);
    const effectsReduced = state.effectsLevel === 'reduced' || state.motionReduced;
    const weatherCount = (() => {
      if (state.weather === 'stormy') {
        return effectsReduced ? 12 : 28;
      }

      if (state.weather === 'rainy') {
        return effectsReduced ? 8 : 20;
      }

      if (state.weather === 'snowy') {
        return effectsReduced ? 6 : 16;
      }

      if (state.weather === 'foggy') {
        return effectsReduced ? 6 : 10;
      }

      return effectsReduced ? 6 : 12;
    })();

    const dustCount = effectsReduced ? 8 : 14;

    destroyGraphicsList(state.weatherParticles, weatherLayer);
    destroyGraphicsList(state.dustParticles, dustLayer);

    state.weatherParticles = Array.from({ length: weatherCount }, () => {
      if (state.weather === 'rainy' || state.weather === 'stormy') {
        return createRainParticle(
          weatherLayer,
          width,
          height,
          mixColor(lineColor, WHITE, 0.18),
          state.weather === 'stormy'
        );
      }

      if (state.weather === 'snowy') {
        return createSnowParticle(weatherLayer, width, height, mixColor(WHITE, lineColor, 0.12));
      }

      return createDustParticle(weatherLayer, width, height, mixColor(glowColor, WHITE, 0.1), [0.04, 0.1]);
    });

    state.dustParticles = Array.from({ length: dustCount }, () =>
      createDustParticle(dustLayer, width, height, mixColor(glowColor, parseHexColor(state.theme.accent), 0.4))
    );
  };

  const syncScene = (forceParticleReset = false) => {
    const nextLighting = state.viewModel?.atmosphere?.lighting || 'warm';
    const nextTheme = getTheme(state.viewModel);
    const nextWeather = state.viewModel?.atmosphere?.weather || 'clear';
    const nextEffectsLevel = getEffectsLevel();
    const nextMotionReduced = prefersReducedMotion();
    const themeChanged = nextLighting !== state.lighting;
    const weatherChanged = nextWeather !== state.weather;
    const effectsChanged = nextEffectsLevel !== state.effectsLevel;
    const motionChanged = nextMotionReduced !== state.motionReduced;

    state.lighting = nextLighting;
    state.theme = nextTheme;
    state.weather = nextWeather;
    state.effectsLevel = nextEffectsLevel;
    state.motionReduced = nextMotionReduced;

    if (forceParticleReset || themeChanged || weatherChanged || effectsChanged || motionChanged) {
      redrawStaticScene();
    }

    if (forceParticleReset || themeChanged || weatherChanged || effectsChanged || motionChanged) {
      rebuildParticles();
    }
  };

  const updateMotion = (deltaSeconds) => {
    const { width, height } = app.screen;
    const isStorm = state.weather === 'stormy';

    state.time += deltaSeconds;

    glowNodes.forEach((glow) => {
      const pulse = 1 + Math.sin(state.time * 0.6 + glow.phase) * glow.pulse;
      glow.node.scale.set(pulse);
      glow.node.alpha = 0.82 + Math.sin(state.time * 0.45 + glow.phase) * 0.08;
    });

    state.lines.forEach((line, index) => {
      const lineHeight = line.node.height || height;

      line.y += LIGHT_COLUMNS[index].speed * deltaSeconds;

      if (line.y > height + lineHeight * 0.18) {
        line.y = -lineHeight;
      }

      line.node.y = line.y;
    });

    state.weatherParticles.forEach((particle) => {
      if (state.weather === 'rainy' || state.weather === 'stormy') {
        particle.y += particle.speed * deltaSeconds;
        particle.x += particle.drift * deltaSeconds;

        if (particle.y > height + particle.height + 24 || particle.x < -24) {
          particle.x = randomBetween(0, width + 36);
          particle.y = -particle.height - randomBetween(12, 80);
        }
      } else if (state.weather === 'snowy') {
        particle.y += particle.speed * deltaSeconds;
        particle.x += Math.sin(state.time * 0.8 + particle.phase) * particle.amplitude * deltaSeconds;

        if (particle.y > height + 20) {
          particle.x = randomBetween(0, width);
          particle.y = -randomBetween(8, 60);
        }
      } else {
        particle.y += particle.speed * deltaSeconds;
        particle.x += Math.sin(state.time * 0.5 + particle.phase) * particle.drift * deltaSeconds;

        if (particle.y > height + 18) {
          particle.x = randomBetween(0, width);
          particle.y = -randomBetween(8, 40);
        }
      }

      particle.node.x = particle.x;
      particle.node.y = particle.y;
    });

    state.dustParticles.forEach((particle) => {
      particle.y += particle.speed * deltaSeconds;
      particle.x += Math.sin(state.time * 0.35 + particle.phase) * particle.drift * deltaSeconds;

      if (particle.y > height + 12) {
        particle.x = randomBetween(0, width);
        particle.y = -randomBetween(8, 28);
      }

      particle.node.x = particle.x;
      particle.node.y = particle.y;
    });

    stormFlashLayer.clear();

    if (!isStorm || state.effectsLevel !== 'full') {
      return;
    }

    if (state.lightningWindow > 0) {
      state.lightningWindow -= deltaSeconds;
    } else {
      state.lightningCooldown -= deltaSeconds;

      if (state.lightningCooldown <= 0) {
        state.lightningWindow = randomBetween(0.08, 0.18);
        state.lightningCooldown = randomBetween(3.8, 7.4);
      }
    }

    if (state.lightningWindow > 0) {
      const flashAlpha = state.lightningWindow > 0.06 ? 0.1 : 0.05;

      stormFlashLayer
        .rect(0, 0, width, height)
        .fill({ alpha: flashAlpha, color: mixColor(parseHexColor(state.theme.line), WHITE, 0.5) });
    }
  };

  const tick = (ticker) => {
    const width = app.screen.width;
    const height = app.screen.height;

    if (width !== state.lastWidth || height !== state.lastHeight) {
      state.lastWidth = width;
      state.lastHeight = height;
      syncScene(true);
    }

    if (state.motionReduced) {
      return;
    }

    updateMotion(ticker.deltaMS / 1000);
  };

  app.ticker.add(tick);
  syncScene(true);

  return {
    destroy() {
      app.ticker.remove(tick);
      destroyGraphicsList(state.weatherParticles, weatherLayer);
      destroyGraphicsList(state.dustParticles, dustLayer);
      glowNodes.forEach(({ node }) => {
        glowLayer.removeChild(node);
        node.destroy();
      });
      state.lines.forEach(({ node }) => {
        lineLayer.removeChild(node);
        node.destroy();
      });
      host.replaceChildren();
      app.destroy(undefined, { children: true });
    },
    update(nextViewModel) {
      state.viewModel = nextViewModel;
      syncScene(false);
    },
  };
};

export { createAmbientPixiScene, getEffectsLevel };
