import React, { useState, useEffect, useCallback } from 'react';
import { Level, Topic, VocabularyItem, Exercise, ExerciseType, UserState, FeedbackData, LeaderboardEntry } from './types';
import { generateVocabularySet, generateHint } from './services/geminiService';
import { Flashcard } from './components/Flashcard';
import { ExerciseRenderer } from './components/ExerciseRenderer';
import { WordRushGame } from './components/WordRushGame';
import { Leaderboard } from './components/Leaderboard';
import confetti from 'canvas-confetti';

// Utilities to create exercises from the vocab list
const createExercises = (vocab: VocabularyItem[]): Exercise[] => {
  const exercises: Exercise[] = [];

  vocab.forEach((item) => {
    // 1. Flashcard (Always first)
    exercises.push({
      id: `fc-${item.id}`,
      type: ExerciseType.Flashcard,
      targetWordId: item.id,
      question: item.word
    });

    // 2. Guess Meaning (EN Word -> VN Definition)
    const distractors = vocab.filter(v => v.id !== item.id).map(v => v.vietnameseDefinition).slice(0, 3);
    const optionsVN = [item.vietnameseDefinition, ...distractors].sort(() => Math.random() - 0.5);
    
    exercises.push({
      id: `gm-${item.id}`,
      type: ExerciseType.GuessMeaning,
      targetWordId: item.id,
      question: item.word, // Question in English
      options: optionsVN, // Answers in Vietnamese
      correctOptionIndex: optionsVN.indexOf(item.vietnameseDefinition)
    });

    // 3. Guess Word (VN Definition -> EN Word) - "And Vice Versa"
    const wordDistractors = vocab.filter(v => v.id !== item.id).map(v => v.word).slice(0, 3);
    const optionsEN = [item.word, ...wordDistractors].sort(() => Math.random() - 0.5);

    exercises.push({
      id: `gw-${item.id}`,
      type: ExerciseType.GuessWord,
      targetWordId: item.id,
      question: item.vietnameseDefinition, // Question in Vietnamese
      options: optionsEN, // Answers in English
      correctOptionIndex: optionsEN.indexOf(item.word)
    });

    // 4. Fill Blank (Contextual - Keep as English sentence, but hint is implicit)
    exercises.push({
      id: `fb-${item.id}`,
      type: ExerciseType.FillBlank,
      targetWordId: item.id,
      question: item.exampleSentenceBlank
    });

    // 5. Listening (Audio -> VN Definition)
    exercises.push({
      id: `ls-${item.id}`,
      type: ExerciseType.Listening,
      targetWordId: item.id,
      question: item.word, // Plays audio of English word
      options: optionsVN, // Select Vietnamese Meaning
      correctOptionIndex: optionsVN.indexOf(item.vietnameseDefinition)
    });
  });

  // 6. Matching (One grouped exercise for all 5 words) - EN Word <-> VN Definition
  exercises.push({
      id: `match-all`,
      type: ExerciseType.Matching,
      targetWordId: 'all',
      question: 'Ghép từ với nghĩa',
      matchingPairs: vocab.map(v => ({ wordId: v.id, definition: v.vietnameseDefinition }))
  });

  return exercises;
};

