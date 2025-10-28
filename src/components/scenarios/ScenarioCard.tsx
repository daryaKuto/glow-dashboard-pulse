import React from 'react';
import { Target, Play } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { GameTemplate } from '@/types/game';

interface ScenarioCardProps {
  scenario: GameTemplate;
  onStart?: () => void;
}

const ScenarioCard: React.FC<ScenarioCardProps> = ({ scenario, onStart }) => {
  const getDifficultyColor = (difficulty: string | null) => {
    switch (difficulty) {
      case 'beginner':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'intermediate':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'advanced':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  return (
    <Card className="w-full bg-white border-gray-200 shadow-sm hover:shadow-md transition-shadow duration-200">
      <CardHeader className="pb-2 md:pb-3 p-3 md:p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 md:gap-3">
            <div className="p-1.5 md:p-2 bg-brand-secondary/10 rounded-lg">
              <Target className="h-4 w-4 md:h-5 md:w-5 text-brand-primary" />
            </div>
            <div>
              <CardTitle className="text-sm md:text-base lg:text-lg font-heading text-brand-dark">
                {scenario.name}
              </CardTitle>
              <div className="flex items-center gap-1.5 md:gap-2 mt-1">
                <Badge
                  variant="outline"
                  className={`border text-xs ${getDifficultyColor(scenario.difficulty)} font-body`}
                >
                  {scenario.difficulty || 'Unknown'}
                </Badge>
                <span className="text-xs md:text-sm text-brand-dark/70 font-body">
                  {scenario.targetCount || 0} targets
                </span>
              </div>
            </div>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-3 md:space-y-4 p-3 md:p-4">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-2 md:gap-3 lg:gap-4">
          <div className="text-center p-2 md:p-3 bg-brand-secondary/5 rounded-lg">
            <div className="text-lg md:text-xl lg:text-2xl font-heading text-brand-dark">
              {scenario.targetCount || 0}
            </div>
            <div className="text-xs md:text-sm text-brand-dark/70 font-body">Targets</div>
          </div>
          <div className="text-center p-2 md:p-3 bg-brand-secondary/5 rounded-lg">
            <div className="text-lg md:text-xl lg:text-2xl font-heading text-brand-dark">
              {scenario.shotsPerTarget || 0}
            </div>
            <div className="text-xs md:text-sm text-brand-dark/70 font-body">Shots/Target</div>
          </div>
          <div className="text-center p-2 md:p-3 bg-brand-secondary/5 rounded-lg">
            <div className="text-lg md:text-xl lg:text-2xl font-heading text-brand-dark">
              {Math.round((scenario.timeLimitMs || 0) / 1000)}
            </div>
            <div className="text-xs md:text-sm text-brand-dark/70 font-body">Seconds</div>
          </div>
        </div>
        
        {/* Description */}
        {scenario.description && (
          <div className="p-2 md:p-3 bg-brand-secondary/5 rounded-lg">
            <p className="text-xs md:text-sm text-brand-dark/80 font-body">
              {scenario.description}
            </p>
          </div>
        )}
        
        {/* Action Button */}
        {onStart && (
          <Button 
            onClick={onStart}
            className="w-full bg-brand-brown hover:bg-brand-secondary/90 text-white font-body text-xs md:text-sm"
            size="sm"
          >
            <Play className="h-3 w-3 md:h-4 md:w-4 mr-1 md:mr-2" />
            Start Scenario
          </Button>
        )}
      </CardContent>
    </Card>
  );
};

export default ScenarioCard; 
