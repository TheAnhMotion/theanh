import React from 'react';
import { LeaderboardEntry } from '../types';

interface LeaderboardProps {
  entries: LeaderboardEntry[];
  onClose: () => void;
}

export const Leaderboard: React.FC<LeaderboardProps> = ({ entries, onClose }) => {
  // Sort by score descending
  const sortedEntries = [...entries].sort((a, b) => b.score - a.score).slice(0, 10);

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl transform transition-all scale-100">
        <div className="bg-gradient-to-r from-purple-600 to-indigo-600 p-6 text-white text-center relative">
          <h2 className="text-2xl font-bold">🏆 Hall of Fame</h2>
          <p className="text-purple-100 text-sm">Top players in Word Rush</p>
          <button 
            onClick={onClose}
            className="absolute top-4 right-4 bg-white/20 hover:bg-white/30 rounded-full p-2 transition-colors"
          >
            ✕
          </button>
        </div>
        
        <div className="p-4 max-h-[60vh] overflow-y-auto">
          {sortedEntries.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p>No records yet.</p>
              <p className="text-sm">Be the first to claim the top spot!</p>
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="text-xs font-semibold text-gray-400 border-b border-gray-100">
                  <th className="text-left py-2 pl-2">Rank</th>
                  <th className="text-left py-2">Player</th>
                  <th className="text-right py-2 pr-2">Score</th>
                </tr>
              </thead>
              <tbody>
                {sortedEntries.map((entry, idx) => (
                  <tr key={idx} className={`border-b border-gray-50 last:border-0 ${idx < 3 ? 'bg-yellow-50/50' : ''}`}>
                    <td className="py-3 pl-2 font-bold text-gray-500">
                      {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`}
                    </td>
                    <td className="py-3 text-gray-800 font-medium">
                      <div>{entry.name}</div>
                      <div className="text-xs text-gray-400 font-normal">{entry.level} • {new Date(entry.date).toLocaleDateString()}</div>
                    </td>
                    <td className="py-3 pr-2 text-right font-bold text-indigo-600">
                      {entry.score.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        
        <div className="p-4 bg-gray-50 text-center">
           <button onClick={onClose} className="text-sm font-semibold text-gray-500 hover:text-gray-800">Close</button>
        </div>
      </div>
    </div>
  );
};
