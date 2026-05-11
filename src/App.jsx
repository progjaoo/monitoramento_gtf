import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ChevronDown,
  Headphones,
  ListChecks,
  Monitor,
  RefreshCw,
  RotateCcw,
  Search,
  VolumeX
} from 'lucide-react'
import StreamCard from './components/StreamCard'
import { allStreamIds, streams } from './data/streams'
import { emptyNowPlaying, fetchNowPlaying } from './lib/nowPlaying'
import { watchStreams } from './lib/watchStream'

const METADATA_REFRESH_MS = 60000
const API_BASE_URL = import.meta.env.VITE_MONITOR_API_URL ?? 'http://localhost:8787'

function createProbeState() {
  return Object.fromEntries(
    streams.map((stream) => [
      stream.id,
      {
        status: 'idle',
        detail: 'Aguardando primeira verificação.',
        checkedAt: null,
        latencyMs: null
      }
    ])
  )
}

function createNowPlayingState() {
  return Object.fromEntries(streams.map((stream) => [stream.id, { ...emptyNowPlaying }]))
}

function createAudioState() {
  return Object.fromEntries(
    streams.map((stream) => [
      stream.id,
      {
        isPlaying: false,
        isMuted: false,
        volume: 1
      }
    ])
  )
}

function getStreamLabel(stream) {
  return `${stream.name} · ${stream.city} - ${stream.state}`
}

function isMetadataOffline(stream, nowPlaying) {
  return stream.metadataOfflineMeansDown && nowPlaying?.title?.trim().toLowerCase() === ''
}

function buildPlaybackUrl(stream, cacheBust = Date.now()) {
  const params = new URLSearchParams({
    url: stream.streamUrl,
    _: String(cacheBust)
  })

  if (stream.fallbackUrl) {
    params.set('fallbackUrl', stream.fallbackUrl)
  }

  return `${API_BASE_URL}/api/audio?${params.toString()}`
}

function getDirectPlaybackUrl(stream) {
  return stream.streamUrl
}

