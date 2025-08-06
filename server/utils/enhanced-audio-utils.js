import { Buffer } from "buffer"

/**
 * Enhanced WAV header creation with proper alignment
 */
export function createOptimizedWavHeader(dataLength, options = {}) {
  const { numChannels = 1, sampleRate = 24000, bitsPerSample = 16 } = options

  const byteRate = (sampleRate * numChannels * bitsPerSample) / 8
  const blockAlign = (numChannels * bitsPerSample) / 8
  const buffer = Buffer.alloc(44)

  // RIFF header
  buffer.write("RIFF", 0)
  buffer.writeUInt32LE(36 + dataLength, 4)
  buffer.write("WAVE", 8)

  // Format chunk
  buffer.write("fmt ", 12)
  buffer.writeUInt32LE(16, 16) // PCM format chunk size
  buffer.writeUInt16LE(1, 20) // PCM format
  buffer.writeUInt16LE(numChannels, 22)
  buffer.writeUInt32LE(sampleRate, 24)
  buffer.writeUInt32LE(byteRate, 28)
  buffer.writeUInt16LE(blockAlign, 32)
  buffer.writeUInt16LE(bitsPerSample, 34)

  // Data chunk
  buffer.write("data", 36)
  buffer.writeUInt32LE(dataLength, 40)

  return buffer
}

/**
 * Advanced streaming audio processor with anti-glitch technology
 */
export class EnhancedStreamingAudioProcessor {
  constructor(sessionId, options = {}) {
    this.sessionId = sessionId
    this.sampleRate = options.sampleRate || 24000
    this.bitsPerSample = options.bitsPerSample || 16
    this.numChannels = options.numChannels || 1

    // Enhanced buffering configuration
    this.rawBuffer = Buffer.alloc(0)
    this.processedChunks = []
    this.chunkSequence = 0
    this.duplicateHashes = new Set()

    // Quality settings
    this.minChunkSize = this.calculateMinChunkSize()
    this.maxBufferSize = this.sampleRate * 2 // 2 seconds max buffer
    this.crossfadeSamples = 64 // Samples for crossfading

    // Performance tracking
    this.stats = {
      totalProcessed: 0,
      chunksProcessed: 0,
      duplicatesSkipped: 0,
      errorsEncountered: 0,
    }

  }

  calculateMinChunkSize() {
    // Minimum 150ms of audio data for smoother playback
    return Math.floor(((this.sampleRate * this.numChannels * this.bitsPerSample) / 8) * 0.15)
  }

  /**
   * Generate hash for duplicate detection
   */
  generateChunkHash(buffer) {
    if (buffer.length < 32) return null

    // Use first and last 16 bytes for hash
    const start = buffer.slice(0, 16)
    const end = buffer.slice(-16)
    return Buffer.concat([start, end]).toString("base64")
  }

  /**
   * Validate and deduplicate audio chunk
   */
  validateChunk(base64Data) {
    if (!base64Data || typeof base64Data !== "string" || base64Data.length < 100) {
      return { valid: false, reason: "Invalid data format" }
    }

    try {
      const buffer = Buffer.from(base64Data, "base64")
      const hash = this.generateChunkHash(buffer)

      if (hash && this.duplicateHashes.has(hash)) {
        this.stats.duplicatesSkipped++
        return { valid: false, reason: "Duplicate chunk" }
      }

      if (hash) {
        this.duplicateHashes.add(hash)
        // Limit hash set size to prevent memory leaks
        if (this.duplicateHashes.size > 1000) {
          const hashArray = Array.from(this.duplicateHashes)
          this.duplicateHashes = new Set(hashArray.slice(-500))
        }
      }

      return { valid: true, buffer, hash }
    } catch (error) {
      this.stats.errorsEncountered++
      return { valid: false, reason: "Decode error" }
    }
  }

  /**
   * Apply gentle audio processing to reduce artifacts without flickering
   */
  processAudioBuffer(buffer) {
    if (buffer.length < 4) return buffer

    const processed = Buffer.from(buffer)
    const samplesCount = Math.floor(buffer.length / 2) // 16-bit samples

    // Very gentle high-pass filter
    let prevInput = 0
    let prevOutput = 0
    const alpha = 0.98 // Less aggressive filtering

    for (let i = 0; i < samplesCount; i++) {
      const sampleIndex = i * 2
      const currentInput = processed.readInt16LE(sampleIndex)

      // Gentle high-pass filter
      const filteredOutput = alpha * (prevOutput + currentInput - prevInput)
      prevInput = currentInput
      prevOutput = filteredOutput

      // Very light limiting to prevent clipping without distortion
      const limited = Math.max(-32767, Math.min(32767, Math.round(filteredOutput * 0.95)))
      processed.writeInt16LE(limited, sampleIndex)
    }

    // Apply very gentle crossfade
    this.applyCrossfade(processed)

    return processed
  }

