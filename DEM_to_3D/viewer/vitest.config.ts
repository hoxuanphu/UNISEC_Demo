import { defineConfig, mergeConfig } from 'vitest/config';
import viteConfig from './vite.config';

// Generated releases and archived worktrees must never be collected as application tests.
export default mergeConfig(viteConfig, defineConfig({
  test: { include: ['src/**/*.{test,spec}.{ts,tsx}'] },
}));
