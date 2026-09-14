// Project layout, in one place. One project directory holds one app.
//
//   my-app/
//   └── src/
//       ├── main.ts        ← the entry point: export default function run()
//       ├── appmeta/       ← manifest.json, plus settings.json and icons
//       └── images/        ← resources; also animations/, sounds/, or any other file
//
// appDir is the only thing that varies per project; everything else is derived from it.

import { existsSync } from 'node:fs'
import { isAbsolute, resolve } from 'node:path'

/** The app itself — sources, appmeta and resources. */
export function appDir(root: string): string {
  return resolve(root, 'src')
}

/** Glyph maps, shipped with @busy-app/busy-lib. Null when it is not installed. */
export function mapsDir(root: string): string | null {
  const dir = resolve(root, 'node_modules/@busy-app/busy-lib/dist/Utils/font/maps')
  return existsSync(dir) ? dir : null
}

/** App metadata the firmware reads: manifest.json, plus settings.json and icons when present. */
export function appmetaDir(root: string): string {
  return resolve(appDir(root), 'appmeta')
}

/** Where the built package lands: `dist/` by default, or the path given by `--out <path>`. A relative path resolves against the project root, so `../` reaches a destination outside the app. */
export function outRoot(root: string, override?: string): string {
  const path = override ?? 'dist'
  return isAbsolute(path) ? path : resolve(root, path)
}

/** App entry point: src/main.ts or src/main.js. Returns the path, or null. */
export function findEntry(root: string): string | null {
  const dir = appDir(root)
  for (const name of ['main.ts', 'main.js']) {
    const path = resolve(dir, name)
    if (existsSync(path)) return path
  }
  return null
}
