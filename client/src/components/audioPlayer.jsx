import EnhancedAudioPlayer from "./enhanced-audio-player"

// Usage example
export default function AudioPlayerDemo() {
  // Replace with your actual WebSocket URL
  const WSS_URL = "ws://localhost:3001" // or your production URL

  return (
    <div className="min-h-screen bg-gray-100 py-8">
      <div className="container mx-auto px-4">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-2">Real-time Audio Streaming</h1>
          <p className="text-gray-600">Connect to your WebSocket server to receive and play audio chunks</p>
        </div>

        <EnhancedAudioPlayer websocketUrl={WSS_URL} />

        <div className="mt-12 text-center">
          <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6 max-w-2xl mx-auto">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">How it works</h2>
            <div className="text-sm text-gray-600 space-y-2 text-left">
              <p>• Automatically connects to your WebSocket server</p>
              <p>• Receives base64-encoded audio chunks in real-time</p>
              <p>• Queues and plays audio chunks seamlessly</p>
              <p>• Provides playback controls and volume management</p>
              <p>• Shows connection status and activity logs</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
