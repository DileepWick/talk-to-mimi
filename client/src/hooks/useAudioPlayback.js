"use client"

import { useRef, useCallback } from "react"

export const useAudioPlayback = (audioContextRef, gainNodeRef, setIsPlaying, logMessage) => {
  const audioQueueRef = useRef([])
  const currentSourceRef = useRef(null)
  const isPlayingRef = useRef(false)
  const nextStartTimeRef = useRef(0)

  const playAudioQueue = useCallback(() => {
    if (
      !audioContextRef.current ||
      !gainNodeRef.current ||
      isPlayingRef.current ||
      audioQueueRef.current.length === 0
    ) {
      return
    }

    isPlayingRef.current = true
    setIsPlaying(true)
    logMessage("🎵 Starting ultra-smooth audio playback")

    const playNextBuffer = () => {
      if (audioQueueRef.current.length === 0) {
        isPlayingRef.current = false
        setIsPlaying(false)
        nextStartTimeRef.current = 0
        logMessage("🎵 Audio playback completed")
        return
      }

      const buffer = audioQueueRef.current.shift()
      const source = audioContextRef.current.createBufferSource()
      source.buffer = buffer
      source.connect(gainNodeRef.current)

      const currentTime = audioContextRef.current.currentTime
      let startTime

      if (nextStartTimeRef.current === 0) {
        startTime = currentTime + 0.02
      } else {
        startTime = Math.max(currentTime, nextStartTimeRef.current - 0.001)
      }

      nextStartTimeRef.current = startTime + buffer.duration
      currentSourceRef.current = source

      source.onended = () => {
        if (currentSourceRef.current === source) {
          currentSourceRef.current = null
        }
        playNextBuffer()
      }

      try {
        source.start(startTime)
        logMessage(`🎵 Playing buffer (${buffer.duration.toFixed(3)}s, queue: ${audioQueueRef.current.length})`)
      } catch (error) {
        console.error("Playback error:", error)
        setTimeout(playNextBuffer, 10)
      }
    }

    playNextBuffer()
  }, [audioContextRef, gainNodeRef, setIsPlaying, logMessage])

  const stopAllAudio = useCallback(() => {
    if (currentSourceRef.current) {
      try {
        currentSourceRef.current.stop()
        currentSourceRef.current.disconnect()
      } catch (e) {}
      currentSourceRef.current = null
    }

    audioQueueRef.current = []
    isPlayingRef.current = false
    nextStartTimeRef.current = 0
    setIsPlaying(false)

    logMessage("⏹️ All audio stopped and queues cleared")
  }, [setIsPlaying, logMessage])

  return {
    audioQueueRef,
    playAudioQueue,
    stopAllAudio,
    isPlayingRef,
  }
}
