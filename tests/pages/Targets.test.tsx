import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '../../src/providers/AuthProvider';
import Targets from '../../src/pages/Targets';

// Mock the hooks to prevent loading states
vi.mock('../../src/store/useTargets', () => ({
  useTargets: () => ({
    targets: [],
    isLoading: false,
    refresh: vi.fn(),
    clearCache: vi.fn()
  })
}));

vi.mock('../../src/store/useRooms', () => ({
  useRooms: () => ({
    rooms: [],
    isLoading: false,
    fetchRooms: vi.fn()
  })
}));

vi.mock('../../src/hooks/useShootingActivityPolling', () => ({
  useShootingActivityPolling: () => ({
    currentInterval: 10000,
    currentMode: 'standby',
    hasActiveShooters: false,
    hasRecentActivity: false,
    isStandbyMode: true,
    targetActivity: [],
    activeShotsCount: 0,
    recentShotsCount: 0,
    forceUpdate: vi.fn()
  })
}));

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

    it('should have refresh button', async () => {
      render(<Targets />, { wrapper: createTestWrapper() });

      await waitFor(() => {
        const refreshButton = screen.getByRole('button', { name: /refresh/i });
        expect(refreshButton).toBeInTheDocument();
      });
    });

    it('should have add target button', async () => {
      render(<Targets />, { wrapper: createTestWrapper() });

      await waitFor(() => {
        const addButton = screen.getByRole('button', { name: /add target/i });
        expect(addButton).toBeInTheDocument();
      });
    });
  });
}); 