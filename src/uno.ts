import { createRequire } from 'node:module';
import { defineConfig, presetIcons, presetWind4 } from 'unocss';

const require = createRequire(import.meta.url);
const collection = (name: string) => () => require(`@iconify-json/${name}/icons.json`);

export interface SxnnysideUnoOptions {
  /** Extra always-generated classes, in addition to `sr-only`. */
  safelist?: readonly string[];
}

/**
 * UnoCSS for layout utilities and icons only. Design tokens (colors, spacing, type) belong in
 * `src/styles/tokens.css` as CSS custom properties, never in `theme`.
 */
export function sxnnysideUno(options: SxnnysideUnoOptions = {}): ReturnType<typeof defineConfig> {
  return defineConfig({
    presets: [
      presetWind4(),
      presetIcons({
        scale: 1.2,
        warn: true,
        collections: {
          mingcute: collection('mingcute'),
          tabler: collection('tabler'),
          mdi: collection('mdi'),
        },
      }),
    ],
    theme: {},
    safelist: ['sr-only', ...(options.safelist ?? [])],
  });
}
