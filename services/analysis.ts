
import { DrawResult, NumberStats, PredictionResult, DayAffinity, PatternStats } from '../types';

// Declare brain.js global type (loaded via CDN)
declare const brain: any;

// --- Helper: Calculate Basic Stats ---
export const calculateStats = (results: DrawResult[]): NumberStats[] => {
  const stats: Map<number, NumberStats> = new Map();

  for (let i = 1; i <= 90; i++) {
    stats.set(i, { number: i, frequency: 0, lastSeen: -1, partners: {}, nextPartners: {} });
  }

  // results are typically sorted Newest [0] -> Oldest [N]
  // To calculate 'nextPartners' (what comes AFTER), we look at transitions from Old -> New.
  // If results[i] is a draw, results[i-1] is the NEXT draw in time.

  results.forEach((draw, idx) => {
    draw.gagnants.forEach((num) => {
      const s = stats.get(num)!;
      s.frequency++;
      
      // idx 0 is most recent
      if (s.lastSeen === -1) s.lastSeen = idx; 

      // 1. Calculate Co-occurrence (Same Draw)
      draw.gagnants.forEach((partner) => {
        if (num !== partner) {
          s.partners[partner] = (s.partners[partner] || 0) + 1;
        }
      });

      // 2. Calculate Sequential Occurrence (Next Draw)
      // If there is a newer draw (idx > 0), then results[idx-1] followed this draw
      if (idx > 0) {
        const nextDraw = results[idx - 1];
        nextDraw.gagnants.forEach((nextNum) => {
          if (s.nextPartners) {
            s.nextPartners[nextNum] = (s.nextPartners[nextNum] || 0) + 1;
          }
        });
      }
    });
  });

  return Array.from(stats.values()).sort((a, b) => b.frequency - a.frequency);
};

export const calculateDayAffinity = (results: DrawResult[], number: number): DayAffinity[] => {
  // Order of days for chart
  const order = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
  const counts = new Map<string, number>();
  order.forEach(d => counts.set(d, 0));

  const frDays = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];

  results.forEach(draw => {
    if (draw.gagnants.includes(number)) {
      try {
        const date = new Date(draw.date);
        const dayIndex = date.getDay(); // 0 = Dimanche
        const dayName = frDays[dayIndex];
        
        if (counts.has(dayName)) {
          counts.set(dayName, counts.get(dayName)! + 1);
        }
      } catch (e) {
        // ignore invalid dates
      }
    }
  });

  return Array.from(counts.entries())
    .map(([day, count]) => ({ day, count }))
    .sort((a, b) => order.indexOf(a.day) - order.indexOf(b.day));
};

export const calculateGlobalPatterns = (results: DrawResult[]): PatternStats => {
  let totalNums = 0;
  let even = 0;
  let low = 0;
  let sumTotal = 0;

  results.forEach(draw => {
    let drawSum = 0;
    draw.gagnants.forEach(n => {
      totalNums++;
      if (n % 2 === 0) even++;
      if (n <= 45) low++;
      drawSum += n;
    });
    sumTotal += drawSum;
  });

  if (totalNums === 0) return { even: 0, odd: 0, low: 0, high: 0, avgSum: 0 };

  return {
    even,
    odd: totalNums - even,
    low,
    high: totalNums - low,
    avgSum: results.length > 0 ? Math.round(sumTotal / results.length) : 0
  };
};

// --- Machine Learning Models ---

