"use client"

import { useEffect, useState, useRef, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { WSS_URL, BASE_URL } from "../config/constant"
import useAudioCollector from "../utils/audioChunkCollection"
import axios from "axios"

// Import modular components and hooks
import { detectMobile, checkSpeechRecognitionSupport } from "../utils/mobile-detection.js"
import { initializeAudioContext, processAudioChunk } from "../utils/audio-utils.js"
import { useVoiceActivityDetection } from "../hooks/useVoiceActivityDetection.js"
import { useSpeechRecognition } from "../hooks/useSpeechRecognition.js"
import { useAudioPlayback } from "../hooks/useAudioPlayback.js"

const VoiceAgentWidget = ({
  agentName = "AI Assistant",
  agentImage = "/placeholder.svg?height=120&width=120&text=AI",
  position = "bottom-right",
  theme = "light",
  onDataReceived,
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const [clientId, setClientId] = useState(null)
  const [sessionId, setSessionId] = useState(null)
  const [connectionStatus, setConnectionStatus] = useState("Connecting...")
  const [isPlaying, setIsPlaying] = useState(false)

  // Voice-to-text state (Desktop only)
  const [isListening, setIsListening] = useState(false)
  const [currentTranscript, setCurrentTranscript] = useState("")
  const [interimTranscript, setInterimTranscript] = useState("")
  const [lastUserMessage, setLastUserMessage] = useState("")
  const [showTranscript, setShowTranscript] = useState(false)
  const [error, setError] = useState("")
  const [isProcessing, setIsProcessing] = useState(false)

  // Mobile text chat state
  const [isMobile, setIsMobile] = useState(false)
  const [textInput, setTextInput] = useState("")
  const [chatMessages, setChatMessages] = useState([])

  // Voice Activity Detection
  const [isUserSpeaking, setIsUserSpeaking] = useState(0)
  const [audioLevel, setAudioLevel] = useState(0)

  // Tooltip visibility state
  const [showMicTooltip, setShowMicTooltip] = useState(false)
  const [showCloseTooltip, setShowCloseTooltip] = useState(false)
  const [showStopAudioTooltip, setShowStopAudioTooltip] = useState(false)

  // Refs
  const wsRef = useRef(null)
  const audioContextRef = useRef(null)
  const gainNodeRef = useRef(null)
  const analyserRef = useRef(null)
  const rawChunksRef = useRef([])
  const processedChunksRef = useRef(new Set())
  const chunkTimeoutRef = useRef(null)
  const chatEndRef = useRef(null)

  // Get position classes
  const getPositionClasses = () => {
    switch (position) {
      case "bottom-left":
        return "bottom-6 left-6"
      case "top-right":
        return "top-6 right-6"
      case "top-left":
        return "top-6 left-6"
      default:
        return "bottom-6 right-6"
    }
  }

  // Get theme classes - Black and White only
  const getThemeClasses = () => {
    return theme === "dark"
      ? "bg-black/95 backdrop-blur-xl border-gray-800/50 text-white"
      : "bg-white/95 backdrop-blur-xl border-gray-300/50 text-black"
  }

  // Log messages function
  const logMessage = useCallback((msg) => {
    console.log(`[Voice Agent] ${msg}`)
  }, [])

  // Custom hooks (Desktop only)
  const { initializeVAD, cleanup: cleanupVAD } = useVoiceActivityDetection(setIsUserSpeaking, setAudioLevel)
  const { audioQueueRef, playAudioQueue, stopAllAudio, isPlayingRef } = useAudioPlayback(
    audioContextRef,
    gainNodeRef,
    setIsPlaying,
    logMessage,
  )

  // Send voice/text query to the API
  const sendQuery = useCallback(
    async (message, isVoice = false) => {
      try {
        setIsProcessing(true)
        logMessage(`📤 Sending ${isVoice ? "voice" : "text"} query: "${message}"`)

        // Add user message to chat (mobile only)
        if (isMobile) {
          setChatMessages((prev) => [...prev, { type: "user", content: message, timestamp: Date.now() }])
        }

        // Stop audio for both mobile and desktop
        stopAllAudio()

        if (!clientId) {
          throw new Error("Client ID not available. Please wait for WebSocket connection.")
        }

        const response = await axios.post(
          `${BASE_URL}/api/voice-query`,
          {
            message: message,
            clientId: clientId,
            sessionId,
          },
          {
            timeout: 8000,
          },
        )

        onDataReceived(response.data.filters)
        console.log("Received Filters", response.data.filters)

        if (!response.data) {
          throw new Error("No response data received from the API")
        }

        const { sessionId: newSid, text, isNewSession, processingTime } = response.data

        if (newSid && newSid !== sessionId) {
          setSessionId(newSid)
          logMessage(`🆔 Session ID updated: ${newSid}`)
        }

        logMessage(`📥 Response: "${text}"`)
        logMessage(`⏱️ Processing time: ${processingTime}ms`)

        if (isNewSession) {
          logMessage("🆕 New session created")
        }

        logMessage("🎵 Waiting for audio response...")
      } catch (err) {
        console.error("Query API Error:", err)
        const errorMsg = err.response?.data?.error || err.message || "Unknown error"
        logMessage(`❌ Query Error: ${errorMsg}`)
        setError(`Query failed: ${errorMsg}`)

        if (isMobile) {
          setChatMessages((prev) => [...prev, { type: "error", content: errorMsg, timestamp: Date.now() }])
        }
      } finally {
        setIsProcessing(false)
      }
    },
    [clientId, sessionId, logMessage, stopAllAudio, isMobile],
  )

  // Speech Recognition
  const { startListening, stopListening } = useSpeechRecognition(
    setIsListening,
    setError,
    setShowTranscript,
    setCurrentTranscript,
    setInterimTranscript,
    setLastUserMessage,
    setIsProcessing,
    logMessage,
    (transcript) => sendQuery(transcript, true),
  )

  // Enhanced mobile detection
  useEffect(() => {
    const checkMobile = () => {
      const isMobileDevice = detectMobile()
      setIsMobile(isMobileDevice)

      if (!isMobileDevice && !checkSpeechRecognitionSupport()) {
        setError("Speech recognition not supported on this browser")
      }
    }

    checkMobile()
    window.addEventListener("resize", checkMobile)
    return () => window.removeEventListener("resize", checkMobile)
  }, [])

  // Scroll to bottom of chat
  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: "smooth" })
    }
  }, [chatMessages])

  // Initialize Audio Context
  const initializeAudioContextWrapper = useCallback(async () => {
    if (!audioContextRef.current) {
      const { audioContext, gainNode, analyser } = await initializeAudioContext()
      audioContextRef.current = audioContext
      gainNodeRef.current = gainNode
      analyserRef.current = analyser
      console.log("🎵 Ultra-smooth AudioContext initialized")
    }
  }, [])

  // Start listening wrapper
  const startListeningWrapper = useCallback(async () => {
    if (isMobile) return

    if (!clientId) {
      setError("WebSocket not connected. Please wait for connection.")
      return
    }

    if (isPlaying) {
      stopAllAudio()
    }

    setCurrentTranscript("")
    setInterimTranscript("")
    setLastUserMessage("")
    setShowTranscript(false)
    setError("")
    setIsProcessing(false)

    try {
      await initializeAudioContextWrapper()
      await initializeVAD(isMobile)
      await startListening(clientId, currentTranscript, isProcessing)
    } catch (error) {
      console.error("Failed to start listening:", error)
      setError("Failed to start voice input")
    }
  }, [
    isMobile,
    clientId,
    isPlaying,
    currentTranscript,
    isProcessing,
    stopAllAudio,
    initializeAudioContextWrapper,
    initializeVAD,
    startListening,
  ])

  // Handle text input submit (Mobile only)
  const handleTextSubmit = useCallback(
    async (e) => {
      e.preventDefault()
      if (!textInput.trim() || isProcessing) return

      const message = textInput.trim()
      setTextInput("")

      if (isMobile) {
        try {
          await initializeAudioContextWrapper()
          if (audioContextRef.current && audioContextRef.current.state === "suspended") {
            await audioContextRef.current.resume()
            logMessage("🎵 Audio context resumed for mobile")
          }
        } catch (error) {
          console.error("Failed to initialize audio context on mobile:", error)
          logMessage(`❌ Mobile audio init error: ${error.message}`)
        }
      }

      await sendQuery(message, false)
    },
    [textInput, isProcessing, sendQuery, isMobile, initializeAudioContextWrapper, logMessage],
  )

  // Process audio chunk wrapper
  const processAudioChunkWrapper = useCallback(async (base64Data) => {
    return await processAudioChunk(base64Data, audioContextRef.current, processedChunksRef.current)
  }, [])

  // Audio collector
  const { collectAudioChunk } = useAudioCollector({
    processAudioChunk: processAudioChunkWrapper,
    logMessage,
    playAudioQueue,
    audioQueueRef,
    isPlayingRef,
  })

  // Handle audio blob
  const handleAudioBlob = useCallback(
    async (blob) => {
      try {
        const arrayBuffer = await blob.arrayBuffer()
        const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)))
        await collectAudioChunk(base64)
      } catch (error) {
        console.error("Error handling audio blob:", error)
        logMessage(`❌ Audio blob error: ${error.message}`)
      }
    },
    [logMessage, collectAudioChunk],
  )

  // WebSocket connection
  useEffect(() => {
    const connectWebSocket = () => {
      const ws = new WebSocket(WSS_URL)
      wsRef.current = ws

      ws.onopen = () => {
        console.log("Voice Chat Connected to WebSocket ✅")
        setConnectionStatus("Connected")
        logMessage("Voice Chat connection established ✅")
      }

      ws.onmessage = async (event) => {
        try {
          const data = JSON.parse(event.data)

          if (data.type === "init") {
            setClientId(data.clientId)
            logMessage(`✅ Voice Chat initialized with clientId: ${data.clientId}`)
            await initializeAudioContextWrapper()
          } else if (data.type === "pong") {
            logMessage("🏓 Pong received")
          } else {
            logMessage(`📩 Control message: ${JSON.stringify(data)}`)
          }
        } catch (err) {
          if (event.data instanceof Blob) {
            if (!audioContextRef.current) {
              await initializeAudioContextWrapper()
            }
            if (audioContextRef.current && audioContextRef.current.state === "suspended") {
              await audioContextRef.current.resume()
              logMessage("🎵 Audio context resumed for audio playback")
            }
            await handleAudioBlob(event.data)
          } else if (typeof event.data === "string") {
            if (!audioContextRef.current) {
              await initializeAudioContextWrapper()
            }
            if (audioContextRef.current && audioContextRef.current.state === "suspended") {
              await audioContextRef.current.resume()
              logMessage("🎵 Audio context resumed for audio playback")
            }
            await collectAudioChunk(event.data)
          } else {
            logMessage(`Unknown data type Received from the backend: ${typeof event.data}`)
          }
        }
      }

      ws.onerror = (err) => {
        console.error("❌ WebSocket Error", err)
        setConnectionStatus("Error")
        logMessage("❌ WebSocket connection error")
      }

      ws.onclose = () => {
        console.warn("Voice Chat Disconnected from WebSocket")
        setConnectionStatus("Disconnected")
        logMessage("Voice Chat Disconnected from WebSocket")

        setTimeout(() => {
          if (wsRef.current?.readyState === WebSocket.CLOSED) {
            logMessage("🔄 Attempting to reconnect...")
            setConnectionStatus("Reconnecting...")
            connectWebSocket()
          }
        }, 1000)
      }
    }

    connectWebSocket()

    return () => {
      if (wsRef.current) {
        wsRef.current.close()
      }
      stopAllAudio()
      if (!isMobile) {
        stopListening()
        cleanupVAD()
      }

      if (chunkTimeoutRef.current) {
        clearTimeout(chunkTimeoutRef.current)
        chunkTimeoutRef.current = null
      }
      if (audioContextRef.current && audioContextRef.current.state !== "closed") {
        audioContextRef.current.close()
      }
    }
  }, [
    initializeAudioContextWrapper,
    handleAudioBlob,
    collectAudioChunk,
    logMessage,
    stopAllAudio,
    stopListening,
    cleanupVAD,
    isMobile,
  ])

  // Get status indicator - Black and White only
  const getStatusIndicator = () => {
    if (connectionStatus !== "Connected") return { color: "bg-red-500", pulse: true, ring: "ring-red-500/30" }
    if (isProcessing) return { color: "bg-gray-600", pulse: true, ring: "ring-gray-600/30" }
    if (!isMobile && isListening) return { color: "bg-green-500", pulse: true, ring: "ring-green-500/30" }
    if (isPlaying) return { color: "bg-black", pulse: true, ring: "ring-black/30" }
    return { color: "bg-gray-400", pulse: false, ring: "ring-gray-400/30" }
  }

  const statusIndicator = getStatusIndicator()

  // Mobile Voice-Centric Interface
  if (isMobile) {
    return (
      <div className={`fixed ${getPositionClasses()} z-50`}>
        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8, y: 50 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.8, y: 50 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className={`mb-4 w-80 h-96 rounded-3xl shadow-2xl border ${getThemeClasses()} overflow-hidden flex flex-col`}
            >
              {/* Compact Header */}
              <div className="p-4 border-b border-gray-300/30 dark:border-gray-700/30 bg-gray-50/50 dark:bg-gray-900/50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <motion.img
                      src={agentImage || "/placeholder.svg"}
                      alt={agentName}
                      className="w-17 h-17 rounded-full object-cover ring-2 ring-gray-300 dark:ring-gray-600"
                      whileHover={{ scale: 1.05 }}
                    />
                    <div>
                      <h3 className="font-semibold text-sm text-black dark:text-white">{agentName}</h3>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {connectionStatus === "Connected"
                          ? isProcessing
                            ? "Thinking..."
                            : isPlaying
                              ? "Speaking..."
                              : "Ready"
                          : connectionStatus}
                      </p>
                    </div>
                  </div>
                  <motion.button
                    onClick={() => setIsOpen(false)}
                    className="p-1.5 hover:bg-gray-200/50 dark:hover:bg-gray-700/50 rounded-full"
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </motion.button>
                </div>
              </div>

              {/* Voice-Centric Main Area */}
              <div className="flex-1 flex flex-col items-center justify-center p-6 space-y-6">
                {/* Central Voice Visualizer */}
                <div className="relative">
                  {/* Audio Waveform Around Avatar */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="absolute w-40 h-40 rounded-full flex items-center justify-center">
                      {Array.from({ length: 16 }).map((_, i) => (
                        <motion.div
                          key={i}
                          className="absolute w-1 bg-black dark:bg-white rounded-full"
                          style={{
                            transform: `rotate(${i * 22.5}deg) translateY(-70px)`,
                            transformOrigin: "center 70px",
                          }}
                          animate={{
                            height: isPlaying ? `${8 + Math.random() * 16}px` : "4px",
                            opacity: isPlaying ? 0.8 : 0.2,
                          }}
                          transition={{ duration: 0.1, delay: i * 0.05 }}
                        />
                      ))}
                    </div>
                  </div>
                </div>

                {/* Status Text */}
                <div className="text-center space-y-2">
                  {isProcessing ? (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="text-sm font-medium text-gray-600 dark:text-gray-400"
                    >
                      Mimi is thinking...
                    </motion.div>
                  ) : isPlaying ? (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="text-sm font-medium text-black dark:text-white"
                    >
                      Speaking...
                    </motion.div>
                  ) : chatMessages.length === 0 ? (
                    <div className="text-center space-y-2">
                      <p className="text-sm font-medium">
                        Mobile browsers don't support reliable voice support . Send message to Mimi , She will answer
                        you .{" "}
                      </p>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-600 dark:text-gray-400"></p>
                  )}
                </div>

                {/* Recent Messages Preview (Compact) */}
                {chatMessages.length > 0 && (
                  <div className="w-full max-h-20 overflow-y-auto space-y-1">
                    {chatMessages.slice(-2).map((msg, index) => (
                      <motion.div
                        key={index}
                        initial={{
                          opacity: 0,
                          x: msg.type === "user" ? 20 : -20,
                        }}
                        animate={{ opacity: 1, x: 0 }}
                        className={`text-xs p-2 rounded-lg ${
                          msg.type === "user"
                            ? "bg-black/10 dark:bg-white/10 text-black dark:text-white ml-8"
                            : "bg-gray-100 dark:bg-gray-800 mr-8"
                        }`}
                      >
                        {msg.content.length > 50 ? `${msg.content.substring(0, 50)}...` : msg.content}
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>

              {/* Fixed Text Input - Positioned absolutely to prevent displacement */}
              <div className="absolute bottom-0 left-0 right-0 p-3 border-t border-gray-300/30 dark:border-gray-700/30 bg-white/95 dark:bg-black/95 backdrop-blur-sm">
                <form onSubmit={handleTextSubmit} className="flex space-x-2">
                  <input
                    type="text"
                    value={textInput}
                    onChange={(e) => setTextInput(e.target.value)}
                    placeholder="Type a message..."
                    disabled={connectionStatus !== "Connected" || isProcessing}
                    className="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-full focus:outline-none focus:ring-1 focus:ring-black dark:focus:ring-white bg-white dark:bg-gray-900 disabled:opacity-50"
                  />
                  <motion.button
                    type="submit"
                    disabled={!textInput.trim() || connectionStatus !== "Connected" || isProcessing}
                    className="px-3 py-2 bg-black dark:bg-white text-white dark:text-black rounded-full disabled:bg-gray-300 disabled:dark:bg-gray-600 disabled:cursor-not-allowed"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                      />
                    </svg>
                  </motion.button>
                </form>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Floating Button */}
        <motion.button
          onClick={() => setIsOpen(!isOpen)}
          className="relative w-17 h-17 rounded-full shadow-2xl overflow-hidden"
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          animate={{
            boxShadow: statusIndicator.pulse
              ? ["0 0 0 0 rgba(0, 0, 0, 0.4)", "0 0 0 20px rgba(0, 0, 0, 0)"]
              : "0 10px 25px rgba(0, 0, 0, 0.15)",
          }}
          transition={{
            duration: statusIndicator.pulse ? 1.5 : 0.3,
            repeat: statusIndicator.pulse ? Number.POSITIVE_INFINITY : 0,
          }}
        >
          <img src={agentImage || "/placeholder.svg"} alt={agentName} className="w-full h-full object-cover" />

          <motion.div
            className={`absolute -top-1 -right-1 w-5 h-5 rounded-full border-2 border-white ${statusIndicator.color} shadow-lg`}
            animate={{ scale: statusIndicator.pulse ? [1, 1.2, 1] : 1 }}
            transition={{
              duration: 1,
              repeat: statusIndicator.pulse ? Number.POSITIVE_INFINITY : 0,
            }}
          />

          {isPlaying && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
              className="absolute -top-2 -left-2 w-6 h-6 bg-black dark:bg-white text-white dark:text-black rounded-full flex items-center justify-center"
            >
              <motion.svg
                className="w-3 h-3"
                fill="currentColor"
                viewBox="0 0 20 20"
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ duration: 0.5, repeat: Number.POSITIVE_INFINITY }}
              >
                <path
                  fillRule="evenodd"
                  d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.617.816L4.846 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.846l3.537-3.816a1 1 0 011.617.816zM16 8a2 2 0 11-4 0 2 2 0 014 0z"
                  clipRule="evenodd"
                />
              </motion.svg>
            </motion.div>
          )}
        </motion.button>
      </div>
    )
  }

  // Desktop Radial Voice Command Center - Smaller Size
  return (
    <div className={`fixed ${getPositionClasses()} z-50`}>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            className={`mb-4 w-35 h-35 rounded-full shadow-2xl border ${getThemeClasses()} overflow-hidden relative`}
          >
            {/* Background */}
            <div className="absolute inset-0 bg-gray-50/50 dark:bg-gray-900/50" />

            {/* Central Avatar */}
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
              <motion.div
                className="relative w-30 h-30 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center border-2 border-gray-200 dark:border-gray-700"
                animate={{
                  scale: isListening ? [1, 1.05, 1] : isPlaying ? [1, 1.08, 1] : 1,
                }}
                transition={{
                  duration: 1.5,
                  repeat: isListening || isPlaying ? Number.POSITIVE_INFINITY : 0,
                }}
              >
                <motion.img
                  src={agentImage || "/placeholder.svg"}
                  alt={agentName}
                  className="w-full h-full rounded-full object-cover"
                  animate={{
                    opacity: isProcessing ? [1, 0.7, 1] : 1,
                  }}
                  transition={{
                    duration: 2,
                    repeat: isProcessing ? Number.POSITIVE_INFINITY : 0,
                  }}
                />
              </motion.div>
            </div>

            {/* Radial Controls */}
            <div className="absolute inset-0">
              {/* Microphone Button - Bottom Edge of Image */}
              <motion.button
                onClick={isListening ? stopListening : startListeningWrapper}
                disabled={connectionStatus !== "Connected"}
                className={`absolute bottom-[10px] left-1/2 transform -translate-x-1/2 w-12 h-12 rounded-full shadow-lg ${
                  isListening
                    ? "bg-red-500 text-white"
                    : connectionStatus !== "Connected"
                      ? "bg-gray-300 dark:bg-gray-700 text-gray-500 cursor-not-allowed"
                      : "bg-black dark:bg-white text-white dark:text-black hover:bg-gray-800 dark:hover:bg-gray-200"
                }`}
                whileHover={{
                  scale: connectionStatus === "Connected" ? 1.1 : 1,
                }}
                whileTap={{ scale: connectionStatus === "Connected" ? 0.9 : 1 }}
                onMouseEnter={() => setShowMicTooltip(true)}
                onMouseLeave={() => setShowMicTooltip(false)}
              >
                {isListening ? (
                  <motion.svg
                    className="w-5 h-5 mx-auto"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{
                      duration: 1,
                      repeat: Number.POSITIVE_INFINITY,
                    }}
                  >
                    <path d="M6 6h12v12H6z" />
                  </motion.svg>
                ) : (
                  <svg className="w-5 h-5 mx-auto" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
                    <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
                  </svg>
                )}
              </motion.button>
              <AnimatePresence>
                {showMicTooltip && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className="absolute bottom-[66px] left-1/2 transform -translate-x-1/2 bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-md px-2 py-1 shadow-lg border border-gray-300/50 dark:border-gray-600/50 text-xs text-gray-600 dark:text-gray-400 whitespace-nowrap z-10"
                  >
                    {isListening
                      ? "Stop Listening"
                      : connectionStatus === "Connected"
                        ? "Start Listening"
                        : "Connecting..."}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Stop Audio Button - Bottom Edge of Image (when playing) */}
              <AnimatePresence>
                {isPlaying && (
                  <>
                    <motion.button
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0, opacity: 0 }}
                      onClick={stopAllAudio}
                      className="absolute bottom-[10px] left-1/2 transform -translate-x-1/2 w-12 h-12 rounded-full bg-red-500 text-white shadow-lg hover:bg-red-600"
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      onMouseEnter={() => setShowStopAudioTooltip(true)}
                      onMouseLeave={() => setShowStopAudioTooltip(false)}
                    >
                      <svg className="w-5 h-5 mx-auto" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M6 6h12v12H6z" />
                      </svg>
                    </motion.button>
                    <AnimatePresence>
                      {showStopAudioTooltip && (
                        <motion.div
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: 10 }}
                          className="absolute bottom-[66px] left-1/2 transform -translate-x-1/2 bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-md px-2 py-1 shadow-lg border border-gray-300/50 dark:border-gray-600/50 text-xs text-gray-600 dark:text-gray-400 whitespace-nowrap z-10"
                        >
                          Stop Audio
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </>
                )}
              </AnimatePresence>

              {/* Tooltip for Thinking/Speaking */}
              <AnimatePresence>
                {(isProcessing || isPlaying) && (
                  <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="absolute top-[10px] left-[10px] max-w-[160px]"
                  >
                    <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-xl p-2 shadow-lg border border-gray-300/50 dark:border-gray-600/50">
                      <div className="text-xs font-medium text-gray-600 dark:text-gray-400">
                        {isProcessing ? "Thinking..." : "Speaking..."}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Close Button - Top Right */}
              <motion.button
                onClick={() => setIsOpen(false)}
                className="absolute top-4 right-4 w-8 h-8 rounded-full bg-gray-200/80 dark:bg-gray-700/80 backdrop-blur-sm hover:bg-gray-300/80 dark:hover:bg-gray-600/80"
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onMouseEnter={() => setShowCloseTooltip(true)}
                onMouseLeave={() => setShowCloseTooltip(false)}
              >
                <svg className="w-4 h-4 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </motion.button>
              <AnimatePresence>
                {showCloseTooltip && (
                  <motion.div
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 10 }}
                    className="absolute top-1/2 right-[calc(4*4px+8*4px+8px)] transform -translate-y-1/2 bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-md px-2 py-1 shadow-lg border border-gray-300/50 dark:border-gray-600/50 text-xs text-gray-600 dark:text-gray-400 whitespace-nowrap z-10"
                  >
                    Close
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Transcript Display - Left Side */}
            <AnimatePresence>
              {(currentTranscript || interimTranscript || lastUserMessage) && !isProcessing && !isPlaying && (
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="absolute left-4 top-1/2 transform -translate-y-1/2 max-w-[160px]"
                >
                  <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-xl p-2 shadow-lg border border-gray-300/50 dark:border-gray-600/50">
                    <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">
                      {lastUserMessage ? "You said:" : "Listening..."}
                    </div>
                    <div className="text-xs font-f1">
                      {lastUserMessage || currentTranscript}
                      {interimTranscript && (
                        <span className="text-gray-500 italic">
                          {interimTranscript}
                          <motion.span
                            className="ml-1"
                            animate={{ opacity: [1, 0, 1] }}
                            transition={{
                              duration: 1,
                              repeat: Number.POSITIVE_INFINITY,
                            }}
                          >
                            |
                          </motion.span>
                        </span>
                      )}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Error Display */}
            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="absolute right-4 top-1/2 transform -translate-y-1/2 max-w-[160px]"
                >
                  <div className="bg-red-50 dark:bg-red-900/20 backdrop-blur-sm rounded-xl p-2 shadow-lg border border-red-300/50 dark:border-red-700/50">
                    <div className="text-xs text-red-600 dark:text-red-400 mb-1">Error:</div>
                    <div className="text-xs text-red-800 dark:text-red-300">{error}</div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Enhanced Floating Button */}
      <AnimatePresence>
        {!isOpen && (
          <motion.button
            onClick={() => setIsOpen(!isOpen)}
            className="relative w-16 h-16 rounded-full shadow-2xl overflow-hidden"
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            animate={{
              boxShadow: statusIndicator.pulse
                ? ["0 0 0 0 rgba(0, 0, 0, 0.4)", "0 0 0 20px rgba(0, 0, 0, 0)"]
                : "0 15px 35px rgba(0, 0, 0, 0.2)",
            }}
            transition={{
              duration: statusIndicator.pulse ? 1.5 : 0.3,
              repeat: statusIndicator.pulse ? Number.POSITIVE_INFINITY : 0,
            }}
          >
            <img src={agentImage || "/placeholder.svg"} alt={agentName} className="w-full h-full object-cover" />

            <motion.div
              className={`absolute inset-0 rounded-full border-3 ${statusIndicator.color.replace("bg-", "border-")}`}
              animate={{
                scale: statusIndicator.pulse ? [1, 1.1, 1] : 1,
                opacity: statusIndicator.pulse ? [0.5, 1, 0.5] : 1,
              }}
              transition={{
                duration: 1.5,
                repeat: statusIndicator.pulse ? Number.POSITIVE_INFINITY : 0,
              }}
            />

            <motion.div
              className={`absolute -top-1 -right-1 w-5 h-5 rounded-full border-2 border-white ${statusIndicator.color} shadow-lg`}
              animate={{ scale: statusIndicator.pulse ? [1, 1.2, 1] : 1 }}
              transition={{
                duration: 1,
                repeat: statusIndicator.pulse ? Number.POSITIVE_INFINITY : 0,
              }}
            />

            {/* Voice Activity Indicator */}
            <AnimatePresence>
              {isListening && isUserSpeaking && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  exit={{ scale: 0 }}
                  className="absolute -top-2 -left-2 w-6 h-6 bg-green-500 text-white rounded-full flex items-center justify-center shadow-lg"
                >
                  <motion.svg
                    className="w-3 h-3"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                    animate={{ scale: [1, 1.3, 1] }}
                    transition={{ duration: 0.3, repeat: Number.POSITIVE_INFINITY }}
                  >
                    <path
                      fillRule="evenodd"
                      d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z"
                      clipRule="evenodd"
                    />
                  </motion.svg>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  )
}

export default VoiceAgentWidget
