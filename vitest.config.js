import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        environment: 'node',
        // Sobrescreve NODE_ENV mesmo quando o container de dev exporta
        // `development`: o setupFile roda depois e usa `??=`, que não corrige.
        // Também silencia os listeners do logger (checam `NODE_ENV !== 'test'`).
        env: { NODE_ENV: 'test' },
        globalSetup: ['./test/apoio/globalSetup.js'],
        setupFiles: ['./test/preparo.js', './test/apoio/ambiente.js'],
        include: ['test/endpoints/**/*.test.js'],
        // Todos os arquivos truncam o mesmo banco antes de cada teste: rodar em
        // paralelo faria um limpar os dados do outro no meio da execução.
        fileParallelism: false,
        testTimeout: 30_000,
        hookTimeout: 60_000,
        coverage: {
            provider: 'v8',
            reportsDirectory: './coverage',
            include: ['src/**/*.js'],
        },
    },
});
