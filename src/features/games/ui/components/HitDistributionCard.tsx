import React, { useEffect, useRef, useState } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { motion } from 'framer-motion';
import { CHART_COLORS } from '@/shared/constants/chart-colors';

// ─── Count-up hook ──────────────────────────────────────────────────────────

function useCountUp(target: number, duration = 800) {
  const [value, setValue] = useState(0);
  const rafId = useRef<number>();
  const startTime = useRef<number | null>(null);

  useEffect(() => {
    if (target === 0) { setValue(0); return; }
    startTime.current = null;

    const step = (ts: number) => {
      if (!startTime.current) startTime.current = ts;
      const progress = Math.min((ts - startTime.current) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // easeOutCubic
      setValue(Math.round(eased * target));
      if (progress < 1) rafId.current = requestAnimationFrame(step);
    };

    rafId.current = requestAnimationFrame(step);
    return () => { if (rafId.current) cancelAnimationFrame(rafId.current); };
  }, [target, duration]);

  return value;
}

// ─── Animation variants ─────────────────────────────────────────────────────

const legendContainerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.08, delayChildren: 0.6 } },
};

const legendRowVariants = {
  hidden: { opacity: 0, x: -6 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.3, ease: 'easeOut' } },
};

interface HitDistributionCardProps {
  totalHits: number;
  deviceHitSummary: Array<{ deviceId: string; deviceName: string; hits: number }>;
  pieChartData: Array<{ name: string; value: number }>;
}

/**
 * A single concentric arc — SVG circle with animated strokeDashoffset.
 * Each device gets its own ring at a different radius.
 */
const ConcentricArc: React.FC<{
  cx: number;
  cy: number;
  radius: number;
  percentage: number;
  color: string;
  strokeWidth: number;
  delay: number;
  isHovered: boolean;
}> = ({ cx, cy, radius, percentage, color, strokeWidth, delay, isHovered }) => {
  const circumference = 2 * Math.PI * radius;
  const filled = (percentage / 100) * circumference;

  return (
    <>
      {/* Track */}
      <circle
        cx={cx}
        cy={cy}
        r={radius}
        fill="none"
        stroke="rgba(28,25,43,0.06)"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
      {/* Filled arc */}
      <motion.circle
        cx={cx}
        cy={cy}
        r={radius}
        fill="none"
        stroke={color}
        strokeLinecap="round"
        strokeDasharray={circumference}
        initial={{ strokeDashoffset: circumference, strokeWidth }}
        animate={{
          strokeDashoffset: circumference - filled,
          strokeWidth: isHovered ? strokeWidth + 3 : strokeWidth,
          opacity: isHovered ? 1 : 0.85,
        }}
        transition={{ duration: isHovered ? 0.2 : 1, ease: 'easeOut', delay: isHovered ? 0 : delay }}
      />
    </>
  );
};

