
import { GoogleGenAI, Type } from "@google/genai";
import { Level, Topic, VocabularyItem, ExerciseType } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// --- Audio Utilities ---
const decodeAudioData = async (
  base64String: string,
  audioContext: AudioContext
): Promise<AudioBuffer> => {
  const binaryString = atob(base64String);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return await audioContext.decodeAudioData(bytes.buffer);
};

export const playPronunciation = async (text: string) => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: {
        parts: [{ text: text }],
      },
      config: {
        responseModalities: ["AUDIO"],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: "Kore" },
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) throw new Error("No audio data returned");

    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const audioBuffer = await decodeAudioData(base64Audio, audioContext);
    
    const source = audioContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(audioContext.destination);
    source.start();
    
  } catch (error) {
    console.error("TTS Error:", error);
    // Fallback to browser TTS if Gemini fails or quota exceeded
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    window.speechSynthesis.speak(utterance);
  }
};

// --- Content Generation ---

export const generateVocabularySet = async (level: Level, topic: Topic): Promise<VocabularyItem[]> => {
  const prompt = `Generate 5 English vocabulary words suitable for ${level} level focused on ${topic}. 
  Provide the output in JSON format.
  IMPORTANT: Provide a clear 'vietnameseDefinition' (Meaning in Vietnamese) for each word.
  Include 'pronunciation' in IPA format (e.g. /həˈləʊ/).
  Ensure 'exampleSentenceBlank' replaces the target word with '_______'.
  Include a short, visual 'imageKeyword' (3-5 words) describing the concept physically.`;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            word: { type: Type.STRING },
            pronunciation: { type: Type.STRING, description: "IPA pronunciation enclosed in slashes" },
            definition: { type: Type.STRING },
            vietnameseDefinition: { type: Type.STRING, description: "Meaning of the word in Vietnamese" },
            partOfSpeech: { type: Type.STRING },
            exampleSentence: { type: Type.STRING },
            exampleSentenceBlank: { type: Type.STRING },
            synonyms: { type: Type.ARRAY, items: { type: Type.STRING } },
            imageKeyword: { type: Type.STRING, description: "A simple visual description for an image generator" }
          },
          required: ["word", "pronunciation", "definition", "vietnameseDefinition", "partOfSpeech", "exampleSentence", "exampleSentenceBlank", "synonyms", "imageKeyword"]
        }
      }
    }
  });

  const rawData = JSON.parse(response.text || "[]");
  return rawData.map((item: any, index: number) => ({
    ...item,
    id: `vocab-${Date.now()}-${index}`
  }));
};

export const generateGameWords = async (level: Level): Promise<VocabularyItem[]> => {
  const prompt = `Generate 15 distinct English vocabulary words for a fast-paced game. Level: ${level}.
  Include 'vietnameseDefinition' (Meaning in Vietnamese).
  Include 'pronunciation' (IPA format).
  Keep definitions short and punchy.
  Include 'imageKeyword'.
  Output JSON.`;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            word: { type: Type.STRING },
            pronunciation: { type: Type.STRING },
            definition: { type: Type.STRING },
            vietnameseDefinition: { type: Type.STRING },
            partOfSpeech: { type: Type.STRING },
            exampleSentence: { type: Type.STRING },
            exampleSentenceBlank: { type: Type.STRING },
            synonyms: { type: Type.ARRAY, items: { type: Type.STRING } },
            imageKeyword: { type: Type.STRING }
          },
          required: ["word", "pronunciation", "definition", "vietnameseDefinition", "partOfSpeech", "exampleSentence", "exampleSentenceBlank", "synonyms", "imageKeyword"]
        }
      }
    }
  });

  const rawData = JSON.parse(response.text || "[]");
  return rawData.map((item: any, index: number) => ({
    ...item,
    id: `game-vocab-${Date.now()}-${index}`
  }));
}

export const generateHint = async (word: VocabularyItem, userAnswer: string, questionType: ExerciseType): Promise<string> => {
  const prompt = `
    Context: English learning app for Vietnamese speakers.
    Target Word: "${word.word}" (VN: ${word.vietnameseDefinition}).
    User's Wrong Answer: "${userAnswer}".
    Question Type: ${questionType}.
    
    Provide a helpful hint in Vietnamese to guide the user to the correct answer. 
    Keep it under 20 words.
  `;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: prompt,
  });

  return response.text || "Hãy thử nghĩ về ngữ cảnh của từ.";
};
