export const detectMobile = () => {
  const userAgent = navigator.userAgent.toLowerCase()
  const isMobileUA = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent)
  const isTouchDevice = "ontouchstart" in window || navigator.maxTouchPoints > 0
  const isSmallScreen = window.innerWidth <= 768

  const isMobileDevice = isMobileUA || (isTouchDevice && isSmallScreen)

  console.log("📱 Mobile Detection:", {
    userAgent: isMobileUA,
    touchDevice: isTouchDevice,
    smallScreen: isSmallScreen,
    finalResult: isMobileDevice,
  })

  return isMobileDevice
}

export const checkSpeechRecognitionSupport = () => {
  return "webkitSpeechRecognition" in window || "SpeechRecognition" in window
}
