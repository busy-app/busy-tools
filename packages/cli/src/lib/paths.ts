// Project layout, in one place. One project directory holds one app, in one of two shapes.
//
// With src/, as the template makes it:
//
//   my-app/
//   └── src/
//       ├── main.ts        ← the entry point: function main(), called at the end of the file
//       ├── appmeta/       ← manifest.json, plus settings.json and icons
//       └── images/        ← resources; also animations/, sounds/, or any other file
//
// Or without src/, the app being the project itself:
//
//   my-app/
//   ├── main.js
//   ├── appmeta/
//   └── images/            ← resources; only images/, animations/, sounds/ and resources/ are taken
//
// The app directory is the only thing that varies per project; everything else is derived from it.

import { existsSync } from 'node:fs'
import { basename, dirname, isAbsolute, resolve } from 'node:path'

/** An app and the project around it. */
export type Project = {
  /** The project directory: what the output directory and node_modules resolve against. */
  root: string
  /** The app itself — sources, appmeta and resources: `src/` under the root, or the root itself. */
  app: string
  /** False when the app is the project itself, with no src/ around it. */
  hasSrc: boolean
}

const MANIFEST = 'appmeta/manifest.json'

/** The project `dir` belongs to, or null. Only `dir` itself is looked at: the project root, its src/, or an app with no src/. Nothing is searched for above or below. */
export function findProject(dir: string): Project | null {
  if (existsSync(resolve(dir, 'src', MANIFEST))) {
    return { root: dir, app: resolve(dir, 'src'), hasSrc: true }
  }
  if (!existsSync(resolve(dir, MANIFEST))) return null
  // Standing in the src/ of a project is the same as standing at its root.
  if (basename(dir) === 'src') return { root: dirname(dir), app: dir, hasSrc: true }
  return { root: dir, app: dir, hasSrc: false }
}

/** Like findProject, but a directory with no app in it is an error. */
export function requireProject(dir: string): Project {
  const project = findProject(dir)
  if (!project) {
    throw new Error(`No BUSY Bar app in ${dir}.\nRun this from an app folder: one that has appmeta/manifest.json, directly or under src/.`)
  }
  return project
}

/** Glyph maps, shipped with @busy-app/busy-lib. Null when it is not installed. */
export function mapsDir({ root }: Project): string | null {
  const dir = resolve(root, 'node_modules/@busy-app/busy-lib/dist/Utils/font/maps')
  return existsSync(dir) ? dir : null
}

/** App metadata the firmware reads: manifest.json, plus settings.json and icons when present. */
export function appmetaDir({ app }: Project): string {
  return resolve(app, 'appmeta')
}

/** Where the built package lands: `dist/` by default, or the path given by `--out <path>`. A relative path resolves against the project root, so `../` reaches a destination outside the app. */
export function outRoot({ root }: Project, override?: string): string {
  const path = override ?? 'dist'
  return isAbsolute(path) ? path : resolve(root, path)
}

/** App entry point: main.ts or main.js in the app directory. Returns the path, or null. */
export function findEntry({ app }: Project): string | null {
  for (const name of ['main.ts', 'main.js']) {
    const path = resolve(app, name)
    if (existsSync(path)) return path
  }
  return null
}
