
import React, { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  debounceMs?: number;
}

const SearchInput: React.FC<SearchInputProps> = ({
  value,
  onChange,
  placeholder = 'Search by email or phone...',
  debounceMs = 400
}) => {
  const [inputValue, setInputValue] = useState(value);
  
  // Set local state when prop changes
  useEffect(() => {
    setInputValue(value);
  }, [value]);
  
  // Debounce input changes
  useEffect(() => {
    const handler = setTimeout(() => {
      if (inputValue !== value) {
        onChange(inputValue);
      }
    }, debounceMs);
    
    return () => clearTimeout(handler);
  }, [inputValue, value, onChange, debounceMs]);
  
  return (
    <div className="relative">
      <Search 
        size={18}
        className="absolute left-3 top-1/2 transform -translate-y-1/2 text-brand-lavender"
      />
      <Input
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        placeholder={placeholder}
        className="pl-10 bg-brand-surface-light border-brand-lavender/30 text-white"
      />
    </div>
  );
};

export default SearchInput;
