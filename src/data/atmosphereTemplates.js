import atmosphereTemplatesData from './atmosphereTemplates.json';

export const WEATHER_ICONS = atmosphereTemplatesData.weatherIcons;
export const WEATHER_NAMES = atmosphereTemplatesData.weatherNames;
export const MUSIC_ICONS = atmosphereTemplatesData.musicIcons;
export const MUSIC_NAMES = atmosphereTemplatesData.musicNames;
export const LIGHTING_ICONS = atmosphereTemplatesData.lightingIcons;
export const LIGHTING_NAMES = atmosphereTemplatesData.lightingNames;
export const CROWD_NAMES = atmosphereTemplatesData.crowdNames;
export const CROWD_ICONS = atmosphereTemplatesData.crowdIcons;
export const FALLBACK_ATMOSPHERES = atmosphereTemplatesData.fallbackAtmospheres;

export const getFallbackAtmosphere = (day, recentAtmospheres = []) => {
  const recentWeathers = recentAtmospheres.map((atmosphere) => atmosphere.weather);
  let available = FALLBACK_ATMOSPHERES.filter(
    (atmosphere) => !recentWeathers.includes(atmosphere.weather)
  );

  if (available.length === 0) {
    available = FALLBACK_ATMOSPHERES;
  }

  const index = day % available.length;
  return { ...available[index] };
};
