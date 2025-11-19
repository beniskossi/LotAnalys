import { DrawResult } from '../types';
import { parse } from 'date-fns';
import { saveDrawsToDB, getDrawsFromDB } from './db';

// Mock Data Generator for Fallback
const generateMockData = (drawName: string): DrawResult[] => {
  const results: DrawResult[] = [];
  const today = new Date();
  
  for (let i = 0; i < 100; i++) { // 100 draws history
    const date = new Date(today);
    date.setDate(date.getDate() - i * 7); 
    
    const gagnants = Array.from({ length: 5 }, () => Math.floor(Math.random() * 90) + 1);
    const machine = Array.from({ length: 5 }, () => Math.floor(Math.random() * 90) + 1);
    
    results.push({
      id: i,
      draw_name: drawName,
      date: date.toISOString().split('T')[0],
      gagnants,
      machine: Math.random() > 0.2 ? machine : undefined,
    });
  }
  return results;
};

export async function fetchLotteryResults(drawName: string, month?: string): Promise<DrawResult[]> {
  const baseUrl = 'https://lotobonheur.ci/api/results';
  const url = month ? `${baseUrl}?month=${month}` : baseUrl;

  try {
    // Try Network First
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json',
      },
    });

    if (!response.ok) throw new Error('Network response was not ok');

    const resultsData = await response.json();
    if (!resultsData.success) throw new Error('API response not successful');

    const drawsResultsWeekly = resultsData.drawsResultsWeekly || [];
    const validDrawNames = new Set<string>(resultsData.drawTypes || []);
    
    const allParsedDraws: DrawResult[] = [];

    // Process ALL data found in response to cache everything
    for (const week of drawsResultsWeekly) {
      for (const dailyResult of week.drawResultsDaily) {
        const dateStr = dailyResult.date;
        let drawDate: string;

        try {
          // "jeudi 18/09" -> "18/09"
          const parts = dateStr.split(' ');
          const dayMonth = parts.length > 1 ? parts[1] : parts[0];
          const [day, m] = dayMonth.split('/');
          
          // Handle Year Rollover (e.g., Scraping Dec in Jan)
          const now = new Date();
          let year = now.getFullYear();
          const monthIndex = parseInt(m) - 1; // 0-11
          
          // If currently Jan (0) and data is Dec (11), it was last year
          if (now.getMonth() === 0 && monthIndex === 11) {
            year = year - 1;
          }

          const parsedDate = parse(`${day}/${m}/${year}`, 'dd/MM/yyyy', new Date());
          drawDate = parsedDate.toISOString().split('T')[0];
        } catch (e) {
          console.warn(`Date parsing error: ${dateStr}`, e);
          continue;
        }

        const allDraws = [
          ...(dailyResult.drawResults.standardDraws || []),
          ...(dailyResult.drawResults.nightDraws || [])
        ];

        for (const draw of allDraws) {
          if (validDrawNames.has(draw.drawName)) {
             const winningNumbers = (draw.winningNumbers?.match(/\d+/g) || []).map(Number).slice(0, 5);
             const machineNumbers = (draw.machineNumbers?.match(/\d+/g) || []).map(Number).slice(0, 5);

             if (winningNumbers.length === 5) {
               allParsedDraws.push({
                 draw_name: draw.drawName,
                 date: drawDate,
                 gagnants: winningNumbers,
                 machine: machineNumbers.length === 5 ? machineNumbers : undefined,
               });
             }
          }
        }
      }
    }

    // Save all parsed draws to IndexedDB for offline use
    if (allParsedDraws.length > 0) {
      await saveDrawsToDB(allParsedDraws);
    }

    // Filter for the requested draw
    const filteredResults = allParsedDraws.filter(d => d.draw_name === drawName);

    if (filteredResults.length === 0) throw new Error('No specific results found in fresh data');
    return filteredResults;

  } catch (error) {
    console.warn("Network failed or empty, checking IndexedDB...", error);
    
    // Fallback: Check IndexedDB
    const cachedDraws = await getDrawsFromDB(drawName);
    if (cachedDraws && cachedDraws.length > 0) {
      console.log("Loaded from IndexedDB");
      return cachedDraws;
    }

    // Final Fallback: Mock Data
    console.log("Using Mock Data (Offline/Demo Mode)");
    return generateMockData(drawName);
  }
}

export const getResultsForDraw = async (drawName: string, forceRefresh = false): Promise<DrawResult[]> => {
  // If forceRefresh is false, we could theoretically check DB first, 
  // but our policy is Network First -> DB -> Mock.
  return fetchLotteryResults(drawName);
};