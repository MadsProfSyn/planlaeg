import Papa from 'papaparse';
import { supabase } from '@/integrations/supabase/client';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export interface CSVData {
  headers: string[];
  rows: any[][];
  rowCount: number;
}

interface QueryOptions {
  messages: Message[];
  mode: 'text' | 'data' | 'actions';
  csvPreview?: {
    headers: string[];
    rowCount: number;
  };
  streaming: boolean;
}

const MAX_ROWS = 1000;
const MAX_COLUMNS = 50;

export async function queryProfSynAI(options: QueryOptions): Promise<Response> {
  // For streaming, use direct fetch to get the stream
  if (options.streaming) {
    const { data: { session } } = await supabase.auth.getSession();
    const response = await fetch(
      `https://wtkyxxfeubpadivllowr.supabase.co/functions/v1/profsyn-ai-query`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token || ''}`,
        },
        body: JSON.stringify(options),
      }
    );
    return response;
  }

  // For non-streaming, use the SDK
  const { data, error } = await supabase.functions.invoke('profsyn-ai-query', {
    body: options,
  });

  if (error) throw error;

  // Wrap the data in a Response
  return new Response(JSON.stringify(data), {
    headers: { 'Content-Type': 'application/json' },
  });
}

export function parseCSVFile(file: File): Promise<CSVData> {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      complete: (results) => {
        if (!results.data || results.data.length === 0) {
          reject(new Error('Ingen data fundet i CSV-filen'));
          return;
        }

        const headers = results.data[0] as string[];
        const rows = results.data.slice(1) as any[][];

        if (headers.length > MAX_COLUMNS) {
          reject(new Error(`For mange kolonner (maks ${MAX_COLUMNS})`));
          return;
        }

        if (rows.length > MAX_ROWS) {
          reject(new Error(`For mange rækker (maks ${MAX_ROWS})`));
          return;
        }

        resolve({
          headers,
          rows,
          rowCount: rows.length,
        });
      },
      error: (error) => {
        reject(error);
      },
    });
  });
}
