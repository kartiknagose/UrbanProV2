// Minimal i18n stub: attach a locale based on Accept-Language header
module.exports = (req, _res, next) => {
  const header = String(req.headers['accept-language'] || 'en').slice(0, 100);
  const candidate = header.split(',')[0].trim().toLowerCase();
  const baseLocale = candidate.split('-')[0];
  const supportedLocales = new Set(['en', 'hi', 'mr']);

  req.locale = supportedLocales.has(baseLocale) ? baseLocale : 'en';
  next();
};