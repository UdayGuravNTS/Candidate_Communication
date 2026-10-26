import apiService from '../config/apiService';

export interface MessageItem {
  id: string;
  channel: string;
  provider?: string;
  text: string;
  status: string;
  timestamp: string;
  scheduledAt?: string;
  failureReason?: string;
  canRetry?: boolean;
  retryCount?: number;
}

export interface Candidate {
  id: string;
  fullName: string;
  mobileNumber: string;
  email: string;
  lastMessage: string;
  status: string;
  role: string;
  notes: string;
  history: MessageItem[];
}

// GET response (Django pagination format)
interface CandidateListResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: Candidate[];
}

// POST response
interface CandidateResponse {
  status: boolean;
  message: string;
  data: Candidate;
}

export interface CreateCandidatePayload {
  fullName: string;
  mobileNumber: string;
  email: string;
}

// send message
export interface SendResultItem {
  candidateId: string;
  fullName: string;
  messageId: string;
  status: string;
  failureReason: string;
  canRetry: boolean;
}

export interface SendMessageResult {
  candidates: Candidate[];
  results: SendResultItem[];
  summary: { total: number; sent: number; scheduled?: number; failed: number };
}

interface SendMessageResponse {
  status: boolean;
  message: string;
  summary: { total: number; sent: number; scheduled?: number; failed: number };
  results: SendResultItem[];
  data: Candidate[];
}

export interface CandidateListParams {
  page: number;
  pageSize: number;
  search: string;
  status: string;
}

export interface CandidateListResult {
  candidates: Candidate[];
  totalCount: number;
}

export interface SendMessagePayload {
  channel: string;
  provider?: string;
  message: string;
  candidateIds: string[];
  isScheduled: boolean;
  scheduledDate: string | null;
}

export interface MessageTemplate {
  id: number;
  title: string;
  category: string;
  channel: string;
  body: string;
  createdAt?: string;
}

export interface ProviderItem {
  id: string;
  name: string;
  channel: string;
  status: 'operational' | 'degraded' | 'outage';
  latencyMs: number;
  description: string;
}

export interface ProviderHealthResponse {
  status: 'operational' | 'degraded' | 'outage';
  isDown: boolean;
  summary: {
    total: number;
    sent: number;
    delivered: number;
    read: number;
    failed: number;
    scheduled: number;
  };
  providers: ProviderItem[];
  systemMessage: string;
}

export default class CandidateApi {
  static async getCandidates(params: CandidateListParams): Promise<CandidateListResult> {
    const query = new URLSearchParams({
      page: String(params.page),
      page_size: String(params.pageSize),
    });

    if (params.search.trim()) query.set('search', params.search.trim());
    if (params.status !== 'all') query.set('status', params.status);

    const response = await apiService.get<CandidateListResponse>(
      `/Get_candidates_lists/?${query.toString()}`
    );

    if (!Array.isArray(response.results)) {
      throw new Error('The server response is missing the candidate list.');
    }

    return { candidates: response.results, totalCount: response.count };
  }

  static async createCandidate(payload: CreateCandidatePayload): Promise<Candidate> {
    const response = await apiService.post<CandidateResponse>('/candidates/', payload);

    if (!response.data?.id || !response.data.fullName) {
      throw new Error('The server response is missing candidate details.');
    }
    return response.data;
  }

  static async deleteCandidate(candidateId: string): Promise<void> {
    await apiService.delete(`/candidates/delete/${candidateId}/`);
  }

  static async sendMessage(payload: SendMessagePayload): Promise<SendMessageResult> {
    const response = await apiService.post<SendMessageResponse>(
      '/candidates/send-message/',
      payload
    );
    if (!Array.isArray(response.data) || !Array.isArray(response.results)) {
      throw new Error('The server response is missing the send results.');
    }
    return { candidates: response.data, results: response.results, summary: response.summary };
  }

  static async retryMessage(
    messageId: string
  ): Promise<{ candidate: Candidate; message: string; ok: boolean }> {
    const response = await apiService.post<{ status: boolean; message: string; data: Candidate }>(
      `/messages/${messageId}/retry/`,
      {}
    );
    return { candidate: response.data, message: response.message, ok: response.status };
  }

  static async markMessageRead(
    messageId: string | number
  ): Promise<{ candidate: Candidate; message: string; ok: boolean }> {
    const response = await apiService.post<{ status: boolean; message: string; data: Candidate }>(
      `/messages/${messageId}/mark_read/`,
      {}
    );
    return { candidate: response.data, message: response.message, ok: response.status };
  }

  // Bonus Feature A: Message Templates
  static async getTemplates(): Promise<MessageTemplate[]> {
    const response = await apiService.get<{ status: boolean; data: MessageTemplate[] }>(
      '/templates/'
    );
    return response.data || [];
  }

  static async createTemplate(payload: {
    title: string;
    body: string;
    category?: string;
    channel?: string;
  }): Promise<MessageTemplate> {
    const response = await apiService.post<{ status: boolean; data: MessageTemplate }>(
      '/templates/',
      payload
    );
    return response.data;
  }

  static async deleteTemplate(templateId: number): Promise<void> {
    await apiService.delete(`/templates/${templateId}/`);
  }

  // Bonus Feature D & E: Provider Health and Outage Simulation
  static async getProviderHealth(): Promise<ProviderHealthResponse> {
    const response = await apiService.get<ProviderHealthResponse>('/provider/health/');
    return response;
  }

  static async toggleProviderOutage(down: boolean): Promise<ProviderHealthResponse> {
    const response = await apiService.post<{ health: ProviderHealthResponse }>(
      '/provider/toggle-outage/',
      { down }
    );
    return response.health;
  }
}