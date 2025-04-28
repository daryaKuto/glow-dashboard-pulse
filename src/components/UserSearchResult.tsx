
import React from 'react';
import { Button } from '@/components/ui/button';
import { UserPlus } from 'lucide-react';

interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  score: number;
  avatar: string;
}

interface UserSearchResultProps {
  user: User;
  onAddFriend: (userId: string) => void;
  isLoading?: boolean;
}

const UserSearchResult: React.FC<UserSearchResultProps> = ({
  user,
  onAddFriend,
  isLoading = false
}) => {
  return (
    <div className="flex items-center justify-between p-3 rounded-lg bg-brand-surface-light border border-brand-lavender/20">
      <div className="flex items-center space-x-3">
        <img 
          src={user.avatar} 
          alt={user.name}
          className="h-10 w-10 rounded-full object-cover"
        />
        <div>
          <h3 className="font-medium text-white">{user.name}</h3>
          <p className="text-xs text-brand-fg-secondary truncate max-w-[180px] sm:max-w-[250px]">
            {user.email}
          </p>
        </div>
      </div>
      
      <Button
        size="sm"
        onClick={() => onAddFriend(user.id)}
        disabled={isLoading}
        className="bg-brand-lavender hover:bg-brand-lavender/90 text-white"
      >
        <UserPlus size={16} className="mr-1" />
        Add
      </Button>
    </div>
  );
};

export default UserSearchResult;
