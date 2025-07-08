import React from 'react';
import { format } from 'date-fns';
import { CalendarIcon, Target, Clock, Trophy, Play } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { Scenario } from '@/types/game';

interface ScenarioCardProps {
  scenario: Scenario;
  onStart?: () => void;
}

const ScenarioCard: React.FC<ScenarioCardProps> = ({ scenario, onStart }) => {
  const getDifficultyColor = (difficulty: string) => {
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
    <Card className="w-full bg-white border-brand-brown/20 shadow-sm hover:shadow-md transition-shadow duration-200">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-brand-brown/10 rounded-lg">
              <Target className="h-5 w-5 text-brand-brown" />
            </div>
            <div>
              <CardTitle className="text-lg font-heading text-brand-dark">
                {scenario.name}
              </CardTitle>
              <div className="flex items-center gap-2 mt-1">
                <Badge 
                  variant="outline" 
                  className={`border ${getDifficultyColor(scenario.difficulty || 'unknown')} font-body`}
                >
                  {scenario.difficulty || 'Unknown'}
                </Badge>
                <span className="text-sm text-brand-dark/70 font-body">
                  {scenario.targetCount || 0} targets
                </span>
              </div>
            </div>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Stats */}
        <div className="grid grid-cols-2 gap-4">
          <div className="text-center p-3 bg-brand-brown/5 rounded-lg">
            <div className="text-2xl font-heading text-brand-dark">
              {scenario.targetCount || 0}
            </div>
            <div className="text-sm text-brand-dark/70 font-body">Targets</div>
          </div>
          <div className="text-center p-3 bg-brand-brown/5 rounded-lg">
            <div className="text-2xl font-heading text-brand-dark">
              {scenario.duration || 0}
            </div>
            <div className="text-sm text-brand-dark/70 font-body">Minutes</div>
          </div>
        </div>
        
        {/* Description */}
        {scenario.description && (
          <div className="p-3 bg-brand-brown/5 rounded-lg">
            <p className="text-sm text-brand-dark/80 font-body">
              {scenario.description}
            </p>
          </div>
        )}
        
        {/* Action Button */}
        {onStart && (
          <Button 
            onClick={onStart}
            className="w-full bg-brand-brown hover:bg-brand-dark text-white font-body"
          >
            <Play className="h-4 w-4 mr-2" />
            Start Scenario
          </Button>
        )}
      </CardContent>
    </Card>
  );
};

export default ScenarioCard; 