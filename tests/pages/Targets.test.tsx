import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '../../src/providers/AuthProvider';
import Targets from '../../src/pages/Targets';

const createTestWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          {children}
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
};

describe('Targets Page', () => {
  beforeEach(() => {
    // Reset any global state if needed
  });

  describe('rendering', () => {
    it('should render the targets page', () => {
      render(<Targets />, { wrapper: createTestWrapper() });

      // Use a more specific query to avoid multiple elements
      expect(screen.getByRole('heading', { name: 'Targets' })).toBeInTheDocument();
    });
  });

  describe('basic functionality', () => {
    it('should have search input', () => {
      render(<Targets />, { wrapper: createTestWrapper() });

      const searchInput = screen.getByPlaceholderText('Search targets...');
      expect(searchInput).toBeInTheDocument();
    });

    it('should have refresh button', () => {
      render(<Targets />, { wrapper: createTestWrapper() });

      const refreshButton = screen.getByText('Refresh');
      expect(refreshButton).toBeInTheDocument();
    });

    it('should have add target button', () => {
      render(<Targets />, { wrapper: createTestWrapper() });

      const addButton = screen.getByText('Add Target');
      expect(addButton).toBeInTheDocument();
    });
  });
}); 