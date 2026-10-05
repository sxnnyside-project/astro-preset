# astro-preset: the command surface. Every recipe fails instead of skipping.

default:
    @just --list

install:
    bun install --frozen-lockfile

dev:
    bun test --watch

build:
    bun run build

test:
    bun run test

typecheck:
    bun run typecheck

lint:
    bun run lint

format:
    bun run format

format-check:
    bun run format:check

# Non-mutating gate: what pre-commit and CI run.
check: format-check lint typecheck test

clean:
    bun run clean

# The release asset: dist/sxnnyside-astro-preset-<version>.tgz (built first, then packed).
package: build
    mkdir -p dist/release
    bun pm pack --ignore-scripts --destination dist/release

# Release notes for $VERSION from Conventional Commits (needs git-cliff).
changelog:
    git cliff --latest --strip header --output RELEASE_NOTES.md
