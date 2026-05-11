const API_BASE_URL = import.meta.env.VITE_MONITOR_API_URL ?? 'http://localhost:8787'

export async function probeStream(streamUrl, fallbackUrl) {
  const startedAt = performance.now()
  const params = new URLSearchParams({ url: streamUrl })

  if (fallbackUrl) {
    params.set('fallbackUrl', fallbackUrl)
  }

  try {
    const response = await fetch(`${API_BASE_URL}/api/probe?${params.toString()}`, {
      cache: 'no-store'
    })

    if (!response.ok) {
      throw new Error(`API HTTP ${response.status}`)
    }

    return await response.json()
  } catch (error) {
    return {
      status: 'offline',
      detail: `API de monitoramento indisponível: ${error.message}.`,
      checkedAt: new Date().toISOString(),
      latencyMs: Math.round(performance.now() - startedAt),
      receivedBytes: 0,
      httpStatus: null,
      contentType: null
    }
  }
}
