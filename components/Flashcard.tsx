
import React, { useState } from 'react';
import { VocabularyItem } from '../types';
import { playPronunciation } from '../services/geminiService';

interface FlashcardProps {
  item: VocabularyItem;
  onNext: () => void;
}

export const Flashcard: React.FC<FlashcardProps> = ({ item, onNext }) => {
  const [isFlipped, setIsFlipped] = useState(false);

  const handleAudio = (e: React.MouseEvent) => {
    e.stopPropagation();
    playPronunciation(item.word);
  };

  // Generate a consistent seed based on the word ID to avoid image flickering
  const imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(item.imageKeyword || item.word)}?width=400&height=300&nologo=true`;

  return (
    <div className="flex flex-col items-center justify-center h-full w-full max-w-md mx-auto p-4">
      <div 
        className="relative w-full h-96 cursor-pointer perspective-1000 group"
        onClick={() => setIsFlipped(!isFlipped)}
      >
        <div className={`relative w-full h-full duration-500 transform-style-3d transition-transform ${isFlipped ? 'rotate-y-180' : ''}`}>
          
          {/* Front */}
          <div className="absolute w-full h-full bg-white rounded-2xl shadow-xl flex flex-col items-center backface-hidden border-2 border-indigo-50 overflow-hidden">
             
             {/* Image Section */}
             <div className="w-full h-48 bg-gray-100 relative">
               <img 
                 src={imageUrl} 
                 alt={item.word} 
                 className="w-full h-full object-cover"
                 loading="lazy"
               />
               <div className="absolute inset-0 bg-gradient-to-t from-white to-transparent opacity-80"></div>
               <span className="absolute top-4 left-4 text-xs font-semibold bg-white/90 px-2 py-1 rounded text-indigo-600 uppercase tracking-widest">New Word</span>
             </div>

             <div className="flex-1 flex flex-col items-center justify-center p-4">
                <h2 className="text-4xl font-bold text-gray-800 mb-1">{item.word}</h2>
                <span className="text-gray-500 font-mono text-lg mb-2">/{item.pronunciation}/</span>
                <span className="text-gray-400 italic text-sm">{item.partOfSpeech}</span>
                
                <button 
                    onClick={handleAudio}
                    className="mt-3 p-3 rounded-full bg-indigo-100 text-indigo-600 hover:bg-indigo-200 transition-colors"
                >
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>
                </button>
                <p className="mt-auto text-xs text-gray-400 pb-2">Chạm để lật</p>
             </div>
          </div>

          {/* Back */}
          <div className="absolute w-full h-full bg-indigo-600 rounded-2xl shadow-xl flex flex-col items-center justify-center backface-hidden rotate-y-180 text-white p-6 text-center">
            <h3 className="text-xl font-bold mb-4">Nghĩa</h3>
            <p className="text-2xl font-bold mb-6 leading-relaxed text-yellow-300">{item.vietnameseDefinition}</p>
            
            <div className="w-full h-px bg-indigo-400 mb-4"></div>
            
            <h3 className="text-sm font-semibold text-indigo-200 mb-2">Ví dụ</h3>
            <p className="italic text-indigo-100">"{item.exampleSentence}"</p>
          </div>

        </div>
      </div>

      <button 
        onClick={onNext}
        className="mt-8 w-full bg-gray-900 text-white py-4 rounded-xl font-semibold shadow-lg hover:bg-gray-800 transition-all active:scale-95"
      >
        Đã ghi nhớ
      </button>
    </div>
  );
};
