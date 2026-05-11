import http from 'node:http'
import { URL } from 'node:url'

const PORT = Number(process.env.MONITOR_API_PORT ?? 8787)
const DEFAULT_TIMEOUT_MS = 9000
const MAX_BYTES = 32768
const STREAM_STALL_TIMEOUT_MS = 20000
const STREAM_RECONNECT_DELAY_MS = 3000
const STREAM_LEVEL_EMIT_MS = 650

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Range',
    'Content-Type': 'application/json; charset=utf-8'
  })
  res.end(JSON.stringify(payload))
}

function sendSse(res, event, payload) {
  res.write(`event: ${event}\n`)
  res.write(`data: ${JSON.stringify(payload)}\n\n`)
}

function delay(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

function waitForDrain(res) {
  return new Promise((resolve) => {
    const cleanup = () => {
      res.off('drain', onDone)
      res.off('close', onDone)
      res.off('error', onDone)
    }
    const onDone = () => {
      cleanup()
      resolve()
    }

    res.once('drain', onDone)
    res.once('close', onDone)
    res.once('error', onDone)
  })
}

function normalizeSong(song) {
  if (!song) return { title: 'Sem metadata', artist: '' }

  if (song.text) {
    return {
      title: song.text,
      artist: song.artist ?? ''
    }
  }

  const title = song.title || song.name || 'Sem metadata'
  const artist = song.artist || ''

  return {
    title: artist && title ? `${artist} - ${title}` : title,
    artist
  }
}

function estimateLevels(chunk, sequence) {
  if (!chunk?.length) {
    return { levelL: 0, levelR: 0 }
  }

  let leftSeed = 0
  let rightSeed = 0
  const sampleSize = Math.min(chunk.length, 96)

  for (let index = 0; index < sampleSize; index += 2) {
    leftSeed += chunk[index] ?? 0
    rightSeed += chunk[index + 1] ?? chunk[index] ?? 0
  }

  const leftWave = Math.abs(Math.sin((leftSeed + sequence * 31) / 120))
  const rightWave = Math.abs(Math.sin((rightSeed + sequence * 47) / 135))

  return {
    levelL: Math.max(2, Math.min(10, Math.round(leftWave * 8) + 2)),
    levelR: Math.max(2, Math.min(10, Math.round(rightWave * 8) + 2))
  }
}

async function readStreamBytes(url, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const controller = new AbortController()
  const startedAt = performance.now()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(url, {
      headers: {
        'Icy-MetaData': '1',
        Range: `bytes=0-${MAX_BYTES - 1}`,
        'User-Agent': 'ServicoMonitoramento/0.1'
      },
      redirect: 'follow',
      signal: controller.signal
    })

    if (response.status >= 400) {
      throw new Error(`HTTP ${response.status}`)
    }

    if (!response.body) {
      throw new Error('Stream sem corpo de resposta')
    }

    const reader = response.body.getReader()
    let receivedBytes = 0

    while (receivedBytes < MAX_BYTES) {
      const { done, value } = await reader.read()
      if (done) break
      receivedBytes += value?.byteLength ?? 0
      if (receivedBytes > 0) break
    }

    await reader.cancel().catch(() => {})

    if (receivedBytes === 0) {
      throw new Error('Nenhum byte recebido')
    }

    return {
      status: 'online',
      detail: 'Stream online com bytes recebidos.',
      checkedAt: new Date().toISOString(),
      latencyMs: Math.round(performance.now() - startedAt),
      receivedBytes,
      httpStatus: response.status,
      contentType: response.headers.get('content-type')
    }
  } finally {
    clearTimeout(timeoutId)
  }
}

async function probeStream(url, fallbackUrl) {
  const attempts = [url, fallbackUrl].filter(Boolean)
  let lastError = null

  for (const attemptUrl of attempts) {
    try {
      return await readStreamBytes(attemptUrl)
    } catch (error) {
      lastError = error
    }
  }

  const isTimeout = lastError?.name === 'AbortError'

  return {
    status: isTimeout ? 'timeout' : 'offline',
    detail: isTimeout ? 'Tempo limite ao conectar no stream.' : `Falha no stream: ${lastError?.message ?? 'erro desconhecido'}.`,
    checkedAt: new Date().toISOString(),
    latencyMs: null,
    receivedBytes: 0,
    httpStatus: null,
    contentType: null
  }
}

