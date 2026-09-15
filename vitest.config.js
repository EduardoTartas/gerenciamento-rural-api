import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        coverage: {
            provider: 'v8',
            reportsDirectory: './coverage',
            include: ['src/**/*.js'],
        },
        projects: [
            {
                test: {
                    name: 'unidade',
                    environment: 'node',
                    env: { NODE_ENV: 'test' },
                    setupFiles: ['./test/preparo.js'],
                    include: ['test/unidade/**/*.test.js'],
                },
            },
            {
                test: {
                    name: 'endpoints',
                    environment: 'node',
                    env: { NODE_ENV: 'test' },
                    globalSetup: ['./test/apoio/globalSetup.js'],
                    setupFiles: ['./test/preparo.js', './test/apoio/ambiente.js'],
                    include: ['test/endpoints/**/*.test.js'],
                    fileParallelism: false,
                    testTimeout: 30_000,
                    hookTimeout: 60_000,
                },
            },
        ],
    },
});
