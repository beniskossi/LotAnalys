
import React from 'react';

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const HelpModal: React.FC<HelpModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose}></div>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] overflow-y-auto relative animate-fade-in">
        <div className="sticky top-0 bg-white p-4 border-b flex justify-between items-center z-10">
          <h2 className="text-lg font-bold text-slate-800">Guide d'Analyse</h2>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-100">
            <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        
        <div className="p-6 space-y-6 text-sm text-slate-600">
          <section>
            <h3 className="font-bold text-blue-900 mb-2 flex items-center gap-2">
              <span className="w-6 h-6 rounded bg-blue-100 text-blue-700 flex items-center justify-center text-xs">1</span>
              Statistiques
            </h3>
            <p className="mb-2">
              <strong className="text-slate-800">Fréquence :</strong> Nombre total de fois qu'un numéro est sorti.
            </p>
            <p className="mb-2">
              <strong className="text-slate-800">Écart :</strong> Nombre de tirages écoulés depuis la dernière sortie. Un écart élevé (rouge) indique qu'un numéro est "dû".
            </p>
            <p>
              <strong className="text-slate-800">Pattern :</strong> Analyse de l'équilibre Pair/Impair et Bas/Haut (1-45 vs 46-90). Un tirage équilibré a souvent une somme autour de 225.
            </p>
          </section>

          <section>
            <h3 className="font-bold text-blue-900 mb-2 flex items-center gap-2">
              <span className="w-6 h-6 rounded bg-blue-100 text-blue-700 flex items-center justify-center text-xs">2</span>
              Prédictions IA
            </h3>
            <ul className="list-disc pl-5 space-y-2">
              <li><strong className="text-slate-800">Random Forest :</strong> Simule des milliers d'arbres de décision pour trouver les combinaisons les plus probables.</li>
              <li><strong className="text-slate-800">Neural Network :</strong> Réseau de neurones qui apprend les séquences temporelles des 20 derniers tirages.</li>
              <li><strong className="text-slate-800">Analyse Bayésienne :</strong> Calcule mathématiquement la probabilité qu'un numéro sorte sachant le tirage précédent (suites logiques).</li>
              <li><strong className="text-slate-800">Hybride :</strong> Combine tous les modèles. C'est la recommandation la plus fiable.</li>
            </ul>
          </section>

          <section>
            <h3 className="font-bold text-blue-900 mb-2 flex items-center gap-2">
              <span className="w-6 h-6 rounded bg-blue-100 text-blue-700 flex items-center justify-center text-xs">3</span>
              Modes d'Analyse
            </h3>
            <p>
              Vous pouvez basculer entre l'analyse des numéros <strong className="text-blue-900">Gagnants</strong> et des numéros <strong className="text-amber-700">Machine</strong> via les boutons <strong>G</strong> et <strong>M</strong> en haut de l'écran.
            </p>
          </section>
        </div>

        <div className="p-4 border-t bg-slate-50 text-center">
          <button onClick={onClose} className="bg-blue-900 text-white px-6 py-2 rounded-lg font-medium w-full">
            Compris
          </button>
        </div>
      </div>
    </div>
  );
};

export default HelpModal;
