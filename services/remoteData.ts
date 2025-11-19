import { supabase } from './supabaseClient';
import { DrawResult, NumberStats } from '../types';
import { saveDrawsToDB } from './db';

// --- Sync Logic ---

export const syncDrawsWithCloud = async (drawName: string): Promise<boolean> => {
  if (!supabase) return false;

  try {
    // 1. Get latest local date (simplified, assumes we want everything)
    // In a complex app, we'd check 'last_sync' timestamp.
    
    // 2. Fetch missing draws from Cloud
    const { data, error } = await supabase
      .from('draws')
      .select('*')
      .eq('draw_name', drawName)
      .order('date', { ascending: false });

    if (error) throw error;

    if (data && data.length > 0) {
      // Map Supabase rows to App types
      const draws: DrawResult[] = data.map((d: any) => ({
        draw_name: d.draw_name,
        date: d.date,
        gagnants: d.gagnants,
        machine: d.machine
      }));

      // Save to IndexedDB
      await saveDrawsToDB(draws);
      return true;
    }
    return false;
  } catch (e) {
    console.error("Cloud Sync Error:", e);
    return false;
  }
};

export const pushDrawsToCloud = async (draws: DrawResult[]): Promise<number> => {
  if (!supabase) return 0;
  
  try {
    // Supabase 'upsert' handles conflicts on unique keys (draw_name + date)
    const { error, count } = await supabase
      .from('draws')
      .upsert(draws.map(d => ({
        draw_name: d.draw_name,
        date: d.date,
        gagnants: d.gagnants,
        machine: d.machine
      })), { onConflict: 'draw_name, date' });

    if (error) throw error;
    return draws.length; // Approximate success count
  } catch (e) {
    console.error("Cloud Push Error:", e);
    return 0;
  }
};

// --- Server-Side Algorithm Calls ---

export const fetchServerSideStats = async (drawName: string): Promise<NumberStats[] | null> => {
  if (!supabase) return null;

  try {
    // Call the Stored Procedure defined in supabase_schema.sql
    const { data, error } = await supabase.rpc('get_number_stats', { target_draw_name: drawName });

    if (error) throw error;

    // Transform server response to NumberStats
    // Note: Server doesn't calculate detailed partners/nextPartners for all numbers 
    // to save bandwidth, so we might mix this with local data or use it as a base.
    return (data as any[]).map(row => ({
      number: row.number,
      frequency: row.frequency,
      lastSeen: row.last_seen,
      partners: {}, // Server algo simplified for this demo
      nextPartners: {}
    }));
  } catch (e) {
    console.warn("Server Stats unavailable, falling back to local.", e);
    return null;
  }
};
