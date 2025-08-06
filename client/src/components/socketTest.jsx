"use client"

import { useEffect, useState, useRef, useCallback } from "react"
import { WSS_URL } from "../config/constant"
import { BASE_URL } from "../config/constant"
import useAudioCollector from "../utils/audioChunkCollection"
import axios from "axios"

const EnhancedVoiceTester = () => {
  const [clientId, setClientId] = useState(null)
  const [sessionId, setSessionId] = useState(null)
  const [message, setMessage] = useState("")
  const [log, setLog] = useState([])
  const [isPlaying, setIsPlaying] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState("Connecting...")

  // Voice-to-text state
  const [isListening, setIsListening] = useState(false)
  const [currentTranscript, setCurrentTranscript] = useState("")
  const [interimTranscript, setInterimTranscript] = useState("")
  const [lastUserMessage, setLastUserMessage] = useState("")
  const [showTranscript, setShowTranscript] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [showMobileInput, setShowMobileInput] = useState(false)
  const [mobileTextInput, setMobileTextInput] = useState("")
  const [hasUserGesture, setHasUserGesture] = useState(false)
  const [error, setError] = useState("")
  const [isProcessing, setIsProcessing] = useState(false)

  // Voice Activity Detection
  const [isUserSpeaking, setIsUserSpeaking] = useState(false)
  const [audioLevel, setAudioLevel] = useState(0)

  const wsRef = useRef(null)
  const audioContextRef = useRef(null)
  const gainNodeRef = useRef(null)
  const analyserRef = useRef(null)

  // Speech recognition refs
  const recognitionRef = useRef(null)
  const silenceTimeoutRef = useRef(null)
  const micStreamRef = useRef(null)
  const vadAnalyserRef = useRef(null)
  const vadCheckIntervalRef = useRef(null)

  // Ultra-smooth audio processing refs
  const rawChunksRef = useRef([])
  const processedChunksRef = useRef(new Set())
  const chunkTimeoutRef = useRef(null)
  const audioQueueRef = useRef([])
  const currentSourceRef = useRef(null)
  const isPlayingRef = useRef(false)
  const nextStartTimeRef = useRef(0)

  const expectedSampleRate = 24000

  // Enhanced mobile detection
  useEffect(() => {
    const checkMobile = () => {
      const userAgent = navigator.userAgent.toLowerCase()
      const isMobileUA = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent)
      const isTouchDevice = "ontouchstart" in window || navigator.maxTouchPoints > 0
      const isSmallScreen = window.innerWidth <= 768

      const isMobileDevice = isMobileUA || (isTouchDevice && isSmallScreen)
      setIsMobile(isMobileDevice)

      console.log("📱 Mobile Detection:", {
        userAgent: isMobileUA,
        touchDevice: isTouchDevice,
        smallScreen: isSmallScreen,
        finalResult: isMobileDevice,
      })

      // For desktop, check speech recognition support
      if (!isMobileDevice) {
        const hasSpeechRecognition = "webkitSpeechRecognition" in window || "SpeechRecognition" in window
        if (!hasSpeechRecognition) {
          setError("Speech recognition not supported on this browser")
        }
      }
    }

    checkMobile()
    window.addEventListener("resize", checkMobile)
    return () => window.removeEventListener("resize", checkMobile)
  }, [])

  // Initialize Audio Context with ultra-smooth settings
  const initializeAudioContext = useCallback(async () => {
    if (!audioContextRef.current) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext
      audioContextRef.current = new AudioContextClass({
        sampleRate: expectedSampleRate,
        latencyHint: "interactive",
      })

      gainNodeRef.current = audioContextRef.current.createGain()
      analyserRef.current = audioContextRef.current.createAnalyser()
      analyserRef.current.fftSize = 256
      analyserRef.current.smoothingTimeConstant = 0.8

      gainNodeRef.current.connect(analyserRef.current)
      analyserRef.current.connect(audioContextRef.current.destination)
      gainNodeRef.current.gain.value = 0.9

      if (audioContextRef.current.state === "suspended") {
        await audioContextRef.current.resume()
      }

      console.log("🎵 Ultra-smooth AudioContext initialized")
    }
  }, [])

  // Initialize Voice Activity Detection
  const initializeVAD = useCallback(async () => {
    if (isMobile) return

    try {
      const constraints = {
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 22050,
          channelCount: 1,
        },
      }

      const stream = await navigator.mediaDevices.getUserMedia(constraints)
      micStreamRef.current = stream

      const vadAudioContext = new (window.AudioContext || window.webkitAudioContext)({
        sampleRate: 22050,
      })
      const source = vadAudioContext.createMediaStreamSource(stream)

      vadAnalyserRef.current = vadAudioContext.createAnalyser()
      vadAnalyserRef.current.fftSize = 512
      vadAnalyserRef.current.smoothingTimeConstant = 0.3

      source.connect(vadAnalyserRef.current)

      startVADMonitoring()
      console.log("🎤 VAD initialized")
    } catch (error) {
      console.error("VAD initialization failed:", error)
      logMessage("⚠️ Microphone access denied - voice detection disabled")
    }
  }, [isMobile])

  // VAD monitoring
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

      const threshold = 25
      const isSpeaking = rms > threshold

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
  }, [])

  // Start listening for speech
  const startListening = useCallback(async () => {
    // Check if we have clientId before starting
    if (!clientId) {
      setError("WebSocket not connected. Please wait for connection.")
      return
    }

    if (isMobile) {
      setShowMobileInput(true)
      return
    }

    // Stop any current audio playback when starting to listen
    if (isPlaying) {
      stopAllAudio()
    }

    setHasUserGesture(true)
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
      await initializeAudioContext()
      await initializeVAD()

      if (!recognitionRef.current) {
        const recognition = new SpeechRecognition()
        recognition.continuous = true
        recognition.lang = "en-US"
        recognition.interimResults = true
        recognition.maxAlternatives = 1
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

        // 3-second silence timeout - automatically send voice query
        silenceTimeoutRef.current = setTimeout(async () => {
          const fullTranscript = (currentTranscript + " " + finalTranscript + " " + interimTranscript).trim()

          if (fullTranscript && !isProcessing) {
            console.log("📝 3-second timeout - sending voice query:", fullTranscript)
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

            // Hide user message after 2 seconds
            setTimeout(() => {
              setLastUserMessage("")
            }, 2000)

            // Send to voice query API instead of text
            await sendVoiceQuery(fullTranscript)
          }
        }, 2000) // 2-second timeout
      }

      // Error handling in case of speech recognition failure
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

      // Handle speech recognition end
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


      // Start speech recognition
      recognition.start()


    } catch (error) {
      console.error("Speech recognition setup failed:", error)
      setError("Failed to initialize speech recognition")
      setIsListening(false)
      setShowTranscript(false)
      setIsProcessing(false)
      logMessage("❌ Failed to start speech recognition")
    }
  }, [currentTranscript, isMobile, initializeAudioContext, initializeVAD, isPlaying, isProcessing, clientId])

  // Stop listening
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
  }, [])

  // Send voice query to the API 
  const sendVoiceQuery = async (transcript) => {
    try {
      setIsProcessing(true)
      logMessage(`📤 Sending voice query: "${transcript}"`)

      // Clear any existing audio when starting new request
      stopAllAudio()

      // Make sure we have clientId before sending
      if (!clientId) {
        throw new Error("Client ID not available. Please wait for WebSocket connection.")
      }

      // Send to voice query API
      const response = await axios.post(`${BASE_URL}/api/voice-query`, {
        message: transcript,
        clientId: clientId, // ✅ FIX: Include clientId in the request
        sessionId,
      })

      // Validate response
      if (!response.data) {
        throw new Error("No response data received from the API")
      }

      // Process response
      const { sessionId: newSid, text, isNewSession, processingTime } = response.data

      //Check if a new session has been created
      if (newSid && newSid !== sessionId) {
        setSessionId(newSid)
        logMessage(`🆔 Session ID updated: ${newSid}`)
      }

      logMessage(`📥 Voice response: "${text}"`)
      logMessage(`⏱️ Processing time: ${processingTime}ms`)
      logMessage(`🎯 Audio will be sent to clientId: ${clientId}`)

      if (isNewSession) {
        logMessage("🆕 New session created")
      }

      // Audio response will come through WebSocket automatically
      logMessage("🎵 Waiting for audio response...")
    } catch (err) {
      console.error("Voice Query API Error:", err)
      const errorMsg = err.response?.data?.error || err.message || "Unknown error"
      logMessage(`❌ Voice Query Error: ${errorMsg}`)
      setError(`Voice query failed: ${errorMsg}`)
    } finally {
      setIsProcessing(false)
    }
  }

  // Handle mobile text input (also sends to voice query)
  const handleMobileSubmit = async (e) => {
    e.preventDefault()
    if (!mobileTextInput.trim()) return

    const message = mobileTextInput.trim()
    setMobileTextInput("")
    setShowMobileInput(false)
    setLastUserMessage(message)

    setTimeout(() => {
      setLastUserMessage("")
    }, 3000)

    logMessage(`📱 Mobile voice input: "${message}"`)
    await sendVoiceQuery(message) // Send to voice query instead of text
  }

  // Handle manual text input 
  const handleSendMessage = async () => {
    if (!message.trim()) {
      alert("Please enter a message")
      return
    }

    if (!clientId) {
      alert("WebSocket not connected or clientId not received")
      return
    }

    await sendVoiceQuery(message.trim()) // Send to voice query instead of text
    setMessage("")
  }

  // WebSocket connection
  useEffect(() => {

    //Connect Web Socket Function
    const connectWebSocket = () => {
      const ws = new WebSocket(WSS_URL)
      wsRef.current = ws

      //Websocket open
      ws.onopen = () => {
        console.log("Voice Chat Connected to WebSocket ✅")
        setConnectionStatus("Connected")
        logMessage("Voice Chat connection established ✅")
      }

      //Websocket message receiving
      ws.onmessage = async (event) => {
        try {
          //Backend sends init message with clientId
          const data = JSON.parse(event.data)

          if (data.type === "init") {
            setClientId(data.clientId)
            logMessage(`✅ Voice Chat initialized with clientId: ${data.clientId}`)
            await initializeAudioContext()
          } else if (data.type === "pong") {
            logMessage("🏓 Pong received")
          } else {
            logMessage(`📩 Control message: ${JSON.stringify(data)}`)
          }
        } catch (err) {
          if (event.data instanceof Blob) { // Check if the data is a audio Blob
            handleAudioBlob(event.data)
          } else if (typeof event.data === "string") { // Check if the data is base64 audio
            collectAudioChunk(event.data)
          } else { // Unknown data type
            logMessage(`Unknown data type Received from the backend: ${typeof event.data}`)
          }
        }
      }

      //Websocket error
      ws.onerror = (err) => {
        console.error("❌ WebSocket Error", err)
        setConnectionStatus("Error")
        logMessage("❌ WebSocket connection error")
      }

      //Websocket close
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
        }, 3000)
      }
    }

    // Connect WebSocket
    connectWebSocket()


    // Cleanup
    return () => {
      if (wsRef.current) {
        wsRef.current.close()
      }
      stopAllAudio()
      stopListening()

      // Cleanup
      if (vadCheckIntervalRef.current) {
        clearInterval(vadCheckIntervalRef.current)
      }
      if (micStreamRef.current) {
        micStreamRef.current.getTracks().forEach((track) => track.stop())
      }
      if (audioContextRef.current && audioContextRef.current.state !== "closed") {
        audioContextRef.current.close()
      }
    }
  }, [])

  // Log messages function
  const logMessage = (msg) => {
    const timestamp = new Date().toLocaleTimeString()
    setLog((prev) => [...prev.slice(-50), `[${timestamp}] ${msg}`])
  }


  // Handle audio blob
  const handleAudioBlob = async (blob) => {
    try {
      const arrayBuffer = await blob.arrayBuffer()
      const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)))
      await collectAudioChunk(base64)
    } catch (error) {
      console.error("Error handling audio blob:", error)
      logMessage(`❌ Audio blob error: ${error.message}`)
    }
  }

  // Ultra-smooth audio processing with enhancement
  const processAudioChunk = useCallback(async (base64Data) => {
    if (!audioContextRef.current || !base64Data) return null

    const chunkHash = btoa(base64Data.slice(0, 100) + base64Data.slice(-100))
    if (processedChunksRef.current.has(chunkHash)) {
      return null
    }
    processedChunksRef.current.add(chunkHash)

    try {
      const binaryString = atob(base64Data)
      const bytes = new Uint8Array(binaryString.length)

      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i)
      }

      const audioBuffer = await audioContextRef.current.decodeAudioData(bytes.buffer.slice(0))

      if (!audioBuffer || audioBuffer.duration <= 0) {
        return null
      }

      const enhancedBuffer = await ultraSmoothEnhancement(audioBuffer)
      return enhancedBuffer
    } catch (error) {
      console.warn("⚠️ Chunk processing failed:", error.message)
      return null
    }
  }, [])


  // Ultra-smooth enhancement function
  const ultraSmoothEnhancement = useCallback(async (buffer) => {
    if (!audioContextRef.current) return buffer

    const sampleRate = buffer.sampleRate
    const channels = buffer.numberOfChannels
    const length = buffer.length

    const enhancedBuffer = audioContextRef.current.createBuffer(channels, length, sampleRate)

    for (let channel = 0; channel < channels; channel++) {
      const inputData = buffer.getChannelData(channel)
      const outputData = enhancedBuffer.getChannelData(channel)

      for (let i = 0; i < length; i++) {
        let sample = inputData[i]

        if (Math.abs(sample) < 0.001) {
          sample = 0
        }

        const threshold = 0.8
        if (Math.abs(sample) > threshold) {
          const excess = Math.abs(sample) - threshold
          const compressedExcess = excess * 0.3
          sample = Math.sign(sample) * (threshold + compressedExcess)
        }

        const fadeLength = Math.min(64, length / 10)

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
  }, [])

  // Ultra-smooth audio queue playback
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
  }, [])

