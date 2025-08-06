const StatusIndicators = ({ isProcessing, error }) => {
  return (
    <>
      {/* Processing Indicator */}
      {isProcessing && (
        <div className="fixed top-8 right-8 z-40">
          <div className="bg-white/95 backdrop-blur-sm border border-gray-200 rounded-xl shadow-lg px-4 py-3">
            <div className="flex items-center space-x-3">
              <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
              <div className="text-sm font-medium text-gray-700">Processing your request...</div>
            </div>
          </div>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="fixed top-8 left-1/2 transform -translate-x-1/2 z-50 max-w-md w-full px-4">
          <div className="bg-red-50 border border-red-200 rounded-xl shadow-lg p-4">
            <div className="flex items-start space-x-3">
              <div className="w-5 h-5 bg-red-500 rounded-full flex-shrink-0 mt-0.5">
                <svg className="w-3 h-3 text-white m-1" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <div>
                <div className="text-sm font-medium text-red-800">Something went wrong</div>
                <div className="text-sm text-red-600 mt-1">{error}</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default StatusIndicators
