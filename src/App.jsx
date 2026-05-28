import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
import { apiUrl } from './lib/apiBaseUrl'
import { emptyNowPlaying, fetchNowPlaying } from './lib/nowPlaying'
import { watchStreams } from './lib/watchStream'
import logoGTF from './images/logogtf.png'

const METADATA_REFRESH_MS = 60000
const WAVEFORM_LEVEL_UPDATE_MS = 90
const AUDIO_PLAY_RETRY_COUNT = 3
const AUDIO_PLAY_RETRY_DELAY_MS = 450
const AUDIO_AUTO_RECONNECT_DELAY_MS = 1200
const AUDIO_START_BATCH_SIZE = 4
const AUDIO_START_RECOVERY_ATTEMPTS = 4
const AUDIO_START_RECOVERY_DELAY_MS = 1800
const AUDIO_PROXY_FAILURE_COOLDOWN_MS = 300000
const STREAM_CHANNEL = 'stream'
const FM_CHANNEL = 'fm'

function wait(ms) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms)
  })
}

async function runInBatches(items, batchSize, worker) {
  const results = []

  for (let index = 0; index < items.length; index += batchSize) {
    const batch = items.slice(index, index + batchSize)
    const batchResults = await Promise.allSettled(batch.map(worker))
    results.push(...batchResults)
  }

  return results
}

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

function createFmProbeState() {
  return Object.fromEntries(
    streams.map((stream) => [
      stream.id,
      {
        status: stream.fmMonitorUrl ? 'idle' : 'unconfigured',
        detail: stream.fmMonitorUrl ? 'Aguardando primeira verificação do FM.' : 'Link de monitoramento FM pendente.',
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
        isMuted: true,
        volume: 1
      }
    ])
  )
}

