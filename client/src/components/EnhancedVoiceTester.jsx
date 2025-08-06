"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { WSS_URL, BASE_URL } from "../config/constant";
import useAudioCollector from "../utils/audioChunkCollection.js";
import  mimi from "../assets/mimi2.jpg"
import axios from "axios";

// Import modular components and hooks
import {
  detectMobile,
  checkSpeechRecognitionSupport,
} from "../utils/mobile-detection.js";
import { handleSendMessageUtil } from "../utils/handleMessage.js";
import {
  initializeAudioContext,
  processAudioChunk,
} from "../utils/audio-utils.js";
import { useVoiceActivityDetection } from "../hooks/useVoiceActivityDetection.js";
import { useSpeechRecognition } from "../hooks/useSpeechRecognition.js";
import { useAudioPlayback } from "../hooks/useAudioPlayback.js";
import TranscriptDisplay from "./TranscriptDisplay.jsx";
import StatusIndicators from "./StatusIndicators.jsx";
import MobileInputModal from "./MobileInputModal.jsx";
import { UI_CONFIG } from "../config/voice-chat.js";
import VoiceAgentWidget from "./VoiceAgentInterface.jsx";

const EnhancedVoiceTester = ({onDataReceived}) => {
  const [clientId, setClientId] = useState(null);
  const [sessionId, setSessionId] = useState(null);
  const [message, setMessage] = useState("");
  const [log, setLog] = useState([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState("Connecting...");

  // Voice-to-text state
  const [isListening, setIsListening] = useState(false);
  const [currentTranscript, setCurrentTranscript] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [lastUserMessage, setLastUserMessage] = useState("");
  const [showTranscript, setShowTranscript] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [showMobileInput, setShowMobileInput] = useState(false);
  const [mobileTextInput, setMobileTextInput] = useState("");
  const [hasUserGesture, setHasUserGesture] = useState(false);
  const [error, setError] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  // Voice Activity Detection
  const [isUserSpeaking, setIsUserSpeaking] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);

  // Refs
  const wsRef = useRef(null);
  const audioContextRef = useRef(null);
  const gainNodeRef = useRef(null);
  const analyserRef = useRef(null);
  const rawChunksRef = useRef([]);
  const processedChunksRef = useRef(new Set());
  const chunkTimeoutRef = useRef(null);

  // Log messages function
  const logMessage = useCallback((msg) => {
    const timestamp = new Date().toLocaleTimeString();
    setLog((prev) => [
      ...prev.slice(-UI_CONFIG.maxLogEntries),
      `[${timestamp}] ${msg}`,
    ]);
  }, []);

  // Custom hooks
  const { initializeVAD, cleanup: cleanupVAD } = useVoiceActivityDetection(
    setIsUserSpeaking,
    setAudioLevel
  );
  const { audioQueueRef, playAudioQueue, stopAllAudio, isPlayingRef } =
    useAudioPlayback(audioContextRef, gainNodeRef, setIsPlaying, logMessage);

  // Send voice query to the API
  const sendVoiceQuery = useCallback(
    async (transcript) => {
      try {
        setIsProcessing(true);
        logMessage(`📤 Sending voice query: "${transcript}"`);

        stopAllAudio();

        if (!clientId) {
          throw new Error(
            "Client ID not available. Please wait for WebSocket connection."
          );
        }

        const response = await axios.post(`${BASE_URL}/api/voice-query`, {
          message: transcript,
          clientId: clientId,
          sessionId,
        });

        if (!response.data) {
          throw new Error("No response data received from the API");
        }

        const {
          sessionId: newSid,
          text,
          isNewSession,
          processingTime,
        } = response.data;

        if (newSid && newSid !== sessionId) {
          setSessionId(newSid);
          logMessage(`🆔 Session ID updated: ${newSid}`);
        }

        logMessage(`📥 Voice response: "${text}"`);
        logMessage(`⏱️ Processing time: ${processingTime}ms`);
        logMessage(`🎯 Audio will be sent to clientId: ${clientId}`);

        if (isNewSession) {
          logMessage("🆕 New session created");
        }

        logMessage("🎵 Waiting for audio response...");
      } catch (err) {
        console.error("Voice Query API Error:", err);
        const errorMsg =
          err.response?.data?.error || err.message || "Unknown error";
        logMessage(`❌ Voice Query Error: ${errorMsg}`);
        setError(`Voice query failed: ${errorMsg}`);
      } finally {
        setIsProcessing(false);
      }
    },
    [clientId, sessionId, logMessage, stopAllAudio]
  );

  const { startListening, stopListening } = useSpeechRecognition(
    setIsListening,
    setError,
    setShowTranscript,
    setCurrentTranscript,
    setInterimTranscript,
    setLastUserMessage,
    setIsProcessing,
    logMessage,
    sendVoiceQuery
  );

  // Enhanced mobile detection
  useEffect(() => {
    const checkMobile = () => {
      const isMobileDevice = detectMobile();
      setIsMobile(isMobileDevice);

      if (!isMobileDevice && !checkSpeechRecognitionSupport()) {
        setError("Speech recognition not supported on this browser");
      }
    };

    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Initialize Audio Context
  const initializeAudioContextWrapper = useCallback(async () => {
    if (!audioContextRef.current) {
      const { audioContext, gainNode, analyser } =
        await initializeAudioContext();
      audioContextRef.current = audioContext;
      gainNodeRef.current = gainNode;
      analyserRef.current = analyser;
      console.log("🎵 Ultra-smooth AudioContext initialized");
    }
  }, []);

  // Start listening wrapper
  const startListeningWrapper = useCallback(async () => {
    if (!clientId) {
      setError("WebSocket not connected. Please wait for connection.");
      return;
    }

    if (isMobile) {
      setShowMobileInput(true);
      return;
    }

    if (isPlaying) {
      stopAllAudio();
    }

    setHasUserGesture(true);
    setCurrentTranscript("");
    setInterimTranscript("");
    setLastUserMessage("");
    setShowTranscript(false);
    setError("");
    setIsProcessing(false);

    try {
      await initializeAudioContextWrapper();
      await initializeVAD(isMobile);
      await startListening(clientId, currentTranscript, isProcessing);
    } catch (error) {
      console.error("Failed to start listening:", error);
      setError("Failed to start voice input");
    }
  }, [
    clientId,
    isMobile,
    isPlaying,
    currentTranscript,
    isProcessing,
    stopAllAudio,
    initializeAudioContextWrapper,
    initializeVAD,
    startListening,
  ]);

  // Handle mobile text input
  const handleMobileSubmit = useCallback(
    async (message) => {
      setMobileTextInput("");
      setShowMobileInput(false);
      setLastUserMessage(message);

      setTimeout(() => {
        setLastUserMessage("");
      }, 3000);

      logMessage(`📱 Mobile voice input: "${message}"`);
      await sendVoiceQuery(message);
    },
    [logMessage, sendVoiceQuery]
  );

  // Handle manual text input
  const handleSendMessage = useCallback(async () => {
    if (!message.trim()) {
      alert("Please enter a message");
      return;
    }

    if (!clientId) {
      alert("WebSocket not connected or clientId not received");
      return;
    }

    await sendVoiceQuery(message.trim());
    console.log("Message sent via handleSendMessage in EnhancedVoiceTester :", message);
    setMessage("");
  }, [message, clientId, sendVoiceQuery]);

  // Handle audio blob
  const handleAudioBlob = useCallback(async (blob) => {
    try {
      const arrayBuffer = await blob.arrayBuffer();
      const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
      await collectAudioChunk(base64);
    } catch (error) {
      console.error("Error handling audio blob:", error);
      logMessage(`❌ Audio blob error: ${error.message}`);
    }
  }, []);

  // Process audio chunk wrapper
  const processAudioChunkWrapper = useCallback(async (base64Data) => {
    return await processAudioChunk(
      base64Data,
      audioContextRef.current,
      processedChunksRef.current
    );
  }, []);

  // Audio collector
  const { collectAudioChunk } = useAudioCollector({
    processAudioChunk: processAudioChunkWrapper,
    logMessage,
    playAudioQueue,
    audioQueueRef,
    isPlayingRef,
  });

  // WebSocket connection - UNCHANGED AS REQUESTED
  useEffect(() => {
    const connectWebSocket = () => {
      const ws = new WebSocket(WSS_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log("Voice Chat Connected to WebSocket ✅");
        setConnectionStatus("Connected");
        logMessage("Voice Chat connection established ✅");
      };

      ws.onmessage = async (event) => {
        try {
          const data = JSON.parse(event.data);

          if (data.type === "init") {
            setClientId(data.clientId);
            logMessage(
              `✅ Voice Chat initialized with clientId: ${data.clientId}`
            );
            await initializeAudioContextWrapper();
          } else if (data.type === "pong") {
            logMessage("🏓 Pong received");
          } else {
            logMessage(`📩 Control message: ${JSON.stringify(data)}`);
          }
        } catch (err) {
          if (event.data instanceof Blob) {
            handleAudioBlob(event.data);
          } else if (typeof event.data === "string") {
            collectAudioChunk(event.data);
          } else {
            logMessage(
              `Unknown data type Received from the backend: ${typeof event.data}`
            );
          }
        }
      };

      ws.onerror = (err) => {
        console.error("❌ WebSocket Error", err);
        setConnectionStatus("Error");
        logMessage("❌ WebSocket connection error");
      };

      ws.onclose = () => {
        console.warn("Voice Chat Disconnected from WebSocket");
        setConnectionStatus("Disconnected");
        logMessage("Voice Chat Disconnected from WebSocket");

        setTimeout(() => {
          if (wsRef.current?.readyState === WebSocket.CLOSED) {
            logMessage("🔄 Attempting to reconnect...");
            setConnectionStatus("Reconnecting...");
            connectWebSocket();
          }
        }, UI_CONFIG.reconnectDelay);
      };
    };

    connectWebSocket();

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
      stopAllAudio();
      stopListening();
      cleanupVAD();

      if (chunkTimeoutRef.current) {
        clearTimeout(chunkTimeoutRef.current);
        chunkTimeoutRef.current = null;
      }
      if (
        audioContextRef.current &&
        audioContextRef.current.state !== "closed"
      ) {
        audioContextRef.current.close();
      }
    };
  }, [
    initializeAudioContextWrapper,
    handleAudioBlob,
    collectAudioChunk,
    logMessage,
    stopAllAudio,
    stopListening,
    cleanupVAD,
  ]);

  // Handle key press
  const handleKeyPress = (e) => {
    if (e.key === "Enter") {
      handleSendMessage();
    }
  };

  // Send ping
  const sendPing = () => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "ping" }));
      logMessage("🏓 Ping sent");
    } else {
      logMessage("❌ WebSocket not connected");
    }
  };

  // Clear log
  const clearLog = () => {
    setLog([]);
  };

  return (
    <>
      <TranscriptDisplay
        showTranscript={showTranscript}
        currentTranscript={currentTranscript}
        interimTranscript={interimTranscript}
        lastUserMessage={lastUserMessage}
      />

      <StatusIndicators isProcessing={isProcessing} error={error} />

      <MobileInputModal
        showMobileInput={showMobileInput}
        mobileTextInput={mobileTextInput}
        setMobileTextInput={setMobileTextInput}
        setShowMobileInput={setShowMobileInput}
        onSubmit={handleMobileSubmit}
      />

      <VoiceAgentWidget
        agentName="Mimi"
        agentImage={mimi}
        position="bottom-right"
        theme="light"
        onDataReceived={onDataReceived}
      />
    </>
  );
};

export default EnhancedVoiceTester;
