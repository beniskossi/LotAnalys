import React from 'react';
import { getBallColorClass } from '../constants';

interface BallProps {
  number: number;
  size?: 'sm' | 'md' | 'lg';
  isFavorite?: boolean;
  onClick?: () => void;
}

const Ball: React.FC<BallProps> = ({ number, size = 'md', isFavorite = false, onClick }) => {
  const colorClass = getBallColorClass(number);
  
  const sizeClasses = {
    sm: 'w-8 h-8 text-xs',
    md: 'w-11 h-11 text-base font-bold',
    lg: 'w-14 h-14 text-xl font-bold',
  };

  return (
    <div 
      onClick={onClick}
      className={`
        ${sizeClasses[size]} 
        ${colorClass} 
        relative rounded-full flex items-center justify-center shadow-sm 
        border-2 
        ${isFavorite ? 'border-amber-400 ring-2 ring-amber-100' : 'border-black/5'}
        ${onClick ? 'cursor-pointer active:scale-95 transition-transform' : ''}
      `}
    >
      {number}
      {isFavorite && size !== 'sm' && (
        <div className="absolute -top-1 -right-1 text-amber-400 bg-white rounded-full shadow-sm">
          <svg className="w-3 h-3 fill-current" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
        </div>
      )}
    </div>
  );
};

export default Ball;
