const textToSpeech = require('@google-cloud/text-to-speech');

// Language name (as stored on Content.language) -> BCP-47 code for Cloud Text-to-Speech.
const LANGUAGE_CODES = {
  spanish: 'es-ES', french: 'fr-FR', german: 'de-DE', italian: 'it-IT', portuguese: 'pt-BR',
  japanese: 'ja-JP', korean: 'ko-KR', chinese: 'cmn-CN', mandarin: 'cmn-CN', russian: 'ru-RU',
  arabic: 'ar-XA', hindi: 'hi-IN', dutch: 'nl-NL', turkish: 'tr-TR', vietnamese: 'vi-VN', english: 'en-US',
};

function languageCode(language) {
  return LANGUAGE_CODES[String(language || '').trim().toLowerCase()] || null;
}

let client = null;
async function synthesize(text, language) {
  const languageCodeValue = languageCode(language);
  if (!languageCodeValue) return null;
  client = client || new textToSpeech.TextToSpeechClient();
  const [res] = await client.synthesizeSpeech({
    input: { text },
    voice: { languageCode: languageCodeValue },
    audioConfig: { audioEncoding: 'MP3' },
  });
  return Buffer.from(res.audioContent);
}

module.exports = { synthesize, languageCode };
