import React, { useState, useEffect, useMemo } from 'react';
import Layout from './components/Layout';
import Ball from './components/Ball';
import Heatmap from './components/Heatmap';
import HelpModal from './components/HelpModal';
import BallPicker from './components/BallPicker';
import { DRAW_SCHEDULE, getBallColorClass } from './constants';
import { DrawResult, TabView, NumberStats, PredictionResult, DayAffinity, RegularityStat } from './types';
import { getResultsForDraw } from './services/api';
import { calculateStats, generatePredictions, calculateDayAffinity, calculateGlobalPatterns, analyzeGapRegularity } from './services/analysis';
import { saveDrawsToDB, deleteDrawFromDB, getAllDrawsFromDB, clearDB } from './services/db';
import { syncDrawsWithCloud, pushDrawsToCloud } from './services/remoteData';
import { getFavorites, toggleFavorite } from './services/preferences';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, Legend } from 'recharts';
import { parse } from 'date-fns';
import { supabase } from './services/supabaseClient';

// Toast Notification Component
const Toast: React.FC<{ message: string; type: 'success' | 'error'; onClose: () => void }> = ({ message, type, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className={`fixed bottom-20 left-1/2 transform -translate-x-1/2 z-[60] px-6 py-3 rounded-full shadow-xl text-sm font-bold text-white animate-fade-in flex items-center gap-2 ${type === 'success' ? 'bg-green-600' : 'bg-red-600'}`}>
      <span>{message}</span>
    </div>
  );
};

