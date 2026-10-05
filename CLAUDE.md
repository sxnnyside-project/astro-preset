# astro-preset

`@sxnnyside/astro-preset`: shared configuration and code for Sxnnyside Astro sites, distributed as a **GitHub Release asset** (a `.tgz`), never through a registry. TypeScript on Bun.

## Commands
`just` is the interface; `just check` is the gate (format-check, lint, typecheck, test) and runs on pre-commit and in CI.

| Command | What it does |
|---|---|
| `just install` | `bun install --frozen-lockfile` (also installs the Git hooks through Husky) |
| `just check` | The non-mutating gate |
| `just build` | Bundles `dist/` (JS entries, the `bun` CLI, declarations) |
| `just package` | Builds and packs `dist/release/sxnnyside-astro-preset-<version>.tgz` |

## Where things go
| Kind | Location |
|---|---|
| Astro config, sitemap policy, merge | `src/config.ts`, `src/sitemap.ts`, `src/merge.ts` |
| URL contract, i18n core | `src/site/`, `src/i18n/` |
| UnoCSS, security headers, env loader | `src/uno.ts`, `src/headers.ts`, `src/env.ts` |
| Asset pipeline | `src/asset-pipeline/` |
| SEO head component, base styles | `src/components/SeoHead.astro`, `src/styles/` |
| CLI (`csp`, `init`) and the CSP gate | `src/checks/`, `src/scaffold/` |
| Files copied into generated sites | `templates/` (byte-identical to the skill templates they came from; the tests say so when the skills checkout sits next to this repo) |
| Exported config bases | `tsconfig.base.json`, `biome.base.json` |
| Tests | `tests/`, mirroring `src/` |

## Release
Bump `version` in `package.json` and `CHANGELOG.md`, merge, then push a tag `vX.Y.Z` equal to it. The release workflow verifies the tag, runs `just check`, packs the tarball and attaches it to a GitHub Release with `SHA256SUMS`. Nothing is published anywhere else.

## Rules
- A change that a site would notice (a new default, a renamed export) is a MINOR before 1.0 and a MAJOR after.
- Every default comes from what the four sites already do; copy, tokens, fonts and components stay in each site.
- Never commit unless asked.
