export const AUDIO_CONFIG = {
  expectedSampleRate: 24000,
  vadSampleRate: 22050,
  vadFftSize: 512,
  vadSmoothingTimeConstant: 0.3,
  analyserFftSize: 256,
  analyserSmoothingTimeConstant: 0.8,
  gainValue: 0.9,
  silenceTimeout: 2000,
  vadThreshold: 25,
  compressionThreshold: 0.8,
  fadeLength: 64,
}

export const UI_CONFIG = {
  maxLogEntries: 50,
  messageMaxLength: 100,
  transcriptMaxLength: 120,
  userMessageDisplayTime: 2000,
  reconnectDelay: 3000,
}

export const SPEECH_CONFIG = {
  language: "en-US",
  continuous: true,
  interimResults: true,
  maxAlternatives: 1,
}
