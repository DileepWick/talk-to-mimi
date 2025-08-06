"use client"

const MobileInputModal = ({ showMobileInput, mobileTextInput, setMobileTextInput, setShowMobileInput, onSubmit }) => {
  if (!showMobileInput) return null

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!mobileTextInput.trim()) return
    onSubmit(mobileTextInput.trim())
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="p-6">
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-blue-600" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
                <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6.92h-2z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Voice Input</h3>
            <p className="text-gray-600 text-sm">
              Speech recognition isn't available on your device. Please type your message instead.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <textarea
                value={mobileTextInput}
                onChange={(e) => setMobileTextInput(e.target.value)}
                placeholder="Type your message here..."
                className="w-full p-4 border border-gray-200 rounded-xl resize-none h-32 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                autoFocus
              />
            </div>

            <div className="flex space-x-3">
              <button
                type="button"
                onClick={() => setShowMobileInput(false)}
                className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-colors font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!mobileTextInput.trim()}
                className="flex-1 px-4 py-3 bg-black text-white rounded-xl hover:bg-gray-800 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors font-medium"
              >
                Send Message
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

export default MobileInputModal
