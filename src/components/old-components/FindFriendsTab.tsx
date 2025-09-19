
import React, { useEffect } from 'react';
import SearchInput from './SearchInput';
import UserSearchResult from './UserSearchResult';
import { useFriends } from '@/store/useFriends';

const FindFriendsTab: React.FC = () => {
  const {
    searchResults,
    searchQuery,
    isSearching,
    setSearchQuery,
    searchUsers,
    addFriend
  } = useFriends();
  
  // Perform search when query changes
  useEffect(() => {
    const handler = setTimeout(() => {
      if (searchQuery) {
        searchUsers(searchQuery);
      }
    }, 400); // Debounce search
    
    return () => clearTimeout(handler);
  }, [searchQuery, searchUsers]);
  
  return (
    <div className="space-y-4">
      <SearchInput 
        value={searchQuery}
        onChange={setSearchQuery}
        placeholder="Search by email or phone number..."
      />
      
      <div className="space-y-3">
        {isSearching && (
          <div className="text-center py-4 text-brand-fg-secondary">
            Searching...
          </div>
        )}
        
        {!isSearching && searchQuery.length >= 3 && searchResults.length === 0 && (
          <div className="text-center py-4 text-brand-fg-secondary">
            No users found matching "{searchQuery}"
          </div>
        )}
        
        {!isSearching && searchQuery.length < 3 && (
          <div className="text-center py-4 text-brand-fg-secondary">
            Enter at least 3 characters to search
          </div>
        )}
        
        {searchResults.map(user => (
          <UserSearchResult
            key={user.id}
            user={user}
            onAddFriend={addFriend}
          />
        ))}
      </div>
    </div>
  );
};

export default FindFriendsTab;
