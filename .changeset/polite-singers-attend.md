---
"@busy-app/cli": minor
---

- Support entry points in `scripts/`: `scripts/main.ts` or `scripts/main.js`, matching the layout of the package on the device. Modules beside the entry are emitted without a `scripts-` prefix. More than one entry point is now an error.
- Validate `manifest.id` the way the firmware does: Latin letters, digits, underscores, dashes and dots, at most 32 characters, not starting with a dot.
- Add `-v, --version`, show the package version in `--help`, and print it before running `busy-cli create`.
