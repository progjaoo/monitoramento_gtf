const API_BASE_URL = import.meta.env.VITE_MONITOR_API_URL ?? 'http://localhost:8787'

export const emptyNowPlaying = {
  status: 'idle',
  title: 'Aguardando metadados',
  artist: '',
  listeners: null,
  checkedAt: null,
  detail: 'Nenhuma consulta executada.'
}

export async function fetchNowPlaying(metadataUrl) {
  if (!metadataUrl) {
    return {
      ...emptyNowPlaying,
      status: 'unavailable',
      title: 'Metadados indisponíveis',
      detail: 'URL de metadata não configurada.',
      checkedAt: new Date().toISOString()
    }
  }

  const params = new URLSearchParams({ url: metadataUrl })

  try {
    const response = await fetch(`${API_BASE_URL}/api/now-playing?${params.toString()}`, {
      cache: 'no-store'
    })

    if (!response.ok) {
      throw new Error(`API HTTP ${response.status}`)
    }

    return await response.json()
  } catch (error) {
    return {
      ...emptyNowPlaying,
      status: 'unavailable',
      title: 'Metadados indisponíveis',
      checkedAt: new Date().toISOString(),
      detail: `API de metadata indisponível: ${error.message}.`
    }
  }
}