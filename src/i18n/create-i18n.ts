import type { Site } from '../site';

/**
 * The i18n core every site shares: one dictionary per locale, all with the shape of the default
 * locale's, and the helpers pages and layouts call. The dictionaries (the copy) stay in the site.
 */
export function createI18n<L extends string, T extends object>(
  site: Site<L>,
  dictionaries: { [K in L]: T },
) {
  return {
    SUPPORTED_LANGS: site.locales,
    DEFAULT_LOCALE: site.defaultLocale,
    getLangFromPath: site.getLangFromPath,
    useTranslations: (lang: L): T => dictionaries[lang],
  };
}
