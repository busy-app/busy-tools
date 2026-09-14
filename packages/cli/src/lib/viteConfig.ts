// Vite config, built in code instead of read from a file in the project — busy-cli owns the build, projects only hold sources.

import { extname, relative, resolve, sep } from 'node:path'
import type { InlineConfig, Plugin } from 'vite'
import { fontMaps } from './fontMapsPlugin.js'
import { appDir, findEntry } from './paths.js'

export type BuildOptions = {
  /** Where the package is assembled; the bundle lands in its `scripts/`. */
  outDir: string
  minify: boolean
  /** Emit a single scripts/main.js instead of one file per module. */
  bundle: boolean
}

// JerryScript runs main.js as a plain script. Rolldown already inlines the default export into a call; this is the fallback for bundlers that still emit `export {X as default}` / `export default X`.
function callDefaultExport(): Plugin {
  return {
    name: 'call-default-export',
    renderChunk(code, chunk) {
      if (!chunk.isEntry) return null
      if (/\n([A-Za-z_$][\w$]*)\(\);\s*$/.test(code)) return null
      const re = /export\s*(?:\{\s*([A-Za-z_$][\w$]*)\s+as\s+default\s*\}|default\s+([A-Za-z_$][\w$]*)\s*)\s*;?\s*$/
      const match = code.match(re)
      const name = match?.[1] ?? match?.[2]
      if (!name) {
        return this.error('call-default-export: no default export at the end of main.js. The app must have `export default function run()`.')
      }
      return { code: code.replace(re, `${name}();\n`), map: null }
    },
  }
}

/** Builds the Vite config for the app at `root`. */
export function buildViteConfig(root: string, { outDir, minify, bundle }: BuildOptions): InlineConfig {
  const app = appDir(root)
  const entry = findEntry(root)
  if (!entry) {
    throw new Error(`build: ${app} has neither main.ts nor main.js`)
  }

  return {
    root,
    // .anim files are binary device assets, served as URLs.
    assetsInclude: ['**/*.anim'],
    plugins: [fontMaps(root), callDefaultExport()],
    build: {
      outDir: resolve(outDir, 'scripts'),
      emptyOutDir: true,
      target: 'es2020',
      minify: minify ? 'oxc' : false,
      rollupOptions: {
        input: entry,
        // The entry export must survive tree-shaking.
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
                  if (id === entry) return undefined
                  // Sources only; assets take their own path.
                  if (!/\.(ts|js)$/.test(id)) return undefined
                  // The package keeps every script next to main.js, so the chunk name is the module's path under src/, flattened — file names alone would collide across folders:
                  //   time.ts → time.js,  lib/format.ts → lib-format.js
                  const path = relative(app, id)
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
