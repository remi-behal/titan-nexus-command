import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        globals: true,
        reporters: ['dot'],
        silent: true,
        projects: [
            {
                test: {
                    name: 'perf-node',
                    environment: 'node',
                    include: ['shared/tests/NukePerformance.test.js']
                }
            },
            {
                test: {
                    name: 'perf-jsdom',
                    environment: 'jsdom',
                    include: ['shared/tests/HighLoadPerformance.test.js']
                }
            }
        ]
    }
});
