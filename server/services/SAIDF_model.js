// simpleGeminiTextCall.js
import { GoogleGenerativeAI } from "@google/generative-ai";
import {SAIDF_MODEL_SYSTEM_PROMPT} from "../config/modelSystemPrompts.js";
import dotenv from "dotenv";

dotenv.config();

const apiKey = process.env.GEMINI_API_KEY; // Replace with your actual API key
const genAI = new GoogleGenerativeAI(apiKey);
const model = genAI.getGenerativeModel({
  model: "gemini-2.5-flash-lite",
});

export const simpleGeminiTextCall = async ({
  userInput,
  systemPrompt = SAIDF_MODEL_SYSTEM_PROMPT,
}) => {
  // Input validation
  if (!userInput || typeof userInput !== "string") {
    throw new Error("Valid user input is required");
  }

  try {
    // Make the API call
    const result = await model.generateContent({
      contents: [{ parts: [{ text: userInput }] }],
      generationConfig: {
        responseMimeType: "text/plain",
      },
      systemInstruction: { parts: [{ text: systemPrompt }] },
    });

    // Process text response
    const text = result.response.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      throw new Error("No text response received");
    }

    return text;
  } catch (error) {
    console.error("[simpleGeminiTextCall] Error:", error.message);
    throw new Error(`Failed to generate response: ${error.message}`);
  } finally {
  }
};
