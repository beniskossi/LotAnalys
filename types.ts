export interface DrawResult {
  id?: number;
  draw_name: string;
  date: string; // ISO string YYYY-MM-DD
  gagnants: number[];
  machine?: number[];
}

export interface DrawDefinition {
  name: string;
  time: string;
}

export interface DaySchedule {
  day: string;
  draws: DrawDefinition[];
}

export enum TabView {
  DATA = 'Données',
  CONSULT = 'Consulter',
  STATS = 'Statistiques',
  PREDICTION = 'Prédiction',
  ADMIN = 'Admin',
}

export interface NumberStats {
  number: number;
  frequency: number;
  lastSeen: number; // days ago
  partners: Record<number, number>; // number -> count (Same draw)
  nextPartners?: Record<number, number>; // number -> count (Next draw)
}

export interface DayAffinity {
  day: string;
  count: number;
}

export interface PatternStats {
  even: number; // count
  odd: number; // count
  low: number; // 1-45
  high: number; // 46-90
  avgSum: number;
}

export interface PredictionResult {
  method: 'Random Forest' | 'Decision Tree' | 'Neural Network' | 'Bayesian Analysis' | 'Hybrid';
  numbers: number[];
  confidence: number;
}

export interface RegularityStat {
  number: number;
  gaps: number[]; // Les derniers écarts (ex: [4, 4, 5])
  avgGap: number; // Écart moyen
  consistency: number; // Score de régularité (0 = parfait)
  nextExpectedIn: number; // Estimation du prochain tirage (négatif = en retard)
}
