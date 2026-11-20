import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'

// Stamps dist/sw.js with a build id so each deploy gets its own cache and old ones are cleared.
// The id is a hash of the output file names, so an identical build keeps the same id.
function swVersion(): Plugin {
  let outDir = 'dist'
  let buildId = ''
  return {
    name: 'pwp-sw-version',
    apply: 'build',
    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir)
    },
    generateBundle(_options, bundle) {
      buildId = createHash('sha256').update(Object.keys(bundle).sort().join('\n')).digest('hex').slice(0, 10)
    },
    closeBundle() {
      const file = resolve(outDir, 'sw.js')
      const src = readFileSync(file, 'utf8')
      if (!src.includes('__BUILD_ID__')) this.error('sw.js has no __BUILD_ID__ placeholder')
      writeFileSync(file, src.replaceAll('__BUILD_ID__', buildId || Date.now().toString(36)))
    },
  }
}

const inNodeModules = (pkgs: string) => new RegExp(`[\\\\/]node_modules[\\\\/](${pkgs})[\\\\/]`)

// https://vite.dev/config/
export default defineConfig({
  base: '/pwp-wedding-app/',
  plugins: [react(), swVersion()],
  // amazon-cognito-identity-js (via its buffer dependency) expects a Node-style `global`.
  define: { global: 'globalThis' },
  build: {
    rolldownOptions: {
      output: {
        // Libraries change far less often than our code; keeping them in their own files means a deploy
        // does not make phones download them again.
        codeSplitting: {
          groups: [
            { name: 'vendor-react', test: inNodeModules('react|react-dom|scheduler|react-router|react-router-dom|cookie|set-cookie-parser'), priority: 30 },
            { name: 'vendor-supabase', test: inNodeModules('@supabase'), priority: 10 },
          ],
        },
      },
    },
  },
})