  /**
   * Apply very gentle crossfade to prevent flickering
   */
  applyCrossfade(buffer) {
    const samplesCount = Math.floor(buffer.length / 2)
    const fadeLength = Math.min(32, Math.floor(samplesCount / 8)) // Much shorter fade

    // Very gentle fade in at the beginning
    for (let i = 0; i < fadeLength; i++) {
      const sampleIndex = i * 2
      const sample = buffer.readInt16LE(sampleIndex)
      // Sine wave fade for smoothness
      const fadeMultiplier = Math.sin((i / fadeLength) * Math.PI * 0.5)
      const fadedSample = Math.round(sample * fadeMultiplier)
      buffer.writeInt16LE(fadedSample, sampleIndex)
    }

    // Very gentle fade out at the end
    for (let i = 0; i < fadeLength; i++) {
      const sampleIndex = (samplesCount - fadeLength + i) * 2
      const sample = buffer.readInt16LE(sampleIndex)
      const fadeMultiplier = Math.sin(((fadeLength - i) / fadeLength) * Math.PI * 0.5)
      const fadedSample = Math.round(sample * fadeMultiplier)
      buffer.writeInt16LE(fadedSample, sampleIndex)
    }
  }

  /**
   * Process incoming chunk with enhanced quality
   */
  processChunk(base64Data, forceFlush = false) {
    const validation = this.validateChunk(base64Data)

    if (!validation.valid) {
      console.log(`[Processor ${this.sessionId}] Skipped chunk: ${validation.reason}`)
      return null
    }

    // Add to raw buffer
    this.rawBuffer = Buffer.concat([this.rawBuffer, validation.buffer])

    // Check if we have enough data or force flush
    if (this.rawBuffer.length >= this.minChunkSize || forceFlush) {
      return this.createOptimizedChunk()
    }

    // Prevent buffer overflow
    if (this.rawBuffer.length > this.maxBufferSize) {
      console.warn(`[Processor ${this.sessionId}] Buffer overflow, force processing`)
      return this.createOptimizedChunk()
    }

    return null
  }

  /**
   * Create optimized audio chunk with quality enhancements
   */
  createOptimizedChunk() {
    if (this.rawBuffer.length === 0) return null

    try {
      // Ensure sample alignment
      const bytesPerSample = (this.numChannels * this.bitsPerSample) / 8
      const alignedLength = Math.floor(this.rawBuffer.length / bytesPerSample) * bytesPerSample

      if (alignedLength === 0) return null

      // Extract aligned audio data
      const audioData = this.rawBuffer.slice(0, alignedLength)
      this.rawBuffer = this.rawBuffer.slice(alignedLength)

      // Apply audio processing
      const processedAudio = this.processAudioBuffer(audioData)

      // Create WAV with optimized header
      const wavHeader = createOptimizedWavHeader(processedAudio.length, {
        numChannels: this.numChannels,
        sampleRate: this.sampleRate,
        bitsPerSample: this.bitsPerSample,
      })

      const completeWav = Buffer.concat([wavHeader, processedAudio])

      // Update statistics
      this.stats.totalProcessed += processedAudio.length
      this.stats.chunksProcessed++
      this.chunkSequence++

      // const durationMs = (processedAudio.length / 2 / this.sampleRate) * 1000

      // console.log(
      //   `[Processor ${this.sessionId}] Chunk ${this.chunkSequence}: ${Math.round(durationMs)}ms, ${processedAudio.length} bytes`,
      // )

      return completeWav.toString("base64")
    } catch (error) {
      console.error(`[Processor ${this.sessionId}] Processing error:`, error)
      this.stats.errorsEncountered++
      return null
    }
  }

  /**
   * Flush remaining buffer
   */
  flush() {
    if (this.rawBuffer.length === 0) return null

    // console.log(`[Processor ${this.sessionId}] Flushing ${this.rawBuffer.length} bytes`)
    const result = this.createOptimizedChunk()

    // Clear remaining buffer
    this.rawBuffer = Buffer.alloc(0)

    this.logStatistics()
    return result
  }

  /**
   * Log processing statistics
   */
  logStatistics() {

  }

  /**
   * Reset processor state
   */
  reset() {
    this.rawBuffer = Buffer.alloc(0)
    this.processedChunks = []
    this.duplicateHashes.clear()
    this.chunkSequence = 0
    this.stats = {
      totalProcessed: 0,
      chunksProcessed: 0,
      duplicatesSkipped: 0,
      errorsEncountered: 0,
    }
    // console.log(`[Processor ${this.sessionId}] Reset completed`)
  }
}

/**
 * Factory function for creating enhanced processor
 */
export function createEnhancedAudioProcessor(sessionId, options = {}) {
  return new EnhancedStreamingAudioProcessor(sessionId, options)
}

/**
 * Analyze audio buffer quality
 */
export function analyzeAudioQuality(buffer, sampleRate = 24000) {
  const samples = Math.floor(buffer.length / 2)
  const durationMs = (samples / sampleRate) * 1000

  // Calculate RMS for volume analysis
  let rmsSum = 0
  for (let i = 0; i < samples; i++) {
    const sample = buffer.readInt16LE(i * 2) / 32768
    rmsSum += sample * sample
  }
  const rms = Math.sqrt(rmsSum / samples)

  return {
    samples,
    durationMs: Math.round(durationMs),
    sizeKB: Math.round((buffer.length / 1024) * 100) / 100,
    rmsLevel: Math.round(rms * 100) / 100,
    peakLevel:
      Math.round(
        Math.max(...Array.from({ length: samples }, (_, i) => Math.abs(buffer.readInt16LE(i * 2)) / 32768)) * 100,
      ) / 100,
  }
}
