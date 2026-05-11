import { useEffect, useRef } from 'react'

const CHANNELS = ['L', 'R']
const BUFFER_SIZE = 1024
const AVERAGING = 0.92

function drawMeter(canvas, volume, channelIndex) {
  const context = canvas.getContext('2d')
  const width = canvas.width
  const height = canvas.height
  const level = Math.max(0, Math.min(1, volume * 5.5))
  const fillHeight = Math.max(2, Math.round(height * level))
  const gradient = context.createLinearGradient(0, height, 0, 0)

  gradient.addColorStop(0, '#3bcf66')
  gradient.addColorStop(0.62, '#d8cf38')
  gradient.addColorStop(0.86, '#e98d36')
  gradient.addColorStop(1, '#e64767')

  context.clearRect(0, 0, width, height)
  context.fillStyle = '#25312d'
  context.fillRect(0, 0, width, height)
  context.fillStyle = gradient
  context.fillRect(0, height - fillHeight, width, fillHeight)

  context.fillStyle = 'rgba(45, 47, 53, 0.92)'
  for (let y = 9; y < height; y += 11) {
    context.fillRect(0, y, width, 4)
  }

  context.fillStyle = '#9ea3ad'
  context.font = '700 10px "Trebuchet MS", "Segoe UI", sans-serif'
  context.textAlign = 'center'
  context.fillText(CHANNELS[channelIndex], width / 2, 9)
}

function readVolume(analyser, buffer) {
  analyser.getFloatTimeDomainData(buffer)

  let sum = 0
  for (let index = 0; index < buffer.length; index += 1) {
    sum += buffer[index] * buffer[index]
  }

  return Math.sqrt(sum / buffer.length)
}

export default function AudioMeterReact({ audioContext, sourceNode, active, levels }) {
  const canvasRefs = useRef([])
  const volumesRef = useRef([0, 0])
  const targetVolumesRef = useRef([0, 0])

  useEffect(() => {
    canvasRefs.current.forEach((canvas, index) => {
      if (canvas) drawMeter(canvas, 0, index)
    })
  }, [])

  useEffect(() => {
    if (!levels) return

    targetVolumesRef.current = [levels.left ?? 0, levels.right ?? 0].map((level) => level / 55)
  }, [levels])

  useEffect(() => {
    if (!active) {
      volumesRef.current = [0, 0]
      canvasRefs.current.forEach((canvas, index) => {
        if (canvas) drawMeter(canvas, 0, index)
      })
      return undefined
    }

    if (levels) {
      let animationFrameId = 0

      const render = () => {
        const nextVolumes = targetVolumesRef.current.map((targetVolume, index) => {
          const currentVolume = volumesRef.current[index]
          return targetVolume > currentVolume
            ? currentVolume + (targetVolume - currentVolume) * 0.38
            : currentVolume * AVERAGING
        })

        volumesRef.current = nextVolumes
        canvasRefs.current.forEach((canvas, index) => {
          if (canvas) drawMeter(canvas, nextVolumes[index], index)
        })

        animationFrameId = window.requestAnimationFrame(render)
      }

      render()

      return () => {
        window.cancelAnimationFrame(animationFrameId)
      }
    }

    if (!audioContext || !sourceNode) return undefined

    const splitter = audioContext.createChannelSplitter(2)
    const analysers = CHANNELS.map(() => {
      const analyser = audioContext.createAnalyser()
      analyser.fftSize = BUFFER_SIZE
      analyser.smoothingTimeConstant = 0
      return analyser
    })
    const buffers = analysers.map((analyser) => new Float32Array(analyser.fftSize))
    let animationFrameId = 0

    sourceNode.connect(splitter)
    analysers.forEach((analyser, index) => {
      splitter.connect(analyser, index)
    })

    const render = () => {
      analysers.forEach((analyser, index) => {
        const volume = readVolume(analyser, buffers[index])
        volumesRef.current[index] = Math.max(volume, volumesRef.current[index] * AVERAGING)

        const canvas = canvasRefs.current[index]
        if (canvas) drawMeter(canvas, volumesRef.current[index], index)
      })

      animationFrameId = window.requestAnimationFrame(render)
    }

    render()

    return () => {
      window.cancelAnimationFrame(animationFrameId)
      try {
        sourceNode.disconnect(splitter)
      } catch {
        // The node may already have been disconnected during a stream reload.
      }
      analysers.forEach((analyser) => analyser.disconnect())
      splitter.disconnect()
    }
  }, [active, audioContext, sourceNode, Boolean(levels)])

  return (
    <div className="audio-meter-react" aria-label="AudioMeter.React L R">
      {CHANNELS.map((channel, index) => (
        <canvas
          key={channel}
          ref={(element) => {
            canvasRefs.current[index] = element
          }}
          width="32"
          height="132"
        />
      ))}
    </div>
  )
}
