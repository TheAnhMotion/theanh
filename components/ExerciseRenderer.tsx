import React, { useState, useEffect } from 'react';
import { VocabularyItem, ExerciseType, Exercise } from '../types';
import { playPronunciation } from '../services/geminiService';

interface ExerciseRendererProps {
  exercise: Exercise;
  vocabList: VocabularyItem[]; // Needed for context in some games
  onAnswer: (answer: string) => void;
  isSubmitting: boolean;
}

export const ExerciseRenderer: React.FC<ExerciseRendererProps> = ({ exercise, vocabList, onAnswer, isSubmitting }) => {
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [fillBlankInput, setFillBlankInput] = useState('');
  const [matchingSelections, setMatchingSelections] = useState<{left: string|null, right: string|null}>({left: null, right: null});
  const [matchedPairs, setMatchedPairs] = useState<string[]>([]);

  // Reset local state when exercise changes
  useEffect(() => {
    setSelectedOption(null);
    setFillBlankInput('');
    setMatchingSelections({left: null, right: null});
    setMatchedPairs([]);
  }, [exercise]);

  const handleSubmit = () => {
    if (exercise.type === ExerciseType.FillBlank) {
      onAnswer(fillBlankInput);
    } else if (selectedOption) {
      onAnswer(selectedOption);
    }
  };

  const targetVocab = vocabList.find(v => v.id === exercise.targetWordId);
  const imageUrl = targetVocab ? `https://image.pollinations.ai/prompt/${encodeURIComponent(targetVocab.imageKeyword || targetVocab.word)}?width=300&height=200&nologo=true` : null;


  // --- GUESS MEANING & GUESS WORD & LISTENING ---
  if ([ExerciseType.GuessMeaning, ExerciseType.GuessWord, ExerciseType.Listening].includes(exercise.type)) {
    return (
      <div className="w-full max-w-md mx-auto p-4 flex flex-col h-full">
        <div className="flex-1 flex flex-col justify-center">
          <h2 className="text-lg font-medium text-gray-500 mb-2 text-center uppercase tracking-wider">
            {exercise.type === ExerciseType.Listening ? 'Listen & Select' : 'Choose the correct answer'}
          </h2>
          
          <div className="mb-6 text-center flex flex-col items-center">
            {exercise.type === ExerciseType.Listening ? (
              <button 
                onClick={() => playPronunciation(exercise.question)}
                className="w-24 h-24 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center mx-auto hover:bg-indigo-200 transition-colors shadow-sm"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>
              </button>
            ) : (
               <>
                 {/* Show image for guess meaning to help context */}
                 {imageUrl && exercise.type === ExerciseType.GuessMeaning && (
                    <img src={imageUrl} alt="Hint" className="w-32 h-24 object-cover rounded-xl mb-4 shadow-sm opacity-90" />
                 )}
                 <h1 className="text-2xl font-bold text-gray-900 leading-snug">{exercise.question}</h1>
               </>
            )}
          </div>

          <div className="space-y-3">
            {exercise.options?.map((option, idx) => (
              <button
                key={idx}
                disabled={isSubmitting}
                onClick={() => setSelectedOption(option)}
                className={`w-full p-4 text-left rounded-xl border-2 transition-all ${
                  selectedOption === option 
                    ? 'border-indigo-600 bg-indigo-50 text-indigo-900 font-semibold' 
                    : 'border-gray-200 hover:border-indigo-300 text-gray-700'
                }`}
              >
                {option}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={handleSubmit}
          disabled={!selectedOption || isSubmitting}
          className="mt-6 w-full bg-indigo-600 text-white py-4 rounded-xl font-bold shadow-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-indigo-700 transition-all"
        >
          Check Answer
        </button>
      </div>
    );
  }

  // --- FILL IN THE BLANK ---
  if (exercise.type === ExerciseType.FillBlank) {
    const parts = exercise.question.split('_______');
    return (
      <div className="w-full max-w-md mx-auto p-4 flex flex-col h-full">
         <div className="flex-1 flex flex-col justify-center items-center">
          <h2 className="text-lg font-medium text-gray-500 mb-6 text-center uppercase tracking-wider">Complete the Sentence</h2>
          
          {imageUrl && (
            <img src={imageUrl} alt="Context Hint" className="w-full max-h-40 object-cover rounded-2xl mb-6 shadow-md" />
          )}

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 text-xl text-gray-800 leading-loose w-full">
            {parts[0]}
            <input
              type="text"
              value={fillBlankInput}
              onChange={(e) => setFillBlankInput(e.target.value)}
              placeholder="..."
              className="inline-block w-32 border-b-2 border-indigo-300 mx-2 focus:outline-none focus:border-indigo-600 text-center text-indigo-600 font-bold bg-transparent"
            />
            {parts[1]}
          </div>
         </div>

         <button
          onClick={handleSubmit}
          disabled={!fillBlankInput.trim() || isSubmitting}
          className="mt-6 w-full bg-indigo-600 text-white py-4 rounded-xl font-bold shadow-lg disabled:opacity-50 hover:bg-indigo-700 transition-all"
        >
          Check Answer
        </button>
      </div>
    );
  }

  // --- MATCHING ---
  if (exercise.type === ExerciseType.Matching && exercise.matchingPairs) {
    
    const handleMatch = (id: string, side: 'left' | 'right') => {
      if (matchedPairs.includes(id)) return;

      const newSelection = { ...matchingSelections, [side]: id };
      setMatchingSelections(newSelection);

      // Check match if both sides selected
      if (newSelection.left && newSelection.right) {
         // In a real scenario we'd check against IDs. Simplified here for demo to just pass "Matched" to parent
         // We verify if the pair exists in the exercise.matchingPairs
         const pair = exercise.matchingPairs.find(p => p.wordId === newSelection.left && p.definition === newSelection.right);
         
         if (pair) {
           // Correct Match
           const newMatched = [...matchedPairs, newSelection.left!, newSelection.right!];
           setMatchedPairs(newMatched);
           setMatchingSelections({left: null, right: null});
           
           // If all matched
           if (newMatched.length === exercise.matchingPairs.length * 2) {
              onAnswer("COMPLETE");
           }
         } else {
           // Incorrect Match - Flash red or reset after delay
           setTimeout(() => {
             setMatchingSelections({left: null, right: null});
           }, 500);
         }
      }
    };

    // Shuffle for display
    const leftSide = exercise.matchingPairs.map(p => ({id: p.wordId, text: vocabList.find(v => v.id === p.wordId)?.word || "Error"}));
    const rightSide = exercise.matchingPairs.map(p => ({id: p.definition, text: p.definition})); // Using definition string as ID for right side simplicity

    return (
      <div className="w-full max-w-md mx-auto p-4 flex flex-col h-full">
         <h2 className="text-lg font-medium text-gray-500 mb-4 text-center uppercase tracking-wider">Match Word to Meaning</h2>
         
         <div className="flex gap-4 h-full overflow-y-auto">
            <div className="flex-1 space-y-3">
              {leftSide.map(item => (
                <button
                  key={item.id}
                  disabled={matchedPairs.includes(item.id)}
                  onClick={() => handleMatch(item.id, 'left')}
                  className={`w-full p-4 text-sm font-bold rounded-xl border-2 transition-all h-24 flex items-center justify-center ${
                    matchedPairs.includes(item.id) ? 'bg-green-100 border-green-400 opacity-50' :
                    matchingSelections.left === item.id ? 'bg-indigo-100 border-indigo-500' : 'bg-white border-gray-200'
                  }`}
                >
                  {item.text}
                </button>
              ))}
            </div>
            <div className="flex-1 space-y-3">
              {rightSide.map(item => (
                <button
                  key={item.id}
                  disabled={matchedPairs.includes(item.id)}
                  onClick={() => handleMatch(item.id, 'right')}
                  className={`w-full p-2 text-xs text-left rounded-xl border-2 transition-all h-24 flex items-center overflow-hidden ${
                    matchedPairs.includes(item.id) ? 'bg-green-100 border-green-400 opacity-50' :
                    matchingSelections.right === item.id ? 'bg-indigo-100 border-indigo-500' : 'bg-white border-gray-200'
                  }`}
                >
                  {item.text}
                </button>
              ))}
            </div>
         </div>
      </div>
    );
  }

  return <div>Unknown Exercise Type</div>;
};