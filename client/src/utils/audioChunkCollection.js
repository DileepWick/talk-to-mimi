import { useRef, useCallback } from "react"

export default function useAudioCollector({
  processAudioChunk,
  logMessage,
  playAudioQueue,
  audioQueueRef,
  isPlayingRef,
  timeoutMs = 80,
}) {
  const rawChunksRef = useRef([])
  const chunkTimeoutRef = useRef(null)

  const collectAudioChunk = useCallback(async (base64Data) => {
    if (!base64Data || typeof base64Data !== "string") return

    console.log(`🎵 Audio chunk received, length: ${base64Data.length}`)
    rawChunksRef.current.push(base64Data)

    if (chunkTimeoutRef.current) {
      clearTimeout(chunkTimeoutRef.current)
    }

    chunkTimeoutRef.current = setTimeout(async () => {
      if (rawChunksRef.current.length === 0) return

      console.log(`🔄 Processing ${rawChunksRef.current.length} collected chunks`)
      const processedBuffers = []

      for (const chunk of rawChunksRef.current) {
        const buffer = await processAudioChunk(chunk)
        if (buffer) processedBuffers.push(buffer)
      }

      if (processedBuffers.length > 0) {
        audioQueueRef.current.push(...processedBuffers)
        logMessage(`✅ Added ${processedBuffers.length} buffers to queue`)
        if (!isPlayingRef.current) {
          playAudioQueue()
        }
      }

      rawChunksRef.current = []
    }, timeoutMs)
  }, [processAudioChunk, logMessage, playAudioQueue, audioQueueRef, isPlayingRef, timeoutMs])

  return { collectAudioChunk }
}
