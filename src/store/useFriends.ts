
import { create } from 'zustand';

interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  score: number;
  avatar: string;
  status?: 'pending' | 'accepted';
  addedAt?: string;
}

interface FriendsState {
  friends: User[];
  searchResults: User[];
  searchQuery: string;
  isSearching: boolean;
  isLoading: boolean;
  
  // Methods
  searchUsers: (query: string) => Promise<void>;
  addFriend: (userId: string) => Promise<void>;
  loadFriends: () => Promise<void>;
  setSearchQuery: (query: string) => void;
}

export const useFriends = create<FriendsState>((set, get) => ({
  friends: [],
  searchResults: [],
  searchQuery: '',
  isSearching: false,
  isLoading: false,
  
  searchUsers: async (query: string) => {
    if (query.length < 3) {
      set({ searchResults: [] });
      return;
    }
    
    set({ isSearching: true });
    
    try {
      const response = await fetch(`/search/users?query=${encodeURIComponent(query)}`);
      
      if (!response.ok) {
        throw new Error('Failed to search users');
      }
      
      const results = await response.json();
      
      // Filter out existing friends
      const friendIds = get().friends.map(friend => friend.id);
      const filteredResults = results.filter((user: User) => !friendIds.includes(user.id));
      
      set({ searchResults: filteredResults, isSearching: false });
    } catch (error) {
      console.error("User search error:", error);
      set({ searchResults: [], isSearching: false });
    }
  },
  
  addFriend: async (userId: string) => {
    try {
      const response = await fetch(`/friends/${userId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (!response.ok) {
        throw new Error('Failed to add friend');
      }
      
      // Move user from search results to friends list
      const userToAdd = get().searchResults.find(user => user.id === userId);
      
      if (userToAdd) {
        set({
          searchResults: get().searchResults.filter(user => user.id !== userId),
          friends: [...get().friends, {
            ...userToAdd,
            status: 'pending',
            addedAt: new Date().toISOString()
          }]
        });
      }
      
      // Refresh friends list after a delay to get auto-accepted status
      setTimeout(get().loadFriends, 2500);
    } catch (error) {
      console.error("Add friend error:", error);
    }
  },
  
  loadFriends: async () => {
    set({ isLoading: true });
    
    try {
      const response = await fetch('/friends');
      
      if (!response.ok) {
        throw new Error('Failed to load friends');
      }
      
      const friends = await response.json();
      set({ friends, isLoading: false });
    } catch (error) {
      console.error("Load friends error:", error);
      set({ isLoading: false });
    }
  },
  
  setSearchQuery: (query: string) => {
    set({ searchQuery: query });
  }
}));