const App: React.FC = () => {
  // Initialize state from localStorage or defaults
  const [userState, setUserState] = useState<UserState>(() => {
    const saved = localStorage.getItem('vocab_user_prefs');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        
        // Validate that the saved level/topic actually exists in our current Enums
        // This prevents the UI from showing empty if the saved data is stale or invalid
        const isValidLevel = Object.values(Level).includes(parsed.currentLevel);
        const isValidTopic = Object.values(Topic).includes(parsed.currentTopic);

        return {
          xp: parsed.xp ?? 0,
          streak: parsed.streak ?? 1,
          currentLevel: isValidLevel ? parsed.currentLevel : Level.Beginner,
          currentTopic: isValidTopic ? parsed.currentTopic : Topic.DailyLife
        };
      } catch (e) {
        console.error("Failed to parse saved preferences", e);
      }
    }
    return {
      xp: 0,
      streak: 1,
      currentLevel: Level.Beginner,
      currentTopic: Topic.DailyLife
    };
  });

  // Persist user preferences to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('vocab_user_prefs', JSON.stringify(userState));
  }, [userState]);

  // State Management
  const [appMode, setAppMode] = useState<'LEARN' | 'GAME' | 'DASHBOARD'>('DASHBOARD');
  
  // Learning Mode State
  const [isLoading, setIsLoading] = useState(false);
  const [vocabList, setVocabList] = useState<VocabularyItem[]>([]);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [currentExerciseIndex, setCurrentExerciseIndex] = useState(0); 
  const [feedback, setFeedback] = useState<FeedbackData | null>(null);
  const [isProcessingAI, setIsProcessingAI] = useState(false);

  // Leaderboard State
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [leaderboardData, setLeaderboardData] = useState<LeaderboardEntry[]>([]);

  useEffect(() => {
    // Load leaderboard from local storage on mount
    const saved = localStorage.getItem('vocab_leaderboard');
    if (saved) {
      setLeaderboardData(JSON.parse(saved));
    }
  }, []);

  const saveScore = (score: number, name: string) => {
    const newEntry: LeaderboardEntry = {
      name: name,
      score,
      level: userState.currentLevel,
      date: new Date().toISOString()
    };
    const updated = [...leaderboardData, newEntry];
    setLeaderboardData(updated);
    localStorage.setItem('vocab_leaderboard', JSON.stringify(updated));
  };

  const startSession = async () => {
    setIsLoading(true);
    setAppMode('LEARN');
    try {
      const vocab = await generateVocabularySet(userState.currentLevel, userState.currentTopic);
      setVocabList(vocab);
      const generatedExercises = createExercises(vocab);
      setExercises(generatedExercises);
      setCurrentExerciseIndex(0);
    } catch (error) {
      console.error("Failed to generate content", error);
      alert("Failed to connect to AI. Please check your API Key.");
      setAppMode('DASHBOARD');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGameExit = (finalScore: number, playerName: string) => {
    if (finalScore > 0) {
      saveScore(finalScore, playerName);
      // Give some XP for playing
      setUserState(prev => ({...prev, xp: prev.xp + Math.floor(finalScore / 10)}));
    }
    setAppMode('DASHBOARD');
    setShowLeaderboard(true); // Show leaderboard after game
  };

  const handleAnswer = async (answer: string) => {
    const currentEx = exercises[currentExerciseIndex];
    const targetVocab = vocabList.find(v => v.id === currentEx.targetWordId);

    let isCorrect = false;

    // Logic to validate answer
    if (currentEx.type === ExerciseType.Flashcard) {
      nextExercise();
      return;
    } 
    
    if (currentEx.type === ExerciseType.Matching) {
        if (answer === "COMPLETE") isCorrect = true;
    } else if (currentEx.type === ExerciseType.FillBlank) {
       if (targetVocab && answer.toLowerCase().trim() === targetVocab.word.toLowerCase().trim()) {
         isCorrect = true;
       }
    } else if (currentEx.type === ExerciseType.Listening) {
        // Listening: Answer is the Vietnamese Definition
        if (targetVocab && answer === targetVocab.vietnameseDefinition) isCorrect = true;
    } else if (currentEx.type === ExerciseType.GuessMeaning) {
       // Guess Meaning: Question EN, Answer VN
       if (targetVocab && answer === targetVocab.vietnameseDefinition) isCorrect = true;
    } else if (currentEx.type === ExerciseType.GuessWord) {
       // Guess Word: Question VN, Answer EN
       if (targetVocab && answer === targetVocab.word) isCorrect = true;
    }

    if (isCorrect) {
      setUserState(prev => ({ ...prev, xp: prev.xp + 10 }));
      // Celebration effect for correct answer
      confetti({
        particleCount: 50,
        spread: 60,
        origin: { y: 0.7 }
      });
      
      setFeedback({
        isCorrect: true,
        message: "Chính xác!",
        hint: targetVocab ? `"${targetVocab.word}": ${targetVocab.vietnameseDefinition}\nExample: ${targetVocab.exampleSentence}` : "Giỏi lắm!"
      });
    } else {
      setIsProcessingAI(true);
      let aiHint = "";
      if (targetVocab) {
         try {
            aiHint = await generateHint(targetVocab, answer, currentEx.type);
         } catch (e) {
            aiHint = "Hãy kiểm tra lại định nghĩa.";
         }
      }
      setIsProcessingAI(false);
      
      setFeedback({
        isCorrect: false,
        message: "Chưa đúng.",
        hint: aiHint
      });
    }
  };

  const nextExercise = () => {
    setFeedback(null);
    if (currentExerciseIndex < exercises.length - 1) {
      setCurrentExerciseIndex(prev => prev + 1);
    } else {
      setCurrentExerciseIndex(-1); // End of Learn Session
      // Big celebration for finishing lesson
      confetti({
        particleCount: 150,
        spread: 100,
        origin: { y: 0.6 }
      });
    }
  };

  const retryExercise = () => {
      setFeedback(null);
  };

  // --- RENDERERS ---

  if (appMode === 'GAME') {
    return <WordRushGame level={userState.currentLevel} onExit={handleGameExit} />;
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 text-indigo-600">
        <div className="w-16 h-16 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mb-4"></div>
        <p className="font-semibold animate-pulse">Đang tạo bài học...</p>
      </div>
    );
  }

  // Dashboard
  if (appMode === 'DASHBOARD') {
    return (
      <div className="min-h-screen bg-gray-50 p-6 flex flex-col items-center">
        {showLeaderboard && <Leaderboard entries={leaderboardData} onClose={() => setShowLeaderboard(false)} />}
        
        <header className="w-full max-w-md flex justify-between items-center mb-8">
           <div className="flex items-center gap-2">
             <div className="w-10 h-10 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold text-xl">V</div>
             <h1 className="text-xl font-bold text-gray-900">VocabMaster AI</h1>
           </div>
           <div className="flex gap-4 text-sm font-semibold">
             <span className="flex items-center text-yellow-600">⚡ {userState.streak}</span>
             <span className="flex items-center text-indigo-600">★ {userState.xp}</span>
           </div>
        </header>

        <div className="w-full max-w-md space-y-6">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <label className="block text-sm font-medium text-gray-700 mb-3">Trình độ (Level)</label>
            <div className="flex flex-col gap-2">
              {Object.values(Level).map((level) => (
                <button
                  key={level}
                  onClick={() => setUserState({...userState, currentLevel: level})}
                  className={`w-full p-4 rounded-xl text-left border-2 transition-all flex items-center justify-between group ${
                    userState.currentLevel === level 
                      ? 'border-indigo-600 bg-indigo-50 shadow-sm' 
                      : 'border-gray-100 hover:border-indigo-200 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex flex-col">
                    <span className={`font-bold text-base ${userState.currentLevel === level ? 'text-indigo-900' : 'text-gray-700'}`}>
                       {level.split('(')[0].trim()}
                    </span>
                    <span className={`text-xs ${userState.currentLevel === level ? 'text-indigo-600' : 'text-gray-400'}`}>
                       {level.includes('(') ? `(${level.split('(')[1].replace(')', '')})` : ''}
                    </span>
                  </div>
                  <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${userState.currentLevel === level ? 'border-indigo-600 bg-indigo-600' : 'border-gray-300'}`}>
                      {userState.currentLevel === level && <div className="w-2 h-2 bg-white rounded-full"></div>}
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <label className="block text-sm font-medium text-gray-700 mb-3">Chủ đề (Topic)</label>
             <div className="grid grid-cols-2 gap-3">
               {Object.values(Topic).map(t => (
                 <button 
                    key={t}
                    onClick={() => setUserState({...userState, currentTopic: t})}
                    className={`p-4 rounded-xl text-sm font-bold border-2 transition-all ${userState.currentTopic === t ? 'border-indigo-600 bg-indigo-50 text-indigo-700' : 'border-gray-100 text-gray-500 hover:border-gray-300'}`}
                 >
                   {t}
                 </button>
               ))}
             </div>
          </div>

          <div className="grid grid-cols-1 gap-4">
             <button 
              onClick={startSession}
              className="w-full bg-indigo-600 text-white py-4 rounded-xl font-bold shadow-lg hover:bg-indigo-700 transition-transform active:scale-95 flex items-center justify-center gap-2"
            >
              <span>📚</span> Học Từ Mới
            </button>
            
            <div className="grid grid-cols-2 gap-4">
               <button 
                onClick={() => setAppMode('GAME')}
                className="w-full bg-purple-600 text-white py-4 rounded-xl font-bold shadow-lg hover:bg-purple-700 transition-transform active:scale-95 flex items-center justify-center gap-2"
              >
                <span>🎮</span> Word Rush
              </button>
               <button 
                onClick={() => setShowLeaderboard(true)}
                className="w-full bg-white text-gray-700 border-2 border-gray-200 py-4 rounded-xl font-bold shadow-sm hover:bg-gray-50 transition-transform active:scale-95 flex items-center justify-center gap-2"
              >
                <span>🏆</span> Xếp Hạng
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Summary Screen for Learn Mode
  if (currentExerciseIndex === -1) {
      return (
          <div className="min-h-screen bg-indigo-600 text-white flex flex-col items-center justify-center p-6 text-center">
              <h1 className="text-4xl font-bold mb-4">Hoàn thành bài học!</h1>
              <div className="text-6xl mb-6">🎉</div>
              <p className="text-indigo-200 mb-8 text-lg">Bạn đã học 5 từ mới và nhận điểm kinh nghiệm.</p>
              
              <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 w-full max-w-xs mb-8">
                  <div className="text-3xl font-bold mb-1">+{exercises.length * 10} XP</div>
                  <div className="text-sm text-indigo-200">Tổng điểm</div>
              </div>

              <button 
                onClick={() => setAppMode('DASHBOARD')}
                className="w-full max-w-xs bg-white text-indigo-600 py-4 rounded-xl font-bold shadow-lg hover:bg-gray-100"
              >
                Về Trang Chủ
              </button>
          </div>
      )
  }

  // Learn Mode - Game Loop
  const currentEx = exercises[currentExerciseIndex];

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
       {/* Progress Bar */}
       <div className="h-2 bg-gray-200 w-full">
         <div 
            className="h-full bg-indigo-500 transition-all duration-500" 
            style={{ width: `${((currentExerciseIndex + 1) / exercises.length) * 100}%`}}
         ></div>
       </div>

       <div className="flex-1 flex flex-col relative">
          {currentEx.type === ExerciseType.Flashcard ? (
            <Flashcard 
                item={vocabList.find(v => v.id === currentEx.targetWordId)!} 
                onNext={nextExercise} 
            />
          ) : (
            <ExerciseRenderer 
                exercise={currentEx} 
                vocabList={vocabList}
                onAnswer={handleAnswer}
                isSubmitting={!!feedback || isProcessingAI}
            />
          )}

          {/* Feedback Modal / Bottom Sheet */}
          {(feedback || isProcessingAI) && (
            <div className="fixed bottom-0 left-0 w-full bg-white shadow-[0_-10px_40px_rgba(0,0,0,0.1)] rounded-t-3xl border-t border-gray-100 p-6 z-50 animate-slide-up">
              {isProcessingAI ? (
                  <div className="flex items-center justify-center py-4 space-x-2 text-indigo-600">
                      <div className="w-2 h-2 bg-indigo-600 rounded-full animate-bounce"></div>
                      <div className="w-2 h-2 bg-indigo-600 rounded-full animate-bounce delay-75"></div>
                      <div className="w-2 h-2 bg-indigo-600 rounded-full animate-bounce delay-150"></div>
                      <span className="font-medium ml-2">AI đang kiểm tra...</span>
                  </div>
              ) : (
                  <>
                    <div className="flex items-start gap-4 mb-4">
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 ${feedback?.isCorrect ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                            {feedback?.isCorrect ? (
                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                            ) : (
                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                            )}
                        </div>
                        <div>
                            <h3 className={`text-lg font-bold ${feedback?.isCorrect ? 'text-green-700' : 'text-red-700'}`}>
                                {feedback?.message}
                            </h3>
                            <p className="text-gray-600 mt-1 text-sm leading-relaxed whitespace-pre-line">{feedback?.hint}</p>
                        </div>
                    </div>
                    
                    <button 
                        onClick={feedback?.isCorrect ? nextExercise : retryExercise}
                        className={`w-full py-4 rounded-xl font-bold text-white shadow-md transition-colors ${feedback?.isCorrect ? 'bg-green-600 hover:bg-green-700' : 'bg-red-500 hover:bg-red-600'}`}
                    >
                        {feedback?.isCorrect ? 'Tiếp tục' : 'Thử lại'}
                    </button>
                  </>
              )}
            </div>
          )}
       </div>
    </div>
  );
};

export default App;