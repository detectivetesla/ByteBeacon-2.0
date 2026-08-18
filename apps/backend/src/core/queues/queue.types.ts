import { NetworkProvider } from '@bytebeacon/shared';

export interface FulfillmentJobData {
  orderId: string;
  correlationId: string;
  network?: NetworkProvider;
  phoneNumber?: string;
  bundleId?: string;
  dataAmountMb?: number;
  idempotencyKey: string;
  attemptCount: number;
}

export interface BulkRecipientItem {
  phoneNumber: string;
  dataSizeGb?: number;
  bundleId?: string;
  recipientIndex: number;
}

export interface BulkChunkJobData {
  batchId: string;
  chunkIndex: number;
  totalChunks: number;
  network: NetworkProvider;
  recipients: BulkRecipientItem[];
  correlationId: string;
  idempotencyKey: string;
  onUnvalidated?: 'set_aside' | 'reject';
}

export interface ReconciliationJobData {
  trigger: 'SCHEDULED' | 'EVENT_DRIVEN';
  lookbackMinutes?: number;
  correlationId: string;
}

export interface AgentWebhookJobData {
  agentId: string;
  targetUrl: string;
  secret: string;
  event: {
    id: string;
    type: string;
    timestamp: string;
    data: Record<string, unknown>;
  };
  correlationId: string;
}
