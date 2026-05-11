import { useEffect, useRef } from 'react'
import { Music2, Play, RefreshCw, Volume2, VolumeX } from 'lucide-react'
import WaveSurfer from 'wavesurfer.js'
import AudioMeterReact from './AudioMeterReact'

function StatusDot({ status, muted }) {
  return (
    <span className={`status-dot status-${status} ${muted ? 'is-muted' : ''}`}>
      {muted ? <VolumeX size={14} aria-hidden="true" /> : <Volume2 size={14} aria-hidden="true" />}
    </span>
  )
}

function AudioMeter({ active, audioContext, sourceNode, levels }) {
  return (
    <div className="vu-wrap" aria-label="Medidor L R">
      <AudioMeterReact active={active} audioContext={audioContext} sourceNode={sourceNode} levels={levels} />
    </div>
  )
}

function Fader({ volume, onVolumeChange }) {
  const volumePercent = Math.round(volume * 100)

  return (
    <div className="fader">
      <span className="fader-value">{volumePercent}%</span>
      <input
        className="fader-input"
        type="range"
        min="0"
        max="100"
        value={volumePercent}
        aria-label="Volume"
        onChange={(event) => onVolumeChange(Number(event.target.value) / 100)}
      />
    </div>
  )
}

function Waveform({ active, audioElement, peaks }) {
  const containerRef = useRef(null)
  const wavesurferRef = useRef(null)

  useEffect(() => {
    if (!containerRef.current || !audioElement) return undefined

    const wavesurfer = WaveSurfer.create({
      container: containerRef.current,
      media: audioElement,
      backend: 'MediaElement',
      waveColor: 'rgba(180, 183, 190, 0.46)',
      progressColor: 'rgba(185, 204, 255, 0.92)',
      cursorColor: 'transparent',
      cursorWidth: 0,
      barWidth: 3,
      barGap: 3,
      barRadius: 2,
      height: 76,
      interact: false,
      normalize: true,
      peaks: peaks ? [peaks] : undefined,
      duration: 30
    })

    wavesurferRef.current = wavesurfer

    return () => {
      wavesurfer.destroy()
      wavesurferRef.current = null
    }
  }, [audioElement])

  useEffect(() => {
    if (!wavesurferRef.current || !peaks?.length) return

    wavesurferRef.current.setOptions({
      waveColor: active ? 'rgba(180, 183, 190, 0.48)' : 'rgba(202, 74, 76, 0.4)',
      progressColor: active ? 'rgba(185, 204, 255, 0.92)' : 'rgba(202, 74, 76, 0.7)',
      peaks: [peaks],
      duration: 30
    })
  }, [active, peaks])

  return <div ref={containerRef} className={`waveform ${active ? 'is-live' : 'is-down'}`} />
}

export default function StreamCard({
  stream,
  probe,
  nowPlaying,
  audioState,
  audioElement,
  audioContext,
  sourceNode,
  waveformPeaks,
  isMeterActive,
  onToggleMute,
  onVolumeChange,
  onReconnect,
  onSolo
}) {
  const isMetadataOffline = stream.metadataOfflineMeansDown && nowPlaying.title?.trim().toLowerCase() === 'station offline'
  const isOnline = probe.status === 'online' && !isMetadataOffline
  const isOffline = ['offline', 'timeout'].includes(probe.status) || isMetadataOffline
  const location = stream.city === 'Não informado' ? stream.state : `${stream.city} - ${stream.state}`
  const title = nowPlaying.title && !isMetadataOffline ? nowPlaying.title : isMetadataOffline ? '' : `${stream.frequency} - ${stream.name}`
  const meterLevels = {
    left: probe.levelL ?? 0,
    right: probe.levelR ?? 0
  }

  return (
    <article className={`stream-card stream-${isOffline ? 'offline' : probe.status}`}>
      <div className="meter-column">
        <AudioMeter active={isMeterActive && isOnline} audioContext={audioContext} sourceNode={sourceNode} levels={meterLevels} />
        <Fader volume={audioState.volume} onVolumeChange={(volume) => onVolumeChange(stream.id, volume)} />
      </div>

      <div className="stream-body">
        <header className="stream-title-row">
          <StatusDot status={isOffline ? 'offline' : probe.status} muted={audioState.isMuted} />
          <h2>{stream.name}</h2>
          <strong>{stream.frequency}</strong>
        </header>

        {/* <div className="stream-subtitle">
            <Music2 size={16} aria-hidden="true" />
            <span>{title}</span>
        </div> */}

        <Waveform active={isOnline} audioElement={audioElement} peaks={waveformPeaks} />

        <footer className="stream-footer">
          <span className={isOffline ? 'state-offline' : 'state-online'}>
            {isOffline ? 'Desconectado.' : isOnline ? 'Tocando' : 'Verificando'}
          </span>
          <span>{location}</span>
        </footer>
      </div>

      <div className="card-actions">
        <button type="button" className="card-action-button is-reconnect" onClick={() => onReconnect(stream.id)}>
          <RefreshCw size={17} aria-hidden="true" />
          Reconectar
        </button>
        <button type="button" className="card-action-button is-mute" onClick={() => onToggleMute(stream.id)}>
          {audioState.isMuted ? <Volume2 size={17} aria-hidden="true" /> : <VolumeX size={17} aria-hidden="true" />}
          {audioState.isMuted ? 'Unmute' : 'Mute'}
        </button>
        <button type="button" className="card-action-button" onClick={() => onSolo(stream.id)}>
          <Play size={17} aria-hidden="true" />
          Solo
        </button>
      </div>
    </article>
  )
}
