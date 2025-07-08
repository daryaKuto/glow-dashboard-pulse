
import React, { useState } from 'react';
import { useRoomDesigner } from '@/store/useRoomDesigner';
import { useTargets } from '@/store/useTargets';
import { useLocation } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Check, X, Users, UserPlus, Target, Trash } from 'lucide-react';
import { toast } from '@/components/ui/sonner';

const InspectorPanel: React.FC = () => {
  const location = useLocation();
  const token = new URLSearchParams(location.search).get('token') || 'dummy_token';
  
  const { 
    selectedIds,
    selectedGroupId,
    groups,
    createGroup,
    renameGroup,
    ungroupTargets
  } = useRoomDesigner();
  
  const { targets } = useTargets();
  
  const [groupName, setGroupName] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  
  // Get selected group
  const selectedGroup = selectedGroupId ? groups.find(g => g.id === selectedGroupId) : null;
  
  // Get selected targets
  const selectedTargets = targets.filter(t => selectedIds.includes(t.id));
  
  // Handle create group
  const handleCreateGroup = () => {
    if (selectedIds.length < 2) {
      toast.error('Select at least two targets to create a group');
      return;
    }
    
    const name = groupName.trim() || `Group ${groups.length + 1}`;
    createGroup(name, selectedIds, token);
    setGroupName('');
  };
  
  // Handle rename group
  const handleRenameGroup = () => {
    if (!selectedGroup) return;
    
    const name = groupName.trim();
    if (!name) {
      toast.error('Group name cannot be empty');
      return;
    }
    
    renameGroup(selectedGroup.id, name, token);
    setIsEditing(false);
    setGroupName('');
  };
  
  // Handle ungroup
  const handleUngroup = () => {
    if (!selectedGroup) return;
    ungroupTargets(selectedGroup.id, token);
  };
  
  // Start renaming group
  const startRenameGroup = () => {
    if (selectedGroup) {
      setGroupName(selectedGroup.name);
      setIsEditing(true);
    }
  };
  
  // Cancel editing
  const cancelEdit = () => {
    setIsEditing(false);
    setGroupName('');
  };
  
  // Render inspector content based on selection
  const renderContent = () => {
    // No selection
    if (selectedIds.length === 0 && !selectedGroup) {
      return (
        <div className="text-center py-8 text-brand-fg-secondary">
          <Target size={32} className="mx-auto mb-3 text-brand-lavender/50" />
          <p>Select a target or group to inspect</p>
        </div>
      );
    }
    
    // Group selected
    if (selectedGroup) {
      return (
        <div className="space-y-4">
          <div>
            <div className="flex justify-between items-center mb-2">
              <Label className="text-brand-lavender">Group Name</Label>
              {!isEditing && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={startRenameGroup}
                  className="h-6 text-xs text-brand-lavender hover:text-white"
                >
                  Edit
                </Button>
              )}
            </div>
            
            {isEditing ? (
              <div className="space-y-2">
                <Input 
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  className="bg-transparent border-brand-lavender/30 text-white"
                />
                <div className="flex gap-2">
                  <Button 
                    size="sm" 
                    onClick={handleRenameGroup}
                    className="bg-brand-lavender hover:bg-brand-lavender/80"
                  >
                    <Check className="h-4 w-4 mr-1" />
                    Save
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={cancelEdit}
                    className="text-brand-fg-secondary hover:bg-brand-lavender hover:text-white"
                  >
                    <X className="h-4 w-4 mr-1" />
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <div className="bg-brand-lavender/10 p-2 rounded text-white">
                {selectedGroup.name}
              </div>
            )}
          </div>
          
          <div>
            <Label className="text-brand-lavender block mb-2">Targets</Label>
            <div className="bg-brand-lavender/10 p-2 rounded text-brand-fg-secondary text-sm">
              {selectedGroup.targetIds.length} targets in this group
            </div>
          </div>
          
          <Button 
            variant="destructive" 
            size="sm" 
            onClick={handleUngroup}
            className="w-full mt-4"
          >
            <Trash className="h-4 w-4 mr-1" />
            Ungroup Targets
          </Button>
        </div>
      );
    }
    
    // Multiple targets selected
    if (selectedIds.length > 1) {
      return (
        <div className="space-y-4">
          <div>
            <Label className="text-brand-lavender block mb-2">Selected Targets</Label>
            <div className="bg-brand-lavender/10 p-2 rounded max-h-40 overflow-y-auto">
              <ul className="text-sm text-brand-fg-secondary space-y-1">
                {selectedTargets.map(target => (
                  <li key={target.id} className="flex items-center">
                    <Target size={12} className="mr-1 text-brand-lavender" />
                    {target.name}
                  </li>
                ))}
              </ul>
            </div>
          </div>
          
          <div>
            <Label htmlFor="groupName" className="text-brand-lavender block mb-2">Group Name</Label>
            <Input 
              id="groupName"
              placeholder={`Group ${groups.length + 1}`}
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              className="bg-transparent border-brand-lavender/30 text-white"
            />
          </div>
          
          <Button 
            onClick={handleCreateGroup}
            className="w-full bg-brand-lavender hover:bg-brand-lavender/80"
          >
            <Users className="h-4 w-4 mr-1" />
            Create Group
          </Button>
        </div>
      );
    }
    
    // Single target selected
    return (
      <div className="space-y-4">
        {selectedTargets.map(target => (
          <div key={target.id}>
            <div>
              <Label className="text-brand-lavender block mb-2">Target Name</Label>
              <div className="bg-brand-lavender/10 p-2 rounded text-white">
                {target.name}
              </div>
            </div>
            
            <div className="mt-3">
              <Label className="text-brand-lavender block mb-2">Status</Label>
              <div className="bg-brand-lavender/10 p-2 rounded text-white">
                {target.status}
              </div>
            </div>
            
            <div className="mt-3">
              <Label className="text-brand-lavender block mb-2">Battery</Label>
              <div className="bg-brand-lavender/10 p-2 rounded text-white">
                {target.battery}%
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  };
  
  return (
    <div className="h-full p-4 overflow-y-auto">
      {renderContent()}
    </div>
  );
};

export default InspectorPanel;
