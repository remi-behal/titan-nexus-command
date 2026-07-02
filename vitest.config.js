import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        globals: true,
        environment: 'jsdom',
        reporters: ['dot'],
        silent: true,
        coverage: {
            provider: 'v8',
            reporter: ['text-summary', 'html', 'lcov'],
            include: ['shared/**/*.js', 'client/src/**/*.js', 'client/src/**/*.jsx'],
            exclude: ['**/*.test.js', '**/*.test.jsx', '**/*.spec.js', 'shared/EntityStats.js']
        }
    }
});
