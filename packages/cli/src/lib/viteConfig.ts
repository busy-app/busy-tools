// Vite config, built in code instead of read from a file in the project — busy-cli owns the build, projects only hold sources.

import { basename, dirname, extname, relative, resolve, sep } from 'node:path'
import type { InlineConfig, Plugin } from 'vite'
import { fontMaps } from './fontMapsPlugin.js'
import { ENTRY_PATHS, findEntry, type Project } from './paths.js'

export type BuildOptions = {
  /** Where the package is assembled; the bundle lands in its `scripts/`. */
  outDir: string
  /** BUSY Bar address the app connects to; replaces `__BUSY_ADDR__` in its sources. */
  addr: string
  minify: boolean
  /** Emit a single scripts/main.js instead of one file per module. */
  bundle: boolean
}

// The BUSY Bar evaluates main.js from top to bottom and never looks at what it exports, so the entry starts the app with a call of its own: `function main() { … }` and `main()` below it.
// An export there would be dead at best, and a default export is the old way to start an app, which no longer does anything. Only the entry is checked; the modules it imports export as they please.
function forbidEntryExports(entry: string): Plugin {
  return {
    name: 'forbid-entry-exports',
    moduleParsed(info) {
      if (info.id !== entry || info.exports.length === 0) return
      const name = basename(entry)
      this.error(
        `${name} must not export anything, but it exports ${info.exports.join(', ')}.\n` +
          `The BUSY Bar runs ${name}, it does not import it.\n` +
          'Remove the export and start the app with a call at the end of the file: `function main() { … }` followed by `main()`.',
      )
    },
  }
}

/** Builds the Vite config for the app of `project`. */
export function buildViteConfig(project: Project, { outDir, addr, minify, bundle }: BuildOptions): InlineConfig {
  const { root, app } = project
  const entry = findEntry(project)
  if (!entry) {
    throw new Error(`build: ${app} has no entry point.\nAdd one of ${ENTRY_PATHS.join(', ')}.`)
  }
  // Modules beside an entry in scripts/ are named from there, as they sit in the package: scripts/time.ts → time.js, not scripts-time.js.
  const entryDir = dirname(entry)

  return {
    root,
    // .anim files are binary device assets, served as URLs.
    assetsInclude: ['**/*.anim'],
    define: { __BUSY_ADDR__: JSON.stringify(addr) },
    plugins: [fontMaps(project), forbidEntryExports(entry)],
    build: {
      outDir: resolve(outDir, 'scripts'),
      emptyOutDir: true,
      target: 'es2020',
      minify: minify ? 'oxc' : false,
      rollupOptions: {
        input: entry,
        // main.js exports nothing, and nothing may be hoisted into it for the other chunks to import.
        preserveEntrySignatures: 'strict',
        output: {
          entryFileNames: 'main.js',
          // No hashes: the runtime resolves relative paths as-is.
          chunkFileNames: '[name].js',
          // inlineDynamicImports and manualChunks are mutually exclusive.
          ...(bundle
            ? { inlineDynamicImports: true }
            : {
                // Each of the app's own modules gets a file next to main.js; dependencies are inlined into the chunk using them.
                manualChunks(id: string) {
                  if (!id.startsWith(app)) return undefined
                  // Without src/ the dependencies sit inside the app directory.
                  if (id.includes('/node_modules/')) return undefined
                  if (id === entry) return undefined
                  // Sources only; assets take their own path.
                  if (!/\.(ts|js)$/.test(id)) return undefined
                  // The package keeps every script next to main.js, so the chunk name is the module's path under the app folder (or its scripts/), flattened — file names alone would collide across folders:
                  //   time.ts → time.js,  lib/format.ts → lib-format.js
                  const path = relative(id.startsWith(entryDir + sep) ? entryDir : app, id)
                  return path.slice(0, -extname(path).length).split(sep).join('-')
                },
              }),
          // Temp folder inside outDir; build.ts spreads it out and removes it.
          assetFileNames: '_assets/[name][extname]',
        },
      },
    },
    logLevel: 'warn',
  }
}
