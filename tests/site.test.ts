import { describe, expect, test } from 'bun:test';
import { createI18n } from '../src/i18n';
import { defineSite } from '../src/site';

const site = defineSite({
  origin: 'https://www.example.com/',
  locales: { es: 'es-MX', en: 'en-US' },
  defaultLocale: 'es',
});

describe('defineSite: the URL contract', () => {
  test('directory routes are canonical with a trailing slash, flat errors without', () => {
    expect(site.canonicalPath('/es/about')).toBe('/es/about/');
    expect(site.canonicalPath('/es/about/')).toBe('/es/about/');
    expect(site.canonicalPath('/404/')).toBe('/404');
    expect(site.canonicalPath('/500')).toBe('/500');
    expect(site.canonicalPath('/robots.txt')).toBe('/robots.txt');
    expect(site.canonicalPath('es/about#team')).toBe('/es/about/#team');
  });

  test('the origin loses its trailing slash and prefixes every URL', () => {
    expect(site.origin).toBe('https://www.example.com');
    expect(site.canonicalUrl('/es/about')).toBe('https://www.example.com/es/about/');
    expect(site.canonicalUrl('/404/')).toBe('https://www.example.com/404');
  });

  test('splits and swaps locales', () => {
    expect(site.splitLocale('/en/realms/x')).toEqual({ locale: 'en', rest: '/realms/x' });
    expect(site.splitLocale('/404')).toEqual({ locale: null, rest: '/404' });
    expect(site.localizedUrl('en', '/es/realms/x/')).toBe('https://www.example.com/en/realms/x/');
    expect(site.localizedUrl('en', '/es')).toBe('https://www.example.com/en/');
    expect(site.localizedUrl('en', '/404')).toBe('https://www.example.com/404');
  });

  test('hreflang alternates cover every locale and x-default is the default locale', () => {
    expect(site.alternatesFor('/en/about')).toEqual({
      es: 'https://www.example.com/es/about/',
      en: 'https://www.example.com/en/about/',
      xDefault: 'https://www.example.com/es/about/',
    });
  });

  test('the locale comes from the first path segment, never from a prefix of it', () => {
    expect(site.getLangFromPath('/en/about/')).toBe('en');
    expect(site.getLangFromPath('/entry/')).toBe('es');
    expect(site.getLangFromPath('/')).toBe('es');
  });

  test('root redirect keeps the trailing slash; static paths use the `locale` param', () => {
    expect(site.rootRedirect).toBe('/es/');
    expect(site.localeStaticPaths()).toEqual([
      { params: { locale: 'es' } },
      { params: { locale: 'en' } },
    ]);
  });
});

describe('createI18n', () => {
  const es = { hello: 'hola' };
  const en = { hello: 'hello' };
  const i18n = createI18n(site, { es, en });
  test('returns the dictionary of the locale and shares the site locales', () => {
    expect(i18n.useTranslations('en').hello).toBe('hello');
    expect(i18n.SUPPORTED_LANGS).toEqual(['es', 'en']);
    expect(i18n.DEFAULT_LOCALE).toBe('es');
    expect(i18n.getLangFromPath('/en/x/')).toBe('en');
  });
});
