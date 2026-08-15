import { defineConfig, loadEnv } from 'vite'
import type { Plugin } from 'vite'
import react from '@vitejs/plugin-react'

/**
 * T6 — serve /api/ai-hop during `vite dev` only.
 *
 * Vercel runs the functions in /api in production; the Vite dev server does
 * not know they exist, so without this the machine's hop can only ever be
 * exercised against a deploy. This mounts the same handler on the dev server
 * and touches nothing in the build: `apply: 'serve'` means it is absent from
 * `vite build`, and production still runs the real serverless function.
 *
 * It also loads .env.local into process.env for the handler to read, which
 * Vite otherwise only exposes to client code under a VITE_ prefix — and the
 * whole point of a proxy is that this key never reaches the client.
 */
function apiDevServer(mode: string): Plugin {
  return {
    name: 'truthchain-api-dev',
    apply: 'serve',
    configureServer(server) {
      const env = loadEnv(mode, process.cwd(), '')
      for (const key of ['GROQ_API_KEY', 'GROQ_MODEL']) {
        if (env[key] && !process.env[key]) process.env[key] = env[key]
      }

      server.middlewares.use('/api/ai-hop', async (req, res) => {
        try {
          /* Imported per request so edits to the handler are picked up without
             restarting the dev server. */
          const { default: handler } = await server.ssrLoadModule('/api/ai-hop.ts')

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
          console.error('[api/ai-hop dev]', error)
          res.statusCode = 500
          res.setHeader('content-type', 'application/json')
          res.end(JSON.stringify({ error: 'dev_handler_failed' }))
        }
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [react(), apiDevServer(mode)],
}))
