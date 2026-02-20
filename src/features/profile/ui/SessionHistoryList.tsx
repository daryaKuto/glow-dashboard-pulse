import React, { useState, useCallback, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Gamepad2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import SessionCard from './SessionCard';
import type { GameHistory } from '@/features/games/lib/device-game-flow';

interface SessionHistoryListProps {
  games: GameHistory[];
  isLoading: boolean;
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.06, delayChildren: 0.1 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.35, ease: 'easeOut' },
  },
};

/**
 * Detect the number of columns in a CSS grid container
 * by reading `grid-template-columns` computed style.
 */
function getGridColumnCount(el: HTMLElement | null): number {
  if (!el) return 1;
  const style = window.getComputedStyle(el);
  const columns = style.getPropertyValue('grid-template-columns');
  // columns is e.g. "300px 300px 300px" — count the entries
  return columns.split(/\s+/).filter(Boolean).length || 1;
}

const SessionHistoryList: React.FC<SessionHistoryListProps> = ({
  games,
  isLoading,
}) => {
  const [expandedRow, setExpandedRow] = useState<number | null>(null);
  const [colCount, setColCount] = useState(3);
  const gridRef = useRef<HTMLDivElement>(null);

  // Keep colCount in sync with the actual grid layout
  useEffect(() => {
    const el = gridRef.current;
    if (!el) return;

    const update = () => setColCount(getGridColumnCount(el));
    update();

    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [games.length]);

  const handleToggleRow = useCallback(
    (cardIndex: number) => {
      const rowIndex = Math.floor(cardIndex / colCount);
      setExpandedRow((prev) => (prev === rowIndex ? null : rowIndex));
    },
    [colCount]
  );

  if (isLoading) {
    return (
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Gamepad2 className="h-4 w-4 text-brand-primary" />
            <h3 className="text-base font-heading text-brand-dark">
              Games Played
            </h3>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 md:gap-4">
          {[...Array(3)].map((_, i) => (
            <Card key={i} className="shadow-card animate-pulse">
              <CardContent className="p-4 md:p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-2 h-2 bg-gray-200 rounded-full" />
                      <div className="h-4 bg-gray-200 rounded w-24" />
                    </div>
                    <div className="h-3 bg-gray-200 rounded w-32" />
                  </div>
                  <div className="text-right">
                    <div className="h-7 bg-gray-200 rounded w-10 mb-1" />
                    <div className="h-2 bg-gray-200 rounded w-8" />
                  </div>
                </div>
                <div className="h-12 bg-gray-200/50 rounded-[var(--radius)]" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (games.length === 0) {
    return (
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Gamepad2 className="h-4 w-4 text-brand-primary" />
            <h3 className="text-base font-heading text-brand-dark">
              Games Played
            </h3>
          </div>
        </div>
        <Card className="shadow-card">
          <CardContent className="p-5 md:p-6">
            <div className="text-center py-8">
              <p className="text-sm text-brand-dark/40 font-body mb-3">
                No sessions recorded yet. Play a game to see your history!
              </p>
              <Button className="bg-brand-primary hover:bg-brand-primary/90 text-white font-body">
                Start Training
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Gamepad2 className="h-4 w-4 text-brand-primary" />
          <h3 className="text-base font-heading text-brand-dark">
            Games Played
          </h3>
        </div>
        <span className="text-label text-brand-dark/70 font-body uppercase tracking-wide">
          {games.length} game{games.length !== 1 ? 's' : ''}
        </span>
      </div>
      {/* Legend */}
      <div className="flex items-center gap-4 mb-3">
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-brand-primary" />
          <span className="text-[11px] text-brand-dark/60 font-body">Goal Achieved</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-brand-dark" />
          <span className="text-[11px] text-brand-dark/60 font-body">Goal Missed</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-gray-400" />
          <span className="text-[11px] text-brand-dark/60 font-body">No Shots</span>
        </div>
      </div>
      <motion.div
        ref={gridRef}
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 md:gap-4"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {games.map((game, index) => {
          const rowIndex = Math.floor(index / colCount);
          return (
            <motion.div key={game.gameId} variants={itemVariants}>
              <SessionCard
                game={game}
                accentIndex={index}
                expanded={expandedRow === rowIndex}
                onToggleExpand={() => handleToggleRow(index)}
              />
            </motion.div>
          );
        })}
      </motion.div>
    </div>
  );
};

export default SessionHistoryList;
