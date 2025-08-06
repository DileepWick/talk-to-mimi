import { ai } from "../config/gemini.js";
import { v4 as uuidv4 } from "uuid";
import { MIMI_PROMPT } from "../config/modelSystemPrompts.js";

const sessions = new Map();

// Static system prompt - can be moved to environment variables
const SYSTEM_PROMPT = MIMI_PROMPT;


// Create a new session
export const createSession = async () => {

  const sessionId = uuidv4();
  const responseQueue = [];

  //models/gemini-2.5-flash-preview-native-audio-dialog
  //models/gemini-2.5-flash-live-preview
  //models/gemini-2.0-flash-live-001
  const geminiSession = await ai.live.connect({
    model: "models/gemini-2.5-flash-preview-native-audio-dialog",
    config: {
      responseModalities: ["AUDIO"],
      mediaResolution: "MEDIA_RESOLUTION_MEDIUM",
      speechConfig: {
        languageCode: "en-US",
        voiceConfig: {
          prebuiltVoiceConfig: {
            voiceName: "Leda",
          },
        },
      },
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
    },
    callbacks: {
      onopen: () => console.log(`Gemini Connection Opened Successfully ✅`),
      onmessage: (msg) => responseQueue.push(msg),
      onerror: (e) => console.error(`Gemini Connection Error ❌`, e.message),
      onclose: () =>
        console.log(
          `Gemini Connection Closed ❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌❌`
        ),
    },
  });

  sessions.set(sessionId, { geminiSession, responseQueue });

  return { sessionId, session: sessions.get(sessionId) };
};

// Get session by ID
export const getSession = (sessionId) => sessions.get(sessionId);

// Delete session by ID
export const deleteSession = async (sessionId) => {
  const session = sessions.get(sessionId);
  if (session) {
    try {
      await session.geminiSession.close();
    } catch {}
    sessions.delete(sessionId);
  }
};

//Check
export const hasSession = (sessionId) => sessions.has(sessionId);