// Visualizes hit distribution across devices via concentric ring chart.
export const HitDistributionCard: React.FC<HitDistributionCardProps> = ({
  totalHits,
  deviceHitSummary,
}) => {
  const hasHits = deviceHitSummary.length > 0;
  const devices = deviceHitSummary.slice(0, 4);
  const [hoveredRing, setHoveredRing] = useState<number | null>(null);
  const animatedTotal = useCountUp(totalHits);

  // Ring config: outermost ring first, each smaller
  const ringConfig = [
    { radius: 80, strokeWidth: 10 },
    { radius: 66, strokeWidth: 10 },
    { radius: 52, strokeWidth: 10 },
    { radius: 38, strokeWidth: 10 },
  ];

  const svgSize = 200;
  const center = svgSize / 2;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
    >
    <Card className="shadow-card bg-gradient-to-br from-white to-brand-secondary/[0.05] h-full">
      <CardHeader className="pb-2 md:pb-3 p-5 md:p-6">
        <span className="text-label text-brand-secondary uppercase tracking-wide font-body">
          Hit Distribution
        </span>
      </CardHeader>
      <CardContent className="px-5 pb-5 md:px-6 md:pb-6 pt-0">
        {!hasHits ? (
          <div className="flex h-52 items-center justify-center text-sm text-brand-dark/40 font-body">
            Start a game to see hit distribution.
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4 mt-3">
            {/* Concentric rings chart */}
            <motion.div
              className="relative cursor-default"
              whileHover={{ scale: 1.04 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
            >
              <svg
                width={svgSize}
                height={svgSize}
                viewBox={`0 0 ${svgSize} ${svgSize}`}
                className="transform -rotate-90"
              >
                {devices.map((device, i) => {
                  const pct = totalHits > 0 ? (device.hits / totalHits) * 100 : 0;
                  const config = ringConfig[i];
                  // Invisible wider hit-area circle for hover detection
                  return (
                    <g
                      key={device.deviceId}
                      onMouseEnter={() => setHoveredRing(i)}
                      onMouseLeave={() => setHoveredRing(null)}
                    >
                      {/* Invisible wider hit area */}
                      <circle
                        cx={center}
                        cy={center}
                        r={config.radius}
                        fill="none"
                        stroke="transparent"
                        strokeWidth={config.strokeWidth + 8}
                      />
                      <ConcentricArc
                        cx={center}
                        cy={center}
                        radius={config.radius}
                        percentage={pct}
                        color={CHART_COLORS[i % CHART_COLORS.length]}
                        strokeWidth={config.strokeWidth}
                        delay={i * 0.15}
                        isHovered={hoveredRing === i}
                      />
                    </g>
                  );
                })}
              </svg>
              {/* Center hero number — count-up */}
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <p className="text-stat-hero font-bold text-brand-dark font-body tabular-nums leading-none">
                  {animatedTotal.toLocaleString()}
                </p>
                <span className="text-[10px] text-brand-dark/40 font-body uppercase tracking-wide mt-0.5">
                  Total Hits
                </span>
              </div>
            </motion.div>

            {/* Legend — staggered entrance */}
            <motion.div
              className="w-full space-y-2"
              variants={legendContainerVariants}
              initial="hidden"
              animate="visible"
            >
              {devices.map((device, i) => (
                <motion.div
                  key={device.deviceId}
                  className="flex items-center justify-between rounded-md px-1 -mx-1 cursor-default"
                  variants={legendRowVariants}
                  whileHover={{ x: 3, transition: { duration: 0.15 } }}
                  onMouseEnter={() => setHoveredRing(i)}
                  onMouseLeave={() => setHoveredRing(null)}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <motion.span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }}
                      animate={{ scale: hoveredRing === i ? 1.4 : 1 }}
                      transition={{ duration: 0.15 }}
                    />
                    <span className={`text-xs font-body truncate transition-colors duration-150 ${
                      hoveredRing === i ? 'text-brand-dark font-medium' : 'text-brand-dark/70'
                    }`}>
                      {device.deviceName}
                    </span>
                  </div>
                  <span className={`text-sm font-bold font-body tabular-nums ml-3 transition-colors duration-150 ${
                    hoveredRing === i ? 'text-brand-primary' : 'text-brand-dark'
                  }`}>
                    {device.hits.toLocaleString()}
                  </span>
                </motion.div>
              ))}
            </motion.div>
          </div>
        )}
      </CardContent>
    </Card>
    </motion.div>
  );
};

// Placeholder while hit distribution data is loading.
export const HitDistributionSkeleton: React.FC = () => (
  <Card className="shadow-card bg-gradient-to-br from-white to-brand-secondary/[0.05]">
    <CardHeader className="pb-2 md:pb-3 p-5 md:p-6">
      <Skeleton className="h-3 w-28 bg-gray-200" />
    </CardHeader>
    <CardContent className="px-5 pb-5 md:px-6 md:pb-6 pt-0">
      <div className="flex flex-col items-center gap-4">
        <Skeleton className="h-[200px] w-[200px] rounded-full bg-gray-100" />
        <div className="w-full space-y-2">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Skeleton className="w-2.5 h-2.5 rounded-full bg-gray-200" />
                <Skeleton className="h-3 w-24 bg-gray-200" />
              </div>
              <Skeleton className="h-4 w-8 bg-gray-200" />
            </div>
          ))}
        </div>
      </div>
    </CardContent>
  </Card>
);
