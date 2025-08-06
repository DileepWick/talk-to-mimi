import { WebSocketServer } from "ws"
import { v4 as uuidv4 } from "uuid"

export const websocketClients = new Map() // clientId -> ws connection

// Broadcast function to send audio to specific client
export const broadcastToClient = (clientId, audioData) => {
  const client = websocketClients.get(clientId)
  if (!client) {
    console.warn(`⚠️ Client ${clientId} not found in websocketClients map`)
    return false
  }

  if (client.readyState !== 1) {
    // WebSocket.OPEN = 1
    console.warn(`⚠️ Client ${clientId} WebSocket not in OPEN state: ${client.readyState}`)
    websocketClients.delete(clientId)
    return false
  }

  try {
    client.send(audioData)
    return true
  } catch (error) {
    console.error(`❌ Failed to send audio to client ${clientId}:`, error)
    websocketClients.delete(clientId)
    return false
  }
}

// Broadcast to all clients (if needed)
export const broadcastToAllClients = (audioData) => {
  let successCount = 0
  websocketClients.forEach((client, clientId) => {
    if (broadcastToClient(clientId, audioData)) {
      successCount++
    }
  })
  console.log(`📡 Audio broadcast to ${successCount} clients`)
  return successCount
}

export const initWebSocketServer = (server) => {
  const wss = new WebSocketServer({ server })

  wss.on("connection", (ws) => {
    // Generate unique client ID
    const clientId = uuidv4()
    console.log(`🔌 New WebSocket connection established with clientId: ${clientId}`)

    // Store client connection
    websocketClients.set(clientId, ws)

    // Send client ID to the client immediately
    try {
      const initMessage = JSON.stringify({
        type: "init",
        clientId: clientId,
        message: "WebSocket connection established",
        timestamp: Date.now(),
      })

      ws.send(initMessage)
      console.log(`📤 Init message sent to client: ${clientId}`)
    } catch (error) {
      console.error(`❌ Failed to send init message to client ${clientId}:`, error)
    }

    // Handle incoming messages
    ws.on("message", (message) => {
      try {
        const data = JSON.parse(message)
        console.log(`📨 Message from client ${clientId}:`, data.type || "unknown")

        // Handle different message types if needed
        switch (data.type) {
          case "ping":
            ws.send(JSON.stringify({ type: "pong", clientId }))
            break
          case "session_info":
            // Client can send session info for logging purposes
            console.log(`📋 Client ${clientId} session info:`, data.sessionId)
            break
          default:
            console.log(`📨 Unhandled message type from client ${clientId}:`, data.type)
        }
      } catch (error) {
        // If not JSON, treat as regular message
        console.log(`📨 Non-JSON message from client ${clientId}`)
      }
    })

    // Handle connection close
    ws.on("close", () => {
      console.log(`🔌 WebSocket connection closed for client: ${clientId}`)
      websocketClients.delete(clientId)
    })

    // Handle connection errors
    ws.on("error", (error) => {
      console.error(`❌ WebSocket error for client ${clientId}:`, error)
      websocketClients.delete(clientId)
    })
  })
}
