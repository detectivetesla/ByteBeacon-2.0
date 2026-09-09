import { apiClient } from './httpClient.js';
import { NetworkProvider } from '@bytebeacon/shared';

export interface BeneficiaryValidationResult {
  phoneNumber: string;
  network: NetworkProvider;
  isValid: boolean;
  isKnown: boolean;
  orderable?: boolean;
  isPorted?: boolean;
  accountName?: string;
}

export interface BeneficiaryItemDto {
  id: string;
  phoneNumber: string;
  network: NetworkProvider;
  accountName?: string;
  status: 'APPROVED' | 'PENDING' | 'REJECTED';
  createdAt: string;
}

export interface BeneficiaryPrecheckItemDto {
  phone: string;
  phoneNumber?: string;
  normalized: string;
  valid: boolean;
  isValid?: boolean;
  known: boolean;
  isKnown?: boolean;
  orderable?: boolean;
  status?: string;
  message?: string;
  isPorted?: boolean;
  accountName?: string;
}

export interface AgentBeneficiaryPrecheckResultDto {
  network: NetworkProvider | string;
  enforced: boolean;
  sandbox: boolean;
  recorded: boolean;
  reason?: string;
  portedCandidates?: string[];
  summary: {
    requested: number;
    unique: number;
    valid: number;
    invalid: number;
    known: number;
    unknown: number;
    orderable?: number;
  };
  unknown: string[];
  results: BeneficiaryPrecheckItemDto[];
}

export interface VerificationJobItemResultDto {
  phone: string;
  phoneNumber?: string;
  normalized: string;
  valid: boolean;
  isValid?: boolean;
  known: boolean;
  isKnown?: boolean;
  orderable?: boolean;
  status: 'APPROVED' | 'UNAPPROVED' | 'REJECTED';
  message: string;
  accountName?: string;
}

export interface VerificationJobStatusResponse {
  jobId: string;
  network: NetworkProvider | string;
  status: 'QUEUED' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  totalRows: number;
  processedRows: number;
  approvedCount: number;
  unapprovedCount: number;
  rejectedCount: number;
  progressPercent: number;
  portedCandidates?: string[];
  results: VerificationJobItemResultDto[];
  error?: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

export const beneficiaryApi = {
  /**
   * Starts an asynchronous beneficiary verification job for Excel/bulk rows.
   * Immediately returns HTTP 202 with jobId.
   */
  startVerificationJob: async (params: {
    network: NetworkProvider | string;
    phoneNumbers: string[];
    record?: boolean;
  }): Promise<VerificationJobStatusResponse> => {
    return apiClient.post('/beneficiaries/verification-jobs', params);
  },

  /**
   * Polls live status, real-time counters, and streaming row results for an active verification job.
   */
  getVerificationJobStatus: async (jobId: string): Promise<VerificationJobStatusResponse> => {
    return apiClient.get(`/beneficiaries/verification-jobs/${jobId}`);
  },

  /**
   * Cancels an ongoing background verification job.
   */
  cancelVerificationJob: async (jobId: string): Promise<{ jobId: string; status: string }> => {
    return apiClient.post(`/beneficiaries/verification-jobs/${jobId}/cancel`);
  },

  /**
   * Public precheck endpoint (up to 10 numbers, no auth needed).
   */
  precheckPublic: async (params: {
    network: NetworkProvider;
    phoneNumbers: string[];
  }): Promise<{
    network: NetworkProvider | string;
    enforced?: boolean;
    reason?: string;
    portedCandidates?: string[];
    summary?: {
      requested: number;
      unique: number;
      valid: number;
      invalid: number;
      known: number;
      unknown: number;
      orderable?: number;
    };
    results: BeneficiaryPrecheckItemDto[];
  }> => {
    return apiClient.post('/orders/beneficiaries/precheck', params, { timeoutMs: 300000 });
  },

  /**
   * Authenticated agent bulk precheck (up to 1000 numbers with opt-in recording).
   */
  precheckAgent: async (params: {
    network: NetworkProvider;
    phoneNumbers: string[];
    record?: boolean;
  }): Promise<AgentBeneficiaryPrecheckResultDto> => {
    return apiClient.post('/agent/beneficiaries/precheck', params, { timeoutMs: 300000 });
  },

  precheck: async (params: {
    phoneNumbers: string[];
    network: NetworkProvider;
    record?: boolean;
  }): Promise<{
    network: NetworkProvider;
    enforced: boolean;
    results: BeneficiaryValidationResult[];
  }> => {
    return apiClient.post('/beneficiaries/precheck', params, { timeoutMs: 300000 });
  },

  /**
   * Records scanned unapproved recipient rows (from Excel or bulk) with their bundle details to Pending MTN Approvals.
   */
  recordUnapproved: async (params: {
    items: Array<{
      phoneNumber: string;
      network?: NetworkProvider | string;
      dataSize?: string;
      dataAmountMb?: number;
      pricePesewas?: number;
      detectedFrom?: string;
    }>;
  }): Promise<{ recorded: number }> => {
    const res = await apiClient.post<{ recorded: number }>('/beneficiaries/record-unapproved', params);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('pending-approvals-updated'));
    }
    return res;
  },

  listBeneficiaries: async (network?: NetworkProvider): Promise<BeneficiaryItemDto[]> => {
    return apiClient.get<BeneficiaryItemDto[]>('/beneficiaries', {
      params: { network },
    });
  },

  listApprovals: async (params?: { network?: string; status?: string; page?: number; limit?: number }): Promise<{ items: any[]; total?: number }> => {
    return apiClient.get('/beneficiaries/approvals', { params });
  },

  approveBeneficiary: async (id: string): Promise<any> => {
    return apiClient.post(`/beneficiaries/approvals/${id}/approve`);
  },

  rejectBeneficiary: async (id: string): Promise<any> => {
    return apiClient.post(`/beneficiaries/approvals/${id}/reject`);
  },

  validatePhoneNumber: async (params: { phoneNumber: string; network: NetworkProvider }): Promise<any> => {
    return apiClient.post('/beneficiaries/validate', params, { timeoutMs: 30000 });
  },

  getBeneficiaryStatus: async (phone: string, network?: NetworkProvider): Promise<any> => {
    return apiClient.get(`/beneficiaries/${encodeURIComponent(phone)}`, {
      params: { network },
    });
  },

  syncBeneficiary: async (phoneNumber: string, network: NetworkProvider): Promise<any> => {
    return apiClient.post('/beneficiaries/precheck', {
      phoneNumbers: [phoneNumber],
      network,
      record: true,
    }, { timeoutMs: 300000 });
  },

  getPendingCount: async (): Promise<{ pendingCount: number }> => {
    return apiClient.get<{ pendingCount: number }>('/beneficiaries/pending-count');
  },

  syncApprovalsWithProvider: async (params?: {
    network?: string;
    status?: string;
    search?: string;
  }): Promise<{
    synced: number;
    approved: number;
    rejected: number;
    submitted: number;
    pending: number;
  }> => {
    return apiClient.post('/beneficiaries/approvals/sync', params || {}, { timeoutMs: 60000 });
  },
};


