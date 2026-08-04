// Carregado antes de cada arquivo de teste.
//
// `src/config/dbConnect.js` lança no import quando DATABASE_URL está ausente, e
// importar qualquer service puxa esse módulo pela cadeia de dependências. O Pool
// do `pg` é preguiçoso: construí-lo não abre conexão.
process.env.DATABASE_URL ??=
    'postgresql://teste:teste@localhost:5432/pasto_livre_teste';
process.env.BETTER_AUTH_SECRET ??= 'segredo-usado-apenas-em-teste';
process.env.BETTER_AUTH_URL ??= 'http://localhost:6060';
process.env.NODE_ENV ??= 'test';