function createFmAudioState() {
  return Object.fromEntries(
    streams.map((stream) => [
      stream.id,
      {
        isPlaying: false,
        isMuted: true,
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

  return apiUrl(`/api/audio?${params.toString()}`)
}

function buildFmPlaybackUrl(stream, cacheBust = Date.now()) {
  if (!stream.fmMonitorUrl) return null

  const params = new URLSearchParams({
    url: stream.fmMonitorUrl,
    _: String(cacheBust)
  })

  if (stream.fmFallbackUrl) {
    params.set('fallbackUrl', stream.fmFallbackUrl)
  }

  return apiUrl(`/api/audio?${params.toString()}`)
}

function getDirectPlaybackUrl(stream) {
  return stream.streamUrl
}

function getDirectFmPlaybackUrl(stream) {
  return stream.fmMonitorUrl
}

function getAudioKey(streamId, channel = STREAM_CHANNEL) {
  return channel === FM_CHANNEL ? `${streamId}:fm` : streamId
}

function mergeProbeState(currentProbe, nextProbe) {
  if (currentProbe?.status === 'online' && nextProbe.status === 'checking') {
    return {
      ...currentProbe,
      checkedAt: nextProbe.checkedAt
    }
  }

  return nextProbe
}

export default function App() {
  const audioRefs = useRef({})
  const audioContextRef = useRef(null)
  const sourceNodesRef = useRef({})
  const gainNodesRef = useRef({})
  const previousStatusesRef = useRef({})
  const lastWaveformUpdateRef = useRef({})
  const reconnectTimersRef = useRef({})
  const audioStatesRef = useRef({})
  const fmAudioStatesRef = useRef({})
  const selectedIdSetRef = useRef(new Set(allStreamIds))
  const isAudioMonitoringActiveRef = useRef(false)
  const startSequenceRef = useRef(0)
  const proxyFailureUntilRef = useRef({})
  const [probeStates, setProbeStates] = useState(createProbeState)
  const [fmProbeStates, setFmProbeStates] = useState(createFmProbeState)
  const [nowPlayingStates, setNowPlayingStates] = useState(createNowPlayingState)
  const [audioStates, setAudioStates] = useState(createAudioState)
  const [fmAudioStates, setFmAudioStates] = useState(createFmAudioState)
  const [meterNodes, setMeterNodes] = useState({})
  const [waveformPeaks, setWaveformPeaks] = useState(() =>
    Object.fromEntries(
      streams.flatMap((stream) => [
        [getAudioKey(stream.id, STREAM_CHANNEL), new Array(96).fill(0.03)],
        [getAudioKey(stream.id, FM_CHANNEL), new Array(96).fill(0.03)]
      ])
    )
  )
  const [isMonitoring, setIsMonitoring] = useState(false)
  const [alerts, setAlerts] = useState([])
  const [columns, setColumns] = useState(4)
  const [selectedStreamIds, setSelectedStreamIds] = useState(allStreamIds)
  const [singleStreamId, setSingleStreamId] = useState(allStreamIds[0])
  const [isFilterOpen, setIsFilterOpen] = useState(false)
  const [hasStartedAudioMonitoring, setHasStartedAudioMonitoring] = useState(false)
  const [isStartingAudioMonitoring, setIsStartingAudioMonitoring] = useState(false)

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

  const getEffectiveMute = (streamId, audioState = audioStates[streamId]) =>
    Boolean(audioState?.isMuted)

  useEffect(() => {
    audioStatesRef.current = audioStates
  }, [audioStates])

  useEffect(() => {
    fmAudioStatesRef.current = fmAudioStates
  }, [fmAudioStates])

  useEffect(() => {
    selectedIdSetRef.current = selectedIdSet
  }, [selectedIdSet])

  useEffect(() => {
    isAudioMonitoringActiveRef.current = hasStartedAudioMonitoring
  }, [hasStartedAudioMonitoring])

  useEffect(() => {
    streams.forEach((stream) => {
      const audio = new Audio(buildPlaybackUrl(stream))
      audio.preload = 'none'
      audio.crossOrigin = 'anonymous'
      audio.dataset.playbackMode = 'proxy'

      const handlePlaybackIssue = () => scheduleAudioReconnect(stream, STREAM_CHANNEL)
      const handlePlaybackStarted = () => markChannelPlaying(stream.id, STREAM_CHANNEL, true)

      audio.addEventListener('ended', handlePlaybackIssue)
      audio.addEventListener('error', handlePlaybackIssue)
      audio.addEventListener('playing', handlePlaybackStarted)
      audioRefs.current[stream.id] = audio

      if (stream.fmMonitorUrl) {
        const fmAudio = new Audio(buildFmPlaybackUrl(stream))
        const fmAudioKey = getAudioKey(stream.id, FM_CHANNEL)
        fmAudio.preload = 'none'
        fmAudio.crossOrigin = 'anonymous'
        fmAudio.dataset.playbackMode = 'proxy'

        const handleFmPlaybackIssue = () => scheduleAudioReconnect(stream, FM_CHANNEL)
        const handleFmPlaybackStarted = () => markChannelPlaying(stream.id, FM_CHANNEL, true)

        fmAudio.addEventListener('ended', handleFmPlaybackIssue)
        fmAudio.addEventListener('error', handleFmPlaybackIssue)
        fmAudio.addEventListener('playing', handleFmPlaybackStarted)
        audioRefs.current[fmAudioKey] = fmAudio
      }
    })

    return () => {
      Object.values(reconnectTimersRef.current).forEach((timerId) => {
        window.clearTimeout(timerId)
      })
      reconnectTimersRef.current = {}

      streams.forEach((stream) => {
        const streamKeys = [stream.id, getAudioKey(stream.id, FM_CHANNEL)]

        streamKeys.forEach((audioKey) => {
          const audio = audioRefs.current[audioKey]
          if (!audio) return

          audio.pause()
          audio.removeAttribute('data-playback-mode')
          audio.removeAttribute('src')
          audio.load()
        })
      })
    }
  }, [])

  const resetAudioSource = (stream, channel = STREAM_CHANNEL) => {
    const audioKey = getAudioKey(stream.id, channel)
    const audio = audioRefs.current[audioKey]
    const directUrl = channel === FM_CHANNEL ? getDirectFmPlaybackUrl(stream) : getDirectPlaybackUrl(stream)
    const shouldUseDirect = directUrl && (proxyFailureUntilRef.current[audioKey] ?? 0) > Date.now()
    const playbackUrl = shouldUseDirect
      ? directUrl
      : channel === FM_CHANNEL ? buildFmPlaybackUrl(stream) : buildPlaybackUrl(stream)

    if (!audio || !playbackUrl) return false

    audio.pause()
    audio.dataset.playbackMode = shouldUseDirect ? 'direct' : 'proxy'
    audio.src = playbackUrl
    audio.load()
    return true
  }

  const switchAudioToDirect = (stream, channel = STREAM_CHANNEL) => {
    const audioKey = getAudioKey(stream.id, channel)
    const audio = audioRefs.current[audioKey]
    const directUrl = channel === FM_CHANNEL ? getDirectFmPlaybackUrl(stream) : getDirectPlaybackUrl(stream)

    if (!audio || !directUrl) return false

    proxyFailureUntilRef.current[audioKey] = Date.now() + AUDIO_PROXY_FAILURE_COOLDOWN_MS
    audio.dataset.playbackMode = 'direct'
    audio.src = directUrl
    audio.load()
    return true
  }

  const ensureAudioGraph = (streamId, channel = STREAM_CHANNEL, audioState = audioStates[streamId]) => {
    const audioKey = getAudioKey(streamId, channel)
    const audio = audioRefs.current[audioKey]
    if (!audio) return null

    const AudioContextConstructor = window.AudioContext || window.webkitAudioContext
    if (!AudioContextConstructor) return null

    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContextConstructor()
    }

    if (audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume().catch(() => {})
    }

    if (!sourceNodesRef.current[audioKey]) {
      const sourceNode = audioContextRef.current.createMediaElementSource(audio)
      const gainNode = audioContextRef.current.createGain()

      audio.muted = false
      audio.volume = 1
      gainNode.gain.value = getEffectiveMute(streamId, audioState) ? 0 : audioState?.volume ?? 1
      sourceNode.connect(gainNode)
      gainNode.connect(audioContextRef.current.destination)

      sourceNodesRef.current[audioKey] = sourceNode
      gainNodesRef.current[audioKey] = gainNode

      setMeterNodes((state) => ({
        ...state,
        [audioKey]: {
          audioContext: audioContextRef.current,
          sourceNode
        }
      }))
    }

    return sourceNodesRef.current[audioKey]
  }

  const setOutputGain = (streamId, volume, isMuted, channel = STREAM_CHANNEL) => {
    const audioKey = getAudioKey(streamId, channel)
    const audioContext = audioContextRef.current
    const gainNode = gainNodesRef.current[audioKey]

    if (!gainNode || !audioContext) return

    gainNode.gain.setTargetAtTime(isMuted ? 0 : volume, audioContext.currentTime, 0.015)
  }

  const prepareAudio = (stream, channel = STREAM_CHANNEL, audioState = audioStates[stream.id]) => {
    const audioKey = getAudioKey(stream.id, channel)
    const audio = audioRefs.current[audioKey]
    if (!audio) return false

    try {
      ensureAudioGraph(stream.id, channel, audioState)
      return true
    } catch {
      return false
    }
  }

  const markChannelPlaying = (streamId, channel = STREAM_CHANNEL, isPlaying) => {
    const setter = channel === FM_CHANNEL ? setFmAudioStates : setAudioStates

    setter((state) => ({
      ...state,
      [streamId]: {
        ...state[streamId],
        isPlaying
      }
    }))
  }

  const playPreparedAudio = async (stream, channel = STREAM_CHANNEL) => {
    const audioKey = getAudioKey(stream.id, channel)
    const audio = audioRefs.current[audioKey]
    if (!audio) return false

    for (let attempt = 0; attempt < AUDIO_PLAY_RETRY_COUNT; attempt += 1) {
      try {
        if (attempt > 0) {
          resetAudioSource(stream, channel)
          await wait(AUDIO_PLAY_RETRY_DELAY_MS * attempt)
        }

        await audio.play()
        markChannelPlaying(stream.id, channel, true)
        return true
      } catch {
        if (audio.dataset.playbackMode === 'proxy' && switchAudioToDirect(stream, channel)) {
          try {
            await wait(AUDIO_PLAY_RETRY_DELAY_MS)
            await audio.play()
            markChannelPlaying(stream.id, channel, true)
            return true
          } catch {
            audio.load()
          }
        }
      }
    }

    markChannelPlaying(stream.id, channel, false)
    return false
  }

  const scheduleAudioReconnect = (stream, channel = STREAM_CHANNEL) => {
    const audioKey = getAudioKey(stream.id, channel)
    const audio = audioRefs.current[audioKey]

    if (!audio || !isAudioMonitoringActiveRef.current) return
    if (reconnectTimersRef.current[audioKey]) return

    if (audio.dataset.playbackMode === 'proxy') {
      const directUrl = channel === FM_CHANNEL ? getDirectFmPlaybackUrl(stream) : getDirectPlaybackUrl(stream)
      if (directUrl) {
        proxyFailureUntilRef.current[audioKey] = Date.now() + AUDIO_PROXY_FAILURE_COOLDOWN_MS
      }
    }

    reconnectTimersRef.current[audioKey] = window.setTimeout(async () => {
      delete reconnectTimersRef.current[audioKey]

      const state = channel === FM_CHANNEL ? fmAudioStatesRef.current : audioStatesRef.current
      if (!selectedIdSetRef.current.has(stream.id) || !isAudioMonitoringActiveRef.current) return

      resetAudioSource(stream, channel)
      prepareAudio(stream, channel, state[stream.id])
      await playPreparedAudio(stream, channel)
    }, AUDIO_AUTO_RECONNECT_DELAY_MS)
  }

  const reconnectAndPlay = async (stream, channel = STREAM_CHANNEL) => {
    const state = channel === FM_CHANNEL ? fmAudioStatesRef.current : audioStatesRef.current
    const audioKey = getAudioKey(stream.id, channel)

    if (reconnectTimersRef.current[audioKey]) {
      window.clearTimeout(reconnectTimersRef.current[audioKey])
      delete reconnectTimersRef.current[audioKey]
    }

    resetAudioSource(stream, channel)
    prepareAudio(stream, channel, state[stream.id])

    if (!isAudioMonitoringActiveRef.current) return false

    return playPreparedAudio(stream, channel)
  }

  const isChannelPlaybackActive = (streamId, channel = STREAM_CHANNEL) => {
    const audio = audioRefs.current[getAudioKey(streamId, channel)]
    return Boolean(audio && !audio.paused && !audio.ended)
  }

  const recoverMissingStartedStreams = async (streamsToRecover, channel = STREAM_CHANNEL, sequence) => {
    const playableStreams = channel === FM_CHANNEL
      ? streamsToRecover.filter((stream) => stream.fmMonitorUrl)
      : streamsToRecover

    for (let attempt = 0; attempt < AUDIO_START_RECOVERY_ATTEMPTS; attempt += 1) {
      await wait(AUDIO_START_RECOVERY_DELAY_MS)

      if (startSequenceRef.current !== sequence || !isAudioMonitoringActiveRef.current) return

      const missingStreams = playableStreams.filter((stream) =>
        selectedIdSetRef.current.has(stream.id) && !isChannelPlaybackActive(stream.id, channel)
      )

      if (missingStreams.length === 0) return

      await runInBatches(missingStreams, AUDIO_START_BATCH_SIZE, (stream) => reconnectAndPlay(stream, channel))
    }
  }

  const startStreams = async (streamsToStart, channel = STREAM_CHANNEL, state = audioStates) => {
    const playableStreams = channel === FM_CHANNEL
      ? streamsToStart.filter((stream) => stream.fmMonitorUrl)
      : streamsToStart
    const preparedStreams = playableStreams.filter((stream) => prepareAudio(stream, channel, state[stream.id]))

    const results = await runInBatches(preparedStreams, AUDIO_START_BATCH_SIZE, (stream) => playPreparedAudio(stream, channel))
    const playedStreamIds = []

    results.forEach((result, index) => {
      if (result.status === 'fulfilled' && result.value) {
        playedStreamIds.push(preparedStreams[index].id)
      }
    })

    return playedStreamIds
  }

  useEffect(() => {
    Object.entries(audioRefs.current).forEach(([audioKey, audio]) => {
      const streamId = audioKey.replace(/:fm$/, '')
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

    setFmAudioStates((state) =>
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
          if (nowPlaying.status === 'unavailable' && !['idle', 'unavailable'].includes(current[streamId]?.status)) {
            return
          }

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
        [stream.id]: mergeProbeState(state[stream.id], probe)
      }))

      const previousStatus = previousStatusesRef.current[stream.id]
      const nextStatus = previousStatus === 'online' && probe.status === 'checking' ? previousStatus : probe.status
      previousStatusesRef.current[stream.id] = nextStatus

      if (previousStatus === 'online' && ['offline', 'timeout'].includes(nextStatus)) {
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

  useEffect(() => {
    const fmStreamsToWatch = monitoredStreams
      .filter((stream) => stream.fmMonitorUrl)
      .map((stream) => ({
        id: stream.id,
        streamUrl: stream.fmMonitorUrl,
        fallbackUrl: stream.fmFallbackUrl
      }))

    setFmProbeStates((state) => {
      const nextState = { ...state }
      monitoredStreams.forEach((stream) => {
        if (!stream.fmMonitorUrl) {
          nextState[stream.id] = {
            ...nextState[stream.id],
            status: 'unconfigured',
            detail: 'Link de monitoramento FM pendente.',
            checkedAt: null,
            latencyMs: null
          }
        }
      })
      return nextState
    })

    if (fmStreamsToWatch.length === 0) {
      return () => {}
    }

    const handleFmStatus = (probe) => {
      setFmProbeStates((state) => ({
        ...state,
        [probe.id]: mergeProbeState(state[probe.id], probe)
      }))
    }

    const cleanupWatcher = watchStreams({
      streams: fmStreamsToWatch,
      onStatus: handleFmStatus,
      onError: (probe) => {
        fmStreamsToWatch.forEach((stream) => {
          handleFmStatus({ id: stream.id, ...probe })
        })
      }
    })

    return () => {
      cleanupWatcher()
    }
  }, [monitoredStreams])

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

  const handleToggleFmMute = (streamId) => {
    const audioKey = getAudioKey(streamId, FM_CHANNEL)
    const audio = audioRefs.current[audioKey]
    if (!audio) return

    const nextMuted = !fmAudioStates[streamId]?.isMuted
    audio.muted = false
    audio.volume = 1
    setOutputGain(streamId, fmAudioStates[streamId]?.volume ?? 1, getEffectiveMute(streamId, { ...fmAudioStates[streamId], isMuted: nextMuted }), FM_CHANNEL)

    setFmAudioStates((state) => ({
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

  const handleFmVolumeChange = (streamId, nextVolume) => {
    const audioKey = getAudioKey(streamId, FM_CHANNEL)
    const audio = audioRefs.current[audioKey]
    if (audio) {
      audio.volume = 1
      audio.muted = false
    }

    setOutputGain(streamId, nextVolume, getEffectiveMute(streamId, { ...fmAudioStates[streamId], volume: nextVolume, isMuted: nextVolume === 0 }), FM_CHANNEL)

    setFmAudioStates((state) => ({
      ...state,
      [streamId]: {
        ...state[streamId],
        volume: nextVolume,
        isMuted: nextVolume === 0 ? true : state[streamId].isMuted && nextVolume === 0
      }
    }))
  }

  const handleReconnect = async (streamId) => {
    const stream = streams.find((item) => item.id === streamId)
    if (!stream) return

    setProbeStates((state) => ({
      ...state,
      [streamId]: {
        ...state[streamId],
        status: 'checking',
        detail: 'Reconectando stream...'
      }
    }))

    await reconnectAndPlay(stream, STREAM_CHANNEL)

    const nowPlaying = await fetchNowPlaying(stream.metadataUrl)

    setNowPlayingStates((state) => ({
      ...state,
      [streamId]: nowPlaying
    }))
  }

  const handleFmReconnect = async (streamId) => {
    const stream = streams.find((item) => item.id === streamId)
    if (!stream?.fmMonitorUrl) return

    setFmProbeStates((state) => ({
      ...state,
      [streamId]: {
        ...state[streamId],
        status: 'checking',
        detail: 'Reconectando FM...'
      }
    }))

    await reconnectAndPlay(stream, FM_CHANNEL)
  }

  const handleStartMonitoring = async () => {
    if (isStartingAudioMonitoring) return

    const sequence = startSequenceRef.current + 1
    startSequenceRef.current = sequence
    isAudioMonitoringActiveRef.current = true
    setHasStartedAudioMonitoring(true)
    setIsStartingAudioMonitoring(true)

    try {
      await Promise.allSettled([
        startStreams(monitoredStreams, STREAM_CHANNEL, audioStatesRef.current),
        startStreams(monitoredStreams, FM_CHANNEL, fmAudioStatesRef.current)
      ])

      await Promise.allSettled([
        recoverMissingStartedStreams(monitoredStreams, STREAM_CHANNEL, sequence),
        recoverMissingStartedStreams(monitoredStreams, FM_CHANNEL, sequence)
      ])
    } finally {
      if (startSequenceRef.current === sequence) {
        setIsStartingAudioMonitoring(false)
      }
    }
  }

  const handleMuteAll = () => {
    monitoredStreams.forEach((stream) => {
      const audio = audioRefs.current[stream.id]
      if (audio) {
        audio.volume = 1
        audio.muted = false
      }
      setOutputGain(stream.id, audioStates[stream.id]?.volume ?? 1, true)

      const fmAudioKey = getAudioKey(stream.id, FM_CHANNEL)
      const fmAudio = audioRefs.current[fmAudioKey]
      if (fmAudio) {
        fmAudio.volume = 1
        fmAudio.muted = false
      }
      setOutputGain(stream.id, fmAudioStates[stream.id]?.volume ?? 1, true, FM_CHANNEL)
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

    setFmAudioStates((state) => ({
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
    if (!hasStartedAudioMonitoring) {
      setHasStartedAudioMonitoring(true)
      isAudioMonitoringActiveRef.current = true
    }

    await Promise.allSettled(
      monitoredStreams.flatMap((stream) => [
        handleReconnect(stream.id),
        stream.fmMonitorUrl ? handleFmReconnect(stream.id) : Promise.resolve()
      ])
    )
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
    isAudioMonitoringActiveRef.current = false
    setHasStartedAudioMonitoring(false)
    setIsStartingAudioMonitoring(false)
    setIsFilterOpen(false)
  }

  const handleMonitorAll = () => {
    setSelectedStreamIds(allStreamIds)
    isAudioMonitoringActiveRef.current = false
    setHasStartedAudioMonitoring(false)
    setIsStartingAudioMonitoring(false)
    setIsFilterOpen(false)
  }

  const handleCycleColumns = () => {
    setColumns((current) => (current === 4 ? 1 : current + 1))
  }

  const handleMeterLevelsForKey = useCallback((waveformKey, levels) => {
    const [left = 0, right = 0] = levels ?? []
    const nextPeak = Math.max(0.03, Math.min(1, ((left + right) / 2) * 8))
    const now = performance.now()

    if (now - (lastWaveformUpdateRef.current[waveformKey] ?? 0) < WAVEFORM_LEVEL_UPDATE_MS) {
      return
    }

    lastWaveformUpdateRef.current[waveformKey] = now

    setWaveformPeaks((state) => {
      const current = state[waveformKey] ?? new Array(96).fill(0.03)
      return {
        ...state,
        [waveformKey]: [...current.slice(1), nextPeak]
      }
    })
  }, [])

  const handleMeterLevels = useCallback((streamId, levels) => {
    handleMeterLevelsForKey(getAudioKey(streamId, STREAM_CHANNEL), levels)
  }, [handleMeterLevelsForKey])

  const handleFmMeterLevels = useCallback((streamId, levels) => {
    handleMeterLevelsForKey(getAudioKey(streamId, FM_CHANNEL), levels)
  }, [handleMeterLevelsForKey])

  return (
    <main className="app-shell">
      
      <section className="control-bar" aria-label="Controles de monitoramento">
          <div className="gtf-logo-wrapper">
            <img src={logoGTF} alt="Grupo GTF" className="gtf-logo" />
          </div>
        <button type="button" className="control-button" onClick={handleStartMonitoring} disabled={monitoredStreams.length === 0 || isStartingAudioMonitoring}>
          <Headphones size={18} aria-hidden="true" />
          {isStartingAudioMonitoring ? 'Iniciando...' : hasStartedAudioMonitoring ? 'Monitoramento iniciado' : 'Iniciar monitoramento'}
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
              fmProbe={fmProbeStates[stream.id]}
              nowPlaying={nowPlayingStates[stream.id]}
              audioState={audioStates[stream.id]}
              fmAudioState={fmAudioStates[stream.id]}
              audioContext={meterNodes[getAudioKey(stream.id, STREAM_CHANNEL)]?.audioContext ?? null}
              sourceNode={meterNodes[getAudioKey(stream.id, STREAM_CHANNEL)]?.sourceNode ?? null}
              fmAudioContext={meterNodes[getAudioKey(stream.id, FM_CHANNEL)]?.audioContext ?? null}
              fmSourceNode={meterNodes[getAudioKey(stream.id, FM_CHANNEL)]?.sourceNode ?? null}
              waveformPeaks={waveformPeaks[getAudioKey(stream.id, STREAM_CHANNEL)]}
              fmWaveformPeaks={waveformPeaks[getAudioKey(stream.id, FM_CHANNEL)]}
              isMeterActive={hasStartedAudioMonitoring}
              onMeterLevels={handleMeterLevels}
              onFmMeterLevels={handleFmMeterLevels}
              onToggleMute={handleToggleMute}
              onToggleFmMute={handleToggleFmMute}
              onVolumeChange={handleVolumeChange}
              onFmVolumeChange={handleFmVolumeChange}
              onReconnect={handleReconnect}
              onFmReconnect={handleFmReconnect}
            />
          ))}
        </section>
      )}
    </main>
  )
}
