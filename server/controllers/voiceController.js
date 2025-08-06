import { createSession, getSession, deleteSession, hasSession } from "../services/sessionService.js"
import { simpleGeminiTextCall } from "../services/SAIDF_model.js"
import { extractIntentJson } from "../utils/filterJsonFromAI.js"
import composeVoiceSummary from "../utils/composeVoiceSummary.js"
import { handleAudioStreamProcessing } from "../utils/audio-processing-handler.js" // New import

// Enhanced voice query handler with session-specific audio broadcasting
export const enhancedVoiceQuery = async (req, res) => {
  const startTime = Date.now()

  const { sessionId, message, initialize, clientId } = req.body

  // Handle initialization request
  if (initialize && message === "initialize") {
    console.log("🆔 Handling initialization request")

    try {
      const newSession = await createSession()
      console.log(`🆔 Created initialization voice chat gemini session: ${newSession.sessionId}`)

      return res.json({
        sessionId: newSession.sessionId,
        message: "Voice Chat initialized successfully",
        processingTime: Date.now() - startTime,
        isNewSession: true,
      })
    } catch (error) {
      console.error("Failed to create initialization session:", error)
      return res.status(500).json({
        error: "Failed to initialize session",
        code: "INITIALIZATION_FAILED",
      })
    }
  }

  // Enhanced input validation for regular messages
  if (!message || typeof message !== "string" || message.trim().length === 0) {
    return res.status(400).json({
      error: "Valid message is required",
      code: "INVALID_MESSAGE",
    })
  }

  // Session management with error handling
  let sid = sessionId
  let session = sid ? getSession(sid) : null
  let isNewSession = false

  //If no sessionId is provided, create a new session
  if (!session) {
    try {
      const newSession = await createSession()
      sid = newSession.sessionId
      session = newSession.session
      isNewSession = true
    } catch (error) {
      console.error("Failed to create session:", error)
      return res.status(500).json({
        error: "Failed to create session",
        code: "SESSION_CREATION_FAILED",
      })
    }
  }

  try {
    // Clear any existing response queue and reset state
    session.responseQueue.length = 0

    // Enhanced history management
    if (!session.history) session.history = []

    // Store user message with role
    session.history.push({ role: "user", content: message })

    // Keep only recent history to prevent context overflow
    if (session.history.length > 10) {
      session.history = session.history.slice(-8)
    }

    // Build optimized context
    const recentHistory = session.history.slice(-5)
    const contextBlock = recentHistory.map((entry, i) => `${i + 1}.${entry.role === "user" ? "User Asked" : "Agent Replied"} : ${entry.content}`).join("\n")

    //SAIDF model call with timeout
    const saidfPromise = simpleGeminiTextCall({ userInput: contextBlock })

    // Add timeout
    const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error("SAIDF timeout")), 10000))

    // Wait for either response or timeout
    const SAIDF_MODEL_RESPONSE = await Promise.race([saidfPromise, timeoutPromise])

    // Extract and validate JSON response
    const result = extractIntentJson(SAIDF_MODEL_RESPONSE)
    if (!result) {
      throw new Error("Failed to extract valid response from SAIDF model")
    }

    // Generate voice summary
    const { summary } = await composeVoiceSummary(result, message)

    // Store agent's reply with role
    session.history.push({ role: "agent", content: summary })

    // Send immediate response with sessionId and a flag for new sessions
    res.json({
      sessionId: sid,
      filters: result,
      text: summary,
      processingTime: Date.now() - startTime,
      isNewSession: isNewSession, // Add this flag
    })

    // For new sessions, wait a bit longer to ensure WebSocket registration
    if (isNewSession) {
      console.log(`⏳ New voice chat session detected: ${sid}`)
      await new Promise((resolve) => setTimeout(resolve, 200)) // Reduced from 800ms to 200ms
    }

    // Start audio processing asynchronously
    handleAudioStreamProcessing(session, clientId, summary, sid).catch((error) => {
      console.error(`[Session ${sid}] Audio stream error:`, error)
    })

  } catch (error) {
    console.error(`[Session ${sid}] Processing error:`, error)

    // Enhanced error response
    const errorResponse = {
      error: "Processing failed",
      code: error.message.includes("timeout") ? "TIMEOUT" : "PROCESSING_ERROR",
      details: error.message,
      sessionId: sid,
    }

    if (!res.headersSent) {
      res.status(500).json(errorResponse)
    }
  } finally {
    console.log(`[Session ${sid}] Total processing time: ${Date.now() - startTime}ms`)
  }
}


//Enhanced session reset with cleanup
export const enhancedResetSession = async (req, res) => {
  const { sessionId } = req.body

  if (!sessionId || !hasSession(sessionId)) {
    return res.status(400).json({
      error: "Invalid or missing sessionId",
      code: "INVALID_SESSION",
    })
  }

  try {
    console.log(`[Session ${sessionId}] Resetting session`)
    await deleteSession(sessionId)

    res.json({
      message: "Session reset successfully",
      sessionId: null,
    })
  } catch (error) {
    console.error(`[Session ${sessionId}] Reset error:`, error)
    res.status(500).json({
      error: "Failed to reset session",
      code: "RESET_FAILED",
    })
  }
}

//Get session status and statistics
export const getSessionStatus = async (req, res) => {
  const { sessionId } = req.params

  if (!sessionId || !hasSession(sessionId)) {
    return res.status(404).json({
      error: "Session not found",
      code: "SESSION_NOT_FOUND",
    })
  }

  try {
    const session = getSession(sessionId)

    res.json({
      sessionId,
      status: "active",
      historyLength: session.history?.length || 0,
      queueLength: session.responseQueue?.length || 0,
      lastActivity: session.lastActivity || null,
    })
  } catch (error) {
    console.error(`[Session ${sessionId}] Status check error:`, error)
    res.status(500).json({
      error: "Failed to get session status",
      code: "STATUS_CHECK_FAILED",
    })
  }
}
