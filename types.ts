
export enum Level {
  Beginner = 'Beginner (A1-A2)',
  Intermediate = 'Intermediate (B1-B2)',
  Advanced = 'Advanced (C1-C2)',
}

export enum Topic {
  DailyLife = 'Daily Communication',
  Professional = 'Work & Professional',
}

export enum ExerciseType {
  Flashcard = 'FLASHCARD',
  GuessMeaning = 'GUESS_MEANING',
  GuessWord = 'GUESS_WORD',
  FillBlank = 'FILL_BLANK',
  Matching = 'MATCHING',
  Listening = 'LISTENING',
}

export interface VocabularyItem {
  id: string;
  word: string;
  pronunciation: string; // IPA format
  definition: string;
  vietnameseDefinition: string; // New field for Vietnamese meaning
  partOfSpeech: string;
  exampleSentence: string; // The full sentence
  exampleSentenceBlank: string; // The sentence with the word replaced by _____
  synonyms: string[];
  imageKeyword: string;
}

export interface Exercise {
  id: string;
  type: ExerciseType;
  targetWordId: string;
  question: string;
  options?: string[]; // For Multiple Choice
  correctOptionIndex?: number;
  matchingPairs?: { wordId: string; definition: string }[]; // For Matching
}

export interface UserState {
  xp: number;
  streak: number;
  currentLevel: Level;
  currentTopic: Topic;
}

export interface FeedbackData {
  isCorrect: boolean;
  message: string;
  hint?: string;
}

export interface LeaderboardEntry {
  name: string;
  score: number;
  level: string;
  date: string;
}
