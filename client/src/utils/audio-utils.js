import { AUDIO_CONFIG } from "../config/voice-chat.js"

export const initializeAudioContext = async () => {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext
  const audioContext = new AudioContextClass({
    sampleRate: AUDIO_CONFIG.expectedSampleRate,
    latencyHint: "interactive",
  })

  const gainNode = audioContext.createGain()
  const analyser = audioContext.createAnalyser()

  analyser.fftSize = AUDIO_CONFIG.analyserFftSize
  analyser.smoothingTimeConstant = AUDIO_CONFIG.analyserSmoothingTimeConstant

  gainNode.connect(analyser)
  analyser.connect(audioContext.destination)
  gainNode.gain.value = AUDIO_CONFIG.gainValue

  if (audioContext.state === "suspended") {
    await audioContext.resume()
  }

  return { audioContext, gainNode, analyser }
}

export const processAudioChunk = async (base64Data, audioContext, processedChunks) => {
  if (!audioContext || !base64Data) return null

  const chunkHash = btoa(base64Data.slice(0, 100) + base64Data.slice(-100))
  if (processedChunks.has(chunkHash)) {
    return null
  }
  processedChunks.add(chunkHash)

  try {
    const binaryString = atob(base64Data)
    const bytes = new Uint8Array(binaryString.length)

    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i)
    }

    const audioBuffer = await audioContext.decodeAudioData(bytes.buffer.slice(0))

    if (!audioBuffer || audioBuffer.duration <= 0) {
      return null
    }

    return await ultraSmoothEnhancement(audioBuffer, audioContext)
  } catch (error) {
    console.warn("⚠️ Chunk processing failed:", error.message)
    return null
  }
}

export const ultraSmoothEnhancement = async (buffer, audioContext) => {
  if (!audioContext) return buffer

  const sampleRate = buffer.sampleRate
  const channels = buffer.numberOfChannels
  const length = buffer.length

  const enhancedBuffer = audioContext.createBuffer(channels, length, sampleRate)

  for (let channel = 0; channel < channels; channel++) {
    const inputData = buffer.getChannelData(channel)
    const outputData = enhancedBuffer.getChannelData(channel)

    for (let i = 0; i < length; i++) {
      let sample = inputData[i]

      if (Math.abs(sample) < 0.001) {
        sample = 0
      }

      if (Math.abs(sample) > AUDIO_CONFIG.compressionThreshold) {
        const excess = Math.abs(sample) - AUDIO_CONFIG.compressionThreshold
        const compressedExcess = excess * 0.3
        sample = Math.sign(sample) * (AUDIO_CONFIG.compressionThreshold + compressedExcess)
      }

      const fadeLength = Math.min(AUDIO_CONFIG.fadeLength, length / 10)

      if (i < fadeLength) {
        const fadeIn = (i / fadeLength) * (i / fadeLength)
        sample *= fadeIn
      }

      if (i >= length - fadeLength) {
        const fadeOut = ((length - i) / fadeLength) * ((length - i) / fadeLength)
        sample *= fadeOut
      }

      outputData[i] = sample
    }
  }

  return enhancedBuffer
}

export const truncateMessage = (message, maxLength = 100) => {
  if (message.length <= maxLength) return message
  return message.substring(0, maxLength) + "..."
}
