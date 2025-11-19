import React, { useState, useEffect } from 'react';
import { DRAW_SCHEDULE } from '../constants';

interface LayoutProps {
  children: React.ReactNode;
  title: string;
  selectedDay?: string;
}

const Layout: React.FC<LayoutProps> = ({ children, title, selectedDay }) => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [nextDraw, setNextDraw] = useState<string | null>(null);

  // Monitor Online Status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Calculate Next Draw
  useEffect(() => {
    const calculateNextDraw = () => {
      const now = new Date();
      const currentDayName = new Intl.DateTimeFormat('fr-FR', { weekday: 'long' }).format(now);
      // Capitalize first letter to match constants (e.g., "lundi" -> "Lundi")
      const formattedDay = currentDayName.charAt(0).toUpperCase() + currentDayName.slice(1);

      // Only show next draw if we are viewing the schedule for today
      // Or purely based on real time regardless of selection
      const todaySchedule = DRAW_SCHEDULE.find(d => d.day === formattedDay);

      if (todaySchedule) {
        const currentMinutes = now.getHours() * 60 + now.getMinutes();
        
        const next = todaySchedule.draws.find(d => {
          const [h, m] = d.time.split(':').map(Number);
          const drawMinutes = h * 60 + m;
          return drawMinutes > currentMinutes;
        });

        if (next) {
          setNextDraw(`${next.time} - ${next.name}`);
        } else {
          setNextDraw(null); // No more draws today
        }
      }
    };

    calculateNextDraw();
    const interval = setInterval(calculateNextDraw, 60000); // Update every minute
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 pb-safe">
      {/* Header */}
      <header className="bg-blue-900 text-white sticky top-0 z-50 shadow-md">
        <div className="max-w-4xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center shadow-sm">
                <span className="text-blue-900 font-bold text-sm">LB</span>
              </div>
              <div>
                <h1 className="text-lg font-semibold tracking-tight leading-tight">{title}</h1>
                {nextDraw && (
                  <p className="text-[10px] text-blue-200 font-medium">
                    Prochain: <span className="text-white">{nextDraw}</span>
                  </p>
                )}
              </div>
            </div>
            
            {/* Offline Badge */}
            {!isOnline && (
              <div className="flex items-center gap-1 bg-red-500/20 border border-red-400/50 px-2 py-1 rounded-md">
                <div className="w-2 h-2 bg-red-400 rounded-full animate-pulse"></div>
                <span className="text-xs font-medium text-red-100">Hors ligne</span>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-grow max-w-4xl w-full mx-auto px-4 py-6 space-y-6">
        {children}
      </main>

      {/* Footer / PWA Hint */}
      <footer className="bg-slate-100 border-t py-6 text-center text-sm text-slate-500 pb-8">
        <p>© 2025 LotoBonheur Analytics</p>
        <p className="text-xs mt-1 opacity-75">
          {isOnline ? 'Connecté au serveur' : 'Mode hors ligne actif'}
        </p>
      </footer>
    </div>
  );
};

export default Layout;