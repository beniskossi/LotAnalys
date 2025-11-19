
import React from 'react';
import { getBallColorClass } from '../constants';

interface BallPickerProps {
  selectedNumbers: number[];
  onChange: (numbers: number[]) => void;
}

const BallPicker: React.FC<BallPickerProps> = ({ selectedNumbers, onChange }) => {
  const handleNumberClick = (num: number) => {
    if (selectedNumbers.includes(num)) {
      onChange(selectedNumbers.filter(n => n !== num));
    } else {
      if (selectedNumbers.length < 5) {
        onChange([...selectedNumbers, num].sort((a, b) => a - b));
      }
    }
  };

  return (
    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-inner bg-slate-50 max-h-60 overflow-y-auto custom-scrollbar">
      <div className="grid grid-cols-9 gap-2">
        {Array.from({ length: 90 }, (_, i) => i + 1).map((num) => {
          const isSelected = selectedNumbers.includes(num);
          const colorClass = getBallColorClass(num);
          
          return (
            <button
              key={num}
              type="button"
              onClick={() => handleNumberClick(num)}
              className={`
                aspect-square flex items-center justify-center rounded-full text-xs font-bold transition-all
                ${isSelected 
                  ? `${colorClass} ring-2 ring-offset-1 ring-blue-500 scale-110 z-10 shadow-md` 
                  : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-100'}
                ${!isSelected && selectedNumbers.length >= 5 ? 'opacity-40 cursor-not-allowed' : ''}
              `}
              disabled={!isSelected && selectedNumbers.length >= 5}
            >
              {num}
            </button>
          );
        })}
      </div>
      <p className="text-[10px] text-slate-400 text-center mt-2">Sélectionnez 5 numéros</p>
    </div>
  );
};

export default BallPicker;
