
import React, { useState, useEffect, useMemo } from 'react';
import Layout from './components/Layout';
import Ball from './components/Ball';
import Heatmap from './components/Heatmap';
import HelpModal from './components/HelpModal';
import { DRAW_SCHEDULE, getBallColorClass } from './constants';
import { DrawResult, TabView, NumberStats, PredictionResult, DayAffinity } from './types';
import { getResultsForDraw } from './services/api';
import { calculateStats, generatePredictions, calculateDayAffinity, calculateGlobalPatterns } from './services/analysis';
import { saveDrawsToDB, deleteDrawFromDB, getAllDrawsFromDB } from './services/db';
import { getFavorites, toggleFavorite } from './services/preferences';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

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
  
  // Data View Filters
  const [filterNumber, setFilterNumber] = useState<string>('');
  const [filterYear, setFilterYear] = useState<string>('');
  
  // Computed Stats State
  const [globalStats, setGlobalStats] = useState<NumberStats[]>([]);
  const [predictions, setPredictions] = useState<PredictionResult[]>([]);
  
  // Stats Filter State
  const [statsPeriod, setStatsPeriod] = useState<number | 'ALL'>('ALL');
  const [filteredStats, setFilteredStats] = useState<NumberStats[]>([]);

  const [installPrompt, setInstallPrompt] = useState<any>(null);
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
  const [newDrawNumbers, setNewDrawNumbers] = useState('');

  // User Preferences & Help
  const [favorites, setFavorites] = useState<number[]>([]);
  const [isHelpOpen, setIsHelpOpen] = useState(false);

  // Helper to show toast
  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
  };

  // Load Favorites
  useEffect(() => {
    setFavorites(getFavorites());
  }, []);

  // Toggle Favorite Handler
  const handleToggleFavorite = (num: number) => {
    const newFavs = toggleFavorite(num);
    setFavorites(newFavs);
    showToast(newFavs.includes(num) ? `Numéro ${num} ajouté aux favoris` : `Numéro ${num} retiré des favoris`, 'success');
  };

  // PWA Install
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

  // Memoized schedule helper
  const drawsForDay = useMemo(() => 
    DRAW_SCHEDULE.find(d => d.day === selectedDay)?.draws || [], 
  [selectedDay]);

  // Initial Load & Updates
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
      const data = await getResultsForDraw(selectedDrawName);
      // Sort descending by date
      const sortedData = data.sort((a, b) => {
        const timeA = new Date(a.date).getTime();
        const timeB = new Date(b.date).getTime();
        return timeB - timeA;
      });
      setResults(sortedData);
    } catch (error) {
      console.error(error);
      showToast("Erreur lors du chargement des données", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    setEditingDraw(null);
    setNewDrawDate('');
    setNewDrawNumbers('');
    setStatsPeriod('ALL'); // Reset filter on draw change
    setFilterNumber('');
    setFilterYear('');
  }, [selectedDrawName]);

  // --- Derived Data based on Mode (Winning vs Machine) ---
  const workingData = useMemo(() => {
    if (analysisMode === 'WINNING') return results;
    // Filter draws that have machine numbers and map them
    return results
      .filter(r => r.machine && r.machine.length === 5)
      .map(r => ({
        ...r,
        gagnants: r.machine! // Swap winners with machine for analysis
      }));
  }, [results, analysisMode]);

  // Calculate Stats & Predictions when data or mode changes
  useEffect(() => {
    if (workingData.length === 0 && !loading && results.length > 0) {
       // Case where we switched to machine but no machine data exists
       setGlobalStats([]);
       setFilteredStats([]);
       setPredictions([]);
       return;
    }
    const calculatedStats = calculateStats(workingData);
    setGlobalStats(calculatedStats);
    setFilteredStats(calculatedStats); 
    setPredictions(generatePredictions(workingData));
  }, [workingData, loading]);

  // Update filtered stats when period changes
  useEffect(() => {
    if (workingData.length === 0) return;

    let dataSlice = workingData;
    if (statsPeriod !== 'ALL') {
      dataSlice = workingData.slice(0, statsPeriod as number);
    }
    setFilteredStats(calculateStats(dataSlice));
  }, [statsPeriod, workingData]);

  // Consult Logic
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

  // Admin Functions
  const handleAdminLogin = () => {
    if (adminPin === '2025') { // Simple PIN for PWA
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

  const handleEditClick = (draw: DrawResult) => {
    setEditingDraw(draw);
    setNewDrawDate(draw.date);
    setNewDrawNumbers(draw.gagnants.join(', '));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancelEdit = () => {
    setEditingDraw(null);
    setNewDrawDate('');
    setNewDrawNumbers('');
  };

  const handleSaveDraw = async () => {
    if (!newDrawDate || !newDrawNumbers) return;
    
    const numbers = newDrawNumbers.split(/[\s,-]+/).map(Number).filter(n => !isNaN(n) && n > 0 && n <= 90);
    if (numbers.length !== 5) {
      showToast('Veuillez entrer exactement 5 numéros valides (1-90).', 'error');
      return;
    }

    const drawToSave: DrawResult = {
      draw_name: selectedDrawName,
      date: newDrawDate,
      gagnants: numbers,
    };

    await saveDrawsToDB([drawToSave]);
    setNewDrawDate('');
    setNewDrawNumbers('');
    setEditingDraw(null);
    showToast(editingDraw ? 'Tirage mis à jour !' : 'Tirage ajouté avec succès !', 'success');
    loadData();
  };

  const handleExportJSON = async () => {
    const allData = await getAllDrawsFromDB();
    const blob = new Blob([JSON.stringify(allData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `LotoBonheur_Backup_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    showToast('Sauvegarde téléchargée');
  };

  const handleImportJSON = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = JSON.parse(e.target?.result as string);
        if (Array.isArray(data)) {
          await saveDrawsToDB(data);
          showToast('Importation réussie !', 'success');
          loadData();
        } else {
          showToast('Format JSON invalide.', 'error');
        }
      } catch (err) {
        console.error(err);
        showToast('Erreur lecture fichier', 'error');
      }
    };
    reader.readAsText(file);
  };

  const handleSharePrediction = async (numbers: number[], method: string) => {
     const text = `🎯 Prédiction LotoBonheur (${selectedDrawName}) - ${method}: ${numbers.join('-')}. Bonne chance !`;
     if (navigator.share) {
       try {
         await navigator.share({
           title: 'LotoBonheur Prédiction',
           text: text,
         });
       } catch (err) {
         console.log('Share cancelled');
       }
     } else {
       navigator.clipboard.writeText(text);
       showToast('Prédiction copiée dans le presse-papier');
     }
  };

  // --- Data View Logic (Filtering) ---
  const filteredResults = useMemo(() => {
    let data = workingData; // Use workingData to reflect Winning vs Machine mode
    
    // Filter by Number
    const searchNum = parseInt(filterNumber);
    if (!isNaN(searchNum)) {
      data = data.filter(d => d.gagnants.includes(searchNum));
    }

    // Filter by Year
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


  // --- Renders ---

  const renderTabs = () => (
    <div className="flex overflow-x-auto no-scrollbar space-x-1 bg-white p-1 rounded-xl shadow-sm border border-slate-200 mb-4">
      {Object.values(TabView).map((tab) => (
        <button
          key={tab}
          onClick={() => setActiveTab(tab)}
          className={`flex-1 min-w-[80px] py-2.5 text-sm font-medium rounded-lg transition-all whitespace-nowrap px-2 ${
            activeTab === tab
              ? 'bg-blue-900 text-white shadow-md'
              : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
          }`}
        >
          {tab}
        </button>
      ))}
    </div>
  );

  const renderDataView = () => (
    <div className="space-y-4 animate-fade-in">
      {/* Filters */}
      <div className="bg-white p-3 rounded-xl shadow-sm border border-slate-200 flex gap-3 overflow-x-auto items-center">
        <input 
          type="number" 
          placeholder="N° (ex: 42)"
          className="w-24 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:border-blue-500 outline-none"
          value={filterNumber}
          onChange={(e) => setFilterNumber(e.target.value)}
        />
        <input 
          type="text" 
          placeholder="Année (ex: 2024)"
          maxLength={4}
          className="w-32 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:border-blue-500 outline-none"
          value={filterYear}
          onChange={(e) => setFilterYear(e.target.value)}
        />
        {(filterNumber || filterYear) && (
          <button 
            onClick={() => { setFilterNumber(''); setFilterYear(''); }}
            className="text-xs text-red-500 font-medium px-2 hover:bg-red-50 rounded"
          >
            Effacer
          </button>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
          <h3 className="font-semibold text-slate-800 flex items-center gap-2">
            Historique 
            <span className="text-[10px] uppercase px-2 py-0.5 rounded bg-slate-200 text-slate-600">
              {analysisMode === 'WINNING' ? 'Gagnants' : 'Machine'}
            </span>
          </h3>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 hidden sm:inline">
              {filteredResults.length} Résultats
            </span>
            <button 
              onClick={loadData}
              disabled={loading}
              className="p-1.5 rounded-md bg-slate-100 text-slate-500 hover:bg-blue-50 hover:text-blue-600 transition-colors"
              title="Rafraîchir"
            >
              <svg className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
            </button>
          </div>
        </div>
        {loading && results.length === 0 ? (
          <div className="p-12 text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-blue-500 border-t-transparent"></div>
            <p className="mt-2 text-slate-500 text-sm">Chargement des données...</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 max-h-[600px] overflow-y-auto">
            {filteredResults.map((draw, index) => (
              <div key={draw.id || `${draw.draw_name}-${draw.date}-${index}`} className="p-4 hover:bg-blue-50 transition-colors">
                <div className="flex justify-between items-center mb-3">
                  <span className="text-sm text-slate-600 font-medium flex items-center gap-2">
                    <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                    {draw.date}
                  </span>
                  <span className="text-xs font-bold text-blue-800 bg-blue-100 px-2 py-1 rounded border border-blue-200">
                    {draw.draw_name}
                  </span>
                </div>
                <div className="flex gap-2 justify-center sm:justify-start mb-2">
                  {draw.gagnants.map((num, idx) => (
                    <Ball key={`w-${idx}`} number={num} size="md" isFavorite={favorites.includes(num)} />
                  ))}
                </div>
                {analysisMode === 'WINNING' && draw.machine && (
                  <div className="mt-3 pt-2 border-t border-dashed border-slate-200 flex items-center gap-3">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Machine</span>
                    <div className="flex gap-1.5 opacity-80">
                      {draw.machine.map((num, idx) => <Ball key={`m-${idx}`} number={num} size="sm" />)}
                    </div>
                  </div>
                )}
              </div>
            ))}
            {filteredResults.length === 0 && !loading && (
               <div className="p-8 text-center text-slate-400">
                 {analysisMode === 'MACHINE' ? 'Pas de données "Machine" disponibles.' : 'Aucun résultat trouvé.'}
               </div>
            )}
          </div>
        )}
      </div>
    </div>
  );

  const renderConsultView = () => {
    const isPredicted = consultResult && predictions.some(p => p.method === 'Hybrid' && p.numbers.includes(consultResult.number));
    const bayesianPrediction = predictions.find(p => p.method === 'Bayesian Analysis');
    const isBayesianTop = consultResult && bayesianPrediction && bayesianPrediction.numbers.includes(consultResult.number);
    const isFav = consultNumber && favorites.includes(parseInt(consultNumber));

    return (
    <div className="space-y-6 animate-fade-in">
       <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 text-center relative">
          <label className="block text-sm font-medium text-slate-700 mb-2">Rechercher un numéro (1-90)</label>
          <div className="flex items-center justify-center gap-4">
             <input 
              type="number" 
              min="1" 
              max="90"
              value={consultNumber}
              onChange={(e) => setConsultNumber(e.target.value)}
              className="text-center text-2xl font-bold w-24 p-2 border-2 border-blue-100 rounded-lg focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
              placeholder="00"
            />
            {consultResult && (
              <button 
                onClick={() => handleToggleFavorite(parseInt(consultNumber))}
                className={`p-2 rounded-full border-2 transition-colors ${isFav ? 'bg-amber-50 border-amber-300 text-amber-500' : 'border-slate-200 text-slate-300 hover:text-amber-400'}`}
                title="Ajouter aux favoris"
              >
                <svg className="w-6 h-6 fill-current" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
              </button>
            )}
          </div>
       </div>

       {consultResult ? (
         <div className="space-y-4">
            {isPredicted && (
              <div className="bg-gradient-to-r from-green-500 to-emerald-600 p-3 rounded-xl text-white shadow-md flex items-center justify-center gap-2 animate-pulse">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                <span className="font-bold text-sm">Numéro Hybride Recommandé !</span>
              </div>
            )}
            
            {isBayesianTop && !isPredicted && (
               <div className="bg-indigo-50 border border-indigo-100 p-3 rounded-xl text-indigo-800 shadow-sm flex items-center justify-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                <span className="font-medium text-sm">Forte probabilité (Suite Logique)</span>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
               <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 text-center">
                 <span className="text-xs text-slate-500 uppercase font-bold">Fréquence</span>
                 <p className="text-3xl font-black text-blue-900 mt-1">{consultResult.frequency}</p>
                 <span className="text-xs text-slate-400">sorties totales</span>
               </div>
               <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 text-center">
                 <span className="text-xs text-slate-500 uppercase font-bold">Écart Actuel</span>
                 <p className={`text-3xl font-black mt-1 ${consultResult.lastSeen > 10 ? 'text-red-500' : 'text-green-600'}`}>
                   {consultResult.lastSeen === -1 ? '-' : consultResult.lastSeen}
                 </p>
                 <span className="text-xs text-slate-400">tirages sans sortie</span>
               </div>
            </div>

            {/* Lucky Days Chart */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
              <h4 className="font-semibold text-slate-700 mb-3 text-sm text-center">Jours de Chance (Affinité)</h4>
              <div className="h-40 w-full">
                <ResponsiveContainer width="100%" height="100%">
                   <BarChart data={consultAffinity}>
                     <XAxis dataKey="day" tick={{fontSize: 9}} interval={0} />
                     <Tooltip />
                     <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                   </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                    <h4 className="font-semibold text-slate-700 mb-3 text-sm text-center">Sortent souvent ENSEMBLE</h4>
                    <div className="flex flex-wrap justify-center gap-2">
                        {Object.entries(consultResult.partners)
                        .sort((a, b) => (b[1] as number) - (a[1] as number))
                        .slice(0, 5)
                        .map(([num, count]) => (
                            <div key={num} className="flex flex-col items-center bg-slate-50 p-2 rounded-lg border border-slate-100 min-w-[50px]">
                                <Ball number={parseInt(num)} size="sm" isFavorite={favorites.includes(parseInt(num))} />
                                <span className="text-[10px] font-bold text-slate-500 mt-1">{count}x</span>
                            </div>
                        ))
                        }
                    </div>
                </div>
                <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                    <h4 className="font-semibold text-slate-700 mb-3 text-sm text-center">Sortent souvent APRÈS</h4>
                    <div className="flex flex-wrap justify-center gap-2">
                        {consultResult.nextPartners && Object.entries(consultResult.nextPartners).length > 0 ? (
                            Object.entries(consultResult.nextPartners)
                            .sort((a, b) => (b[1] as number) - (a[1] as number))
                            .slice(0, 5)
                            .map(([num, count]) => (
                                <div key={`next-${num}`} className="flex flex-col items-center bg-indigo-50 p-2 rounded-lg border border-indigo-100 min-w-[50px]">
                                    <Ball number={parseInt(num)} size="sm" isFavorite={favorites.includes(parseInt(num))} />
                                    <span className="text-[10px] font-bold text-indigo-500 mt-1">{count}x</span>
                                </div>
                            ))
                        ) : (
                            <p className="text-xs text-slate-400 italic text-center">Pas assez de données.</p>
                        )}
                    </div>
                </div>
            </div>

         </div>
       ) : (
         consultNumber && <p className="text-center text-slate-400">Numéro invalide ou non trouvé.</p>
       )}
    </div>
    );
  };

  const renderStatsView = () => {
    const chartData = filteredStats
        .slice()
        .sort((a, b) => b.frequency - a.frequency)
        .slice(0, 15)
        .map(s => ({ name: s.number.toString(), freq: s.frequency }));
    
    const total = patternStats.even + patternStats.odd;
    const evenPct = total ? Math.round((patternStats.even / total) * 100) : 0;
    const lowPct = total ? Math.round((patternStats.low / total) * 100) : 0;

    return (
      <div className="space-y-6 animate-fade-in">
        {/* Filter Controls */}
        <div className="bg-white p-2 rounded-xl shadow-sm border border-slate-200 flex justify-between items-center overflow-x-auto no-scrollbar">
             <span className="text-xs font-bold text-slate-500 px-2 whitespace-nowrap">Période :</span>
             <div className="flex gap-1">
                {[20, 50, 100, 'ALL'].map((p) => (
                    <button
                        key={p}
                        onClick={() => setStatsPeriod(p as number | 'ALL')}
                        className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-colors ${
                            statsPeriod === p 
                            ? 'bg-blue-100 text-blue-700 border border-blue-200' 
                            : 'text-slate-500 hover:bg-slate-50'
                        }`}
                    >
                        {p === 'ALL' ? 'Tout' : `${p} Tirages`}
                    </button>
                ))}
             </div>
        </div>
        
        {/* Pattern Structure Stats */}
        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 grid grid-cols-2 gap-6">
            <div>
                <div className="flex justify-between text-xs mb-1 font-bold text-slate-700">
                    <span>Pairs ({evenPct}%)</span>
                    <span>Impairs ({100-evenPct}%)</span>
                </div>
                <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden flex">
                    <div className="bg-blue-500 h-full" style={{ width: `${evenPct}%` }}></div>
                    <div className="bg-orange-400 h-full" style={{ width: `${100-evenPct}%` }}></div>
                </div>
            </div>
            <div>
                <div className="flex justify-between text-xs mb-1 font-bold text-slate-700">
                    <span>Bas 1-45 ({lowPct}%)</span>
                    <span>Haut 46-90 ({100-lowPct}%)</span>
                </div>
                <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden flex">
                    <div className="bg-indigo-500 h-full" style={{ width: `${lowPct}%` }}></div>
                    <div className="bg-purple-500 h-full" style={{ width: `${100-lowPct}%` }}></div>
                </div>
            </div>
            <div className="col-span-2 text-center border-t pt-2 mt-1">
                <span className="text-xs text-slate-500 uppercase font-bold">Somme Moyenne des Tirages</span>
                <p className="text-xl font-black text-slate-800">{patternStats.avgSum}</p>
            </div>
        </div>

        {/* Heatmap */}
        <Heatmap stats={filteredStats} />

        {/* Chart */}
        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
          <h3 className="font-semibold text-slate-700 mb-4 text-sm">Top 15 (Fréquence)</h3>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#64748b'}} />
                <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#64748b'}} />
                <Tooltip 
                  cursor={{fill: '#f8fafc'}}
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <Bar dataKey="freq" radius={[4, 4, 0, 0]}>
                  {chartData.map((entry, index) => (
                     <Cell key={`cell-${index}`} fill={getBallColorClass(parseInt(entry.name)).includes('bg-blue') ? '#1e3a8a' : '#3b82f6'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Due Numbers (Gaps) */}
        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
          <div className="flex justify-between items-center mb-3">
            <h3 className="font-semibold text-slate-700 text-sm">Numéros à l'écart (Plus gros écarts)</h3>
            <span className="text-[10px] bg-red-100 text-red-600 px-2 py-1 rounded-full font-bold">Critique</span>
          </div>
          <div className="flex gap-2 overflow-x-auto no-scrollbar py-2">
            {filteredStats
              .sort((a, b) => b.lastSeen - a.lastSeen)
              .slice(0, 7)
              .map(s => (
                <div key={s.number} className="flex flex-col items-center min-w-[50px]">
                  <Ball number={s.number} size="sm" isFavorite={favorites.includes(s.number)} />
                  <span className="text-xs font-bold text-red-500 mt-1">{s.lastSeen}j</span>
                </div>
              ))}
          </div>
        </div>
      </div>
    );
  };

  const renderPredictionView = () => (
    <div className="space-y-5 animate-fade-in">
       <div className="p-4 bg-gradient-to-r from-blue-600 to-indigo-700 rounded-xl text-white shadow-lg relative overflow-hidden">
          <div className="relative z-10">
            <h3 className="font-bold text-lg mb-1">Algorithmes IA</h3>
            <p className="text-blue-100 text-sm opacity-90">
                Analyse : <span className="font-bold">{analysisMode === 'WINNING' ? 'Tirage Gagnant' : 'Machine'}</span>
                <br/>
                Basé sur {workingData.length} tirages
            </p>
          </div>
          <div className="absolute top-0 right-0 -mt-4 -mr-4 w-24 h-24 bg-white opacity-10 rounded-full"></div>
       </div>

      {predictions.map((pred, idx) => (
        <div key={idx} className={`relative p-5 rounded-xl border transition-all duration-300 ${
            pred.method === 'Hybrid' 
              ? 'bg-white border-blue-500 shadow-md ring-4 ring-blue-500/5' 
              : 'bg-white border-slate-200 shadow-sm'
          }`}>
          {pred.method === 'Hybrid' && (
             <div className="absolute -top-3 right-4 flex gap-2">
                 <span className="bg-blue-600 text-white text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-wide shadow-sm">
                    Recommandé
                 </span>
                 <button 
                    onClick={() => handleSharePrediction(pred.numbers, pred.method)}
                    className="bg-indigo-500 hover:bg-indigo-600 text-white p-1 rounded-full shadow-sm transition-colors"
                    title="Partager"
                 >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>
                 </button>
             </div>
          )}
          
          <div className="flex justify-between items-end mb-4">
            <div>
               <h4 className={`font-bold text-base ${pred.method === 'Hybrid' ? 'text-blue-900' : 'text-slate-700'}`}>
                 {pred.method === 'Bayesian Analysis' ? 'Analyse Bayésienne' : pred.method}
               </h4>
               <p className="text-[10px] text-slate-400 max-w-[200px] leading-tight mt-1">
                 {pred.method === 'Random Forest' && 'Validation des interactions (Forêt Aléatoire)'}
                 {pred.method === 'Decision Tree' && 'Analyse statistique écarts/fréquence'}
                 {pred.method === 'Neural Network' && 'Pattern Temporel (Réseau de Neurones)'}
                 {pred.method === 'Bayesian Analysis' && 'Probabilités Conditionnelles (Suites Logiques)'}
                 {pred.method === 'Hybrid' && 'Agrégation pondérée de tous les modèles'}
               </p>
            </div>
            <div className="text-right">
               <span className={`text-xl font-black ${pred.confidence > 0.8 ? 'text-green-600' : 'text-blue-600'}`}>
                 {(pred.confidence * 100).toFixed(0)}%
               </span>
               <p className="text-[10px] text-slate-400">Probabilité</p>
            </div>
          </div>

          <div className="flex gap-2 justify-between sm:justify-start">
            {pred.numbers.map((n, i) => (
               <div key={i} className="flex flex-col items-center">
                 <Ball number={n} size="md" isFavorite={favorites.includes(n)} />
               </div>
            ))}
          </div>
        </div>
      ))}
      
      {workingData.length < 5 && (
        <div className="text-center text-xs text-slate-400 p-4">
          Données insuffisantes pour des prédictions fiables. {analysisMode === 'MACHINE' && 'Vérifiez si des données Machine sont disponibles.'}
        </div>
      )}
    </div>
  );

  const renderAdminView = () => {
    if (!isAdminAuth) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[300px] space-y-4 animate-fade-in">
          <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center text-slate-400">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
          </div>
          <h3 className="font-bold text-slate-800">Accès Administrateur</h3>
          <div className="flex gap-2">
            <input 
              type="password" 
              value={adminPin}
              onChange={(e) => setAdminPin(e.target.value)}
              placeholder="Code PIN" 
              className="border border-slate-300 rounded-lg px-3 py-2 w-32 text-center focus:ring-blue-500 outline-none"
            />
            <button onClick={handleAdminLogin} className="bg-blue-900 text-white px-4 py-2 rounded-lg font-medium">
              Entrer
            </button>
          </div>
          <p className="text-xs text-slate-400">Code par défaut: 2025</p>
        </div>
      );
    }

    return (
      <div className="space-y-6 animate-fade-in">
        {/* Add / Edit Form */}
        <div className={`bg-white p-4 rounded-xl shadow-sm border ${editingDraw ? 'border-amber-200 bg-amber-50' : 'border-slate-200'}`}>
          <h3 className="font-semibold text-slate-800 mb-3 flex items-center gap-2">
            {editingDraw ? (
              <>
               <svg className="w-4 h-4 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
               Modifier le Tirage
              </>
            ) : (
              <>
               <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
               Ajouter un Tirage
              </>
            )}
          </h3>
          <div className="space-y-3">
             <div className="text-sm text-slate-500">
               Jeu : <span className="font-bold text-blue-900">{selectedDrawName}</span>
             </div>
             <input 
               type="date" 
               value={newDrawDate}
               onChange={(e) => setNewDrawDate(e.target.value)}
               disabled={!!editingDraw} // Can't change date as it's part of the key
               className="w-full border border-slate-300 rounded-lg p-2 text-sm disabled:bg-slate-100 disabled:text-slate-400"
             />
             <input 
               type="text" 
               value={newDrawNumbers}
               onChange={(e) => setNewDrawNumbers(e.target.value)}
               placeholder="Ex: 10, 25, 33, 45, 88"
               className="w-full border border-slate-300 rounded-lg p-2 text-sm"
             />
             <div className="flex gap-2">
               {editingDraw && (
                 <button 
                   onClick={handleCancelEdit}
                   className="flex-1 bg-slate-200 text-slate-700 py-2 rounded-lg font-medium hover:bg-slate-300 transition-colors"
                 >
                   Annuler
                 </button>
               )}
               <button 
                 onClick={handleSaveDraw}
                 className={`flex-1 py-2 rounded-lg font-medium text-white transition-colors ${editingDraw ? 'bg-amber-600 hover:bg-amber-700' : 'bg-green-600 hover:bg-green-700'}`}
               >
                 {editingDraw ? 'Mettre à jour' : 'Enregistrer'}
               </button>
             </div>
          </div>
        </div>

        {/* Import/Export */}
        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
           <h3 className="font-semibold text-slate-800 mb-3">Gestion des Données</h3>
           <div className="grid grid-cols-2 gap-3">
             <button onClick={handleExportJSON} className="flex flex-col items-center justify-center p-3 border border-blue-100 bg-blue-50 rounded-lg text-blue-800 hover:bg-blue-100 transition-colors">
               <svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
               <span className="text-xs font-bold">Sauvegarder JSON</span>
             </button>
             <label className="flex flex-col items-center justify-center p-3 border border-amber-100 bg-amber-50 rounded-lg text-amber-800 hover:bg-amber-100 transition-colors cursor-pointer">
               <svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
               <span className="text-xs font-bold">Restaurer JSON</span>
               <input type="file" accept=".json" onChange={handleImportJSON} className="hidden" />
             </label>
           </div>
        </div>

        {/* List for Management */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="px-4 py-3 bg-slate-50 border-b border-slate-200">
             <h3 className="font-semibold text-slate-700 text-sm">Modifier / Supprimer</h3>
          </div>
          <div className="max-h-60 overflow-y-auto divide-y divide-slate-100">
             {results.map((draw) => (
               <div key={`${draw.date}-del`} className="px-4 py-3 flex justify-between items-center hover:bg-slate-50 transition-colors">
                  <div onClick={() => handleEditClick(draw)} className="cursor-pointer flex-1">
                    <div className="text-xs font-bold text-slate-700">{draw.date}</div>
                    <div className="text-[10px] text-slate-400">{draw.gagnants.join('-')}</div>
                  </div>
                  <button 
                    onClick={() => handleDeleteDraw(draw.date)}
                    className="text-red-500 hover:text-red-700 p-2 border border-red-100 rounded bg-white hover:bg-red-50"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  </button>
               </div>
             ))}
          </div>
        </div>
      </div>
    );
  };

  return (
    <Layout title="LotoBonheur Analytics" selectedDay={selectedDay}>
      {/* Toast */}
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      
      {/* Help Modal */}
      <HelpModal isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} />

      {/* Top Controls */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 space-y-4 mb-4">
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
          {DRAW_SCHEDULE.map((schedule) => (
            <button
              key={schedule.day}
              onClick={() => setSelectedDay(schedule.day)}
              className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap ${
                selectedDay === schedule.day
                  ? 'bg-slate-900 text-white shadow-md scale-105'
                  : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
              }`}
            >
              {schedule.day}
            </button>
          ))}
        </div>
        
        <div className="flex gap-2 items-center">
           <div className="relative group flex-grow">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <span className="text-slate-400">🕒</span>
            </div>
            <select 
                value={selectedDrawName}
                onChange={(e) => setSelectedDrawName(e.target.value)}
                className="w-full pl-10 pr-8 py-3 bg-slate-50 border border-slate-200 text-slate-900 text-sm font-medium rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all appearance-none"
            >
                {drawsForDay.map((draw) => (
                <option key={draw.name} value={draw.name}>
                    {draw.time} — {draw.name}
                </option>
                ))}
            </select>
            <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none text-slate-500">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
            </div>
          </div>
          
          {/* Analysis Mode Toggle */}
          <div className="bg-slate-100 p-1 rounded-lg flex shadow-inner">
             <button 
               onClick={() => setAnalysisMode('WINNING')}
               className={`p-2 rounded-md transition-all ${analysisMode === 'WINNING' ? 'bg-white shadow text-blue-900' : 'text-slate-400 hover:text-slate-600'}`}
               title="Analyser les Gagnants"
             >
               <span className="text-xs font-bold">G</span>
             </button>
             <button 
               onClick={() => setAnalysisMode('MACHINE')}
               className={`p-2 rounded-md transition-all ${analysisMode === 'MACHINE' ? 'bg-white shadow text-amber-700' : 'text-slate-400 hover:text-slate-600'}`}
               title="Analyser la Machine"
             >
               <span className="text-xs font-bold">M</span>
             </button>
          </div>

          {/* Help Button */}
          <button 
            onClick={() => setIsHelpOpen(true)}
            className="p-3 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors"
            title="Guide"
          >
             <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          </button>
        </div>
      </div>

      {/* PWA Install */}
      {installPrompt && (
        <button 
          onClick={handleInstall}
          className="w-full mb-4 bg-gradient-to-r from-pink-600 to-purple-600 text-white font-bold py-3 px-4 rounded-xl shadow-lg flex items-center justify-center gap-2 active:scale-95 transition-transform"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
          Installer l'application
        </button>
      )}

      {renderTabs()}

      <div className="min-h-[400px] pb-20">
        {activeTab === TabView.DATA && renderDataView()}
        {activeTab === TabView.CONSULT && renderConsultView()}
        {activeTab === TabView.STATS && renderStatsView()}
        {activeTab === TabView.PREDICTION && renderPredictionView()}
        {activeTab === TabView.ADMIN && renderAdminView()}
      </div>
    </Layout>
  );
};

export default App;