async function proxyAudioStream({ req, res, url, fallbackUrl }) {
  const attempts = [url, fallbackUrl].filter(Boolean)
  let lastError = null

  for (const attemptUrl of attempts) {
    const controller = new AbortController()
    let clientClosed = false

    res.on('close', () => {
      clientClosed = true
      controller.abort()
    })

    try {
      const headers = {
        'Icy-MetaData': '1',
        'User-Agent': 'ServicoMonitoramento/0.1'
      }

      if (req.headers.range) {
        headers.Range = req.headers.range
      }

      const response = await fetch(attemptUrl, {
        headers,
        redirect: 'follow',
        signal: controller.signal
      })

      if (response.status >= 400 || !response.body) {
        throw new Error(`HTTP ${response.status}`)
      }

      res.writeHead(response.status === 206 ? 206 : 200, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Range',
        'Accept-Ranges': response.headers.get('accept-ranges') ?? 'bytes',
        'Cache-Control': 'no-store, no-transform',
        Connection: 'keep-alive',
        'Content-Type': response.headers.get('content-type') ?? 'audio/mpeg',
        ...(response.headers.get('content-range') ? { 'Content-Range': response.headers.get('content-range') } : {}),
        ...(response.headers.get('content-length') ? { 'Content-Length': response.headers.get('content-length') } : {})
      })

      const reader = response.body.getReader()

      while (!clientClosed) {
        const { done, value } = await reader.read()
        if (done) break
        if (value && !res.write(Buffer.from(value))) {
          await waitForDrain(res)
        }
      }

      await reader.cancel().catch(() => {})
      if (!res.writableEnded) {
        res.end()
      }
      return
    } catch (error) {
      lastError = error
      controller.abort()

      if (clientClosed || res.headersSent) {
        if (!res.writableEnded) {
          res.end()
        }
        return
      }
    }
  }

  sendJson(res, 502, {
    error: `Falha ao abrir proxy de áudio: ${lastError?.message ?? 'erro desconhecido'}.`
  })
}

async function monitorContinuousStream({ id, url, fallbackUrl, res, isClosed }) {
  const attempts = [url, fallbackUrl].filter(Boolean)
  let lastStatus = null

  const emitStatus = (payload) => {
    sendSse(res, 'status', id ? { id, ...payload } : payload)
  }

  while (!isClosed()) {
    let lastError = null

    for (const attemptUrl of attempts) {
      if (isClosed()) return

      const controller = new AbortController()
      let stallTimer = null
      const startedAt = performance.now()
      let lastLevelEmitAt = 0
      let sequence = 0

      const resetStallTimer = () => {
        clearTimeout(stallTimer)
        stallTimer = setTimeout(() => controller.abort(), STREAM_STALL_TIMEOUT_MS)
      }

      try {
        resetStallTimer()

        const response = await fetch(attemptUrl, {
          headers: {
            'Icy-MetaData': '1',
            'User-Agent': 'ServicoMonitoramento/0.1'
          },
          redirect: 'follow',
          signal: controller.signal
        })

        if (response.status >= 400) {
          throw new Error(`HTTP ${response.status}`)
        }

        if (!response.body) {
          throw new Error('Stream sem corpo de resposta')
        }

        const reader = response.body.getReader()
        let receivedBytes = 0

        while (!isClosed()) {
          resetStallTimer()
          const { done, value } = await reader.read()

          if (done) {
            throw new Error('Stream encerrado pelo servidor')
          }

          receivedBytes += value?.byteLength ?? 0
          sequence += 1
          const now = performance.now()
          const levels = estimateLevels(value, sequence)

          if (lastStatus !== 'online' && receivedBytes > 0) {
            lastStatus = 'online'
            lastLevelEmitAt = now
            emitStatus({
              status: 'online',
              detail: 'Stream online com leitura contínua.',
              checkedAt: new Date().toISOString(),
              latencyMs: Math.round(performance.now() - startedAt),
              receivedBytes,
              httpStatus: response.status,
              contentType: response.headers.get('content-type'),
              ...levels
            })
          } else if (lastStatus === 'online' && now - lastLevelEmitAt >= STREAM_LEVEL_EMIT_MS) {
            lastLevelEmitAt = now
            emitStatus({
              status: 'online',
              detail: 'Stream online com leitura contínua.',
              checkedAt: new Date().toISOString(),
              latencyMs: Math.round(performance.now() - startedAt),
              receivedBytes,
              httpStatus: response.status,
              contentType: response.headers.get('content-type'),
              ...levels
            })
          }
        }

        await reader.cancel().catch(() => {})
      } catch (error) {
        lastError = error
      } finally {
        clearTimeout(stallTimer)
        controller.abort()
      }
    }

    if (isClosed()) return

    const nextStatus = lastError?.name === 'AbortError' ? 'timeout' : 'offline'

    if (lastStatus !== nextStatus) {
      lastStatus = nextStatus
      emitStatus({
        status: nextStatus,
        detail: nextStatus === 'timeout' ? 'Stream sem bytes por tempo prolongado.' : `Falha no stream: ${lastError?.message ?? 'erro desconhecido'}.`,
        checkedAt: new Date().toISOString(),
        latencyMs: null,
        receivedBytes: 0,
        httpStatus: null,
        contentType: null
      })
    }

    await delay(STREAM_RECONNECT_DELAY_MS)
  }
}

