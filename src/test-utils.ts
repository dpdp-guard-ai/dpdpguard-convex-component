/**
 * Test utilities and helpers for DpdpGuard tests
 */

import { vi } from 'vitest';
import type { ConvexClient } from 'convex/browser';

/**
 * Create a mock Convex client for testing
 */
export function createMockConvexClient(): ConvexClient {
  return {
    setAuth: vi.fn(),
    clearAuth: vi.fn(),
    mutation: vi.fn(),
    query: vi.fn(),
    action: vi.fn(),
    onAuth: vi.fn(),
    onError: vi.fn(),
    watchQuery: vi.fn(),
    watchMutation: vi.fn(),
  } as any;
}

/**
 * Create a mock query function
 */
export function createMockQuery<T>(data: T) {
  return vi.fn().mockResolvedValue(data);
}

/**
 * Create a mock mutation function
 */
export function createMockMutation<T>(data: T) {
  return vi.fn().mockResolvedValue(data);
}

/**
 * Create a mock action function
 */
export function createMockAction<T>(data: T) {
  return vi.fn().mockResolvedValue(data);
}
