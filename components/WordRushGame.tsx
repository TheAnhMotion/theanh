
import React, { useState, useEffect, useRef } from 'react';
import { Level, VocabularyItem } from '../types';
import { generateGameWords } from '../services/geminiService';
import confetti from 'canvas-confetti';

interface WordRushGameProps {
  level: Level;
  onExit: (score: number, name: string) => void;
}

export const WordRushGame: React.FC<WordRushGameProps> = ({ level, onExit }) => {
  const [gameState, setGameState] = useState<'LOADING' | 'PLAYING' | 'GAME_OVER'>('LOADING');
  const [words, setWords] = useState<VocabularyItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [timeLeft, setTimeLeft] = useState(10); // Seconds per question
  const [maxTime, setMaxTime] = useState(10);
  const [options, setOptions] = useState<string[]>([]);
  const [playerName, setPlayerName] = useState('');
  
  // Scoring & Animation states
  const [streak, setStreak] = useState(0);
  const [feedback, setFeedback] = useState<'HIT' | 'MISS' | null>(null);

  const timerRef = useRef<number | null>(null);

  // Initial Load
  useEffect(() => {
    const loadWords = async () => {
      try {
        const data = await generateGameWords(level);
        setWords(data);
        setGameState('PLAYING');
        prepareRound(0, data);
      } catch (e) {
        console.error("Game load error", e);
        // Fallback or exit
        onExit(0, 'Anonymous');
      }
    };
    loadWords();
    return () => stopTimer();
  }, []);

  // Timer Logic
  useEffect(() => {
    if (gameState === 'PLAYING') {
      timerRef.current = window.setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 0.1) {
            handleTimeRunOut();
            return 0;
          }
          return prev - 0.1;
        });
      }, 100);
    }
    return () => stopTimer();
  }, [gameState, currentIndex]); // Reset when index changes

  const stopTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
  };

  const handleTimeRunOut = () => {
    handleAnswer(null); // Treat as miss
  };

  const prepareRound = (index: number, wordList: VocabularyItem[]) => {
    if (index >= wordList.length) {
      // Victory / End of set (In a full app we would fetch more)
      setGameState('GAME_OVER');
      triggerConfetti();
      return;
    }

    const currentWord = wordList[index];
    // Create distractors (Using Vietnamese Definitions)
    const otherWords = wordList.filter(w => w.id !== currentWord.id);
    const shuffledOthers = otherWords.sort(() => 0.5 - Math.random()).slice(0, 3);
    
    // Mix correct definition with distractors
    const roundOptions = [currentWord.vietnameseDefinition, ...shuffledOthers.map(w => w.vietnameseDefinition)]
      .sort(() => 0.5 - Math.random());
    
    setOptions(roundOptions);
    
    // Difficulty scaling: Decrease max time every 3 words
    const newMaxTime = Math.max(3, 10 - Math.floor(index / 3)); 
    setMaxTime(newMaxTime);
    setTimeLeft(newMaxTime);
  };

  const triggerConfetti = () => {
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 }
    });
  };

  const handleAnswer = (selectedDefinition: string | null) => {
    const currentWord = words[currentIndex];
    // Compare with Vietnamese definition
    const isCorrect = selectedDefinition === currentWord.vietnameseDefinition;

    if (isCorrect) {
      // Score Calculation: Base 100 + (TimeLeft * 10) + (Streak * 5)
      const points = 100 + Math.ceil(timeLeft * 10) + (streak * 5);
      setScore(prev => prev + points);
      setStreak(prev => prev + 1);
      setFeedback('HIT');
      
      if (streak > 2) triggerConfetti(); // Mini confetti for streaks

      // Visual feedback delay then next
      setTimeout(() => {
        setFeedback(null);
        const nextIdx = currentIndex + 1;
        setCurrentIndex(nextIdx);
        prepareRound(nextIdx, words);
      }, 400);

    } else {
      setLives(prev => prev - 1);
      setStreak(0);
      setFeedback('MISS');

      if (lives <= 1) { // Will be 0 after update
        stopTimer();
        setTimeout(() => setGameState('GAME_OVER'), 1000);
      } else {
        setTimeout(() => {
           setFeedback(null);
           const nextIdx = currentIndex + 1;
           setCurrentIndex(nextIdx);
           prepareRound(nextIdx, words);
        }, 1000);
      }
    }
  };

  if (gameState === 'LOADING') {
    return (
      <div className="flex flex-col items-center justify-center h-full text-indigo-800">
        <div className="text-4xl animate-bounce mb-4">🚀</div>
        <div className="text-xl font-bold">Chuẩn bị dữ liệu...</div>
        <p className="text-sm opacity-60">Đang tải từ vựng</p>
      </div>
    );
  }

  if (gameState === 'GAME_OVER') {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6 text-center animate-fade-in">
        <h2 className="text-3xl font-black text-gray-800 mb-2">GAME OVER</h2>
        <div className="text-6xl mb-6">🏁</div>
        <div className="bg-white p-6 rounded-2xl shadow-xl border-b-4 border-gray-200 w-full max-w-sm mb-8">
           <p className="text-sm text-gray-500 uppercase tracking-widest font-semibold">Điểm số</p>
           <p className="text-5xl font-black text-indigo-600 mb-6">{score.toLocaleString()}</p>
           
           <div className="text-left">
             <label className="block text-sm font-medium text-gray-700 mb-1">Nhập tên của bạn:</label>
             <input 
                type="text" 
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                placeholder="Tên người chơi"
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                autoFocus
             />
           </div>
        </div>
        <button 
          onClick={() => onExit(score, playerName || 'Anonymous')}
          className="w-full max-w-sm bg-indigo-600 text-white py-4 rounded-xl font-bold shadow-lg hover:bg-indigo-700 hover:scale-105 transition-all"
        >
          Lưu & Thoát
        </button>
      </div>
    );
  }

  const currentWord = words[currentIndex];

  return (
    <div className={`h-full flex flex-col p-4 max-w-md mx-auto transition-colors duration-300 ${feedback === 'HIT' ? 'bg-green-50' : feedback === 'MISS' ? 'bg-red-50' : ''}`}>
      
      {/* HUD */}
      <div className="flex justify-between items-center mb-6 bg-white p-3 rounded-xl shadow-sm border border-gray-100">
         <div className="flex items-center gap-1">
            <span className="text-red-500 text-xl">❤️</span>
            <span className="font-bold text-gray-700">x{lives}</span>
         </div>
         <div className="font-mono text-xl font-bold text-indigo-600">
            {score.toString().padStart(6, '0')}
         </div>
         <div className="flex items-center gap-1">
            <span className="text-orange-500 text-sm">🔥</span>
            <span className="font-bold text-gray-700 text-sm">x{streak}</span>
         </div>
      </div>

      {/* Timer Bar */}
      <div className="w-full bg-gray-200 rounded-full h-3 mb-8 overflow-hidden">
        <div 
           className={`h-full transition-all duration-100 ease-linear ${timeLeft < 3 ? 'bg-red-500' : 'bg-blue-500'}`}
           style={{ width: `${(timeLeft / maxTime) * 100}%` }}
        />
      </div>

      {/* Question Area */}
      <div className="flex-1 flex flex-col justify-center">
         <div className="text-center mb-8 relative">
            <span className="text-xs uppercase font-bold text-gray-400 mb-2 block">Chọn nghĩa đúng</span>
            <h1 className="text-4xl font-black text-gray-800 animate-slide-up">{currentWord.word}</h1>
             <div className="flex flex-col items-center">
                 <span className="text-gray-400 font-mono text-lg mb-1">/{currentWord.pronunciation}/</span>
                 <p className="text-indigo-400 italic text-sm">{currentWord.partOfSpeech}</p>
             </div>
            
            {feedback === 'HIT' && <div className="absolute inset-0 flex items-center justify-center text-green-500 font-black text-5xl opacity-50 scale-150 animate-pop">✓</div>}
            {feedback === 'MISS' && <div className="absolute inset-0 flex items-center justify-center text-red-500 font-black text-5xl opacity-50 scale-150 animate-pop">✕</div>}
         </div>

         <div className="grid grid-cols-1 gap-3">
            {options.map((opt, idx) => (
              <button
                key={idx}
                onClick={() => handleAnswer(opt)}
                disabled={feedback !== null}
                className="p-4 rounded-xl border-2 border-gray-200 bg-white hover:border-indigo-400 hover:bg-indigo-50 text-gray-700 font-medium text-left transition-all active:scale-95 shadow-sm text-sm"
              >
                {opt}
              </button>
            ))}
         </div>
      </div>
      
    </div>
  );
};
