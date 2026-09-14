// Vite plugin: scans the app for `font:` literals and serves `#font-maps` with just those glyph maps, so nothing is registered by hand.
//
// Over-including is deliberate: `font:` also appears on raw DisplayDraw elements, which need no metrics.

import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { relative, resolve } from 'node:path'
import type { Plugin } from 'vite'
import { appDir, mapsDir } from './paths.js'

/** A `font:` whose value the scan could not read, kept to report where it is. */
type DynamicFont = { file: string; line: number; expr: string }

const VIRTUAL_ID = '#font-maps'
const RESOLVED_ID = '\0' + VIRTUAL_ID

const SOURCE_FILE = /\.(ts|tsx|js|mjs|jsx)$/

const SKIP_DIRS = new Set(['node_modules'])

/** Every `font:` property, literal or not. */
const FONT_PROP = /\bfont\s*:\s*([^,;}\n)]+)/g
/** The value of a literal one: "bold", 'bold', optionally `as const`. */
const LITERAL = /^(["'])([a-z_]+)\1(\s+as\s+const)?$/

/** The library has one entry point, so API and layout share a specifier and only the names tell them apart. */
const LIB_IMPORT = /import\s*\{([^}]*)\}\s*from\s*['"]@busy-app\/busy-lib['"]/g
const LAYOUT_NAMES = new Set(['row', 'column', 'stack', 'render', 'measure'])

function importsLayout(code: string): boolean {
  for (const m of code.matchAll(LIB_IMPORT)) {
    // `row` or `row as r`: the imported name comes first.
    for (const spec of m[1]!.split(',')) {
      const name = spec.trim().split(/\s/)[0]
      if (name && LAYOUT_NAMES.has(name)) return true
    }
  }
  return false
}

function scan(code: string, file: string, found: Set<string>, dynamic: DynamicFont[]): void {
  for (const m of code.matchAll(FONT_PROP)) {
    const lineStart = code.lastIndexOf('\n', m.index) + 1
    const before = code.slice(lineStart, m.index)
    // Skip comments and type annotations (`font: DeviceFont`).
    if (/(\/\/|\*)/.test(before)) continue

    const value = m[1]!.trim()
    const literal = LITERAL.exec(value)
    if (literal) {
      found.add(literal[2]!)
    } else if (!/^[A-Z]/.test(value)) {
      dynamic.push({ file, line: code.slice(0, m.index).split('\n').length, expr: value })
    }
  }
}

export function fontMaps(root: string): Plugin {
  const maps = mapsDir(root)
  const app = appDir(root)

  /** Font names that have a generated map. */
  function available(): Set<string> {
    if (!maps || !existsSync(maps)) return new Set()
    return new Set(readdirSync(maps).filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -5)))
  }

  const found = new Set<string>()
  const dynamic: DynamicFont[] = []
  let known = new Set<string>()
  let usesLayout = false

  function scanSources(): void {
    found.clear()
    dynamic.length = 0
    usesLayout = false
    const walk = (dir: string): void => {
      if (!existsSync(dir)) return
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        if (SKIP_DIRS.has(entry.name) || entry.name.startsWith('.')) continue
        const path = resolve(dir, entry.name)
        if (entry.isDirectory()) walk(path)
        else if (SOURCE_FILE.test(entry.name)) {
          const code = readFileSync(path, 'utf8')
          if (importsLayout(code)) usesLayout = true
          scan(code, path, found, dynamic)
        }
      }
    }
    walk(app)
  }

  return {
    name: 'font-maps',

    buildStart() {
      scanSources()
      if (found.size === 0 && dynamic.length === 0) return

      if (usesLayout && dynamic.length > 0) {
        const where = dynamic
          .map((d) => `  ${relative(root, d.file)}:${d.line}  font: ${d.expr}`)
          .join('\n')
        this.warn(
          `font is computed, so its map cannot be bundled:\n${where}\n` +
            `Fine for DisplayDraw. For layout, use a string literal or import the map and call registerFontMaps() yourself.`,
        )
      }

      known = available()
      if (known.size === 0) {
        if (usesLayout) {
          this.warn(
            `the app names font ${[...found].map((f) => `"${f}"`).join(', ')}, but no glyph maps are installed. ` +
              `DisplayDraw is unaffected; layout measuring will throw. Install @busy-app/busy-lib to bundle the maps.`,
          )
        }
        return
      }

      const unknown = [...found].filter((f) => !known.has(f))
      if (usesLayout && unknown.length > 0) {
        this.warn(`no map for font ${unknown.map((f) => `"${f}"`).join(', ')}`)
      }
    },

    resolveId(id: string) {
      return id === VIRTUAL_ID ? RESOLVED_ID : null
    },

    load(id: string) {
      if (id !== RESOLVED_ID) return null
      // The module is emitted even with nothing to serve: the library imports it unconditionally.
      if (!maps) return 'export const MAPS = [];\n'

      // Importing a map that is not on disk would fail to resolve.
      const fonts = [...found].filter((f) => known.has(f)).sort()
      const imports = fonts.map((f, i) => `import f${i} from '${resolve(maps, `${f}.json`)}';`).join('\n')

      return `${imports}\nexport const MAPS = [${fonts.map((_, i) => `f${i}`).join(', ')}];\n`
    },

    handleHotUpdate({ file, server }) {
      if (!SOURCE_FILE.test(file)) return
      const before = [...found].join()
      scanSources()
      if ([...found].join() === before) return

      const virtual = server.moduleGraph.getModuleById(RESOLVED_ID)
      if (!virtual) return
      server.moduleGraph.invalidateModule(virtual)
      server.ws.send({ type: 'full-reload' })
    },
  }
}
