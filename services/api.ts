import { DrawResult } from '../types';
import { parse } from 'date-fns';
import { saveDrawsToDB, getDrawsFromDB } from './db';
import { supabase } from './supabaseClient';

// NOTE: STRICTLY NO MOCK DATA. REAL DATA ONLY.

export async function fetchLotteryResults(drawName: string, month?: string): Promise<DrawResult[]> {
  const baseUrl = 'https://lotobonheur.ci/api/results';
  const url = month ? `${baseUrl}?month=${month}` : baseUrl;

  try {
    // 1. Try Supabase (Cloud - Fastest & Shared)
    if (supabase) {
        const { data, error } = await supabase
            .from('draws')
            .select('*')
            .eq('draw_name', drawName)
            .order('date', { ascending: false });
        
        if (!error && data && data.length > 0) {
            // Convert Supabase format to App format if needed, or ensure types match
            return data as DrawResult[];
        }
    }

    // 2. Try Network (Scraping Source)
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json',
      },
    });

    if (response.ok) {
        const resultsData = await response.json();
        if (resultsData.success) {
            const drawsResultsWeekly = resultsData.drawsResultsWeekly || [];
            const validDrawNames = new Set<string>(resultsData.drawTypes || []);
            
            const allParsedDraws: DrawResult[] = [];

            for (const week of drawsResultsWeekly) {
            for (const dailyResult of week.drawResultsDaily) {
                const dateStr = dailyResult.date;
                let drawDate: string;

                try {
                const parts = dateStr.split(' ');
                const dayMonth = parts.length > 1 ? parts[1] : parts[0];
                const [day, m] = dayMonth.split('/');
                
                const now = new Date();
                let year = now.getFullYear();
                const monthIndex = parseInt(m) - 1;
                
                if (now.getMonth() === 0 && monthIndex === 11) {
                    year = year - 1;
                }

                const parsedDate = parse(`${day}/${m}/${year}`, 'dd/MM/yyyy', new Date());
                drawDate = parsedDate.toISOString().split('T')[0];
                } catch (e) {
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

            // Save to IndexedDB
            if (allParsedDraws.length > 0) {
                await saveDrawsToDB(allParsedDraws);
                
                // Optional: Sync to Supabase here if user is admin
            }

            const filteredResults = allParsedDraws.filter(d => d.draw_name === drawName);
            if (filteredResults.length > 0) return filteredResults;
        }
    }

    throw new Error('Network fetch failed or empty');

  } catch (error) {
    console.warn("Network failed, checking IndexedDB...", error);
    
    // 3. Fallback: Check IndexedDB (Local Cache)
    const cachedDraws = await getDrawsFromDB(drawName);
    if (cachedDraws && cachedDraws.length > 0) {
      console.log("Loaded from IndexedDB");
      return cachedDraws;
    }

    // 4. Final State: No Data.
    // We DO NOT generate mock data. We return empty or throw.
    console.warn("No real data available.");
    return [];
  }
}

export const getResultsForDraw = async (drawName: string): Promise<DrawResult[]> => {
  return fetchLotteryResults(drawName);
};
