
import React, { useState, useEffect, useRef } from 'react';
import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import UserSearchResult from './UserSearchResult';
import { useFriends } from '@/store/useFriends';
import { useAuth } from '@/providers/AuthProvider';

interface SearchInputProps {
  placeholder?: string;
  onSearch?: (query: string) => void;
  className?: string;
}

const SearchInput: React.FC<SearchInputProps> = ({ 
  placeholder = "Search users...", 
  onSearch,
  className = ""
}) => {
  const [query, setQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [showResults, setShowResults] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const { user } = useAuth();
  const { sendFriendRequest, acceptFriendRequest, declineFriendRequest } = useFriends();

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowResults(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (query.trim()) {
      setIsSearching(true);
      // Simulate search delay
      const timer = setTimeout(() => {
        // Mock search results
        const mockResults = [
          { id: '1', name: 'John Doe', email: 'john@example.com', avatar: '/thumb-3.png' },
          { id: '2', name: 'Jane Smith', email: 'jane@example.com', avatar: '/thumb-3.png' },
          { id: '3', name: 'Mike Johnson', email: 'mike@example.com', avatar: '/thumb-3.png' },
        ].filter(user => 
          user.name.toLowerCase().includes(query.toLowerCase()) ||
          user.email.toLowerCase().includes(query.toLowerCase())
        );
        
        setResults(mockResults);
        setIsSearching(false);
        setShowResults(true);
      }, 300);

      return () => clearTimeout(timer);
    } else {
      setResults([]);
      setShowResults(false);
    }
  }, [query]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (onSearch) {
      onSearch(query);
    }
  };

  const handleClear = () => {
    setQuery('');
    setResults([]);
    setShowResults(false);
  };

  const handleFriendAction = async (userId: string, action: 'send' | 'accept' | 'decline') => {
    try {
      switch (action) {
        case 'send':
          await sendFriendRequest(userId);
          break;
        case 'accept':
          await acceptFriendRequest(userId);
          break;
        case 'decline':
          await declineFriendRequest(userId);
          break;
      }
    } catch (error) {
      console.error('Friend action failed:', error);
    }
  };

  return (
    <div ref={searchRef} className={`relative ${className}`}>
      <form onSubmit={handleSearch} className="relative">
        <Input
          type="text"
          placeholder={placeholder}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-10 bg-white border-gray-200 text-brand-dark"
        />
        <Search className="absolute left-3 top-3 h-4 w-4 text-brand-primary" />
        
        {query && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleClear}
            className="absolute right-2 top-2 h-6 w-6 p-0 text-brand-primary hover:text-brand-dark"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </form>

      {/* Search Results Dropdown */}
      {showResults && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-64 overflow-y-auto">
          {isSearching ? (
            <div className="p-4 text-center text-brand-dark/70 font-body">
              Searching...
            </div>
          ) : results.length > 0 ? (
            <div className="py-2">
              {results.map((result) => (
                <UserSearchResult
                  key={result.id}
                  user={result}
                  currentUserId={user?.id}
                  onFriendAction={handleFriendAction}
                />
              ))}
            </div>
          ) : (
            <div className="p-4 text-center text-brand-dark/70 font-body">
              No users found
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SearchInput;
