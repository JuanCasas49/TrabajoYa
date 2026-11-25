// Cada instancia del API es una "región" (celda) autónoma: un país, su moneda, su idioma y su base de datos.
export const REGIONS = {
  CO: { code: 'CO', name: 'Colombia',      flag: '🇨🇴', currency: 'COP', lang: 'es', locale: 'es-CO', tz: 'America/Bogota' },
  US: { code: 'US', name: 'United States', flag: '🇺🇸', currency: 'USD', lang: 'en', locale: 'en-US', tz: 'America/New_York' },
  BR: { code: 'BR', name: 'Brasil',        flag: '🇧🇷', currency: 'BRL', lang: 'pt', locale: 'pt-BR', tz: 'America/Sao_Paulo' },
  FR: { code: 'FR', name: 'France',        flag: '🇫🇷', currency: 'EUR', lang: 'fr', locale: 'fr-FR', tz: 'Europe/Paris' },
  DE: { code: 'DE', name: 'Deutschland',   flag: '🇩🇪', currency: 'EUR', lang: 'de', locale: 'de-DE', tz: 'Europe/Berlin' },
};

export const REGION = REGIONS[(process.env.REGION || '').toUpperCase()];
if (!REGION) throw new Error(`Falta REGION en .env (una de: ${Object.keys(REGIONS).join(', ')})`);
