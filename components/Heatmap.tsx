import React from 'react';
import { NumberStats } from '../types';

interface HeatmapProps {
  stats: NumberStats[];
  onNumberClick?: (num: number) => void;
}

const Heatmap: React.FC<HeatmapProps> = ({ stats, onNumberClick }) => {
  // Find max frequency to normalize colors
  const maxFreq = Math.max(...stats.map(s => s.frequency), 1);

  // Sort by number (1-90) for the grid view
  const sortedStats = [...stats].sort((a, b) => a.number - b.number);

  const getHeatColor = (freq: number) => {
    const intensity = freq / maxFreq;
    // Gradient from Slate-100 (Cold) to Blue-900 (Hot)
    const lightness = 95 - (intensity * 55); 
    return `hsl(221, 83%, ${lightness}%)`;
  };

  const getTextColor = (freq: number) => {
    // White text for dark backgrounds (high frequency)
    return (freq / maxFreq) > 0.5 ? '#fff' : '#1e293b';
  };

  return (
    <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-semibold text-slate-700 text-sm">Carte Thermique (Fréquence)</h3>
        <div className="flex items-center gap-2 text-[10px]">
            <span className="flex items-center gap-1"><span className="w-3 h-3 bg-slate-100 border border-slate-200 rounded-sm"></span> Froid</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 bg-blue-900 rounded-sm"></span> Chaud</span>
        </div>
      </div>
      
      <div className="grid grid-cols-9 sm:grid-cols-10 gap-1.5 sm:gap-2">
        {sortedStats.map((s) => (
          <div 
            key={s.number}
            onClick={() => onNumberClick && onNumberClick(s.number)}
            className={`aspect-square rounded-md flex flex-col items-center justify-center text-xs font-bold shadow-sm transition-transform border border-black/5 ${onNumberClick ? 'cursor-pointer hover:scale-110 hover:z-10' : ''}`}
            style={{ 
              backgroundColor: getHeatColor(s.frequency),
              color: getTextColor(s.frequency)
            }}
            title={`Numéro ${s.number}: ${s.frequency} sorties - Cliquez pour analyser`}
          >
            <span>{s.number}</span>
            {s.frequency > 0 && (
                <span className="text-[8px] font-normal opacity-80">{s.frequency}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default Heatmap;