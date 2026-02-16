import React, { useCallback, useState } from 'react';
import { getStatusDisplay, TARGET_STATUS_SORT_ORDER } from '@/shared/constants/target-status';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Plus, Home, Sofa, Utensils, ChefHat, Bed, Briefcase, Building, Car, TreePine, Gamepad2, Dumbbell, Music, BookOpen, Target } from 'lucide-react';
import type { Target as TargetType } from '@/features/targets/schema';

interface CreateRoomModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateRoom: (roomData: {
    name: string;
    icon: string;
    type: string;
    assignedTargets: string[];
  }) => void;
  availableTargets: Array<{
    id: string;
    name: string;
    status: TargetType['status'] | null | undefined;
    activityStatus?: TargetType['activityStatus'] | null;
  }>;
}

const CreateRoomModal: React.FC<CreateRoomModalProps> = ({
  isOpen,
  onClose,
  onCreateRoom,
  availableTargets,
}) => {
  const [roomName, setRoomName] = useState('');
  const [roomIcon, setRoomIcon] = useState('home');
  const [roomType, setRoomType] = useState('');
  const [selectedTargets, setSelectedTargets] = useState<string[]>([]);

  // Available room types
  const roomTypes = [
    { value: 'living-room', label: 'Living Room' },
    { value: 'bedroom', label: 'Bedroom' },
    { value: 'kitchen', label: 'Kitchen' },
    { value: 'dining-room', label: 'Dining Room' },
    { value: 'bathroom', label: 'Bathroom' },
    { value: 'office', label: 'Office/Study' },
    { value: 'basement', label: 'Basement' },
    { value: 'garage', label: 'Garage' },
    { value: 'attic', label: 'Attic' },
    { value: 'laundry-room', label: 'Laundry Room' },
  ];

  // Available room icons
  const roomIcons = [
    { value: 'home', label: 'Home', icon: <Home className="h-4 w-4" /> },
    { value: 'sofa', label: 'Living Room', icon: <Sofa className="h-4 w-4" /> },
    { value: 'utensils', label: 'Dining Room', icon: <Utensils className="h-4 w-4" /> },
    { value: 'chef-hat', label: 'Kitchen', icon: <ChefHat className="h-4 w-4" /> },
    { value: 'bed', label: 'Bedroom', icon: <Bed className="h-4 w-4" /> },
    { value: 'briefcase', label: 'Office', icon: <Briefcase className="h-4 w-4" /> },
    { value: 'building', label: 'Basement', icon: <Building className="h-4 w-4" /> },
    { value: 'car', label: 'Garage', icon: <Car className="h-4 w-4" /> },
    { value: 'tree-pine', label: 'Garden', icon: <TreePine className="h-4 w-4" /> },
    { value: 'gamepad2', label: 'Game Room', icon: <Gamepad2 className="h-4 w-4" /> },
    { value: 'dumbbell', label: 'Gym', icon: <Dumbbell className="h-4 w-4" /> },
    { value: 'music', label: 'Music Room', icon: <Music className="h-4 w-4" /> },
    { value: 'book-open', label: 'Library', icon: <BookOpen className="h-4 w-4" /> },
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomName.trim() || !roomType) return;

    onCreateRoom({
      name: roomName.trim(),
      icon: roomIcon,
      type: roomType,
      assignedTargets: selectedTargets,
    });

    // Reset form
    setRoomName('');
    setRoomIcon('home');
    setRoomType('');
    setSelectedTargets([]);
    onClose();
  };

  const handleTargetToggle = (targetId: string) => {
    setSelectedTargets((prev) =>
      prev.includes(targetId)
        ? prev.filter((id) => id !== targetId)
        : [...prev, targetId],
    );
  };

  const resolveStatusDot = useCallback(
    (status: TargetType['status'] | null | undefined) => {
      const cfg = getStatusDisplay(status);
      return { label: cfg.label, dotColor: cfg.dotColor };
    },
    [],
  );

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-lg md:max-w-2xl mx-auto max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-[var(--radius)] bg-brand-primary/10 flex items-center justify-center shrink-0">
              <Plus className="w-4 h-4 text-brand-primary" />
            </div>
            <div>
              <DialogTitle className="text-base md:text-lg font-heading text-brand-dark">
                Create New Room
              </DialogTitle>
              <DialogDescription className="text-[11px] text-brand-dark/45 font-body mt-0.5">
                Set up a new room with targets and configure its properties.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 md:space-y-5">
          {/* Room Name */}
          <div className="space-y-1.5 md:space-y-2">
            <div className="flex items-center gap-2">
              <Home className="w-3.5 h-3.5 text-brand-primary" />
              <Label htmlFor="room-name" className="text-label text-brand-primary font-body uppercase tracking-wide">
                Room Name
              </Label>
            </div>
            <Input
              id="room-name"
              placeholder="e.g., Master Bedroom, Living Room"
              value={roomName}
              onChange={(e) => setRoomName(e.target.value)}
              className="bg-white border border-[rgba(28,25,43,0.1)] rounded-[var(--radius)] text-brand-dark focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary/30 font-body h-10 text-sm"
              required
            />
          </div>

          {/* Room Type */}
          <div className="space-y-1.5 md:space-y-2">
            <div className="flex items-center gap-2">
              <Building className="w-3.5 h-3.5 text-brand-secondary" />
              <Label htmlFor="room-type" className="text-label text-brand-secondary font-body uppercase tracking-wide">
                Room Type
              </Label>
            </div>
            <Select value={roomType} onValueChange={setRoomType} required>
              <SelectTrigger className="bg-white border border-[rgba(28,25,43,0.1)] rounded-[var(--radius)] text-brand-dark h-10 text-sm">
                <SelectValue placeholder="Select room type" />
              </SelectTrigger>
              <SelectContent className="bg-white shadow-lg border-0">
                {roomTypes.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Room Icon — visual grid picker */}
          <div className="space-y-1.5 md:space-y-2">
            <div className="flex items-center gap-2">
              <Gamepad2 className="w-3.5 h-3.5 text-brand-secondary" />
              <Label className="text-label text-brand-secondary font-body uppercase tracking-wide">
                Room Icon
              </Label>
            </div>
            <div className="grid grid-cols-5 sm:grid-cols-7 gap-1.5 md:gap-2">
              {roomIcons.map((icon) => (
                <button
                  key={icon.value}
                  type="button"
                  onClick={() => setRoomIcon(icon.value)}
                  className={`flex flex-col items-center justify-center gap-1 p-2 md:p-2.5 rounded-[var(--radius)] transition-all duration-200 ${
                    roomIcon === icon.value
                      ? 'bg-brand-primary/10 ring-2 ring-brand-primary text-brand-primary shadow-subtle'
                      : 'bg-brand-dark/[0.03] text-brand-dark/50 hover:bg-brand-dark/[0.06] hover:text-brand-dark/70'
                  }`}
                  title={icon.label}
                >
                  <span className={roomIcon === icon.value ? 'text-brand-primary' : ''}>{icon.icon}</span>
                  <span className="text-[8px] md:text-[9px] font-body leading-tight truncate w-full text-center">{icon.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-[rgba(28,25,43,0.06)]" />

          {/* Available Targets */}
          <div className="space-y-2 md:space-y-3">
            <div className="flex items-center gap-2">
              <Target className="w-3.5 h-3.5 text-brand-primary" />
              <Label className="text-label text-brand-primary font-body uppercase tracking-wide">
                Assign Targets
              </Label>
              <span className="text-[10px] text-brand-dark/40 font-body">(optional)</span>
              <span className="text-[10px] text-brand-dark/40 font-body ml-auto tabular-nums">
                {availableTargets.length}
              </span>
            </div>

            {availableTargets.length === 0 ? (
              <div className="rounded-[var(--radius)] bg-brand-primary/[0.03] border border-dashed border-brand-primary/15 py-6 text-center">
                <Target className="w-5 h-5 text-brand-dark/20 mx-auto mb-1.5" />
                <p className="text-xs text-brand-dark/40 font-body">No unassigned targets available</p>
                <p className="text-[10px] text-brand-dark/30 font-body mt-0.5">All targets are already assigned to rooms</p>
              </div>
            ) : (
              <div className="space-y-1.5 md:space-y-2 max-h-48 md:max-h-56 overflow-y-auto">
                {[...availableTargets].sort((a, b) => {
                  const aOrder = TARGET_STATUS_SORT_ORDER[a.status ?? 'offline'] ?? 2;
                  const bOrder = TARGET_STATUS_SORT_ORDER[b.status ?? 'offline'] ?? 2;
                  return aOrder - bOrder;
                }).map((target) => {
                  const statusDisplay = resolveStatusDot(target.status);
                  const isSelected = selectedTargets.includes(target.id);
                  const statusCfg = getStatusDisplay(target.status);
                  const rowBg = isSelected
                    ? 'bg-brand-primary/[0.06] ring-1 ring-brand-primary/20 shadow-subtle'
                    : statusCfg.rowBgClassName;
                  return (
                    <div
                      key={target.id}
                      className={`flex items-center justify-between p-2.5 md:p-3 rounded-[var(--radius)] cursor-pointer transition-all duration-200 ${rowBg}`}
                      onClick={() => handleTargetToggle(target.id)}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="relative w-7 h-7 rounded-full bg-brand-dark/[0.04] flex items-center justify-center shrink-0">
                          <Target className="w-3 h-3 text-brand-primary" />
                          <span className={`absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white ${statusDisplay.dotColor}`} />
                        </div>
                        <div className="min-w-0">
                          <span className="text-xs md:text-sm font-medium font-body text-brand-dark truncate block">{target.name}</span>
                          <span className={`text-[10px] font-body ${statusCfg.textColor}`}>
                            {statusDisplay.label}
                          </span>
                        </div>
                      </div>
                      <div
                        className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ml-2 transition-all duration-200 ${
                          isSelected
                            ? 'border-brand-primary bg-brand-primary'
                            : 'border-brand-dark/20'
                        }`}
                      >
                        {isSelected && (
                          <svg className="w-3 h-3 text-white" viewBox="0 0 12 12" fill="none">
                            <path d="M2.5 6L5 8.5L9.5 3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {selectedTargets.length > 0 && (
              <div className="flex items-center justify-between bg-brand-primary/[0.04] rounded-[var(--radius)] p-3">
                <span className="text-xs text-brand-dark/60 font-body">
                  {selectedTargets.length} target{selectedTargets.length !== 1 ? 's' : ''} selected
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedTargets([])}
                  className="text-[11px] text-brand-dark/40 hover:text-brand-dark/60 font-body transition-colors"
                >
                  Clear all
                </button>
              </div>
            )}
          </div>

          <DialogFooter className="flex flex-col-reverse sm:flex-row gap-2 pt-3 border-t border-[rgba(28,25,43,0.06)]">
            <Button
              type="button"
              variant="secondary"
              onClick={onClose}
              className="w-full sm:w-auto"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!roomName.trim() || !roomType}
              className="bg-brand-primary hover:bg-brand-primary/90 text-white shadow-lg w-full sm:w-auto"
            >
              <Plus className="h-4 w-4 mr-2" />
              Create Room
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default CreateRoomModal;
