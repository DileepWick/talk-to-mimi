import { truncateMessage } from "../utils/audio-utils.js"

const TranscriptDisplay = ({ showTranscript, currentTranscript, interimTranscript, lastUserMessage }) => {
  if (!((showTranscript && (currentTranscript || interimTranscript)) || lastUserMessage)) {
    return null
  }

  return (
    <div className="fixed top-8 left-1/2 transform -translate-x-1/2 z-40 max-w-2xl w-full px-4">
      <div className="bg-white/95 backdrop-blur-sm border border-gray-200 rounded-2xl shadow-xl p-6">
        <div className="text-center">
          {lastUserMessage ? (
            <div className="space-y-2">
              <div className="text-sm text-gray-500 font-medium">You said:</div>
              <div className="text-lg text-gray-900 font-medium">"{truncateMessage(lastUserMessage, 150)}"</div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-center space-x-2">
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                <span className="text-sm text-gray-600 font-medium">Listening...</span>
              </div>

              {currentTranscript && (
                <div className="text-lg text-gray-900 font-medium">{truncateMessage(currentTranscript, 120)}</div>
              )}

              {interimTranscript && (
                <div className="text-gray-500 italic">
                  {truncateMessage(interimTranscript, 100)}
                  <span className="animate-pulse ml-1">|</span>
                </div>
              )}

              <div className="text-xs text-gray-400">Speak naturally - I'll respond after you finish</div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default TranscriptDisplay