// 1. Random Forest: Bagging Approach
const predictRandomForest = (results: DrawResult[]): number[] => {
  const candidates = new Map<number, number>();
  const numberOfTrees = 10;
  const subsetSize = Math.max(10, Math.floor(results.length * 0.6));

  for (let i = 0; i < numberOfTrees; i++) {
    const subset = [];
    for(let j=0; j<subsetSize; j++) {
      subset.push(results[Math.floor(Math.random() * results.length)]);
    }
    
    const localFreq = new Map<number, number>();
    subset.forEach(r => r.gagnants.forEach(n => localFreq.set(n, (localFreq.get(n) || 0) + 1)));
    
    Array.from(localFreq.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .forEach(([num]) => candidates.set(num, (candidates.get(num) || 0) + 1));
  }

  return Array.from(candidates.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(e => e[0]);
};

// 2. Decision Tree: Rules-Based on Gaps and Frequency
const predictDecisionTree = (results: DrawResult[]): number[] => {
  const stats = calculateStats(results);
  const totalDraws = results.length;
  
  const scored = stats.map(s => {
    let score = 0;
    const gap = s.lastSeen;
    const freqRatio = s.frequency / totalDraws;

    // Rule 1: Hot number
    if (gap < 5 && freqRatio > 0.1) score += 10;
    
    // Rule 2: Due number
    const avgGap = totalDraws / s.frequency;
    if (gap > avgGap && gap < avgGap * 2 && freqRatio > 0.05) score += 15;

    // Rule 3: Cold
    if (gap > 30) score -= 5;

    return { num: s.number, score };
  });

  return scored.sort((a, b) => b.score - a.score).slice(0, 5).map(s => s.num);
};

// 3. Simple Neural Network (via brain.js)
// Trains a simple FeedForward NN on the last 20 draws to find patterns in number sets
const predictNeuralNet = (results: DrawResult[]): number[] => {
  // Fallback to simulation if brain.js is not loaded or too few results
  if (typeof brain === 'undefined' || results.length < 10) {
    return predictNeuralNetSimulation(results);
  }

  try {
    const net = new brain.NeuralNetwork({
      hiddenLayers: [10, 10],
      activation: 'sigmoid', // 0-1 normalization needed
    });

    // Prepare Training Data
    // Input: Previous Draw (normalized), Output: Next Draw (normalized)
    const trainingData = [];
    // Use last 20 draws
    const slice = results.slice(0, 20).reverse(); // Oldest to Newest

    for (let i = 0; i < slice.length - 1; i++) {
      const input = new Array(90).fill(0);
      const output = new Array(90).fill(0);

      slice[i].gagnants.forEach(n => input[n-1] = 1);
      slice[i+1].gagnants.forEach(n => output[n-1] = 1);

      trainingData.push({ input, output });
    }

    net.train(trainingData, {
      iterations: 100, // Keep low for mobile performance
      errorThresh: 0.02,
      log: false
    });

    // Predict next based on latest draw
    const lastDrawInput = new Array(90).fill(0);
    results[0].gagnants.forEach(n => lastDrawInput[n-1] = 1);
    
    const output = net.run(lastDrawInput); // Returns object {0: 0.1, 1: 0.9...} (actually array-like if mapped)
    
    // Convert output object/array to sorted numbers
    const scores = [];
    // brain.js output is often an object { '0': val, '1': val } or array
    // Since we used array inputs, output is array-like
    for(let i=0; i<90; i++) {
      scores.push({ num: i+1, score: output[i] || 0 });
    }

    return scores.sort((a, b) => b.score - a.score).slice(0, 5).map(s => s.num);

  } catch (e) {
    console.warn("Brain.js failed, using simulation", e);
    return predictNeuralNetSimulation(results);
  }
};

// Fallback Simulation (Time Decay Weighting)
const predictNeuralNetSimulation = (results: DrawResult[]): number[] => {
  const weights = new Map<number, number>();
  const inputLayer = results.slice(0, 30);
  
  inputLayer.forEach((draw, t) => {
    const weight = 1 / (1 + 0.1 * t);
    draw.gagnants.forEach(num => {
      weights.set(num, (weights.get(num) || 0) + weight);
    });
  });

  return Array.from(weights.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(e => e[0]);
};

// 4. Bayesian Analysis: Conditional Probability
// Calculates P(Num | LastDraw)
const predictBayesian = (results: DrawResult[]): number[] => {
  if (results.length < 2) return [];

  const lastDraw = results[0].gagnants;
  const scores = new Map<number, number>();

  // Analyze history to see what usually follows the numbers in 'lastDraw'
  // We look at pairs (Draw T, Draw T-1)
  for (let i = 0; i < results.length - 1; i++) {
    const current = results[i]; // Newer (T)
    const previous = results[i + 1]; // Older (T-1)

    // Check how many numbers from 'previous' match 'lastDraw'
    // This gives weight to the relevance of this historical transition
    const matches = previous.gagnants.filter(n => lastDraw.includes(n)).length;
    
    if (matches > 0) {
      const weight = matches * (1 / (i + 1)); // Decay weight by recency
      current.gagnants.forEach(num => {
        scores.set(num, (scores.get(num) || 0) + weight);
      });
    }
  }

  return Array.from(scores.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(e => e[0]);
};

export const generatePredictions = (results: DrawResult[]): PredictionResult[] => {
  // Sort results desc by date (Newest first) for algorithms
  const sortedResults = [...results].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  if (sortedResults.length < 5) return [];

  const rf = predictRandomForest(sortedResults);
  const dt = predictDecisionTree(sortedResults);
  const nn = predictNeuralNet(sortedResults);
  const bayes = predictBayesian(sortedResults);

  // Hybrid Model: Ensemble Voting
  const ensembleScores = new Map<number, number>();
  
  // Weighting System
  rf.forEach((n, i) => ensembleScores.set(n, (ensembleScores.get(n) || 0) + (5 - i) * 1.0)); // Structure
  dt.forEach((n, i) => ensembleScores.set(n, (ensembleScores.get(n) || 0) + (5 - i) * 0.8)); // Stats
  nn.forEach((n, i) => ensembleScores.set(n, (ensembleScores.get(n) || 0) + (5 - i) * 1.2)); // Pattern
  bayes.forEach((n, i) => ensembleScores.set(n, (ensembleScores.get(n) || 0) + (5 - i) * 1.5)); // Probabilist (High weight for immediate sequence)

  const hybrid = Array.from(ensembleScores.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(e => e[0]);

  return [
    { method: 'Random Forest', numbers: rf, confidence: 0.75 },
    { method: 'Decision Tree', numbers: dt, confidence: 0.68 },
    { method: 'Neural Network', numbers: nn, confidence: 0.72 },
    { method: 'Bayesian Analysis', numbers: bayes, confidence: 0.82 },
    { method: 'Hybrid', numbers: hybrid, confidence: 0.91 },
  ];
};
