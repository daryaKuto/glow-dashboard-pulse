export interface GameTemplate {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  category: string | null;
  difficulty: string | null;
  targetCount: number;
  shotsPerTarget: number;
  timeLimitMs: number;
  isActive: boolean;
  isPublic: boolean;
  thingsboardConfig: Record<string, unknown> | null;
  rules: Record<string, unknown> | null;
  createdAt: string | null;
  updatedAt: string | null;
}

// Legacy alias retained for older components that still reference Scenario terminology.
export type Scenario = GameTemplate;
