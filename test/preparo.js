process.env.DATABASE_URL ??=
    'postgresql://teste:teste@localhost:5432/pasto_livre_teste';
process.env.BETTER_AUTH_SECRET ??= 'segredo-usado-apenas-em-teste';
process.env.BETTER_AUTH_URL ??= 'http://localhost:6060';
process.env.NODE_ENV ??= 'test';

process.env.GARAGE_ENDPOINT ??= 'localhost';
process.env.GARAGE_PORT ??= '3900';
process.env.GARAGE_ACCESS_KEY ??= 'teste';
process.env.GARAGE_SECRET_KEY ??= 'teste';
process.env.GARAGE_BUCKET_FOTOS ??= 'fotos-teste';
process.env.GARAGE_PUBLIC_URL ??= 'http://localhost:3900/fotos-teste';
