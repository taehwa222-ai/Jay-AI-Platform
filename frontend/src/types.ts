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

export type RoadmapPhase = {
  id: string;
  title: string;
  status: string;
  items: string[];
};
