export interface Scenario {
  id: number;
  name: string;
  targetCount?: number;  // optional for backward compatibility
  difficulty?: string;   // optional for backward compatibility
  duration?: number;     // optional for backward compatibility
  description?: string;  // optional for backward compatibility
} 