interface ZapierSynPayload {
  // Identification
  inspection_id: string;
  monday_item_id: number | null;
  
  // Inspector details
  inspector_id: string;
  inspector_name: string;
  
  // Scheduling
  scheduled_date: string; // ISO8601: 2025-11-10
  start_time: string; // ISO8601: 2025-11-10T09:00:00Z
  end_time: string; // ISO8601: 2025-11-10T11:30:00Z
  
  // Inspection details
  inspection_type: string;
  address: string;
  customer_name: string | null;
  department: string;
  rooms: number;
  lease_number: string | null;
  
  // Metadata
  approved_at: string; // ISO8601 timestamp
  vrp_run_id: string;
}

interface ZapierWebhookResponse {
  success: boolean;
  error?: string;
}

const ZAPIER_WEBHOOK_URL = "https://hooks.zapier.com/hooks/catch/14031399/u8y3khi/";
const MAX_RETRIES = 3;
const RETRY_DELAYS = [1000, 2000, 4000]; // 1s, 2s, 4s

/**
 * Send inspection approval data to Zapier webhook with retry logic
 */
export async function sendToZapierWebhook(
  payload: ZapierSynPayload,
  retryCount = 0
): Promise<ZapierWebhookResponse> {
  try {
    console.log(`[Zapier] Sending payload (attempt ${retryCount + 1}/${MAX_RETRIES + 1}):`, payload);
    
    const response = await fetch(ZAPIER_WEBHOOK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Webhook-Event": "godkend_syn",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    console.log("[Zapier] Webhook sent successfully");
    return { success: true };
    
  } catch (error) {
    console.error(`[Zapier] Attempt ${retryCount + 1} failed:`, error);
    
    // Retry logic
    if (retryCount < MAX_RETRIES) {
      const delay = RETRY_DELAYS[retryCount];
      console.log(`[Zapier] Retrying in ${delay}ms...`);
      
      await new Promise(resolve => setTimeout(resolve, delay));
      return sendToZapierWebhook(payload, retryCount + 1);
    }
    
    // Max retries exceeded
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Send multiple syn approvals to Zapier (batch)
 */
export async function sendBatchToZapier(
  payloads: ZapierSynPayload[]
): Promise<{ success: number; failed: number }> {
  const results = await Promise.allSettled(
    payloads.map(payload => sendToZapierWebhook(payload))
  );
  
  const success = results.filter(
    r => r.status === "fulfilled" && r.value.success
  ).length;
  
  const failed = results.length - success;
  
  return { success, failed };
}

export type { ZapierSynPayload };
