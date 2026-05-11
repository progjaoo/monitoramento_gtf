const API_BASE_URL = import.meta.env.VITE_MONITOR_API_URL ?? 'http://localhost:8787'

export function watchStream({ streamUrl, fallbackUrl, onStatus, onError }) {
  const params = new URLSearchParams({ url: streamUrl })

  if (fallbackUrl) {
    params.set('fallbackUrl', fallbackUrl)
  }

  const eventSource = new EventSource(`${API_BASE_URL}/api/watch?${params.toString()}`)

  eventSource.addEventListener('status', (event) => {
    onStatus(JSON.parse(event.data))
  })

  eventSource.onerror = () => {
    onError?.({
      status: 'checking',
      detail: 'Reconectando com a API de monitoramento.',
      checkedAt: new Date().toISOString(),
      latencyMs: null,
      receivedBytes: 0,
      httpStatus: null,
      contentType: null
    })
  }

  return () => eventSource.close()
}

export function watchStreams({ streams, onStatus, onError }) {
  const params = new URLSearchParams({
    streams: JSON.stringify(
      streams.map((stream) => ({
        id: stream.id,
        streamUrl: stream.streamUrl,
        fallbackUrl: stream.fallbackUrl
      }))
    )
  })

  const eventSource = new EventSource(`${API_BASE_URL}/api/watch-many?${params.toString()}`)

  eventSource.addEventListener('status', (event) => {
    onStatus(JSON.parse(event.data))
  })

  eventSource.onerror = () => {
    onError?.({
      status: 'checking',
      detail: 'Reconectando com a API de monitoramento.',
      checkedAt: new Date().toISOString(),
      latencyMs: null,
      receivedBytes: 0,
      httpStatus: null,
      contentType: null
    })
  }

  return () => eventSource.close()
}
