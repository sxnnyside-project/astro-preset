# @sxnnyside/astro-preset

![Banner](astro-preset-banner.png)

![Version](https://img.shields.io/badge/version-0.2.0-blue)
![License](https://img.shields.io/badge/License-SPUL-yellow)

<p align="center">
  <strong>Shared Config ✦ Strict Standards ✦ Zero Drift</strong><br>
  <em>Shared configuration, strict bases, and core utilities for Sxnnyside Astro sites.</em>
</p>

<p align="center">
  <a href="#about">About</a> ✦
  <a href="#features">Features</a> ✦
  <a href="#installation">Installation</a> ✦
  <a href="#usage">Usage</a> ✦
  <a href="#architecture">Architecture</a>
</p>

---

## About

**astro-preset** is the foundational preset package providing shared configuration, tooling bases, and core runtime utilities for Sxnnyside Astro sites.

Instead of maintaining diverging copies across repositories, sites import canonical configurations and runtime helpers directly. It ensures unified behavior for Astro configuration, UnoCSS rules, security headers, URL contracts, an asset pipeline, and automated site scaffolding.

### Philosophy

> _"Shared conventions belong in a versioned dependency, while creative tokens, copy, and UI identities remain with each individual site."_

This is an official Sxnnyside Project.

## Features

- **Canonical Astro Config**: Preconfigured Astro settings with strict trailing slashes, sitemap policies, HTML compression, and external script chunking.
- **UnoCSS & Icons**: Standard `presetWind4` with MingCute, Tabler, and MDI icon support out of the box.
- **Security Headers**: Generates strict CSP policies and immutable caching headers for `public/_headers`.
- **URL & i18n Contract**: Canonical URLs, localized routing, static path resolution, and SEO head generation (`<SeoHead />`).
- **Asset Pipeline**: High-performance image downloading, resizing, responsive picture generation, and persistent caching.
- **Scaffolding CLI**: Built-in CLI (`sxnnyside-astro-check init` and `csp`) for site generation and CSP verification.

## Installation

### Prerequisites

- Bun (`>= 1.4.0`)
- Node.js (`>= 22`)
- Astro (`^7.3.0`)

### From Source

```bash
git clone https://github.com/sxnnyside-project/astro-preset.git
cd astro-preset
bun install
bun run build
```

### In an Astro Site

Distributed as a GitHub Release asset (a `.tgz`), pinned to an exact version:

```jsonc
// package.json
"dependencies": {
  "@sxnnyside/astro-preset": "https://github.com/sxnnyside-project/astro-preset/releases/download/v0.2.0/sxnnyside-astro-preset-0.2.0.tgz",
  "astro": "7.3.5"
}
```

## Usage

```ts
// astro.config.ts
import { sxnnysideAstro } from "@sxnnyside/astro-preset";
import { createAssetPipeline } from "@sxnnyside/astro-preset/asset-pipeline";

export default sxnnysideAstro({
  site: "https://example.sxnnysideproject.com",
  defaultLocale: "en",
  locales: { en: "en-US", es: "es-MX" },
  toml: true,
  sitemap: {
    rules: [
      {
        equals: ["https://example.sxnnysideproject.com/en"],
        changefreq: "weekly",
        priority: 1,
      },
      { includes: ["/about"], changefreq: "monthly", priority: 0.7 },
    ],
    fallback: { changefreq: "monthly", priority: 0.5 },
  },
});
```

```bash
# Verify CSP contract compliance
bunx sxnnyside-astro-check csp

# Scaffold a new standard site
bunx sxnnyside-astro-check init docs-website --name docs-website --origin https://docs.sxnnysideproject.com --locales es,en
```

## Architecture

```
astro-preset/
├── src/          # Preset source (config, uno, headers, site, i18n, asset pipeline, cli)
├── templates/    # Standard template scaffolding files used by sxnnyside-astro-check init
└── tests/        # Unit and integration test suite
```

## License

This project is licensed under the SPUL — see the [LICENSE](LICENSE) file for details.

---

<p align="center">
  <strong>astro-preset</strong> — A Sxnnyside Project<br>
  <em>&copy; 2026 Sxnnyside Project</em>
</p>
