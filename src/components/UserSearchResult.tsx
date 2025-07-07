
import React from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { UserPlus, Check, X } from 'lucide-react';

interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
}

interface UserSearchResultProps {
  user: User;
  currentUserId?: string;
  onFriendAction: (userId: string, action: 'send' | 'accept' | 'decline') => void;
}

const UserSearchResult: React.FC<UserSearchResultProps> = ({ 
  user, 
  currentUserId, 
  onFriendAction 
}) => {
  const isCurrentUser = user.id === currentUserId;

  const handleAddFriend = () => {
    onFriendAction(user.id, 'send');
  };

  const handleAcceptRequest = () => {
    onFriendAction(user.id, 'accept');
  };

  const handleDeclineRequest = () => {
    onFriendAction(user.id, 'decline');
  };

  return (
    <div className="flex items-center justify-between p-3 rounded-lg bg-brand-brown/5 border border-brand-brown/10 hover:bg-brand-brown/10 transition-colors">
      <div className="flex items-center gap-3">
        <Avatar className="h-10 w-10 border border-brand-brown/20">
          <AvatarImage src={user.avatar} />
          <AvatarFallback className="bg-brand-brown text-white text-sm font-heading">
            {user.name.split(' ').map(n => n[0]).join('')}
          </AvatarFallback>
        </Avatar>
        
        <div className="min-w-0 flex-1">
          <div className="font-medium text-brand-dark font-body truncate">
            {user.name}
          </div>
          <p className="text-xs text-brand-dark/70 font-body truncate max-w-[180px] sm:max-w-[250px]">
            {user.email}
          </p>
        </div>
      </div>
      
      <div className="flex items-center gap-2">
        {isCurrentUser ? (
          <span className="text-xs text-brand-dark/50 font-body px-2 py-1 bg-brand-brown/10 rounded">
            You
          </span>
        ) : (
          <>
            <Button
              size="sm"
              variant="ghost"
              onClick={handleAddFriend}
              className="text-brand-brown hover:text-brand-dark hover:bg-brand-brown/10"
            >
              <UserPlus className="h-4 w-4" />
            </Button>
            
            {/* These buttons would be shown based on friend request status */}
            {/* <Button
              size="sm"
              variant="ghost"
              onClick={handleAcceptRequest}
              className="text-green-600 hover:text-green-700 hover:bg-green-50"
            >
              <Check className="h-4 w-4" />
            </Button>
            
            <Button
              size="sm"
              variant="ghost"
              onClick={handleDeclineRequest}
              className="text-red-600 hover:text-red-700 hover:bg-red-50"
            >
              <X className="h-4 w-4" />
            </Button> */}
          </>
        )}
      </div>
    </div>
  );
};

export default UserSearchResult;
