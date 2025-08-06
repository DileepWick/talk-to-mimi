"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { getVoiceResponse } from "../services/voiceService"
import { WSS_URL } from "../config/constant"

const ModernVoiceAgent = ({ onDataReceived }) => {
  // WebSocket and Audio Context refs
  const ws = useRef(null)
  const audioCtxRef = useRef(null)
  const gainNodeRef = useRef(null)
  const analyserRef = useRef(null)

  // Audio processing state
  const [agentState, setAgentState] = useState("idle") // idle, listening, thinking, speaking
  const audioQueueRef = useRef([])
  const currentSourceRef = useRef(null)
  const isPlayingRef = useRef(false)
  const nextStartTimeRef = useRef(0)

  // Enhanced audio processing
  const rawChunksRef = useRef([])
  const processedChunksRef = useRef(new Set())
  const chunkTimeoutRef = useRef(null)
  const expectedSampleRate = 24000

  // Voice activity detection
  const [isUserSpeaking, setIsUserSpeaking] = useState(false)
  const micStreamRef = useRef(null)
  const vadAnalyserRef = useRef(null)
  const vadCheckIntervalRef = useRef(null)

  // UI state
  const [isHovered, setIsHovered] = useState(false)
  const [recording, setRecording] = useState(false)
  const [error, setError] = useState("")
  const [sessionId, setSessionId] = useState(null)
  const [audioLevel, setAudioLevel] = useState(0)
  const [isMobile, setIsMobile] = useState(false)
  const [hasUserGesture, setHasUserGesture] = useState(false)
  const recognitionRef = useRef(null)
  const silenceTimeoutRef = useRef(null)

  // Speech recognition state
  const [currentTranscript, setCurrentTranscript] = useState("")
  const [interimTranscript, setInterimTranscript] = useState("")
  const [lastUserMessage, setLastUserMessage] = useState("")
  const [showTranscript, setShowTranscript] = useState(false)

  // Mobile fallback state
  const [showMobileMessage, setShowMobileMessage] = useState(false)
  const [textInput, setTextInput] = useState("")
  const [showTextInput, setShowTextInput] = useState(false)

  // Mobile audio state
  const [mobileAudioEnabled, setMobileAudioEnabled] = useState(false)
  const mobileAudioRef = useRef(null)

  // Avatar animation state
  const [mouthMovement, setMouthMovement] = useState(0)
  const animationFrameRef = useRef(null)

  // Auto-hide controls timer
  const transcriptTimeoutRef = useRef(null)

  // Add new state for connection
  const [isConnected, setIsConnected] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)
  const [shouldConnect, setShouldConnect] = useState(false) // Add this new state

  // Enhanced mobile detection
  useEffect(() => {
    const checkMobile = () => {
      // Multiple methods to detect mobile
      const userAgent = navigator.userAgent.toLowerCase()
      const isMobileUA = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent)
      const isTouchDevice = "ontouchstart" in window || navigator.maxTouchPoints > 0
      const isSmallScreen = window.innerWidth <= 768

      // Consider it mobile if any of these conditions are true
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

    // Re-check on window resize
    const handleResize = () => {
      checkMobile()
    }

    window.addEventListener("resize", handleResize)
    return () => window.removeEventListener("resize", handleResize)
  }, [])

  // Register session with WebSocket when sessionId changes
  const registerSessionWithWebSocket = useCallback((newSessionId) => {
    if (ws.current && ws.current.readyState === WebSocket.OPEN && newSessionId) {
      console.log(`📋 Registering session ${newSessionId} with WebSocket`)
      try {
        ws.current.send(
          JSON.stringify({
            type: "session_init",
            sessionId: newSessionId,
          }),
        )
        console.log(`✅ Session ${newSessionId} registered with WebSocket`)
      } catch (error) {
        console.error(`❌ Failed to register session ${newSessionId}:`, error)
      }
    }
  }, [])

  // Update session registration when sessionId changes
  useEffect(() => {
    if (sessionId) {
      registerSessionWithWebSocket(sessionId)
    }
  }, [sessionId, registerSessionWithWebSocket])

  // Stop all audio
  const stopAllAudio = useCallback(() => {
    // Desktop audio cleanup
    if (currentSourceRef.current) {
      try {
        currentSourceRef.current.stop()
        currentSourceRef.current.disconnect()
      } catch (e) {}
      currentSourceRef.current = null
    }

    // Mobile audio cleanup
    if (mobileAudioRef.current) {
      try {
        mobileAudioRef.current.pause()
        mobileAudioRef.current.currentTime = 0
      } catch (e) {}
    }

    audioQueueRef.current = []
    rawChunksRef.current = []
    processedChunksRef.current.clear()
    isPlayingRef.current = false
    nextStartTimeRef.current = 0
    setMouthMovement(0)

    if (chunkTimeoutRef.current) {
      clearTimeout(chunkTimeoutRef.current)
      chunkTimeoutRef.current = null
    }
  }, [])

  // Initialize AudioContext (desktop only)
  const initializeAudioContext = useCallback(async () => {
    if (isMobile) return // Skip for mobile

    try {
      if (audioCtxRef.current && audioCtxRef.current.state !== "closed") {
        return
      }

      const AudioContextClass = window.AudioContext || window.webkitAudioContext
      audioCtxRef.current = new AudioContextClass({
        sampleRate: expectedSampleRate,
        latencyHint: "interactive",
      })

      gainNodeRef.current = audioCtxRef.current.createGain()
      analyserRef.current = audioCtxRef.current.createAnalyser()
      analyserRef.current.fftSize = 256
      analyserRef.current.smoothingTimeConstant = 0.8

      gainNodeRef.current.connect(analyserRef.current)
      analyserRef.current.connect(audioCtxRef.current.destination)
      gainNodeRef.current.gain.value = 0.9

      if (audioCtxRef.current.state === "suspended") {
        await audioCtxRef.current.resume()
      }

      console.log("🎵 AudioContext initialized")
      startAudioVisualization()
    } catch (error) {
      console.error("Failed to initialize AudioContext:", error)
      setError("Audio system initialization failed")
    }
  }, [isMobile])

  // Initialize mobile audio element
  const initializeMobileAudio = useCallback(() => {
    if (!isMobile) return

    try {
      if (!mobileAudioRef.current) {
        mobileAudioRef.current = new Audio()
        mobileAudioRef.current.preload = "none"
        mobileAudioRef.current.crossOrigin = "anonymous"

        mobileAudioRef.current.onloadstart = () => {
          console.log("📱 Mobile audio loading...")
          setAgentState("speaking")
        }

        mobileAudioRef.current.oncanplay = () => {
          console.log("📱 Mobile audio ready to play")
        }

        mobileAudioRef.current.onplay = () => {
          console.log("📱 Mobile audio started playing")
          setAgentState("speaking")
        }

        mobileAudioRef.current.onended = () => {
          console.log("📱 Mobile audio finished")
          setAgentState("idle")
          setMouthMovement(0)
        }

        mobileAudioRef.current.onerror = (e) => {
          console.error("📱 Mobile audio error:", e)
          setAgentState("idle")
          setMouthMovement(0)
        }
      }

      console.log("📱 Mobile audio initialized")
    } catch (error) {
      console.error("Failed to initialize mobile audio:", error)
    }
  }, [isMobile])

  // Initialize VAD (desktop only)
  const initializeVAD = useCallback(async () => {
    if (isMobile) return // Skip for mobile

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
    }
  }, [isMobile])

  // VAD monitoring (desktop only)
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

  // Interrupt agent when speaking
  const interruptAgent = useCallback(() => {
    if (agentState === "speaking") {
      console.log("🛑 User interruption - stopping agent")
      stopAllAudio()
      setAgentState("idle")
      return true
    }
    return false
  }, [agentState, stopAllAudio])

  // Audio visualization
  const startAudioVisualization = useCallback(() => {
    if (!analyserRef.current) return

    const bufferLength = analyserRef.current.frequencyBinCount
    const dataArray = new Uint8Array(bufferLength)

    const animate = () => {
      if (!analyserRef.current) return

      analyserRef.current.getByteFrequencyData(dataArray)

      let sum = 0
      for (let i = 0; i < bufferLength / 4; i++) {
        sum += dataArray[i]
      }
      const average = sum / (bufferLength / 4)
      setMouthMovement(Math.min(average / 50, 1))

      animationFrameRef.current = requestAnimationFrame(animate)
    }

    animate()
  }, [])

  // Mobile audio visualization (simulated)
  const startMobileAudioVisualization = useCallback(() => {
    if (!isMobile || !mobileAudioRef.current) return

    const animate = () => {
      if (!mobileAudioRef.current || mobileAudioRef.current.paused) {
        setMouthMovement(0)
        return
      }

      // Simulate mouth movement based on audio playback
      const currentTime = mobileAudioRef.current.currentTime
      const movement = Math.sin(currentTime * 10) * 0.5 + 0.5
      setMouthMovement(movement)

      animationFrameRef.current = requestAnimationFrame(animate)
    }

    animate()
  }, [isMobile])

  // Audio processing functions (desktop only)
  const processAudioChunk = useCallback(
    async (base64Data) => {
      if (isMobile || !audioCtxRef.current || !base64Data || typeof base64Data !== "string") {
        return null
      }

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

        const audioBuffer = await audioCtxRef.current.decodeAudioData(bytes.buffer.slice(0))

        if (!audioBuffer || audioBuffer.duration <= 0) {
          return null
        }

        const enhancedBuffer = await ultraSmoothEnhancement(audioBuffer)
        return enhancedBuffer
      } catch (error) {
        console.warn("⚠️ Chunk processing failed:", error.message)
        return null
      }
    },
    [isMobile],
  )

  // Mobile audio chunk processing
  const processMobileAudioChunk = useCallback(
    (base64Data) => {
      if (!isMobile || !base64Data || typeof base64Data !== "string") {
        return
      }

      try {
        console.log("📱 Processing mobile audio chunk, length:", base64Data.length)

        // Convert base64 to blob URL for mobile audio element
        const binaryString = atob(base64Data)
        const bytes = new Uint8Array(binaryString.length)

        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i)
        }

        const blob = new Blob([bytes], { type: "audio/wav" })
        const audioUrl = URL.createObjectURL(blob)

        console.log("📱 Audio blob created, size:", blob.size)

        if (mobileAudioRef.current) {
          mobileAudioRef.current.src = audioUrl
          mobileAudioRef.current
            .play()
            .then(() => {
              console.log("📱 Mobile audio playing successfully")
              startMobileAudioVisualization()
            })
            .catch((error) => {
              console.error("📱 Mobile audio play failed:", error)
              setAgentState("idle")
              setError("Audio playback failed. Please try again.")
            })
        } else {
          console.error("📱 Mobile audio element not initialized")
          setAgentState("idle")
          setError("Audio system not ready. Please try again.")
        }
      } catch (error) {
        console.error("📱 Mobile audio processing failed:", error)
        setAgentState("idle")
        setError("Audio processing failed. Please try again.")
      }
    },
    [isMobile, startMobileAudioVisualization],
  )

  const ultraSmoothEnhancement = useCallback(async (buffer) => {
    if (!audioCtxRef.current) return buffer

    const sampleRate = buffer.sampleRate
    const channels = buffer.numberOfChannels
    const length = buffer.length

    const enhancedBuffer = audioCtxRef.current.createBuffer(channels, length, sampleRate)

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

  const playAudioQueue = useCallback(() => {
    if (
      isMobile ||
      !audioCtxRef.current ||
      !gainNodeRef.current ||
      isPlayingRef.current ||
      audioQueueRef.current.length === 0
    ) {
      return
    }

    isPlayingRef.current = true
    setAgentState("speaking")

    const playNextBuffer = () => {
      if (audioQueueRef.current.length === 0) {
        isPlayingRef.current = false
        nextStartTimeRef.current = 0
        setMouthMovement(0)
        setAgentState("idle")
        return
      }

      const buffer = audioQueueRef.current.shift()
      const source = audioCtxRef.current.createBufferSource()
      source.buffer = buffer
      source.connect(gainNodeRef.current)

      const currentTime = audioCtxRef.current.currentTime
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
      } catch (error) {
        console.error("Playback error:", error)
        setTimeout(playNextBuffer, 10)
      }
    }

    playNextBuffer()
  }, [isMobile])

  // Unified audio chunk collection for both desktop and mobile
  const collectAudioChunk = useCallback(
    async (base64Data) => {
      if (!base64Data) return

      console.log(`🎵 Audio chunk received for session ${sessionId} (${isMobile ? "Mobile" : "Desktop"})`)

      // Clear response timeout since we received audio
      if (window.responseTimeoutRef) {
        clearTimeout(window.responseTimeoutRef)
        window.responseTimeoutRef = null
        console.log("⏰ Response timeout cleared")
      }

      if (isMobile) {
        // Handle mobile audio directly
        processMobileAudioChunk(base64Data)
      } else {
        // Handle desktop audio with queue system
        rawChunksRef.current.push(base64Data)

        if (chunkTimeoutRef.current) {
          clearTimeout(chunkTimeoutRef.current)
        }

        chunkTimeoutRef.current = setTimeout(async () => {
          if (rawChunksRef.current.length === 0) return

          const processedBuffers = []
          for (const chunk of rawChunksRef.current) {
            const buffer = await processAudioChunk(chunk)
            if (buffer) {
              processedBuffers.push(buffer)
            }
          }

          if (processedBuffers.length > 0) {
            audioQueueRef.current.push(...processedBuffers)
            if (!isPlayingRef.current) {
              playAudioQueue()
            }
          }

          rawChunksRef.current = []
        }, 80)
      }
    },
    [processAudioChunk, playAudioQueue, processMobileAudioChunk, isMobile, sessionId],
  )

  // Desktop speech recognition
  const startListening = useCallback(async () => {
    if (isMobile) {
      console.log("📱 Mobile device detected, showing mobile message")
      setShowMobileMessage(true)
      return
    }

    setHasUserGesture(true)
    setCurrentTranscript("")
    setInterimTranscript("")
    setLastUserMessage("")
    setShowTranscript(false)

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition

    if (!SpeechRecognition) {
      setError("Speech recognition not supported on this browser")
      return
    }

    try {
      await initializeAudioContext()
      setError("")

      if (!recognitionRef.current) {
        const recognition = new SpeechRecognition()
        recognition.continuous = true
        recognition.lang = "en-US"
        recognition.interimResults = true
        recognition.maxAlternatives = 1

        recognitionRef.current = recognition
      }

      const recognition = recognitionRef.current

      recognition.onstart = null
      recognition.onresult = null
      recognition.onerror = null
      recognition.onend = null

      recognition.onstart = () => {
        console.log("🎤 Speech recognition started")
        setRecording(true)
        setAgentState("listening")
        setError("")
        setShowTranscript(true)
        setCurrentTranscript("")
        setInterimTranscript("")
        setLastUserMessage("")
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

        if (silenceTimeoutRef.current) {
          clearTimeout(silenceTimeoutRef.current)
        }

        silenceTimeoutRef.current = setTimeout(async () => {
          const fullTranscript = (currentTranscript + " " + finalTranscript + " " + interimTranscript).trim()

          if (fullTranscript) {
            console.log("📝 3-second timeout - sending:", fullTranscript)

            setCurrentTranscript("")
            setInterimTranscript("")
            setShowTranscript(false)
            setLastUserMessage(fullTranscript)
            setRecording(false)
            setAgentState("thinking")

            if (recognitionRef.current) {
              recognitionRef.current.stop()
            }

            setTimeout(() => {
              setLastUserMessage("")
            }, 2000)

            await sendMessage(fullTranscript)
          }
        }, 1000)
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
        setRecording(false)
        setAgentState("idle")
        setShowTranscript(false)
      }

      recognition.onend = () => {
        console.log("🎤 Speech recognition ended")

        if (silenceTimeoutRef.current) {
          clearTimeout(silenceTimeoutRef.current)
          silenceTimeoutRef.current = null
        }

        setRecording(false)
        setShowTranscript(false)
        if (agentState === "listening") {
          setAgentState("idle")
        }
      }

      try {
        recognition.start()
      } catch (error) {
        console.error("Failed to start recognition:", error)
        setError("Failed to start speech recognition. Please try again.")
        setRecording(false)
        setAgentState("idle")
        setShowTranscript(false)
      }
    } catch (error) {
      console.error("Speech recognition setup failed:", error)
      setError("Failed to initialize speech recognition")
      setRecording(false)
      setAgentState("idle")
      setShowTranscript(false)
    }
  }, [agentState, initializeAudioContext, currentTranscript, isMobile])

  // Stop listening
  const stopListening = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop()
    }

    if (silenceTimeoutRef.current) {
      clearTimeout(silenceTimeoutRef.current)
      silenceTimeoutRef.current = null
    }

    setRecording(false)
    setAgentState("idle")
    setCurrentTranscript("")
    setInterimTranscript("")
    setShowTranscript(false)
    setLastUserMessage("")
  }

  // Send message to the backend
  const sendMessage = async (message) => {
    try {
      console.log("📤 Sending message:", message)
      setAgentState("thinking")

      const body = { message }
      if (sessionId) {
        body.sessionId = sessionId
      }

      console.log("🌐 Calling getVoiceResponse with:", body)
      const res = await getVoiceResponse(body)
      console.log("📥 Response received:", res)

      const data = res.data
      console.log("📊 Response data:", data)

      if (data.filters) {
        console.log("🔍 Filters received:", data.filters)
        onDataReceived?.(data.filters)
      }

      // 🎯 FIX: Handle new sessions immediately
      if (data.sessionId && data.sessionId !== sessionId) {
        console.log("🆔 Session ID updated:", data.sessionId)
        setSessionId(data.sessionId)

        // 🎯 FIX: Immediately register new session with WebSocket if connected
        if (ws.current && ws.current.readyState === WebSocket.OPEN) {
          console.log(`📋 Immediately registering new session ${data.sessionId} with WebSocket`)
          try {
            ws.current.send(
              JSON.stringify({
                type: "session_init",
                sessionId: data.sessionId,
              }),
            )
            console.log(`✅ New session ${data.sessionId} registered immediately`)
          } catch (error) {
            console.error(`❌ Failed to register new session ${data.sessionId}:`, error)
          }
        }
      }

      // Set a timeout to reset state if no audio is received
      const responseTimeout = setTimeout(() => {
        console.log("⏰ No audio response received, resetting state")
        setAgentState("idle")
        setError("No voice response received. Please try again.")
      }, 15000) // Increased to 15 seconds for new sessions

      // Store timeout reference to clear it if audio is received
      window.responseTimeoutRef = responseTimeout

      console.log("✅ Message sent successfully, waiting for audio response...")
    } catch (err) {
      console.error("❌ Error sending message:", err)
      setError(`Error: ${err.message}`)
      setAgentState("idle")
    }
  }

  // Add connect function after the sendMessage function
  const handleConnect = async () => {
    setIsConnecting(true)
    setError("")

    try {
      // Set shouldConnect to true to trigger WebSocket connection
      setShouldConnect(true)

      // Initialize audio context first if desktop
      if (!isMobile) {
        await initializeAudioContext()
        await initializeVAD()
      } else {
        initializeMobileAudio()
      }

      // Wait a moment for WebSocket to connect
      await new Promise((resolve) => setTimeout(resolve, 1000))

      // Check WebSocket connection
      if (!ws.current || ws.current.readyState !== WebSocket.OPEN) {
        throw new Error("WebSocket connection failed")
      }

      // 🎯 NEW: Create a session immediately during connection
      console.log("🆔 Creating session during connection...")
      try {
        const response = await getVoiceResponse({
          message: "initialize", // Special initialization message
          initialize: true,
        })

        if (response.data.sessionId) {
          console.log("✅ Session created during connection:", response.data.sessionId)
          setSessionId(response.data.sessionId)

          // Register the session with WebSocket immediately
          if (ws.current && ws.current.readyState === WebSocket.OPEN) {
            ws.current.send(
              JSON.stringify({
                type: "session_init",
                sessionId: response.data.sessionId,
              }),
            )
            console.log("✅ Session registered with WebSocket during connection")
          }
        }
      } catch (sessionError) {
        console.warn("⚠️ Could not create session during connection:", sessionError)
        // Continue anyway - session will be created on first message
      }

      setHasUserGesture(true)
      console.log("✅ Successfully connected and ready for voice interaction")
    } catch (error) {
      console.error("❌ Connection failed:", error)
      setError("Failed to connect. Please try again.")
      setShouldConnect(false) // Reset on failure
      setIsConnected(false)
    } finally {
      setIsConnecting(false)
    }
  }

  // Handle text input submission (mobile fallback)
  const handleTextSubmit = async (e) => {
    e.preventDefault()
    if (!textInput.trim()) return

    const message = textInput.trim()
    setTextInput("")
    setShowTextInput(false)
    setShowMobileMessage(false) // Close mobile message too
    setLastUserMessage(message)

    setTimeout(() => {
      setLastUserMessage("")
    }, 2000)

    await sendMessage(message)
  }

  // Update handleClaraClick function
  const handleClaraClick = (e) => {
    e.preventDefault()
    e.stopPropagation()

    console.log("🖱️ Clara clicked, isConnected:", isConnected, "isMobile:", isMobile, "agentState:", agentState)

    // If not connected, do nothing (connect button should be visible)
    if (!isConnected) {
      return
    }

    if (isMobile) {
      console.log("📱 Opening mobile message modal")
      setShowMobileMessage(true)
      return
    }

    if (agentState === "speaking") {
      interruptAgent()
    } else if (agentState === "listening") {
      stopListening()
      setLastUserMessage("")
    } else if (agentState === "idle") {
      setLastUserMessage("")
      setCurrentTranscript("")
      setInterimTranscript("")
      startListening()
    }
  }

  const handleTryTextChat = (e) => {
    e.preventDefault()
    e.stopPropagation()
    console.log("💬 Opening text chat modal")
    setShowMobileMessage(false)
    setShowTextInput(true)
  }

  const handleCloseMobileMessage = (e) => {
    e.preventDefault()
    e.stopPropagation()
    console.log("❌ Closing mobile message modal")
    setShowMobileMessage(false)
  }

  const handleCloseTextInput = (e) => {
    e.preventDefault()
    e.stopPropagation()
    console.log("❌ Closing text input modal")
    setShowTextInput(false)
    setTextInput("")
  }

  // Update getTooltipText function
  const getTooltipText = () => {
    if (!isConnected) {
      return "Click to connect first"
    }

    if (isMobile) {
      return "Tap for text chat"
    }

    if (agentState === "speaking") {
      return "Tap to interrupt"
    } else if (agentState === "listening") {
      return "Listening... Tap to stop"
    } else if (agentState === "thinking") {
      return "Processing..."
    } else {
      return "Tap to speak"
    }
  }

  // Truncate long messages for display
  const truncateMessage = (message, maxLength = 100) => {
    if (message.length <= maxLength) return message
    return message.substring(0, maxLength) + "..."
  }

  // WebSocket connection with session awareness
  useEffect(() => {
    // Only connect if shouldConnect is true
    if (!shouldConnect) return

    const connectWebSocket = () => {
      try {
        console.log(`🔌 Connecting WebSocket (${isMobile ? "Mobile" : "Desktop"})...`)
        ws.current = new WebSocket(WSS_URL)

        ws.current.onopen = () => {
          console.log(`✅ WebSocket connected (${isMobile ? "Mobile" : "Desktop"})`)
          setError("")
          setIsConnected(true)

          // Register session immediately if we have one
          if (sessionId) {
            console.log(`📋 WebSocket opened, registering existing session: ${sessionId}`)
            registerSessionWithWebSocket(sessionId)
          }
        }

        ws.current.onmessage = (event) => {
          console.log(
            `📨 WebSocket message received for session ${sessionId} (${isMobile ? "Mobile" : "Desktop"}), data length:`,
            event.data?.length || 0,
          )
          collectAudioChunk(event.data)
        }

        ws.current.onclose = (event) => {
          console.log(`🔌 WebSocket closed (${isMobile ? "Mobile" : "Desktop"}), code:`, event.code)
          stopAllAudio()
          setIsConnected(false)
          if (event.code !== 1000 && shouldConnect) {
            console.log("🔄 Attempting to reconnect WebSocket...")
            setTimeout(connectWebSocket, 2000)
          }
        }

        ws.current.onerror = (error) => {
          console.error(`❌ WebSocket error (${isMobile ? "Mobile" : "Desktop"}):`, error)
          setError("Connection error - please refresh the page")
          setIsConnected(false)
        }
      } catch (error) {
        console.error("Failed to connect WebSocket:", error)
        setError("Failed to connect - please refresh the page")
        setIsConnected(false)
      }
    }

    connectWebSocket()
    return () => {
      if (ws.current) {
        ws.current.close(1000)
      }
      stopAllAudio()

      // Clear response timeout on cleanup
      if (window.responseTimeoutRef) {
        clearTimeout(window.responseTimeoutRef)
        window.responseTimeoutRef = null
      }

      if (silenceTimeoutRef.current) {
        clearTimeout(silenceTimeoutRef.current)
      }
      if (vadCheckIntervalRef.current) {
        clearInterval(vadCheckIntervalRef.current)
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
      if (transcriptTimeoutRef.current) {
        clearTimeout(transcriptTimeoutRef.current)
      }
      if (micStreamRef.current) {
        micStreamRef.current.getTracks().forEach((track) => track.stop())
      }
      if (audioCtxRef.current && audioCtxRef.current.state !== "closed") {
        audioCtxRef.current.close()
      }
    }
  }, [collectAudioChunk, stopAllAudio, isMobile, registerSessionWithWebSocket, sessionId, shouldConnect]) // Add shouldConnect to dependencies

  // Initialize on mount
  useEffect(() => {
    if (isMobile) {
      // Initialize mobile audio
      initializeMobileAudio()
    } else {
      // Initialize desktop audio and VAD
      setTimeout(() => {
        initializeAudioContext()
        initializeVAD()
      }, 100)
    }

    return () => {
      stopAllAudio()
      if (vadCheckIntervalRef.current) {
        clearInterval(vadCheckIntervalRef.current)
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
      if (transcriptTimeoutRef.current) {
        clearTimeout(transcriptTimeoutRef.current)
      }
      if (micStreamRef.current) {
        micStreamRef.current.getTracks().forEach((track) => track.stop())
      }
      if (audioCtxRef.current && audioCtxRef.current.state !== "closed") {
        audioCtxRef.current.close()
      }
    }
  }, [initializeAudioContext, initializeVAD, initializeMobileAudio, stopAllAudio, isMobile])

  // Debug effect to log state changes
  useEffect(() => {
    console.log("🔄 State changed:", {
      isMobile,
      showMobileMessage,
      showTextInput,
      agentState,
      sessionId,
    })
  }, [isMobile, showMobileMessage, showTextInput, agentState, sessionId])

  // Add Connect Button - place this right before the main Clara component return
  if (!isConnected) {
    return (
      <div className="fixed bottom-12 right-6 z-50">
        {/* Error Display */}
        {error && (
          <div className="absolute -top-20 left-1/2 transform -translate-x-1/2 bg-red-600 text-white px-4 py-2 rounded-lg text-sm shadow-lg whitespace-nowrap animate-in fade-in duration-200 max-w-xs">
            {error}
          </div>
        )}

        {/* Connect Button */}
        <div className="relative">
          <button
            onClick={handleConnect}
            disabled={isConnecting}
            className={`w-24 h-24 sm:w-32 sm:h-32 md:w-36 md:h-36 rounded-full cursor-pointer transition-all duration-300 transform hover:scale-105 active:scale-95 touch-manipulation flex flex-col items-center justify-center text-white font-medium shadow-2xl ${
              isConnecting
                ? "bg-gradient-to-br from-yellow-500 to-orange-600 animate-pulse"
                : "bg-gradient-to-br from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
            }`}
          >
            {isConnecting ? (
              <>
                <div className="w-8 h-8 border-3 border-white border-t-transparent rounded-full animate-spin mb-2"></div>
                <span className="text-xs">Connecting...</span>
              </>
            ) : (
              <>
                <svg className="w-8 h-8 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                <span className="text-xs">Connect</span>
              </>
            )}
          </button>

          {/* Connection Hint */}
          <div className="absolute -top-16 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white px-3 py-2 rounded-lg text-sm shadow-lg whitespace-nowrap animate-in fade-in duration-200">
            {isConnecting
              ? "Establishing connection..."
              : `Click to connect with Clara ${isMobile ? "(Text Chat)" : "(Voice Chat)"}`}
            <div className="absolute top-full left-1/2 transform -translate-x-1/2">
              <div className="w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Desktop Interface
  return (
    <div className="fixed bottom-12 right-6 z-50">
      {/* User Transcript Display (Desktop Only) */}
      {!isMobile && ((showTranscript && (currentTranscript || interimTranscript)) || lastUserMessage) ? (
        <div className="fixed top-6 right-6 z-50">
          <div className="bg-blue-600 text-white px-4 py-3 rounded-xl shadow-2xl animate-in slide-in-from-top-2 duration-200 max-w-[320px] text-sm">
            <div className="break-words">
              {lastUserMessage ? (
                <div className="font-medium text-blue-100">
                  <span className="text-blue-200">You said:</span> "{truncateMessage(lastUserMessage, 120)}"
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
      ) : null}

      {/* Error Display (Desktop Only) */}
      {!isMobile && error && (
        <div className="fixed top-6 left-6 right-6 z-50">
          <div className="bg-red-600 text-white px-4 py-3 rounded-xl shadow-2xl animate-in slide-in-from-top-2 duration-200 max-w-sm mx-auto">
            <div className="flex items-center">
              <div className="w-4 h-4 bg-red-300 rounded-full mr-2 flex-shrink-0"></div>
              <div className="text-sm">{error}</div>
            </div>
          </div>
        </div>
      )}

      {/* Hover Tooltip */}
      {isHovered && !showTranscript && !lastUserMessage && !error && (
        <div className="absolute -top-16 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white px-3 py-2 rounded-lg text-sm shadow-lg whitespace-nowrap animate-in fade-in duration-200">
          {getTooltipText()}
          <div className="absolute top-full left-1/2 transform -translate-x-1/2">
            <div className="w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
          </div>
        </div>
      )}

      {/* Main Clara Image Component */}
      <div className="relative">
        {/* Outer Glow Effects */}
        <div
          className={`absolute inset-0 rounded-full transition-all duration-500 ${
            agentState === "listening"
              ? "shadow-[0_0_40px_rgba(59,130,246,0.6)] animate-pulse"
              : agentState === "speaking"
                ? "shadow-[0_0_40px_rgba(34,197,94,0.6)] animate-pulse"
                : agentState === "thinking"
                  ? "shadow-[0_0_40px_rgba(251,191,36,0.6)] animate-pulse"
                  : isHovered
                    ? "shadow-[0_0_30px_rgba(147,51,234,0.4)]"
                    : "shadow-[0_0_20px_rgba(0,0,0,0.2)]"
          }`}
          style={{
            transform: `scale(${1 + (agentState === "speaking" ? mouthMovement * 0.1 : 0)})`,
          }}
        />

        {/* Animated Rings */}
        <div
          className={`absolute inset-0 rounded-full border-4 transition-all duration-300 ${
            agentState === "listening"
              ? "border-blue-400 border-opacity-60 animate-ping"
              : agentState === "speaking"
                ? "border-green-400 border-opacity-60 animate-pulse"
                : agentState === "thinking"
                  ? "border-yellow-400 border-opacity-60 animate-spin"
                  : "border-transparent"
          }`}
          style={{
            transform: `scale(${1.1 + (isUserSpeaking ? audioLevel * 0.2 : 0)})`,
          }}
        />

        {/* Clara's Image - Main Component */}
        <div
          className={`relative w-24 h-24 sm:w-32 sm:h-32 md:w-36 md:h-36 rounded-full overflow-hidden cursor-pointer transition-all duration-300 transform ${
            isHovered ? "scale-105" : "scale-100"
          } ${agentState === "speaking" ? "animate-pulse" : ""} ${isMobile ? "opacity-90" : ""} touch-manipulation`}
          onClick={handleClaraClick}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          onTouchStart={() => setIsHovered(true)}
          onTouchEnd={() => setIsHovered(false)}
          style={{
            transform: `scale(${1 + mouthMovement * 0.05}) ${isHovered ? "scale(1.05)" : ""}`,
            filter: `brightness(${1 + mouthMovement * 0.2}) contrast(${1 + mouthMovement * 0.1})`,
          }}
        >
          <img
            src="https://res.cloudinary.com/dbjgffukp/image/upload/v1750799324/Leonardo_Anime_XL_Anime_style_portrait_of_Clara_a_futuristic_A_3_b46p8r.jpg"
            alt="Clara AI"
            className="w-full h-full object-cover"
            onError={(e) => {
              e.target.style.display = "none"
              e.target.nextSibling.style.display = "flex"
            }}
          />
          {/* Fallback Avatar */}
          <div
            className="w-full h-full bg-gradient-to-br from-purple-500 to-blue-600 flex items-center justify-center text-white text-2xl font-bold"
            style={{ display: "none" }}
          >
            C
          </div>

          {/* Mobile Overlay Indicator */}
          {isMobile && (
            <div className="absolute inset-0 bg-gradient-to-t from-purple-500/30 to-transparent rounded-full flex items-center justify-center">
              <div className="bg-white/90 rounded-full p-2">
                <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                  />
                </svg>
              </div>
            </div>
          )}

          {/* Voice Activity Overlay (Desktop Only) */}
          {!isMobile && agentState === "speaking" && (
            <div className="absolute inset-0 bg-gradient-to-t from-green-500/20 to-transparent rounded-full" />
          )}

          {/* Listening Overlay (Desktop Only) */}
          {!isMobile && agentState === "listening" && (
            <div className="absolute inset-0 bg-gradient-to-t from-blue-500/20 to-transparent rounded-full animate-pulse" />
          )}

          {/* Thinking Overlay */}
          {agentState === "thinking" && (
            <div className="absolute inset-0 bg-gradient-to-t from-yellow-500/20 to-transparent rounded-full" />
          )}
        </div>

        {/* Status Indicator */}
        <div
          className={`absolute -top-2 -right-2 w-6 h-6 rounded-full border-2 border-white transition-all duration-300 ${
            isMobile
              ? agentState === "speaking"
                ? "bg-green-500 animate-pulse"
                : agentState === "thinking"
                  ? "bg-yellow-500 animate-spin"
                  : "bg-purple-500"
              : agentState === "listening"
                ? "bg-blue-500 animate-pulse"
                : agentState === "speaking"
                  ? "bg-green-500"
                  : agentState === "thinking"
                    ? "bg-yellow-500 animate-spin"
                    : error
                      ? "bg-red-500"
                      : "bg-gray-400"
          }`}
        >
          {isMobile ? (
            <div className="w-full h-full flex items-center justify-center">
              {agentState === "speaking" ? (
                <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
              ) : agentState === "thinking" ? (
                <div className="w-2 h-2 border border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                  />
                </svg>
              )}
            </div>
          ) : (
            <>
              {agentState === "listening" && (
                <div className="w-full h-full flex items-center justify-center">
                  <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                </div>
              )}
              {agentState === "thinking" && (
                <div className="w-full h-full flex items-center justify-center">
                  <div className="w-2 h-2 border border-white border-t-transparent rounded-full animate-spin" />
                </div>
              )}
              {agentState === "speaking" && (
                <div className="w-full h-full flex items-center justify-center space-x-px">
                  {[...Array(3)].map((_, i) => (
                    <div
                      key={i}
                      className="w-px bg-white rounded-full animate-pulse"
                      style={{
                        height: `${4 + mouthMovement * 6 + Math.sin(Date.now() * 0.01 + i) * 2}px`,
                        animationDelay: `${i * 100}ms`,
                      }}
                    />
                  ))}
                </div>
              )}
              {error && (
                <div className="w-full h-full flex items-center justify-center">
                  <div className="w-2 h-2 bg-white rounded-full" />
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default ModernVoiceAgent
