import JSON5 from 'json5';

/**
 * Extracts a JSON object from a text string using JSON5 (tolerant parser).
 * @param {string} aiText - The raw response text from the AI.
 * @returns {object|null} Parsed JSON object or null if invalid.
 */
export function extractIntentJson(aiText) {
  try {
    if (!aiText || typeof aiText !== 'string') return null;

    // Remove Markdown formatting, e.g., triple backticks
    const cleanedText = aiText
      .replace(/```(?:json)?/gi, '') // Remove code block wrappers
      .replace(/^[\s]*`+/gm, '')     // Remove leading backticks
      .trim();

    // Attempt to match the first JSON-like object
    const match = cleanedText.match(/{[\s\S]*?}/);

    if (!match) {
      console.warn('⚠️ No JSON block found in the AI text.');
      return null;
    }

    const rawJson = match[0];

    // Try parsing with JSON5 (tolerant to syntax issues)
    const parsed = JSON5.parse(rawJson);
    return parsed;

  } catch (err) {
    console.error('❌ Failed to extract JSON:', err.message);
    console.debug('🔍 Raw input that caused error:', aiText);
    return null;
  }
}
