export interface GmplSubmitRequest {
  client_reference: string;
  network: string; // MTN, TELECEL, AIRTELTIGO
  recipient_msisdn: string;
  package_size_mb: number;
  idempotency_key: string;
  callback_url?: string;
  metadata?: Record<string, unknown>;
}

export interface GmplSubmitResponse {
  status: 'ACCEPTED' | 'REJECTED' | 'ERROR';
  order_id: string; // GMPL internal telecom order id
  reference: string;
  created_at: string;
  error_code?: string;
  message?: string;
}

export interface GmplStatusResponse {
  order_id: string;
  reference: string;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'REJECTED';
  network: string;
  recipient_msisdn: string;
  package_size_mb: number;
  completed_at?: string;
  error_code?: string;
  error_message?: string;
}

export interface GmplBeneficiaryResponse {
  status: 'VALID' | 'INVALID' | 'UNKNOWN';
  msisdn: string;
  network: string;
  account_name?: string;
  error_message?: string;
}

export interface GmplWebhookPayload {
  event: 'order.status_updated' | 'order.completed' | 'order.failed';
  event_id: string;
  event_version?: number;
  timestamp: string;
  data: {
    order_id: string;
    reference: string;
    status: 'RECEIVED' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'REJECTED';
    network: string;
    completed_at?: string;
    error_code?: string;
    error_message?: string;
  };
}
