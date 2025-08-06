import { createEnhancedAudioProcessor } from "./enhanced-audio-utils.js"
import { broadcastToClient } from "../services/websocket.js" // Assuming index.js is at the root level relative to utils

/**
 * Handles the audio stream processing for a given session.
 * @param {object} session - The current session object.
 * @param {string} clientId - The client ID for broadcasting audio.
 * @param {string} summary - The text summary to be converted to audio.
 * @param {string} sessionId - The ID of the current session.
 */
export const handleAudioStreamProcessing = async (session, clientId, summary, sessionId) => {
  // Initialize enhanced audio processor
  const audioProcessor = createEnhancedAudioProcessor(sessionId, {
    sampleRate: 24000,
    bitsPerSample: 16,
    numChannels: 1,
  })

  try {
    // Send to Gemini Live for audio generation
    await session.geminiSession.sendClientContent({
      turns: [{ role: "user", parts: [{ text: summary }] }],
    })

    let sampleRate = 24000
    let sampleRateDetected = false
    let chunkCount = 0
    let lastActivityTime = Date.now()

    // Enhanced timeout with activity tracking
    const timeoutId = setTimeout(() => {
      console.log(`⏰ Audio timeout reached for voice chat session: ${sessionId}`)
      const finalChunk = audioProcessor.flush()
      if (finalChunk) {
        // Broadcast final chunk to the client
        broadcastToClient(clientId, finalChunk)
      }
    }, 30000)

    // Enhanced activity tracking
    const activityTimeout = setInterval(() => {
      if (Date.now() - lastActivityTime > 5000) {
        clearInterval(activityTimeout)
      }
    }, 1000)

    // Enhanced audio processing loop
    try {
      while (true) {
        if (session.responseQueue.length > 0) {
          const msg = session.responseQueue.shift()
          const parts = msg.serverContent?.modelTurn?.parts || []
          lastActivityTime = Date.now()

          for (const part of parts) {
            if (part.inlineData?.data) {
              chunkCount++

              // Enhanced sample rate detection
              if (!sampleRateDetected && part.inlineData.mimeType) {
                const rateMatch = part.inlineData.mimeType.match(/rate=(\d+)/)
                if (rateMatch) {
                  const detectedRate = Number.parseInt(rateMatch[1], 10)
                  if (detectedRate !== sampleRate) {
                    sampleRate = detectedRate
                    audioProcessor.sampleRate = sampleRate
                  }
                  sampleRateDetected = true
                }
              }

              // Process chunk with enhanced processor
              const processedChunk = audioProcessor.processChunk(part.inlineData.data, false)

              if (processedChunk) {
                // Broadcast processed chunk
                broadcastToClient(clientId, processedChunk)
              }
            }
          }

          // Check for completion
          if (msg.serverContent?.turnComplete) {
            // Flush any remaining audio data
            const finalChunk = audioProcessor.flush()
            if (finalChunk) {
              // Broadcast final chunk
              broadcastToClient(clientId, finalChunk)
            }

            clearTimeout(timeoutId)
            clearInterval(activityTimeout)
            break
          }
        } else {
          // Faster polling for smoother streaming
          await new Promise((resolve) => setTimeout(resolve, 2))
        }
      }
    } catch (error) {
      console.error(`[Session ${sessionId}] Audio processing error:`, error)
      clearTimeout(timeoutId)
      clearInterval(activityTimeout)

      // Attempt to flush any remaining data
      try {
        const finalChunk = audioProcessor.flush()
        if (finalChunk) {
          broadcastToClient(clientId, finalChunk)
        }
      } catch (flushError) {
        console.error(`[Session ${sessionId}] Error flushing audio:`, flushError)
      }
    }
  } catch (error) {
    console.error(`[Session ${sessionId}] Failed to send client content to Gemini Live:`, error)
    throw error // Re-throw to be caught by the main voice query handler
  }
}
