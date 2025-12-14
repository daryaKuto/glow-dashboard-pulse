import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useRoomDesigner } from '@/store/useRoomDesigner';
import TargetIcon from '@/pages/targets/TargetIcon';
import { Target } from '@/store/useTargets';
import API from '@/lib/api';

const PalettePanel: React.FC = () => {
  const { id: roomId } = useParams<{ id: string }>();
  const { layout } = useRoomDesigner();
  const [targets, setTargets] = useState<Target[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch targets assigned to this room
  useEffect(() => {
    const fetchTargets = async () => {
      if (!roomId) return;

      setIsLoading(true);
      setError(null);
      try {
        const roomTargets = await API.getRoomTargets(roomId);
        setTargets(roomTargets);
      } catch (err) {
        console.error('Error fetching room targets:', err);
        setError('Failed to load targets');
      } finally {
        setIsLoading(false);
      }
    };

    fetchTargets();
  }, [roomId]);

  // Filter targets that are not placed on the canvas
  const unplacedTargets = targets.filter(
    target => !layout.some(t => String(t.id) === String(target.id))
  );

  return (
    <div className="p-4">
      <h3 className="text-sm font-heading font-medium text-brand-purple mb-4">Available Targets</h3>

      {isLoading ? (
        <div className="text-center py-8 font-body text-brand-fg-secondary">
          Loading targets...
        </div>
      ) : error ? (
        <div className="text-center py-8 font-body text-brand-error">
          {error}
        </div>
      ) : unplacedTargets.length === 0 ? (
        <div className="text-center py-8 font-body text-brand-fg-secondary">
          All targets have been placed on the canvas
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {unplacedTargets.map(target => {
            const targetType = target.type || target.deviceType || 'standard';
            return (
              <div
                key={target.id}
                className="flex flex-col items-center cursor-move hover:opacity-80 transition-opacity"
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData('application/target-id', target.id);
                  e.dataTransfer.effectAllowed = 'move';
                }}
              >
                <TargetIcon
                  type={targetType}
                  size="md"
                />
                <span className="text-xs font-body text-brand-fg-secondary mt-1 text-center">
                  {target.name}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default PalettePanel;
