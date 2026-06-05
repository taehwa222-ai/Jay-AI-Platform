export type HealthStatus = {
  ok: boolean;
  app: string;
  env: string;
  time: string;
};

export type PlatformOverview = {
  name: string;
  status: string;
  message: string;
  modules: string[];
};

export type PlatformModule = {
  id: string;
  title: string;
  status: string;
  description: string;
  items: string[];
};

export type ManualSection = {
  id: string;
  title: string;
  summary: string;
  commands: string[];
  checks: string[];
};

export type MonetizationIdea = {
  id: string;
  title: string;
  model: string;
  risk: string;
  next_step: string;
};

export type RoadmapPhase = {
  id: string;
  title: string;
  status: string;
  items: string[];
};
