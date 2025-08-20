"use client";
import { useState } from "react";
import mimi from "../assets/mimi2.jpg";
import TranscriptDisplay from "./TranscriptDisplay.jsx";
import StatusIndicators from "./StatusIndicators.jsx";
import MobileInputModal from "./MobileInputModal.jsx";
import VoiceAgentWidget from "./VoiceAgentInterface.jsx";

const MimiInterface = ({ onDataReceived }) => {
  // Voice-to-text state
  const [currentTranscript, setCurrentTranscript] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [lastUserMessage, setLastUserMessage] = useState("");
  const [showTranscript, setShowTranscript] = useState(false);
  const [showMobileInput, setShowMobileInput] = useState(false);
  const [mobileTextInput, setMobileTextInput] = useState("");
  const [error, setError] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

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

export default MimiInterface;
