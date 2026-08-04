import { describe, expect, it } from 'vitest';

describe('suíte de testes', () => {
    it('carrega as variáveis de ambiente do preparo', () => {
        expect(process.env.NODE_ENV).toBe('test');
        expect(process.env.DATABASE_URL).toBeDefined();
    });

    it('importa um módulo do src sem estourar por falta de ambiente', async () => {
        const { default: CustomError } = await import(
            '../src/utils/helpers/CustomError.js'
        );
        expect(new CustomError({ statusCode: 400 }).statusCode).toBe(400);
    });
});
