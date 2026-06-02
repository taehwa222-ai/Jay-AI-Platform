import type {
  HealthStatus,
  RecommendationDefaults,
  RecommendationRequest,
  RecommendationResponse,
  RoadmapPhase,
} from './types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
    ...init,
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Request failed: ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export function getHealth(): Promise<HealthStatus> {
  return request<HealthStatus>('/api/v1/health');
}

export function getDefaults(): Promise<RecommendationDefaults> {
  return request<RecommendationDefaults>('/api/v1/recommendations/defaults');
}

export function runRecommendations(payload: RecommendationRequest): Promise<RecommendationResponse> {
  return request<RecommendationResponse>('/api/v1/recommendations/run', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function getRoadmap(): Promise<RoadmapPhase[]> {
  const response = await request<{ phases: RoadmapPhase[] }>('/api/v1/platform/roadmap');
  return response.phases;
}
