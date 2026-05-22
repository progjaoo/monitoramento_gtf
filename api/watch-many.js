import { getWatchMaxRuntimeMs, handleOptions, monitorStreamForSse, sendJson, sendSse } from './_monitor.js'
export default async function handler(req, res) {
  if (handleOptions(req, res)) return

  if (req.method !== 'GET') {
    sendJson(res, 405, { error: 'Método não permitido.' })
    return
  }

  if (!req.query.streams) {
    sendJson(res, 400, { error: 'Parâmetro streams é obrigatório.' })
    return
  }

  let streamsToWatch = []

  try {
    streamsToWatch = JSON.parse(req.query.streams)
  } catch {
    sendJson(res, 400, { error: 'Parâmetro streams inválido.' })
    return
  }

  res.writeHead(200, {
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'Content-Type': 'text/event-stream; charset=utf-8'
  })

  let closed = false
  req.on('close', () => {
    closed = true
  })

  const startedAt = Date.now()
  const shouldStop = () => closed || Date.now() - startedAt > getWatchMaxRuntimeMs()
  const keepAliveInterval = setInterval(() => {
    if (!closed) {
      res.write(': keepalive\n\n')
    }
  }, 15000)

  streamsToWatch.forEach((stream) => {
    sendSse(res, 'status', {
      id: stream.id,
      status: 'checking',
      detail: 'Monitoramento contínuo iniciado.',
      checkedAt: new Date().toISOString(),
      latencyMs: null,
      receivedBytes: 0,
      httpStatus: null,
      contentType: null
    })
  })

  await Promise.allSettled(
    streamsToWatch.map((stream) =>
      monitorStreamForSse({
        id: stream.id,
        url: stream.streamUrl,
        fallbackUrl: stream.fallbackUrl,
        res,
        shouldStop
      })
    )
  )
  if (!res.writableEnded) {
    clearInterval(keepAliveInterval)
    res.end()
  }
}