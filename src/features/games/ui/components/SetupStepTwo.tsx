import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export type SetupStepTwoProps = {
  canAdvanceToDuration: boolean;
  isSessionLocked: boolean;
  isDurationUnlimited: boolean;
  durationInputValue: string;
  formattedDurationLabel: string;
  onDurationInputValueChange: (value: string) => void;
  onToggleDurationUnlimited: (unlimited: boolean) => void;
};

// Displays the Step 2 setup card: session duration quick-select buttons and custom input.
const _SetupStepTwo: React.FC<SetupStepTwoProps> = ({
  canAdvanceToDuration,
  isSessionLocked,
  isDurationUnlimited,
  durationInputValue,
  formattedDurationLabel,
  onDurationInputValueChange,
  onToggleDurationUnlimited,
}) => {
  return (
    <Card className="bg-white border-gray-200 shadow-sm rounded-md md:rounded-lg">
      <CardContent className="p-[10px] space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center rounded-full bg-brand-primary/10 px-2.5 py-0.5 text-xs font-semibold text-brand-primary">
                Step 2
              </span>
              <span className="text-xs font-medium uppercase tracking-wide text-brand-dark/60">
                Duration
              </span>
            </div>
            <h2 className="font-heading text-lg text-brand-dark">Select session duration</h2>
            <p className="text-xs text-brand-dark/60">Set a timer or run without limits.</p>
          </div>
        </div>
        {!canAdvanceToDuration ? (
          <div className="rounded-md border border-dashed border-gray-200 bg-gray-50 px-3 py-4 text-sm text-brand-dark/60">
            Complete Step 1 to configure the game duration.
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-4 rounded-md border border-gray-200 bg-gray-50 px-[10px] py-[10px]">
              <div className="space-y-2">
                <Label className="text-xs font-medium text-brand-dark">Quick selections</Label>
                <div className="flex flex-wrap gap-2">
                  {[
                    { label: '30s', value: 30 },
                    { label: '1m', value: 60 },
                    { label: '2m', value: 120 },
                  ].map((option) => (
                    <Button
                      key={option.value}
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => onDurationInputValueChange(String(option.value))}
                      disabled={isSessionLocked}
                    >
                      {option.label}
                    </Button>
                  ))}
                  <Button
                    type="button"
                    variant={isDurationUnlimited ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => onToggleDurationUnlimited(true)}
                    disabled={isSessionLocked}
                  >
                    No time limit
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="game-duration" className="text-xs font-medium text-brand-dark">
                  Custom duration (seconds)
                </Label>
                <Input
                  id="game-duration"
                  type="number"
                  inputMode="numeric"
                  placeholder="Enter seconds (e.g. 180)"
                  value={durationInputValue}
                  min={10}
                  step={10}
                  onChange={(event) => onDurationInputValueChange(event.target.value)}
                  disabled={isSessionLocked}
                />
                <p className="text-[11px] text-brand-dark/60">
                  {isDurationUnlimited
                    ? 'Timer disabled • leave blank or choose No time limit'
                    : `Formatted: ${formattedDurationLabel}`}
                </p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export const SetupStepTwo = React.memo(_SetupStepTwo);
SetupStepTwo.displayName = 'SetupStepTwo';
