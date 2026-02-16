import React, { useState } from 'react';
import { motion } from 'framer-motion';

export type SetupStepTwoProps = {
  canAdvanceToDuration: boolean;
  isSessionLocked: boolean;
  isDurationUnlimited: boolean;
  durationInputValue: string;
  formattedDurationLabel: string;
  onDurationInputValueChange: (value: string) => void;
  onToggleDurationUnlimited: (unlimited: boolean) => void;
  /** Called when the user picks a duration pill or "No limit" — advances to Step 3. */
  onConfirm?: () => void;
};

const DURATION_OPTIONS = [
  { label: '30s', value: 30 },
  { label: '1m', value: 60 },
  { label: '2m', value: 120 },
  { label: '5m', value: 300 },
] as const;

// Step 2 content: inline duration pills with collapsible custom input.
// Rendered inside the SetupStep accordion wrapper in games-page.tsx.
const _SetupStepTwo: React.FC<SetupStepTwoProps> = ({
  canAdvanceToDuration,
  isSessionLocked,
  isDurationUnlimited,
  durationInputValue,
  formattedDurationLabel,
  onDurationInputValueChange,
  onToggleDurationUnlimited,
  onConfirm,
}) => {
  const [showCustom, setShowCustom] = useState(false);

  if (!canAdvanceToDuration) {
    return (
      <div className="text-sm text-brand-dark/40 font-body text-center py-4">
        Complete Step 1 to configure the game duration.
      </div>
    );
  }

  const selectedValue = isDurationUnlimited
    ? 0
    : parseInt(durationInputValue, 10) || 0;

  // Check if current value matches a preset pill
  const isPresetSelected = DURATION_OPTIONS.some((o) => o.value === selectedValue);
  const isCustomValue = !isDurationUnlimited && !isPresetSelected && selectedValue > 0;

  return (
    <div className="space-y-3">
      {/* Quick duration pills */}
      <div className="flex gap-1.5 flex-wrap">
        {DURATION_OPTIONS.map((option) => (
          <button
            key={option.value}
            onClick={() => {
              onDurationInputValueChange(String(option.value));
              setShowCustom(false);
              onConfirm?.();
            }}
            disabled={isSessionLocked}
            className={`rounded-full px-4 py-2 text-sm font-medium font-body transition-all duration-200 ${
              selectedValue === option.value && !isDurationUnlimited
                ? 'bg-brand-primary text-white shadow-sm'
                : 'bg-brand-primary/[0.05] text-brand-dark hover:bg-brand-primary/[0.1]'
            }`}
          >
            {option.label}
          </button>
        ))}
        <button
          onClick={() => {
            onToggleDurationUnlimited(true);
            setShowCustom(false);
            onConfirm?.();
          }}
          disabled={isSessionLocked}
          className={`rounded-full px-4 py-2 text-sm font-medium font-body transition-all duration-200 ${
            isDurationUnlimited
              ? 'bg-brand-primary text-white shadow-sm'
              : 'bg-brand-primary/[0.05] text-brand-dark hover:bg-brand-primary/[0.1]'
          }`}
        >
          No limit
        </button>
      </div>

      {/* Custom duration toggle */}
      <button
        onClick={() => setShowCustom(!showCustom)}
        className="text-xs text-brand-primary font-medium font-body"
      >
        {showCustom ? 'Use preset' : isCustomValue ? `Custom: ${formattedDurationLabel}` : 'Custom duration'}
      </button>

      {showCustom && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="overflow-hidden"
        >
          <div className="flex items-center gap-2">
            <input
              type="number"
              value={durationInputValue}
              onChange={(e) => onDurationInputValueChange(e.target.value)}
              disabled={isSessionLocked}
              min={10}
              step={10}
              className="w-24 rounded-full bg-white border border-[rgba(28,25,43,0.1)] px-4 py-2 text-sm font-body text-brand-dark focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary/30 outline-none"
              placeholder="Seconds"
            />
            <span className="text-xs text-brand-dark/40 font-body">
              {durationInputValue && !isDurationUnlimited ? formattedDurationLabel : 'Enter seconds'}
            </span>
          </div>
        </motion.div>
      )}
    </div>
  );
};

export const SetupStepTwo = React.memo(_SetupStepTwo);
SetupStepTwo.displayName = 'SetupStepTwo';