async function fetchNowPlaying(metadataUrl) {
  if (!metadataUrl) {
    return {
      status: 'unavailable',
      title: '',
      artist: '',
      listeners: null,
      checkedAt: new Date().toISOString(),
      detail: 'URL de metadata não configurada.'
    }
  }

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS)

  try {
    const response = await fetch(`${metadataUrl}?_=${Date.now()}`, {
      cache: 'no-store',
      signal: controller.signal
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }

    const payload = await response.json()
    const song = normalizeSong(payload.now_playing?.song ?? payload.nowPlaying?.song ?? payload.song)

    return {
      status: 'available',
      title: song.title,
      artist: song.artist,
      listeners: payload.listeners?.current ?? payload.listeners?.total ?? null,
      checkedAt: new Date().toISOString(),
      detail: 'Metadata atualizada.'
    }
  } catch (error) {
    return {
      status: 'unavailable',
      title: '',
      artist: '',
      listeners: null,
      checkedAt: new Date().toISOString(),
      detail: error.name === 'AbortError' ? 'Tempo limite na metadata.' : `Falha na metadata: ${error.message}.`
    }
  } finally {
    clearTimeout(timeoutId)
  }
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    sendJson(res, 204, {})
    return
  }

  const requestUrl = new URL(req.url, `http://${req.headers.host}`)

  try {
    if (requestUrl.pathname === '/api/probe') {
      const streamUrl = requestUrl.searchParams.get('url')
      const fallbackUrl = requestUrl.searchParams.get('fallbackUrl')

      if (!streamUrl) {
        sendJson(res, 400, { error: 'Parâmetro url é obrigatório.' })
        return
      }

      sendJson(res, 200, await probeStream(streamUrl, fallbackUrl))
      return
    }

    if (requestUrl.pathname === '/api/watch') {
      const streamUrl = requestUrl.searchParams.get('url')
      const fallbackUrl = requestUrl.searchParams.get('fallbackUrl')

      if (!streamUrl) {
        sendJson(res, 400, { error: 'Parâmetro url é obrigatório.' })
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

      const keepAliveInterval = setInterval(() => {
        if (!closed) {
          res.write(': keepalive\n\n')
        }
      }, 15000)

      sendSse(res, 'status', {
        status: 'checking',
        detail: 'Monitoramento contínuo iniciado.',
        checkedAt: new Date().toISOString(),
        latencyMs: null,
        receivedBytes: 0,
        httpStatus: null,
        contentType: null
      })

      await monitorContinuousStream({
        url: streamUrl,
        fallbackUrl,
        res,
        isClosed: () => closed
      })

      clearInterval(keepAliveInterval)

      return
    }

    if (requestUrl.pathname === '/api/audio') {
      const streamUrl = requestUrl.searchParams.get('url')
      const fallbackUrl = requestUrl.searchParams.get('fallbackUrl')

      if (!streamUrl) {
        sendJson(res, 400, { error: 'Parâmetro url é obrigatório.' })
        return
      }

      await proxyAudioStream({
        req,
        res,
        url: streamUrl,
        fallbackUrl
      })

      return
    }

    if (requestUrl.pathname === '/api/watch-many') {
      const streamsParam = requestUrl.searchParams.get('streams')

      if (!streamsParam) {
        sendJson(res, 400, { error: 'Parâmetro streams é obrigatório.' })
        return
      }

      let streamsToWatch = []

      try {
        streamsToWatch = JSON.parse(streamsParam)
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

      await Promise.all(
        streamsToWatch.map((stream) =>
          monitorContinuousStream({
            id: stream.id,
            url: stream.streamUrl,
            fallbackUrl: stream.fallbackUrl,
            res,
            isClosed: () => closed
          })
        )
      )

      clearInterval(keepAliveInterval)

      return
    }

    if (requestUrl.pathname === '/api/now-playing') {
      const metadataUrl = requestUrl.searchParams.get('url')

      sendJson(res, 200, await fetchNowPlaying(metadataUrl))
      return
    }

    sendJson(res, 404, { error: 'Rota não encontrada.' })
  } catch (error) {
    sendJson(res, 500, { error: error.message })
  }
})

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Monitor API listening on http://localhost:${PORT}`)
})
