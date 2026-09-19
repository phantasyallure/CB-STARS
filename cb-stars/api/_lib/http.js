// Small helpers shared by every serverless function.

export class HttpError extends Error {
  constructor(status, message, extra = {}) {
    super(message)
    this.status = status
    this.extra = extra
  }
}

export function handle(fn) {
  return async function handler(req, res) {
    try {
      await fn(req, res)
    } catch (err) {
      const status = err instanceof HttpError ? err.status : 500
      if (status === 500) console.error(err)
      res.status(status).json({
        error: err instanceof HttpError ? err.message : 'Server error',
        ...(err instanceof HttpError ? err.extra : {}),
      })
    }
  }
}

export function allow(req, methods) {
  if (!methods.includes(req.method)) {
    throw new HttpError(405, `Method ${req.method} not allowed`)
  }
}

export function body(req) {
  const b = req.body
  if (!b) return {}
  if (typeof b === 'string') {
    try { return JSON.parse(b) } catch { throw new HttpError(400, 'Invalid JSON body') }
  }
  return b
}