const App: React.FC = () => {
  // --- State ---
  const [selectedDay, setSelectedDay] = useState<string>('Lundi');
  const [selectedDrawName, setSelectedDrawName] = useState<string>(DRAW_SCHEDULE[0].draws[0].name);
  const [activeTab, setActiveTab] = useState<TabView>(TabView.DATA);
  const [analysisMode, setAnalysisMode] = useState<'WINNING' | 'MACHINE'>('WINNING');
  
  // Data
  const [results, setResults] = useState<DrawResult[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [syncing, setSyncing] = useState<boolean>(false);
  
  // Data View Filters
  const [filterNumber, setFilterNumber] = useState<string>('');
  const [filterYear, setFilterYear] = useState<string>('');
  
  // Computed Stats State
  const [globalStats, setGlobalStats] = useState<NumberStats[]>([]);
  const [predictions, setPredictions] = useState<PredictionResult[]>([]);
  
  // Stats Filter State
  const [statsPeriod, setStatsPeriod] = useState<number | 'ALL'>('ALL');
  const [statsSortMode, setStatsSortMode] = useState<'FREQUENCY' | 'REGULARITY'>('FREQUENCY'); 
  const [filteredStats, setFilteredStats] = useState<NumberStats[]>([]);
  const [regularityStats, setRegularityStats] = useState<RegularityStat[]>([]);

  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  
  // Consult Tab State
  const [consultNumber, setConsultNumber] = useState<string>('');
  const [consultResult, setConsultResult] = useState<NumberStats | null>(null);
  const [consultAffinity, setConsultAffinity] = useState<DayAffinity[]>([]);

  // Admin State
  const [isAdminAuth, setIsAdminAuth] = useState(false);
  const [adminPin, setAdminPin] = useState('');
  
  // Admin Edit/Add State
  const [editingDraw, setEditingDraw] = useState<DrawResult | null>(null);
  const [newDrawDate, setNewDrawDate] = useState('');
  const [newDrawNumbers, setNewDrawNumbers] = useState<number[]>([]);
  const [bulkImportText, setBulkImportText] = useState('');

  // User Preferences & Help
  const [favorites, setFavorites] = useState<number[]>([]);
  const [isHelpOpen, setIsHelpOpen] = useState(false);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
  };

  useEffect(() => {
    setFavorites(getFavorites());
  }, []);

  useEffect(() => {
    const isIosDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    setIsIOS(isIosDevice && !isStandalone);
  }, []);

  const handleToggleFavorite = (num: number) => {
    const newFavs = toggleFavorite(num);
    setFavorites(newFavs);
    showToast(newFavs.includes(num) ? `Numéro ${num} ajouté aux favoris` : `Numéro ${num} retiré des favoris`, 'success');
  };

  useEffect(() => {
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      setInstallPrompt(e);
    });
  }, []);

  const handleInstall = () => {
    if (installPrompt) {
      installPrompt.prompt();
      installPrompt.userChoice.then(() => setInstallPrompt(null));
    }
  };

  const drawsForDay = useMemo(() => 
    DRAW_SCHEDULE.find(d => d.day === selectedDay)?.draws || [], 
  [selectedDay]);

  useEffect(() => {
    const isValid = drawsForDay.find(d => d.name === selectedDrawName);
    if (!isValid && drawsForDay.length > 0) {
      setSelectedDrawName(drawsForDay[0].name);
    }
  }, [selectedDay, drawsForDay, selectedDrawName]);

  const loadData = async () => {
    setLoading(true);
    setConsultResult(null);
    try {
      // Load local/scraped data
      const data = await getResultsForDraw(selectedDrawName);
      
      // Try background sync with cloud if enabled
      if (supabase) {
         setSyncing(true);
         syncDrawsWithCloud(selectedDrawName).then((didSync) => {
            if (didSync) {
                // Reload if we got new data from cloud
                getResultsForDraw(selectedDrawName).then(updatedData => {
                    const sorted = updatedData.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
                    setResults(sorted);
                    showToast('Données synchronisées avec le Cloud', 'success');
                });
            }
            setSyncing(false);
         });
      }
      
      const sortedData = data.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setResults(sortedData);
    } catch (error) {
      console.error(error);
      showToast("Aucune donnée trouvée.", "error");
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    setEditingDraw(null);
    setNewDrawDate('');
    setNewDrawNumbers([]);
    setStatsPeriod('ALL'); 
    setFilterNumber('');
    setFilterYear('');
  }, [selectedDrawName]);

  // --- Derived Data based on Mode (Winning vs Machine) ---
  const workingData = useMemo(() => {
    if (analysisMode === 'WINNING') return results;
    return results
      .filter(r => r.machine && r.machine.length === 5)
      .map(r => ({
        ...r,
        gagnants: r.machine! 
      }));
  }, [results, analysisMode]);

  useEffect(() => {
    if (workingData.length === 0) {
       setGlobalStats([]);
       setFilteredStats([]);
       setRegularityStats([]);
       setPredictions([]);
       return;
    }
    const calculatedStats = calculateStats(workingData);
    setGlobalStats(calculatedStats);
    setFilteredStats(calculatedStats);
    setRegularityStats(analyzeGapRegularity(workingData)); 
    setPredictions(generatePredictions(workingData));
  }, [workingData, loading]);

  useEffect(() => {
    if (workingData.length === 0) return;
    let dataSlice = workingData;
    if (statsPeriod !== 'ALL') {
      dataSlice = workingData.slice(0, statsPeriod as number);
    }
    setFilteredStats(calculateStats(dataSlice));
  }, [statsPeriod, workingData]);

  useEffect(() => {
    const num = parseInt(consultNumber);
    if (!isNaN(num) && num >= 1 && num <= 90) {
      const found = globalStats.find(s => s.number === num);
      setConsultResult(found || { number: num, frequency: 0, lastSeen: -1, partners: {}, nextPartners: {} });
      setConsultAffinity(calculateDayAffinity(workingData, num));
    } else {
      setConsultResult(null);
      setConsultAffinity([]);
    }
  }, [consultNumber, globalStats, workingData]);

  const handleAdminLogin = () => {
    if (adminPin === '2025') {
      setIsAdminAuth(true);
    } else {
      showToast('Code PIN incorrect', 'error');
    }
  };

  const handleDeleteDraw = async (date: string) => {
    if (window.confirm('Êtes-vous sûr de vouloir supprimer ce tirage ?')) {
      await deleteDrawFromDB(selectedDrawName, date);
      showToast('Tirage supprimé');
      loadData();
    }
  };

  const handleClearDB = async () => {
    if (window.confirm('ATTENTION : Cela va effacer toutes les données locales. Continuer ?')) {
        try {
            await clearDB();
            setResults([]);
            showToast('Base de données effacée.', 'success');
            setTimeout(() => window.location.reload(), 1500);
        } catch (e) {
            showToast('Erreur.', 'error');
        }
    }
  };

  const handleEditClick = (draw: DrawResult) => {
    setEditingDraw(draw);
    setNewDrawDate(draw.date);
    setNewDrawNumbers(draw.gagnants);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancelEdit = () => {
    setEditingDraw(null);
    setNewDrawDate('');
    setNewDrawNumbers([]);
  };

  const handleSaveDraw = async () => {
    if (!newDrawDate || newDrawNumbers.length !== 5) {
      showToast('Données incomplètes.', 'error');
      return;
    }

    const drawToSave: DrawResult = {
      draw_name: selectedDrawName,
      date: newDrawDate,
      gagnants: newDrawNumbers,
    };

    await saveDrawsToDB([drawToSave]);
    
    // Push to cloud if configured
    if (supabase) {
        pushDrawsToCloud([drawToSave]);
    }

    setNewDrawDate('');
    setNewDrawNumbers([]);
    setEditingDraw(null);
    showToast('Tirage enregistré !', 'success');
    loadData();
  };

  // --- Bulk Import Logic ---
  const handleBulkImport = async () => {
    const lines = bulkImportText.split('\n');
    const newDraws: DrawResult[] = [];
    let errors = 0;

    for (const line of lines) {
        if (!line.trim()) continue;
        const match = line.match(/^(\d{2}[\/-]\d{2}[\/-]\d{4})[\s\t]+(.+)$/);
        if (match) {
            const dateStr = match[1].replace(/-/g, '/');
            const numsStr = match[2];
            try {
                const parsedDate = parse(dateStr, 'dd/MM/yyyy', new Date());
                const isoDate = parsedDate.toISOString().split('T')[0];
                
                const nums = numsStr.match(/\d+/g)?.map(Number).filter(n => n >= 1 && n <= 90);
                if (nums && nums.length === 5) {
                    newDraws.push({
                        draw_name: selectedDrawName,
                        date: isoDate,
                        gagnants: nums
                    });
                } else {
                    errors++;
                }
            } catch (e) {
                errors++;
            }
        } else {
            errors++;
        }
    }

    if (newDraws.length > 0) {
        await saveDrawsToDB(newDraws);
        if (supabase) {
            await pushDrawsToCloud(newDraws);
        }
        showToast(`${newDraws.length} tirages importés. ${errors} erreurs.`, 'success');
        setBulkImportText('');
        loadData();
    } else {
        showToast('Aucun tirage valide trouvé. Vérifiez le format.', 'error');
    }
  };

  const handleExportJSON = async () => {
    const allData = await getAllDrawsFromDB();
    const blob = new Blob([JSON.stringify(allData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Backup_Loto_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleSharePrediction = async (numbers: number[], method: string) => {
     const text = `🎯 Prédiction (${selectedDrawName}) - ${method}: ${numbers.join('-')}`;
     if (navigator.share) {
       try { await navigator.share({ title: 'LotoBonheur', text: text }); } catch (e) {}
     } else {
       navigator.clipboard.writeText(text);
       showToast('Copié !');
     }
  };

  const handleHeatmapClick = (num: number) => {
    setConsultNumber(num.toString());
    setActiveTab(TabView.CONSULT);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // --- Data View Logic ---
  const filteredResults = useMemo(() => {
    let data = workingData;
    const searchNum = parseInt(filterNumber);
    if (!isNaN(searchNum)) {
      data = data.filter(d => d.gagnants.includes(searchNum));
    }
    if (filterYear && filterYear.length === 4) {
      data = data.filter(d => d.date.startsWith(filterYear));
    }
    return data;
  }, [workingData, filterNumber, filterYear]);

  const patternStats = useMemo(() => {
    let slice = workingData;
    if (statsPeriod !== 'ALL') {
      slice = workingData.slice(0, statsPeriod as number);
    }
    return calculateGlobalPatterns(slice);
  }, [workingData, statsPeriod]);

  const comparisonData = useMemo(() => {
    if (results.length === 0) return [];
    let dataSlice = results;
    if (statsPeriod !== 'ALL') {
      dataSlice = results.slice(0, statsPeriod as number);
    }
    const winCounts = new Array(91).fill(0);
    const machCounts = new Array(91).fill(0);

    dataSlice.forEach(d => {
      d.gagnants.forEach(n => winCounts[n]++);
      d.machine?.forEach(n => machCounts[n]++);
    });

    const chartData = [];
    for(let i=1; i<=90; i++) {
      chartData.push({
        name: i.toString(),
        Gagnant: winCounts[i],
        Machine: machCounts[i],
        total: winCounts[i] + machCounts[i]
      });
    }

    // Dynamic Sorting: If viewing Winning, sort by Winning Frequency. If Machine, by Machine.
    const sortKey = analysisMode === 'WINNING' ? 'Gagnant' : 'Machine';
    return chartData.sort((a, b) => (b as any)[sortKey] - (a as any)[sortKey]).slice(0, 15);
  }, [results, statsPeriod, analysisMode]);

  return (
    <Layout title={selectedDrawName}>
      <HelpModal isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} />
      
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* --- CONTROLS & TABS --- */}
      <div className="space-y-4 sticky top-[56px] z-40 bg-slate-50/95 backdrop-blur-sm py-2 -mx-4 px-4 shadow-sm transition-all">
        
        {/* Top Row: Draw Selector & Mode Toggle */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
           {/* Draw Selector */}
           <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
              <select 
                value={selectedDay} 
                onChange={(e) => setSelectedDay(e.target.value)}
                className="bg-white border border-slate-300 text-slate-700 text-sm rounded-lg p-2 focus:ring-blue-500 focus:border-blue-500 shadow-sm"
              >
                {DRAW_SCHEDULE.map(d => <option key={d.day} value={d.day}>{d.day}</option>)}
              </select>
              
              <select
                value={selectedDrawName}
                onChange={(e) => setSelectedDrawName(e.target.value)}
                className="bg-white border border-slate-300 text-slate-700 text-sm rounded-lg p-2 focus:ring-blue-500 focus:border-blue-500 shadow-sm flex-grow min-w-[160px]"
              >
                {drawsForDay.map(d => <option key={d.name} value={d.name}>{d.time} - {d.name}</option>)}
              </select>

              <button 
                onClick={() => loadData()} 
                className={`p-2 rounded-lg bg-blue-100 text-blue-700 hover:bg-blue-200 transition-colors ${loading || syncing ? 'animate-spin' : ''}`}
                title="Rafraîchir"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
              </button>
              
              <button
                onClick={() => setIsHelpOpen(true)}
                className="p-2 rounded-lg bg-slate-200 text-slate-600 hover:bg-slate-300"
                title="Aide"
              >
                ?
              </button>
           </div>

           {/* Mode Toggle (Winning vs Machine) */}
           <div className="flex self-end sm:self-auto bg-slate-200 p-1 rounded-lg">
             <button 
               onClick={() => setAnalysisMode('WINNING')}
               className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${analysisMode === 'WINNING' ? 'bg-blue-900 text-white shadow-sm' : 'text-slate-500'}`}
             >
               G
             </button>
             <button 
               onClick={() => setAnalysisMode('MACHINE')}
               className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${analysisMode === 'MACHINE' ? 'bg-amber-600 text-white shadow-sm' : 'text-slate-500'}`}
             >
               M
             </button>
           </div>
        </div>

        {/* Tabs */}
        <div className="flex rounded-xl bg-white p-1 shadow-sm border border-slate-200 overflow-x-auto no-scrollbar">
          {Object.values(TabView).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-2 px-3 text-sm font-medium rounded-lg whitespace-nowrap transition-all duration-200
                ${activeTab === tab 
                  ? 'bg-blue-50 text-blue-700 shadow-sm ring-1 ring-blue-200' 
                  : 'text-slate-500 hover:bg-slate-50'
                }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* --- iOS Install Hint --- */}
      {isIOS && (
        <div className="bg-blue-50 border border-blue-100 p-3 rounded-lg text-xs text-blue-800 flex items-start gap-2 mb-4">
            <span className="text-xl">📲</span>
            <p>Pour installer sur iPhone : appuyez sur <span className="font-bold">Partager</span> puis <span className="font-bold">Sur l'écran d'accueil</span>.</p>
        </div>
      )}
      
      {installPrompt && (
         <button onClick={handleInstall} className="w-full mb-4 bg-blue-900 text-white py-3 rounded-xl font-bold shadow-lg active:scale-95 transition-transform">
            Installer l'application
         </button>
      )}

      {/* --- CONTENT --- */}
      <div className="min-h-[300px]">
        {loading && <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div></div>}

        {!loading && activeTab === TabView.DATA && (
          <div className="space-y-4 animate-fade-in">
            {/* Filters */}
            <div className="flex gap-2 bg-white p-3 rounded-lg shadow-sm border border-slate-100">
                <input 
                    type="number" 
                    placeholder="N° inclus (ex: 42)"
                    className="w-full p-2 text-sm border rounded bg-slate-50"
                    value={filterNumber}
                    onChange={e => setFilterNumber(e.target.value)}
                />
                <input 
                    type="number"
                    placeholder="Année (ex: 2024)"
                    className="w-full p-2 text-sm border rounded bg-slate-50"
                    value={filterYear}
                    onChange={e => setFilterYear(e.target.value)}
                />
            </div>

            <div className="space-y-3">
              {filteredResults.length === 0 ? (
                <div className="text-center py-10 text-slate-400 bg-white rounded-xl border border-dashed">
                   Aucun résultat. Ajoutez-en via l'Admin.
                </div>
              ) : (
                filteredResults.map((draw, idx) => (
                  <div key={`${draw.date}-${idx}`} className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex flex-col gap-3">
                    <div className="flex justify-between items-center border-b border-slate-50 pb-2">
                      <div className="flex items-center gap-2">
                         <div className="w-2 h-8 bg-blue-600 rounded-full"></div>
                         <div>
                             <span className="text-xs text-slate-400 font-mono">{draw.date}</span>
                             <h3 className="font-bold text-slate-800 text-sm">{draw.draw_name}</h3>
                         </div>
                      </div>
                    </div>
                    
                    {/* Gagnants */}
                    <div className="flex justify-between gap-2">
                      {draw.gagnants.map((num, i) => (
                        <Ball key={i} number={num} isFavorite={favorites.includes(num)} onClick={() => handleHeatmapClick(num)} />
                      ))}
                    </div>
                    
                    {/* Machine (if exists) */}
                    {draw.machine && (
                        <div className="mt-1 pt-2 border-t border-dashed border-slate-100">
                            <p className="text-[10px] text-amber-600 font-bold mb-1 uppercase tracking-wider">Machine</p>
                            <div className="flex justify-between gap-2 opacity-75 scale-90 origin-left">
                                {draw.machine.map((num, i) => (
                                    <Ball key={i} number={num} size="sm" isFavorite={favorites.includes(num)} onClick={() => handleHeatmapClick(num)} />
                                ))}
                            </div>
                        </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {!loading && activeTab === TabView.STATS && (
          <div className="space-y-6 animate-fade-in">
            
            {/* Period Filter */}
            <div className="flex justify-between items-center bg-white p-2 rounded-lg shadow-sm border border-slate-200">
                <span className="text-xs font-bold text-slate-500 ml-2">Période:</span>
                <div className="flex gap-1">
                    {[20, 50, 100, 'ALL'].map(p => (
                        <button 
                            key={p}
                            onClick={() => setStatsPeriod(p as any)}
                            className={`px-3 py-1 text-xs rounded-md font-medium transition-colors ${statsPeriod === p ? 'bg-blue-100 text-blue-700' : 'text-slate-400 hover:bg-slate-50'}`}
                        >
                            {p === 'ALL' ? 'Tout' : p}
                        </button>
                    ))}
                </div>
            </div>

            {/* View Mode Switcher: Frequency vs Regularity */}
            <div className="flex justify-center">
                <div className="bg-slate-100 p-1 rounded-lg flex border border-slate-200">
                    <button 
                      onClick={() => setStatsSortMode('FREQUENCY')} 
                      className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${statsSortMode === 'FREQUENCY' ? 'bg-white shadow-sm text-blue-900 ring-1 ring-black/5' : 'text-slate-500'}`}
                    >
                      Fréquence
                    </button>
                    <button 
                      onClick={() => setStatsSortMode('REGULARITY')} 
                      className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${statsSortMode === 'REGULARITY' ? 'bg-white shadow-sm text-blue-900 ring-1 ring-black/5' : 'text-slate-500'}`}
                    >
                      Régularité (Cycles)
                    </button>
                </div>
            </div>

            {/* Stats Content */}
            {statsSortMode === 'FREQUENCY' ? (
                <>
                    <Heatmap stats={filteredStats} onNumberClick={handleHeatmapClick} />

                    <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                        <h3 className="font-bold text-slate-700 mb-4 text-sm">Top {analysisMode === 'WINNING' ? 'Gagnants' : 'Machine'} vs {analysisMode === 'WINNING' ? 'Machine' : 'Gagnants'}</h3>
                        <div className="h-64 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={comparisonData} margin={{top: 5, right: 5, bottom: 5, left: -20}}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                    <XAxis dataKey="name" tick={{fontSize: 10}} interval={0} />
                                    <YAxis tick={{fontSize: 10}} />
                                    <Tooltip contentStyle={{borderRadius: '8px', fontSize: '12px'}} />
                                    <Legend wrapperStyle={{fontSize: '12px'}} />
                                    <Bar dataKey="Gagnant" fill="#1e3a8a" radius={[4, 4, 0, 0]} name="Gagnant" />
                                    <Bar dataKey="Machine" fill="#d97706" radius={[4, 4, 0, 0]} name="Machine" />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                            <h3 className="font-bold text-slate-700 text-xs mb-2">Numéros à l'écart (Retard)</h3>
                            <div className="space-y-2">
                                {filteredStats.sort((a, b) => b.lastSeen - a.lastSeen).slice(0, 5).map(s => (
                                    <div key={s.number} className="flex justify-between items-center cursor-pointer hover:bg-slate-50 p-1 rounded" onClick={() => handleHeatmapClick(s.number)}>
                                        <div className="flex items-center gap-2">
                                            <span className="font-bold text-slate-800 bg-slate-100 w-6 h-6 flex items-center justify-center rounded text-xs">{s.number}</span>
                                        </div>
                                        <span className="text-xs font-bold text-red-600">{s.lastSeen} tr.</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                            <h3 className="font-bold text-slate-700 text-xs mb-2">Structure (Pair/Impair)</h3>
                            <div className="space-y-3 text-xs">
                                <div>
                                    <div className="flex justify-between mb-1"><span>Pair</span><span>{patternStats.even}</span></div>
                                    <div className="w-full bg-slate-100 rounded-full h-2"><div className="bg-blue-500 h-2 rounded-full" style={{width: `${(patternStats.even / (patternStats.even + patternStats.odd)) * 100}%`}}></div></div>
                                </div>
                                <div>
                                    <div className="flex justify-between mb-1"><span>Impair</span><span>{patternStats.odd}</span></div>
                                    <div className="w-full bg-slate-100 rounded-full h-2"><div className="bg-purple-500 h-2 rounded-full" style={{width: `${(patternStats.odd / (patternStats.even + patternStats.odd)) * 100}%`}}></div></div>
                                </div>
                            </div>
                        </div>
                    </div>
                </>
            ) : (
                <div className="space-y-3">
                   <div className="bg-blue-50 p-3 rounded-lg border border-blue-100 text-xs text-blue-800">
                      Analyse les écarts entre les sorties. Une régularité (score bas) indique un numéro qui sort souvent au même intervalle.
                   </div>
                   {regularityStats.length === 0 ? (
                       <p className="text-center text-slate-400 text-sm py-8">Pas assez de données pour calculer les cycles.</p>
                   ) : (
                       regularityStats.slice(0, 20).map(stat => (
                           <div key={stat.number} onClick={() => handleHeatmapClick(stat.number)} className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col gap-2 cursor-pointer hover:border-blue-300 transition-colors">
                               <div className="flex justify-between items-start">
                                   <div className="flex items-center gap-3">
                                       <Ball number={stat.number} size="sm" isFavorite={favorites.includes(stat.number)} />
                                       <div>
                                           <div className="font-bold text-slate-800 text-sm">Cycle Moyen: {stat.avgGap}</div>
                                           <div className="text-xs text-slate-500">Régularité: <span className="font-mono font-bold text-blue-600">{stat.consistency}</span></div>
                                       </div>
                                   </div>
                                   
                                   {/* Next Expected Indicator */}
                                   <div className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${stat.nextExpectedIn <= 0 ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                                       {stat.nextExpectedIn <= 0 ? `En retard de ${Math.abs(stat.nextExpectedIn)}` : `Attendu ds ${stat.nextExpectedIn}`}
                                   </div>
                               </div>
                               
                               {/* Gaps Visualizer */}
                               <div className="flex items-center gap-1 mt-1 overflow-x-auto">
                                   <span className="text-[10px] text-slate-400 mr-1">Écarts:</span>
                                   {stat.gaps.map((gap, i) => (
                                       <span key={i} className="bg-slate-100 text-slate-600 text-[10px] px-1.5 py-0.5 rounded font-mono border border-slate-200">
                                           {gap}
                                       </span>
                                   ))}
                               </div>
                           </div>
                       ))
                   )}
                </div>
            )}
          </div>
        )}

        {!loading && activeTab === TabView.CONSULT && (
          <div className="space-y-6 animate-fade-in">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 text-center">
              <input 
                type="number" 
                value={consultNumber}
                onChange={(e) => setConsultNumber(e.target.value)}
                placeholder="Entrez un numéro (1-90)"
                className="text-center text-2xl font-bold border-b-2 border-blue-200 focus:border-blue-600 outline-none w-32 mx-auto block text-slate-800 bg-transparent"
                autoFocus
              />
              <p className="text-xs text-slate-400 mt-2">Appuyez sur un numéro dans les stats pour voir les détails</p>
            </div>

            {consultResult ? (
              <div className="space-y-4">
                {/* Quick Stats */}
                <div className="grid grid-cols-3 gap-2">
                    <div className="bg-blue-50 p-3 rounded-lg text-center">
                        <div className="text-xs text-blue-600 uppercase font-bold">Sorties</div>
                        <div className="text-xl font-bold text-blue-900">{consultResult.frequency}</div>
                    </div>
                    <div className="bg-amber-50 p-3 rounded-lg text-center">
                        <div className="text-xs text-amber-600 uppercase font-bold">Écart</div>
                        <div className="text-xl font-bold text-amber-900">{consultResult.lastSeen}</div>
                    </div>
                    <div className="bg-purple-50 p-3 rounded-lg text-center">
                        <div className="text-xs text-purple-600 uppercase font-bold">Favori</div>
                        <button onClick={() => handleToggleFavorite(consultResult.number)} className="text-xl">
                            {favorites.includes(consultResult.number) ? '★' : '☆'}
                        </button>
                    </div>
                </div>

                {/* Prediction Status */}
                {predictions.some(p => p.numbers.includes(consultResult.number)) && (
                   <div className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white p-3 rounded-lg shadow-lg flex items-center gap-3">
                      <span className="text-2xl">🔮</span>
                      <div>
                         <p className="font-bold text-sm">Ce numéro est recommandé !</p>
                         <p className="text-xs opacity-90">Il apparaît dans les prédictions actuelles.</p>
                      </div>
                   </div>
                )}

                {/* Partners Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Same Draw Partners */}
                    <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                      <h3 className="font-bold text-slate-700 mb-3 text-sm flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-green-500"></span> Sortent souvent ENSEMBLE
                      </h3>
                      <div className="space-y-3">
                        {Object.entries(consultResult.partners)
                          .sort(([, a], [, b]) => b - a)
                          .slice(0, 5)
                          .map(([num, count], idx) => (
                            <div key={num} className="flex items-center justify-between p-2 hover:bg-slate-50 rounded-lg cursor-pointer transition-colors" onClick={() => handleHeatmapClick(parseInt(num))}>
                              <div className="flex items-center gap-3">
                                <span className="text-xs font-bold text-slate-400 w-4">#{idx + 1}</span>
                                <Ball number={parseInt(num)} size="sm" />
                              </div>
                              <span className="text-xs font-bold bg-green-100 text-green-700 px-2 py-1 rounded-full">{count} fois</span>
                            </div>
                          ))}
                      </div>
                    </div>

                    {/* Next Draw Partners (Bayesian/Sequential) */}
                    <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                      <h3 className="font-bold text-slate-700 mb-3 text-sm flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-blue-500"></span> Sortent souvent APRÈS
                      </h3>
                      {consultResult.nextPartners && Object.keys(consultResult.nextPartners).length > 0 ? (
                          <div className="space-y-3">
                            {Object.entries(consultResult.nextPartners)
                              .sort(([, a], [, b]) => b - a)
                              .slice(0, 5)
                              .map(([num, count], idx) => (
                                <div key={num} className="flex items-center justify-between p-2 hover:bg-slate-50 rounded-lg cursor-pointer transition-colors" onClick={() => handleHeatmapClick(parseInt(num))}>
                                  <div className="flex items-center gap-3">
                                    <span className="text-xs font-bold text-slate-400 w-4">#{idx + 1}</span>
                                    <Ball number={parseInt(num)} size="sm" />
                                  </div>
                                  <span className="text-xs font-bold bg-blue-100 text-blue-700 px-2 py-1 rounded-full">{count} fois</span>
                                </div>
                              ))}
                          </div>
                      ) : (
                          <p className="text-xs text-slate-400 italic">Pas assez de données séquentielles.</p>
                      )}
                    </div>
                </div>

                {/* Lucky Days Chart */}
                <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                    <h3 className="font-bold text-slate-700 mb-3 text-sm">Jours de Chance</h3>
                    <div className="h-40 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={consultAffinity}>
                                <XAxis dataKey="day" tick={{fontSize: 10}} interval={0} />
                                <Tooltip cursor={{fill: '#f1f5f9'}} contentStyle={{borderRadius: '8px', fontSize: '12px'}} />
                                <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
              </div>
            ) : (
               consultNumber && <div className="text-center py-8 text-slate-400">Numéro non trouvé ou aucune donnée.</div>
            )}
          </div>
        )}

        {!loading && activeTab === TabView.PREDICTION && (
          <div className="space-y-6 animate-fade-in">
            <div className="bg-gradient-to-br from-blue-900 to-indigo-900 p-6 rounded-2xl shadow-lg text-white mb-6">
              <h2 className="text-xl font-bold mb-1">Prédictions IA</h2>
              <p className="text-blue-200 text-sm opacity-80">Basé sur {workingData.length} tirages ({analysisMode === 'WINNING' ? 'Gagnants' : 'Machine'})</p>
            </div>

            <div className="space-y-4">
              {predictions.map((pred) => (
                <div key={pred.method} className={`bg-white p-5 rounded-xl shadow-md border-l-4 transition-transform active:scale-[0.99] ${pred.method === 'Hybrid' ? 'border-l-amber-400 ring-1 ring-amber-100' : 'border-l-blue-500'}`}>
                  <div className="flex justify-between items-start mb-4">
                    <div>
                        <h3 className="font-bold text-slate-800 flex items-center gap-2">
                            {pred.method}
                            {pred.method === 'Hybrid' && <span className="bg-amber-100 text-amber-700 text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wider">Recommandé</span>}
                        </h3>
                        <p className="text-xs text-slate-400 mt-0.5">Confiance: {Math.round(pred.confidence * 100)}%</p>
                    </div>
                    <button onClick={() => handleSharePrediction(pred.numbers, pred.method)} className="text-slate-400 hover:text-blue-600">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>
                    </button>
                  </div>
                  <div className="flex justify-between gap-2">
                    {pred.numbers.map((num, i) => (
                      <Ball key={i} number={num} isFavorite={favorites.includes(num)} onClick={() => handleHeatmapClick(num)} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === TabView.ADMIN && (
          <div className="space-y-6 animate-fade-in">
            {!isAdminAuth ? (
              <div className="bg-white p-8 rounded-xl shadow-sm border border-slate-200 text-center max-w-sm mx-auto mt-10">
                <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl">🔒</div>
                <h3 className="font-bold text-slate-800 mb-4">Accès Administrateur</h3>
                <input 
                  type="password" 
                  value={adminPin}
                  onChange={(e) => setAdminPin(e.target.value)}
                  placeholder="Code PIN (2025)"
                  className="w-full p-3 border rounded-lg mb-4 text-center text-lg tracking-widest"
                />
                <button onClick={handleAdminLogin} className="w-full bg-blue-900 text-white py-3 rounded-lg font-bold">
                  Déverrouiller
                </button>
              </div>
            ) : (
              <div className="space-y-8">
                {/* Add/Edit Section */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                  <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                      <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                      {editingDraw ? 'Modifier un tirage' : 'Ajouter un tirage'}
                  </h3>
                  
                  <div className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1">Date</label>
                        <input 
                            type="date" 
                            value={newDrawDate}
                            onChange={(e) => setNewDrawDate(e.target.value)}
                            className="w-full p-3 border rounded-lg bg-slate-50"
                        />
                    </div>

                    <BallPicker selectedNumbers={newDrawNumbers} onChange={setNewDrawNumbers} />
                    
                    <div className="flex gap-2 pt-2">
                        {editingDraw && (
                            <button onClick={handleCancelEdit} className="flex-1 py-3 rounded-lg border border-slate-300 text-slate-600 font-bold">
                                Annuler
                            </button>
                        )}
                        <button 
                            onClick={handleSaveDraw} 
                            className="flex-1 bg-blue-900 text-white py-3 rounded-lg font-bold shadow-md active:scale-95 transition-transform"
                        >
                            {editingDraw ? 'Mettre à jour' : 'Enregistrer'}
                        </button>
                    </div>
                  </div>
                </div>

                {/* Bulk Import Section */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                    <h3 className="font-bold text-slate-800 mb-2">Importation en Masse</h3>
                    <p className="text-xs text-slate-500 mb-3">Collez les résultats (Format: JJ/MM/AAAA 1-2-3-4-5)</p>
                    <textarea
                        value={bulkImportText}
                        onChange={(e) => setBulkImportText(e.target.value)}
                        placeholder="12/01/2025 10 20 30 40 50&#10;13/01/2025 05-15-25-35-45"
                        className="w-full p-3 border rounded-lg bg-slate-50 h-32 text-sm font-mono mb-3"
                    />
                    <button onClick={handleBulkImport} className="w-full bg-slate-700 text-white py-2 rounded-lg font-bold text-sm">
                        Importer
                    </button>
                </div>

                {/* List & Management */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                  <div className="flex justify-between items-center mb-4">
                     <h3 className="font-bold text-slate-800">Gestion des données</h3>
                     <span className="text-xs bg-slate-100 px-2 py-1 rounded text-slate-500">{workingData.length} tirages</span>
                  </div>
                  
                  <div className="max-h-60 overflow-y-auto space-y-2 mb-4 custom-scrollbar">
                    {workingData.map((draw, idx) => (
                      <div key={`${draw.date}-${idx}`} className="flex justify-between items-center p-3 bg-slate-50 rounded-lg border border-slate-100 group">
                        <div className="cursor-pointer" onClick={() => handleEditClick(draw)}>
                            <span className="text-sm font-bold text-slate-700 block">{draw.date}</span>
                            <span className="text-xs text-slate-400 tracking-wider">{draw.gagnants.join('-')}</span>
                        </div>
                        <button onClick={() => handleDeleteDraw(draw.date)} className="text-red-400 hover:text-red-600 p-2">
                          🗑️
                        </button>
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                      <button onClick={handleExportJSON} className="bg-blue-50 text-blue-700 py-2 rounded-lg font-bold text-sm border border-blue-100">
                          Sauvegarder JSON
                      </button>
                      <button onClick={handleClearDB} className="bg-red-50 text-red-700 py-2 rounded-lg font-bold text-sm border border-red-100">
                          Tout Effacer
                      </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
};

export default App;
