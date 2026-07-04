import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        globals: true,
        reporters: ['dot'],
        silent: true,
        exclude: [
            '**/node_modules/**',
            '**/dist/**',
            '**/shared/tests/*Performance.test.js'
        ],
        coverage: {
            provider: 'v8',
            reporter: ['text-summary', 'html', 'lcov'],
            include: ['shared/**/*.js', 'client/src/**/*.js', 'client/src/**/*.jsx'],
            exclude: ['**/*.test.js', '**/*.test.jsx', '**/*.spec.js', 'shared/EntityStats.js']
        },
        projects: [
            {
                test: {
                    name: 'node-suite',
                    globals: true,
                    environment: 'node',
                    include: ['server/**/*.test.js', 'shared/tests/**/*.test.js'],
                    exclude: ['shared/tests/*Performance.test.js']
                }
            },
            {
                test: {
                    name: 'client-ui',
                    globals: true,
                    environment: 'jsdom',
                    include: ['client/src/**/*.test.js', 'client/src/**/*.test.jsx']
                }
            }
        ]
    }
});
