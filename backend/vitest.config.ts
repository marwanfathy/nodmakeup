import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        environment: 'node',
        include: ['**/*.test.ts'],
        // Pure unit tests only — services that touch prisma/redis are integration
        // tested live against the running stack, not in CI.
        exclude: ['node_modules', 'dist', '.runtime'],
        testTimeout: 10_000,
    },
});