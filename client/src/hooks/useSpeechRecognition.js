"use client"

import { useRef, useCallback } from "react"
import { SPEECH_CONFIG, AUDIO_CONFIG } from "../config/voice-chat"

export const useSpeechRecognition = (
  setIsListening,
  setError,
  setShowTranscript,
  setCurrentTranscript,
  setInterimTranscript,
  setLastUserMessage,
  setIsProcessing,
  logMessage,
  sendVoiceQuery,
) => {
  const recognitionRef = useRef(null)
  const silenceTimeoutRef = useRef(null)

  const startListening = useCallback(
    async (clientId, currentTranscript, isProcessing) => {
      if (!clientId) {
        setError("WebSocket not connected. Please wait for connection.")
        return
      }

      setCurrentTranscript("")
      setInterimTranscript("")
      setLastUserMessage("")
      setShowTranscript(false)
      setError("")
      setIsProcessing(false)

      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition

      if (!SpeechRecognition) {
        setError("Speech recognition not supported on this browser")
        return
      }

      try {
        if (!recognitionRef.current) {
          const recognition = new SpeechRecognition()
          recognition.continuous = SPEECH_CONFIG.continuous
          recognition.lang = SPEECH_CONFIG.language
          recognition.interimResults = SPEECH_CONFIG.interimResults
          recognition.maxAlternatives = SPEECH_CONFIG.maxAlternatives
          recognitionRef.current = recognition
        }

        const recognition = recognitionRef.current

        // Clear previous event handlers
        recognition.onstart = null
        recognition.onresult = null
        recognition.onerror = null
        recognition.onend = null

        recognition.onstart = () => {
          console.log("🎤 Speech recognition started")
          setIsListening(true)
          setError("")
          setShowTranscript(true)
          setCurrentTranscript("")
          setInterimTranscript("")
          setLastUserMessage("")
          logMessage("🎤 Started listening for voice input...")
        }

        recognition.onresult = async (event) => {
          let interimTranscript = ""
          let finalTranscript = ""

          for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcript = event.results[i][0].transcript
            if (event.results[i].isFinal) {
              finalTranscript += transcript
            } else {
              interimTranscript += transcript
            }
          }

          setInterimTranscript(interimTranscript)

          if (finalTranscript) {
            setCurrentTranscript((prev) => (prev + " " + finalTranscript).trim())
          }

          // Reset silence timeout on speech
          if (silenceTimeoutRef.current) {
            clearTimeout(silenceTimeoutRef.current)
          }

          // Auto-send after silence timeout
          silenceTimeoutRef.current = setTimeout(async () => {
            const fullTranscript = (currentTranscript + " " + finalTranscript + " " + interimTranscript).trim()

            if (fullTranscript && !isProcessing) {
              console.log("📝 Timeout - sending voice query:", fullTranscript)
              logMessage(`🎤 Voice captured: "${fullTranscript}"`)

              setCurrentTranscript("")
              setInterimTranscript("")
              setShowTranscript(false)
              setLastUserMessage(fullTranscript)
              setIsListening(false)
              setIsProcessing(true)

              if (recognitionRef.current) {
                recognitionRef.current.stop()
              }

              // Hide user message after delay
              setTimeout(() => {
                setLastUserMessage("")
              }, 2000)

              await sendVoiceQuery(fullTranscript)
            }
          }, AUDIO_CONFIG.silenceTimeout)
        }

        recognition.onerror = (event) => {
          console.error("Speech recognition error:", event.error)

          let errorMessage = "Recognition error"
          switch (event.error) {
            case "no-speech":
              errorMessage = "No speech detected. Please try again."
              break
            case "audio-capture":
              errorMessage = "Microphone not accessible. Please check permissions."
              break
            case "not-allowed":
              errorMessage = "Microphone permission denied. Please allow microphone access."
              break
            case "network":
              errorMessage = "Network error. Please check your connection."
              break
            case "service-not-allowed":
              errorMessage = "Speech service not available on this device."
              break
            default:
              errorMessage = `Recognition error: ${event.error}`
          }

          setError(errorMessage)
          setIsListening(false)
          setShowTranscript(false)
          setIsProcessing(false)
          logMessage(`❌ Speech error: ${errorMessage}`)
        }

        recognition.onend = () => {
          console.log("🎤 Speech recognition ended")

          if (silenceTimeoutRef.current) {
            clearTimeout(silenceTimeoutRef.current)
            silenceTimeoutRef.current = null
          }

          setIsListening(false)
          setShowTranscript(false)
          if (!isProcessing) {
            logMessage("🎤 Stopped listening")
          }
        }

        recognition.start()
      } catch (error) {
        console.error("Speech recognition setup failed:", error)
        setError("Failed to initialize speech recognition")
        setIsListening(false)
        setShowTranscript(false)
        setIsProcessing(false)
        logMessage("❌ Failed to start speech recognition")
      }
    },
    [
      setIsListening,
      setError,
      setShowTranscript,
      setCurrentTranscript,
      setInterimTranscript,
      setLastUserMessage,
      setIsProcessing,
      logMessage,
      sendVoiceQuery,
    ],
  )

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop()
    }

    if (silenceTimeoutRef.current) {
      clearTimeout(silenceTimeoutRef.current)
      silenceTimeoutRef.current = null
    }

    setIsListening(false)
    setShowTranscript(false)
    setCurrentTranscript("")
    setInterimTranscript("")
    setLastUserMessage("")
    setIsProcessing(false)
    logMessage("🎤 Voice input stopped")
  }, [
    setIsListening,
    setShowTranscript,
    setCurrentTranscript,
    setInterimTranscript,
    setLastUserMessage,
    setIsProcessing,
    logMessage,
  ])

  return { startListening, stopListening }
}
