"use client"

import { useRef, useCallback } from "react"
import { AUDIO_CONFIG } from "../config/voice-chat.js"

export const useVoiceActivityDetection = (setIsUserSpeaking, setAudioLevel) => {
  const micStreamRef = useRef(null)
  const vadAnalyserRef = useRef(null)
  const vadCheckIntervalRef = useRef(null)

  const initializeVAD = useCallback(async (isMobile) => {
    if (isMobile) return

    try {
      const constraints = {
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: AUDIO_CONFIG.vadSampleRate,
          channelCount: 1,
        },
      }

      const stream = await navigator.mediaDevices.getUserMedia(constraints)
      micStreamRef.current = stream

      const vadAudioContext = new (window.AudioContext || window.webkitAudioContext)({
        sampleRate: AUDIO_CONFIG.vadSampleRate,
      })
      const source = vadAudioContext.createMediaStreamSource(stream)

      vadAnalyserRef.current = vadAudioContext.createAnalyser()
      vadAnalyserRef.current.fftSize = AUDIO_CONFIG.vadFftSize
      vadAnalyserRef.current.smoothingTimeConstant = AUDIO_CONFIG.vadSmoothingTimeConstant

      source.connect(vadAnalyserRef.current)

      startVADMonitoring()
      console.log("🎤 VAD initialized")
    } catch (error) {
      console.error("VAD initialization failed:", error)
      return "⚠️ Microphone access denied - voice detection disabled"
    }
  }, [])

  const startVADMonitoring = useCallback(() => {
    if (!vadAnalyserRef.current) return

    const bufferLength = vadAnalyserRef.current.frequencyBinCount
    const dataArray = new Uint8Array(bufferLength)
    let silenceCount = 0
    let speechCount = 0

    const checkVAD = () => {
      vadAnalyserRef.current.getByteFrequencyData(dataArray)

      let sum = 0
      for (let i = 0; i < bufferLength; i++) {
        sum += dataArray[i] * dataArray[i]
      }
      const rms = Math.sqrt(sum / bufferLength)

      const isSpeaking = rms > AUDIO_CONFIG.vadThreshold

      if (isSpeaking) {
        speechCount++
        silenceCount = 0
      } else {
        silenceCount++
        speechCount = Math.max(0, speechCount - 1)
      }

      setIsUserSpeaking(speechCount > 2)
      setAudioLevel(rms / 100)
    }

    vadCheckIntervalRef.current = setInterval(checkVAD, 50)
  }, [setIsUserSpeaking, setAudioLevel])

  const cleanup = useCallback(() => {
    if (vadCheckIntervalRef.current) {
      clearInterval(vadCheckIntervalRef.current)
    }
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((track) => track.stop())
    }
  }, [])

  return { initializeVAD, cleanup }
}
