---
"@busy-app/create-app": minor
---

The generator:

- Allow dashes in app IDs, matching the firmware rules: Latin letters, digits, underscores, dashes and dots, at most 32 characters, not starting with a dot.
- Keep dashes in folder names and turn whitespace into underscores when suggesting an app ID (`"My-App 2"` by "Jane Doe" → `app.jane_doe.my-app_2`).
- Fall back to a placeholder (`app` or `example`) for a folder or author name with characters the firmware rejects, keeping the valid segment.
- Add `-v, --version`, and show the package version in `--help` and above the banner.

The template:

- Add a `build/tgz` script (`busy-cli build --tgz`) to build and pack the package into a `.tgz` archive in one step.
- Update `@busy-app/cli` to `^0.5.0`.
