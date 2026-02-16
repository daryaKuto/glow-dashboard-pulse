import React from 'react';
import { Card, CardContent } from '@/components/ui/card';

// Single unified skeleton matching the accordion wizard structure (Phase 3).
// Replaces the old StepOneSkeleton, StepTwoSkeleton, StepThreeSkeleton.
export const SetupWizardSkeleton: React.FC = () => (
  <Card className="bg-gradient-to-br from-white via-white to-brand-primary/[0.04] shadow-card rounded-[var(--radius-lg)]">
    <CardContent className="p-5 md:p-6 animate-pulse space-y-4">
      {/* Progress bar */}
      <div className="flex gap-1.5">
        <div className="flex-1 h-1.5 rounded-full bg-gray-200" />
        <div className="flex-1 h-1.5 rounded-full bg-gray-200" />
        <div className="flex-1 h-1.5 rounded-full bg-gray-200" />
      </div>

      {/* Step 1 header */}
      <div className="flex items-center gap-3 py-2">
        <div className="h-7 w-7 rounded-full bg-gray-200" />
        <div className="space-y-1">
          <div className="h-3 w-12 rounded bg-gray-200" />
          <div className="h-5 w-32 rounded bg-gray-200" />
        </div>
      </div>

      {/* Step 1 content placeholder */}
      <div className="space-y-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-12 rounded-[var(--radius)] bg-gray-200" />
        ))}
      </div>

      <div className="border-t border-[rgba(28,25,43,0.06)]" />

      {/* Step 2 header (collapsed) */}
      <div className="flex items-center gap-3 py-2">
        <div className="h-7 w-7 rounded-full bg-gray-200" />
        <div className="space-y-1">
          <div className="h-3 w-12 rounded bg-gray-200" />
          <div className="h-5 w-24 rounded bg-gray-200" />
        </div>
      </div>

      <div className="border-t border-[rgba(28,25,43,0.06)]" />

      {/* Step 3 header (collapsed) */}
      <div className="flex items-center gap-3 py-2">
        <div className="h-7 w-7 rounded-full bg-gray-200" />
        <div className="space-y-1">
          <div className="h-3 w-12 rounded bg-gray-200" />
          <div className="h-5 w-36 rounded bg-gray-200" />
        </div>
      </div>
    </CardContent>
  </Card>
);

// Keep legacy exports for backward compatibility during migration
export const StepOneSkeleton = SetupWizardSkeleton;
export const StepTwoSkeleton: React.FC = () => null;
export const StepThreeSkeleton: React.FC = () => null;
