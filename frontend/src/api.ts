import type {
  AuthResponse,
  HealthStatus,
  LoginPayload,
  ManualSection,
  MonetizationIdea,
  PlatformModule,
  PlatformOverview,
  RoadmapPhase,
  SignupPayload,
  UserAccount,
} from './types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '';

async function request<T>(path: string, init?: RequestInit, token?: string): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
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

export function getOverview(): Promise<PlatformOverview> {
  return request<PlatformOverview>('/api/v1/platform/overview');
}

export async function getModules(): Promise<PlatformModule[]> {
  const response = await request<{ modules: PlatformModule[] }>('/api/v1/platform/modules');
  return response.modules;
}

export async function getManual(): Promise<ManualSection[]> {
  const response = await request<{ sections: ManualSection[] }>('/api/v1/platform/manual');
  return response.sections;
}

export async function getMonetizationIdeas(): Promise<MonetizationIdea[]> {
  const response = await request<{ ideas: MonetizationIdea[] }>('/api/v1/platform/monetization');
  return response.ideas;
}

export async function getRoadmap(): Promise<RoadmapPhase[]> {
  const response = await request<{ phases: RoadmapPhase[] }>('/api/v1/platform/roadmap');
  return response.phases;
}

export function signup(payload: SignupPayload): Promise<AuthResponse> {
  return request<AuthResponse>('/api/v1/auth/signup', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function login(payload: LoginPayload): Promise<AuthResponse> {
  return request<AuthResponse>('/api/v1/auth/login', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function getMe(token: string): Promise<UserAccount> {
  return request<UserAccount>('/api/v1/auth/me', undefined, token);
}

export function getAdminUsers(token: string): Promise<UserAccount[]> {
  return request<UserAccount[]>('/api/v1/admin/users', undefined, token);
}