// Audio collector
const { collectAudioChunk } = useAudioCollector({
  processAudioChunk,
  logMessage,
  playAudioQueue,
  audioQueueRef,
  isPlayingRef,
})

  // Stop all audio
  const stopAllAudio = useCallback(() => {
    if (currentSourceRef.current) {
      try {
        currentSourceRef.current.stop()
        currentSourceRef.current.disconnect()
      } catch (e) {}
      currentSourceRef.current = null
    }

    audioQueueRef.current = []
    rawChunksRef.current = []
    processedChunksRef.current.clear()
    isPlayingRef.current = false
    nextStartTimeRef.current = 0
    setIsPlaying(false)

    if (chunkTimeoutRef.current) {
      clearTimeout(chunkTimeoutRef.current)
      chunkTimeoutRef.current = null
    }

    logMessage("⏹️ All audio stopped and queues cleared")
  }, [])

  // Handle key press
  const handleKeyPress = (e) => {
    if (e.key === "Enter") {
      handleSendMessage()
    }
  }

  // Send ping
  const sendPing = () => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "ping" }))
      logMessage("🏓 Ping sent")
    } else {
      logMessage("❌ WebSocket not connected")
    }
  }

  // Clear log
  const clearLog = () => {
    setLog([])
  }

  // Truncate long messages
  const truncateMessage = (message, maxLength = 100) => {
    if (message.length <= maxLength) return message
    return message.substring(0, maxLength) + "..."
  }

  return (
    <div className="p-8 font-sans max-w-4xl mx-auto">
      {/* User Transcript Display */}
      {((showTranscript && (currentTranscript || interimTranscript)) || lastUserMessage) && (
        <div className="fixed top-6 right-6 z-50">
          <div className="bg-blue-600 text-white px-4 py-3 rounded-xl shadow-2xl animate-in slide-in-from-top-2 duration-200 max-w-[320px] text-sm">
            <div className="break-words">
              {lastUserMessage ? (
                <div className="font-medium text-blue-100">
                  <span className="text-blue-200">🎤 You said:</span> "{truncateMessage(lastUserMessage, 120)}"
                </div>
              ) : (
                <>
                  {currentTranscript && (
                    <div className="font-medium text-green-300 mb-1">✓ {truncateMessage(currentTranscript, 100)}</div>
                  )}
                  {interimTranscript && (
                    <div className="text-blue-200 italic">
                      {truncateMessage(interimTranscript, 80)}
                      <span className="animate-pulse">|</span>
                    </div>
                  )}
                </>
              )}
            </div>
            {showTranscript && (
              <div className="text-xs text-blue-200 mt-2 flex items-center">
                <div className="w-2 h-2 bg-blue-300 rounded-full animate-pulse mr-2"></div>
                Listening... (3s timeout)
              </div>
            )}
          </div>
        </div>
      )}

      {/* Processing Indicator */}
      {isProcessing && (
        <div className="fixed top-6 left-6 z-50">
          <div className="bg-yellow-600 text-white px-4 py-3 rounded-xl shadow-2xl animate-in slide-in-from-top-2 duration-200">
            <div className="flex items-center">
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
              <div className="text-sm">Processing voice query...</div>
            </div>
          </div>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="fixed top-6 left-6 right-6 z-50">
          <div className="bg-red-600 text-white px-4 py-3 rounded-xl shadow-2xl animate-in slide-in-from-top-2 duration-200 max-w-sm mx-auto">
            <div className="flex items-center">
              <div className="w-4 h-4 bg-red-300 rounded-full mr-2 flex-shrink-0"></div>
              <div className="text-sm">{error}</div>
            </div>
          </div>
        </div>
      )}

      {/* Mobile Text Input Modal */}
      {showMobileInput && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">🎤 Voice Input (Mobile)</h3>
            <p className="text-gray-600 mb-4">
              Speech recognition may not work reliably on mobile. Please type your voice query:
            </p>
            <form onSubmit={handleMobileSubmit}>
              <textarea
                value={mobileTextInput}
                onChange={(e) => setMobileTextInput(e.target.value)}
                placeholder="Type your voice query here..."
                className="w-full p-3 border border-gray-300 rounded-lg resize-none h-24 mb-4"
                autoFocus
              />
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={!mobileTextInput.trim()}
                  className="flex-1 bg-blue-500 text-white py-2 px-4 rounded-lg disabled:bg-gray-400"
                >
                  Send Voice Query
                </button>
                <button
                  type="button"
                  onClick={() => setShowMobileInput(false)}
                  className="px-4 py-2 bg-gray-500 text-white rounded-lg"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      <div className="mb-6 flex gap-2 flex-wrap">
        <input
          type="text"
          placeholder="Enter test message (will send to voice query)"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyPress={handleKeyPress}
          className="flex-1 min-w-64 p-2 border border-gray-300 rounded"
        />
        <button
          onClick={handleSendMessage}
          disabled={!clientId || !message.trim() || isProcessing}
          className="px-4 py-2 bg-blue-500 text-white rounded disabled:bg-gray-400 hover:bg-blue-600"
        >
          Test Query
        </button>
        <button
          onClick={isListening ? stopListening : startListening}
          disabled={!clientId || isProcessing}
          className={`px-4 py-2 text-white rounded ${
            isListening
              ? "bg-red-500 hover:bg-red-600 animate-pulse"
              : isProcessing
                ? "bg-yellow-500"
                : "bg-green-500 hover:bg-green-600"
          } disabled:bg-gray-400`}
        >
          {isListening ? "🛑 Stop Voice" : isProcessing ? "⚙️ Processing" : "🎤 Start Voice"}
        </button>
        <button onClick={sendPing} className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600">
          Ping
        </button>
        <button
          onClick={stopAllAudio}
          disabled={isProcessing}
          className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 disabled:bg-gray-400"
        >
          Stop Audio
        </button>
      </div>
    </div>
  )
}

export default EnhancedVoiceTester
