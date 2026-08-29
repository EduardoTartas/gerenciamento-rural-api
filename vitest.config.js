import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        environment: 'node',
        // Sobrescreve NODE_ENV mesmo quando o container de dev exporta
        // `development`: o setupFile roda depois e usa `??=`, que não corrige.
        // Também silencia os listeners do logger (checam `NODE_ENV !== 'test'`).
        env: { NODE_ENV: 'test' },
        setupFiles: ['./test/preparo.js'],
        include: ['test/**/*.test.js'],
        coverage: {
            provider: 'v8',
            reportsDirectory: './coverage',
            include: ['src/**/*.js'],
        },
    },
});
