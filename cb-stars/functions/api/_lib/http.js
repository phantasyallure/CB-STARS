// Small helpers shared by every Pages Function.
// Cloudflare Pages Functions use the Fetch API (Request in, Response out) —
// there is no (req, res) pair like on Vercel/Node, and no process.env; every
// handler gets a `context` object with { request, env, params }.

export class HttpError extends Error {
  constructor(status, message, extra = {}) {
    super(message)
    this.status = status
    this.extra = extra
  }
}

export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

// Wraps a Pages Function handler: `async (context) => { ... }`.
// Catches HttpError (and anything else) and turns it into a JSON error response.
export function handle(fn) {
  return async (context) => {
    try {
      return await fn(context)
    } catch (err) {
      const status = err instanceof HttpError ? err.status : 500
      if (status === 500) console.error(err)
      return json(
        {
          error: err instanceof HttpError ? err.message : 'Server error',
          ...(err instanceof HttpError ? err.extra : {}),
        },
        status
      )
    }
  }
}

export function allow(context, methods) {
  if (!methods.includes(context.request.method)) {
    throw new HttpError(405, `Method ${context.request.method} not allowed`)
  }
}

export async function body(context) {
  try {
    return await context.request.json()
  } catch {
    return {}
  }
}

// Query-string params, e.g. query(context).get('userId')
export function query(context) {
  return new URL(context.request.url).searchParams
}