export default function App() {
  const audioRefs = useRef({})
  const audioContextRef = useRef(null)
  const sourceNodesRef = useRef({})
  const gainNodesRef = useRef({})
  const previousStatusesRef = useRef({})
  const [probeStates, setProbeStates] = useState(createProbeState)
  const [nowPlayingStates, setNowPlayingStates] = useState(createNowPlayingState)
  const [audioStates, setAudioStates] = useState(createAudioState)
  const [meterNodes, setMeterNodes] = useState({})
  const [waveformPeaks, setWaveformPeaks] = useState(() =>
    Object.fromEntries(streams.map((stream) => [stream.id, new Array(96).fill(0.03)]))
  )
  const [isMonitoring, setIsMonitoring] = useState(false)
  const [alerts, setAlerts] = useState([])
  const [columns, setColumns] = useState(4)
  const [selectedStreamIds, setSelectedStreamIds] = useState(allStreamIds)
  const [singleStreamId, setSingleStreamId] = useState(allStreamIds[0])
  const [isFilterOpen, setIsFilterOpen] = useState(false)
  const [soloStreamId, setSoloStreamId] = useState(null)
  const [hasStartedAudioMonitoring, setHasStartedAudioMonitoring] = useState(false)

  const selectedIdSet = useMemo(() => new Set(selectedStreamIds), [selectedStreamIds])
  const monitoredStreams = useMemo(
    () => streams.filter((stream) => selectedIdSet.has(stream.id)),
    [selectedIdSet]
  )
  const allSelected = selectedStreamIds.length === allStreamIds.length
  const onlineCount = monitoredStreams.filter(
    (stream) => probeStates[stream.id]?.status === 'online' && !isMetadataOffline(stream, nowPlayingStates[stream.id])
  ).length
  const unavailableCount = monitoredStreams.filter((stream) =>
    ['offline', 'timeout'].includes(probeStates[stream.id]?.status) || isMetadataOffline(stream, nowPlayingStates[stream.id])
  ).length
  const activeFilterLabel =
    allSelected
      ? 'Todas as rádios'
      : selectedStreamIds.length === 1
        ? streams.find((stream) => stream.id === selectedStreamIds[0])?.name
        : `${selectedStreamIds.length} rádios selecionadas`

  const getEffectiveMute = (streamId, audioState = audioStates[streamId], activeSoloId = soloStreamId) =>
    Boolean(audioState?.isMuted || !activeSoloId || activeSoloId !== streamId)

  useEffect(() => {
    streams.forEach((stream) => {
      const audio = new Audio(buildPlaybackUrl(stream))
      audio.preload = 'none'
      audio.crossOrigin = 'anonymous'
      audio.dataset.playbackMode = 'proxy'

      const handlePlaybackError = () => {
        if (audio.dataset.playbackMode !== 'proxy') return

        audio.dataset.playbackMode = 'direct'
        audio.src = getDirectPlaybackUrl(stream)
        audio.load()
      }

      audio.addEventListener('error', handlePlaybackError)
      audioRefs.current[stream.id] = audio
    })

    return () => {
      streams.forEach((stream) => {
        const audio = audioRefs.current[stream.id]
        if (!audio) return

        audio.pause()
        audio.removeAttribute('data-playback-mode')
        audio.removeAttribute('src')
        audio.load()
      })
    }
  }, [])

  const ensureAudioGraph = (streamId, activeSoloId = soloStreamId) => {
    const audio = audioRefs.current[streamId]
    if (!audio) return null

    const AudioContextConstructor = window.AudioContext || window.webkitAudioContext
    if (!AudioContextConstructor) return null

    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContextConstructor()
    }

    if (audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume().catch(() => {})
    }

    if (!sourceNodesRef.current[streamId]) {
      const sourceNode = audioContextRef.current.createMediaElementSource(audio)
      const gainNode = audioContextRef.current.createGain()
      const currentAudioState = audioStates[streamId]

      audio.muted = false
      audio.volume = 1
      gainNode.gain.value = getEffectiveMute(streamId, currentAudioState, activeSoloId) ? 0 : currentAudioState?.volume ?? 1
      sourceNode.connect(gainNode)
      gainNode.connect(audioContextRef.current.destination)

      sourceNodesRef.current[streamId] = sourceNode
      gainNodesRef.current[streamId] = gainNode

      setMeterNodes((state) => ({
        ...state,
        [streamId]: {
          audioContext: audioContextRef.current,
          sourceNode
        }
      }))
    }

    return sourceNodesRef.current[streamId]
  }

  const setOutputGain = (streamId, volume, isMuted) => {
    const audioContext = audioContextRef.current
    const gainNode = gainNodesRef.current[streamId]

    if (!gainNode || !audioContext) return

    gainNode.gain.setTargetAtTime(isMuted ? 0 : volume, audioContext.currentTime, 0.015)
  }

  const syncOutputGain = (streamId, audioState = audioStates[streamId], activeSoloId = soloStreamId) => {
    setOutputGain(streamId, audioState?.volume ?? 1, getEffectiveMute(streamId, audioState, activeSoloId))
  }

  const prepareAudio = (stream, activeSoloId = soloStreamId) => {
    const audio = audioRefs.current[stream.id]
    if (!audio) return false

    try {
      ensureAudioGraph(stream.id, activeSoloId)
      return true
    } catch {
      return false
    }
  }

  const playPreparedAudio = async (stream) => {
    const audio = audioRefs.current[stream.id]
    if (!audio) return false

    try {
      await audio.play()
      return true
    } catch {
      if (audio.dataset.playbackMode === 'proxy') {
        audio.dataset.playbackMode = 'direct'
        audio.src = getDirectPlaybackUrl(stream)
        audio.load()

        try {
          await audio.play()
          return true
        } catch {
          return false
        }
      }

      return false
    }
  }

  const startStreams = async (streamsToStart, activeSoloId = soloStreamId) => {
    const preparedStreams = streamsToStart.filter((stream) => prepareAudio(stream, activeSoloId))

    const results = await Promise.allSettled(preparedStreams.map((stream) => playPreparedAudio(stream)))
    const playedStreamIds = []

    results.forEach((result, index) => {
      if (result.status === 'fulfilled' && result.value) {
        playedStreamIds.push(preparedStreams[index].id)
      }
    })

    return playedStreamIds
  }

  useEffect(() => {
    Object.entries(audioRefs.current).forEach(([streamId, audio]) => {
      if (selectedIdSet.has(streamId)) return

      audio.pause()
    })

    setAudioStates((state) =>
      Object.fromEntries(
        Object.entries(state).map(([streamId, value]) => [
          streamId,
          {
            ...value,
            isPlaying: selectedIdSet.has(streamId) ? value.isPlaying : false
          }
        ])
      )
    )

    if (soloStreamId && !selectedIdSet.has(soloStreamId)) {
      setSoloStreamId(null)
    }
  }, [selectedIdSet])

  useEffect(() => {
    let cancelled = false

    async function refreshMetadata() {
      if (monitoredStreams.length === 0) {
        return
      }

      const results = await Promise.all(
        monitoredStreams.map(async (stream) => {
          const nowPlaying = await fetchNowPlaying(stream.metadataUrl)
          return [stream.id, nowPlaying]
        })
      )

      if (cancelled) return

      setNowPlayingStates((current) => {
        const nextState = { ...current }
        results.forEach(([streamId, nowPlaying]) => {
          nextState[streamId] = nowPlaying
        })
        return nextState
      })
    }

    refreshMetadata()
    const intervalId = window.setInterval(refreshMetadata, METADATA_REFRESH_MS)

    return () => {
      cancelled = true
      window.clearInterval(intervalId)
    }
  }, [monitoredStreams])

  useEffect(() => {
    if (monitoredStreams.length === 0) {
      setIsMonitoring(false)
      return () => {}
    }

    setIsMonitoring(true)

    const handleStatus = (probe) => {
      const stream = streams.find((item) => item.id === probe.id)
      if (!stream) return

      setProbeStates((state) => ({
        ...state,
        [stream.id]: probe
      }))

      if (probe.status === 'online') {
        const nextPeak = Math.max(0.03, Math.min(1, ((probe.levelL ?? 1) + (probe.levelR ?? 1)) / 20))
        setWaveformPeaks((state) => {
          const current = state[stream.id] ?? new Array(96).fill(0.03)
          return {
            ...state,
            [stream.id]: [...current.slice(1), nextPeak]
          }
        })
      }

      const previousStatus = previousStatusesRef.current[stream.id]
      previousStatusesRef.current[stream.id] = probe.status

      if (previousStatus === 'online' && ['offline', 'timeout'].includes(probe.status)) {
        const alert = {
          id: `${stream.id}-${Date.now()}`,
          streamName: stream.name,
          detail: probe.detail,
          time: new Date(probe.checkedAt).toLocaleTimeString('pt-BR')
        }

        setAlerts((current) => [alert, ...current].slice(0, 5))

        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification(`${stream.name} caiu`, {
            body: probe.detail
          })
        }
      }
    }

    const cleanupWatcher = watchStreams({
      streams: monitoredStreams,
      onStatus: handleStatus,
      onError: (probe) => {
        monitoredStreams.forEach((stream) => {
          handleStatus({ id: stream.id, ...probe })
        })
      }
    })

    return () => {
      cleanupWatcher()
      setIsMonitoring(false)
    }
  }, [monitoredStreams])

  const handleTogglePlay = async (streamId) => {
    const audio = audioRefs.current[streamId]
    if (!audio) return

    const currentState = audioStates[streamId]

    if (currentState.isPlaying) {
      audio.pause()
      audio.currentTime = 0
      setAudioStates((state) => ({
        ...state,
        [streamId]: {
          ...state[streamId],
          isPlaying: false
        }
      }))
      return
    }

    try {
      const stream = streams.find((item) => item.id === streamId)
      const playedStreamIds = stream ? await startStreams([stream]) : []
      if (!playedStreamIds.includes(streamId)) {
        throw new Error('Falha ao reproduzir áudio.')
      }

      setAudioStates((state) => ({
        ...state,
        [streamId]: {
          ...state[streamId],
          isPlaying: true
        }
      }))
    } catch {
      setProbeStates((state) => ({
        ...state,
        [streamId]: {
          ...state[streamId],
          status: 'offline',
          detail: 'O navegador bloqueou a reprodução ou o stream falhou.',
          checkedAt: new Date().toISOString(),
          latencyMs: state[streamId].latencyMs
        }
      }))
    }
  }

  const handleToggleMute = (streamId) => {
    const audio = audioRefs.current[streamId]
    if (!audio) return

    const nextMuted = !audioStates[streamId]?.isMuted
    audio.muted = false
    audio.volume = 1
    setOutputGain(streamId, audioStates[streamId]?.volume ?? 1, getEffectiveMute(streamId, { ...audioStates[streamId], isMuted: nextMuted }))

    setAudioStates((state) => ({
      ...state,
      [streamId]: {
        ...state[streamId],
        isMuted: nextMuted
      }
    }))
  }

  const handleVolumeChange = (streamId, nextVolume) => {
    const audio = audioRefs.current[streamId]
    if (audio) {
      audio.volume = 1
      audio.muted = false
    }

    setOutputGain(streamId, nextVolume, getEffectiveMute(streamId, { ...audioStates[streamId], volume: nextVolume, isMuted: nextVolume === 0 }))

    setAudioStates((state) => ({
      ...state,
      [streamId]: {
        ...state[streamId],
        volume: nextVolume,
        isMuted: nextVolume === 0 ? true : state[streamId].isMuted && nextVolume === 0
      }
    }))
  }

  const handleReconnect = async (streamId) => {
    const audio = audioRefs.current[streamId]
    if (!audio) return

    const stream = streams.find((item) => item.id === streamId)
    if (!stream) return

    audio.pause()
    audio.dataset.playbackMode = 'proxy'
    audio.src = buildPlaybackUrl(stream)
    audio.load()

    setProbeStates((state) => ({
      ...state,
      [streamId]: {
        ...state[streamId],
        status: 'checking',
        detail: 'Reconectando stream...'
      }
    }))

    const nowPlaying = await fetchNowPlaying(stream.metadataUrl)

    setNowPlayingStates((state) => ({
      ...state,
      [streamId]: nowPlaying
    }))
  }

  const handleSolo = async (streamId) => {
    const nextSoloId = soloStreamId === streamId ? null : streamId
    const stream = monitoredStreams.find((item) => item.id === streamId)
    const playedStreamIds = []

    setHasStartedAudioMonitoring(true)
    setSoloStreamId(nextSoloId)

    Object.entries(audioRefs.current).forEach(([id, audio]) => {
      if (!nextSoloId || id !== streamId) {
        audio.pause()
      }
    })

    if (stream && nextSoloId) {
      const playedIds = await startStreams([stream], nextSoloId)
      playedStreamIds.push(...playedIds)
      syncOutputGain(stream.id, audioStates[stream.id], nextSoloId)
    }

    const playedIdSet = new Set(playedStreamIds)

    setAudioStates((state) => ({
      ...state,
      ...Object.fromEntries(
        monitoredStreams.map((stream) => [
          stream.id,
          {
            ...state[stream.id],
            isPlaying: stream.id === streamId ? playedIdSet.has(stream.id) : false
          }
        ])
      )
    }))
  }

  const handleStartMonitoring = () => {
    setSoloStreamId(null)
    setHasStartedAudioMonitoring(true)

    setAudioStates((state) => ({
      ...state,
      ...Object.fromEntries(
        monitoredStreams.map((stream) => [
          stream.id,
          {
            ...state[stream.id],
            isPlaying: false
          }
        ])
      )
    }))
  }

  const handleMuteAll = () => {
    monitoredStreams.forEach((stream) => {
      const audio = audioRefs.current[stream.id]
      if (audio) {
        audio.volume = 1
        audio.muted = false
      }
      setOutputGain(stream.id, audioStates[stream.id]?.volume ?? 1, true)
    })

    setAudioStates((state) => ({
      ...state,
      ...Object.fromEntries(
        monitoredStreams.map((stream) => [
          stream.id,
          {
            ...state[stream.id],
            isMuted: true
          }
        ])
      )
    }))
  }

  const handleReconnectAll = async () => {
    for (const stream of monitoredStreams) {
      await handleReconnect(stream.id)
    }
  }

  const handleToggleStreamSelection = (streamId) => {
    setSelectedStreamIds((current) => {
      const nextSet = new Set(current)

      if (nextSet.has(streamId)) {
        nextSet.delete(streamId)
      } else {
        nextSet.add(streamId)
      }

      return streams.filter((stream) => nextSet.has(stream.id)).map((stream) => stream.id)
    })
  }

  const handleMonitorSingle = () => {
    if (!singleStreamId) return
    setSelectedStreamIds([singleStreamId])
    setSoloStreamId(null)
    setHasStartedAudioMonitoring(false)
    setIsFilterOpen(false)
  }

  const handleMonitorAll = () => {
    setSelectedStreamIds(allStreamIds)
    setSoloStreamId(null)
    setHasStartedAudioMonitoring(false)
    setIsFilterOpen(false)
  }

  const handleCycleColumns = () => {
    setColumns((current) => (current === 4 ? 1 : current + 1))
  }

  return (
    <main className="app-shell">
      <section className="control-bar" aria-label="Controles de monitoramento">
        <button type="button" className="control-button" onClick={handleStartMonitoring} disabled={monitoredStreams.length === 0}>
          <Headphones size={18} aria-hidden="true" />
          {hasStartedAudioMonitoring ? 'Monitoramento iniciado' : 'Iniciar monitoramento'}
        </button>
        <button type="button" className="control-button is-mute" onClick={handleMuteAll} disabled={monitoredStreams.length === 0}>
          <VolumeX size={18} aria-hidden="true" />
          Mutar todos
        </button>
        <button type="button" className="control-button is-primary" onClick={handleReconnectAll} disabled={monitoredStreams.length === 0}>
          <RefreshCw size={18} aria-hidden="true" />
          Reconectar todos
        </button>
        <button type="button" className="control-button" onClick={handleCycleColumns}>
          <Monitor size={18} aria-hidden="true" />
          Alterar modo ({columns} coluna{columns > 1 ? 's' : ''})
        </button>
        <div className="column-switcher" aria-label="Quantidade de colunas">
          {[1, 2, 3, 4].map((columnCount) => (
            <button
              key={columnCount}
              type="button"
              className={`column-button ${columns === columnCount ? 'is-active' : ''}`}
              onClick={() => setColumns(columnCount)}
              title={`Exibir em ${columnCount} coluna${columnCount > 1 ? 's' : ''}`}
            >
              {columnCount}
            </button>
          ))}
        </div>

        <div className="toolbar-spacer" />

        <div className="single-picker">
          <select value={singleStreamId} onChange={(event) => setSingleStreamId(event.target.value)}>
            {streams.map((stream) => (
              <option key={stream.id} value={stream.id}>
                {getStreamLabel(stream)}
              </option>
            ))}
          </select>
          <button type="button" className="control-button" onClick={handleMonitorSingle} title="Monitorar somente esta rádio">
            <Search size={18} aria-hidden="true" />
            Monitorar uma
          </button>
        </div>

        <div className="filter-menu">
          <button
            type="button"
            className="control-button"
            onClick={() => setIsFilterOpen((current) => !current)}
            aria-expanded={isFilterOpen}
            title="Escolher rádios específicas"
          >
            <ListChecks size={18} aria-hidden="true" />
            Rádios específicas
            <ChevronDown size={16} aria-hidden="true" />
          </button>

          {isFilterOpen && (
            <div className="filter-popover">
              <label className="check-row">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={(event) => {
                    if (event.target.checked) {
                      handleMonitorAll()
                    } else {
                      setSelectedStreamIds([])
                    }
                  }}
                />
                <span>Todas as rádios</span>
              </label>

              <div className="check-list">
                {streams.map((stream) => (
                  <label key={stream.id} className="check-row">
                    <input
                      type="checkbox"
                      checked={selectedIdSet.has(stream.id)}
                      onChange={() => handleToggleStreamSelection(stream.id)}
                    />
                    <span>{getStreamLabel(stream)}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>

        <button type="button" className="control-button" onClick={handleMonitorAll} title="Voltar a monitorar todas as rádios">
          <RotateCcw size={18} aria-hidden="true" />
          Voltar ao normal
        </button>
      </section>

      <p className="source-note"></p>

     {/*  <div className="monitoring-context">
        <span>{activeFilterLabel}</span>
        <span>{onlineCount} online</span>
        <span>{unavailableCount} offline</span>
        <span>{isMonitoring ? 'Monitoramento contínuo ativo' : 'Monitoramento parado'}</span>
      </div> */}

      {alerts.length > 0 && (
        <section className="alerts-panel" aria-label="Alertas de queda">
          {alerts.map((alert) => (
            <article key={alert.id} className="alert-item">
              <strong>{alert.streamName} caiu</strong>
              <span>{alert.time}</span>
              <p>{alert.detail}</p>
              <button type="button" onClick={() => setAlerts((current) => current.filter((item) => item.id !== alert.id))}>
                Fechar
              </button>
            </article>
          ))}
        </section>
      )}

      {monitoredStreams.length === 0 ? (
        <section className="empty-state">
          <h2>Nenhuma rádio selecionada</h2>
          <button type="button" className="control-button is-primary" onClick={handleMonitorAll}>
            <RotateCcw size={18} aria-hidden="true" />
            Monitorar todas
          </button>
        </section>
      ) : (
        <section className="streams-grid" style={{ '--grid-columns': columns }}>
          {monitoredStreams.map((stream) => (
            <StreamCard
              key={stream.id}
              stream={stream}
              probe={probeStates[stream.id]}
              nowPlaying={nowPlayingStates[stream.id]}
              audioState={audioStates[stream.id]}
              audioElement={audioRefs.current[stream.id]}
              audioContext={meterNodes[stream.id]?.audioContext ?? null}
              sourceNode={meterNodes[stream.id]?.sourceNode ?? null}
              waveformPeaks={waveformPeaks[stream.id]}
              isMeterActive={hasStartedAudioMonitoring}
              onTogglePlay={handleTogglePlay}
              onToggleMute={handleToggleMute}
              onVolumeChange={handleVolumeChange}
              onReconnect={handleReconnect}
              onSolo={handleSolo}
            />
          ))}
        </section>
      )}
    </main>
  )
}
