import { defineConfig, loadEnv } from 'vite'
import type { Plugin } from 'vite'
import react from '@vitejs/plugin-react'

/** Every function in /api, mounted at the path Vercel serves it from. */
const API_ROUTES = [
  '/api/ai-hop', //  T6 — the machine's turn
  '/api/room', //    T7 — rooms, polled every 1.5s
] as const

/**
 * Serve the functions in /api during `vite dev` only.
 *
 * Vercel runs them in production; the Vite dev server does not know they
 * exist, so without this they can only ever be exercised against a deploy —
 * which is how a broken /api/room reached a deploy in the first place. This
 * mounts the same handlers on the dev server and touches nothing in the
 * build: `apply: 'serve'` means it is absent from `vite build`, and
 * production still runs the real serverless functions.
 *
 * NOTE: `ssrLoadModule` resolves imports through Vite, which is far more
 * forgiving than Node's ESM resolver. A handler working here is NOT proof it
 * will load on Vercel — see the note on the imports in src/state/gameReducer.ts.
 *
 * It also loads .env.local into process.env for the handlers to read, which
 * Vite otherwise only exposes to client code under a VITE_ prefix — and the
 * whole point of a proxy is that the key never reaches the client. Rooms fall
 * back to an in-process Map when the Upstash pair is absent, so dev works
 * without credentials; supply them to rehearse the real thing.
 *
 * NOT UNDER VITEST. Vitest builds a Vite server of its own, so `configureServer`
 * fired during `vitest run` and pushed .env.local's Upstash pair into the test
 * process — which pointed `roomStore.test.ts` at the live database. Two cases
 * failed there and nowhere else: the TTL case, because `vi.setSystemTime` cannot
 * move a clock inside Redis, and the overdue-wave case, because a network
 * round-trip does not fit in a 5s test. Both were noise, but noise that has to
 * be explained away on every run is how a real failure gets waved through. The
 * suite documents that it exercises the in-process Map; this is what makes that
 * true regardless of who has credentials on their machine.
 */
function apiDevServer(mode: string): Plugin {
  return {
    name: 'brick-by-brick-api-dev',
    apply: (_config, { command }) => command === 'serve' && !process.env.VITEST,
    configureServer(server) {
      const env = loadEnv(mode, process.cwd(), '')
      for (const key of [
        'GROQ_API_KEY',
        'GROQ_MODEL',
        'UPSTASH_REDIS_REST_URL',
        'UPSTASH_REDIS_REST_TOKEN',
      ]) {
        if (env[key] && !process.env[key]) process.env[key] = env[key]
      }

      for (const route of API_ROUTES) {
        server.middlewares.use(route, async (req, res) => {
          try {
            /* Imported per request so edits to the handler are picked up
               without restarting the dev server. */
            const { default: handler } = await server.ssrLoadModule(`${route}.ts`)

            /* The shim Vercel's Node runtime provides around res. */
            const shim = Object.assign(res, {
              status(code: number) {
                res.statusCode = code
                return shim
              },
              json(payload: unknown) {
                res.setHeader('content-type', 'application/json')
                res.end(JSON.stringify(payload))
                return shim
              },
            })

            await handler(req, shim)
          } catch (error) {
            /* Never surface a dev-server stack trace to the round — the client
               treats any non-200 as "use the fallback" and carries on. */
            console.error(`[${route} dev]`, error)
            res.statusCode = 500
            res.setHeader('content-type', 'application/json')
            res.end(JSON.stringify({ error: 'dev_handler_failed' }))
          }
        })
      }
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [react(), apiDevServer(mode)],
}))
