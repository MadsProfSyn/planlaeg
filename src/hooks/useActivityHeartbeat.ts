import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export function useActivityHeartbeat() {
  const { session } = useAuth();
  const timerRef = useRef<number | null>(null);
  const runningRef = useRef(false);

  useEffect(() => {
    if (!session) {
      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      runningRef.current = false;
      return;
    }

    const sendHeartbeat = async () => {
      try {
        await supabase.rpc('record_heartbeat');
      } catch (err) {
        // Intentionally silent to avoid noisy logs
      }
    };

    const start = () => {
      if (runningRef.current) return;
      runningRef.current = true;
      // send immediately and then every 60s
      sendHeartbeat();
      const tick = () => {
        sendHeartbeat();
        timerRef.current = window.setTimeout(tick, 60_000);
      };
      timerRef.current = window.setTimeout(tick, 60_000);
    };

    const stop = () => {
      runningRef.current = false;
      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };

    const handleVis = () => {
      if (document.visibilityState === 'visible') start();
      else stop();
    };

    if (document.visibilityState === 'visible') start();

    document.addEventListener('visibilitychange', handleVis);
    window.addEventListener('focus', start);
    window.addEventListener('blur', stop);

    return () => {
      stop();
      document.removeEventListener('visibilitychange', handleVis);
      window.removeEventListener('focus', start);
      window.removeEventListener('blur', stop);
    };
  }, [session]);
}
