import { describe, expect, it, vi } from 'vitest';

/**
 * O SyncService não conhece regra de negócio. Ele resolve ordem, dependência e
 * idempotência, e delega ao service de domínio que já existe — multi-tenancy,
 * lotação conjunta e ciclo de descanso continuam com dono único.
 */
describe('aplicação do lote', () => {
    const req = { user: { id: 'u1' } };

    async function montar({ despacho, jaAplicadas = new Map() }) {
        vi.doMock('../src/service/sync/despacho.js', () => ({ DESPACHO: despacho }));
        vi.doMock('../src/repository/MutacaoAplicadaRepository.js', () => ({
            default: class {
                buscarPorIds = vi.fn().mockResolvedValue(jaAplicadas);
                registrar = vi.fn().mockResolvedValue(undefined);
                limparAntigas = vi.fn().mockResolvedValue(0);
            },
        }));
        vi.doMock('../src/config/dbConnect.js', () => ({
            default: { prisma: { $transaction: async (cb) => cb({}) } },
        }));

        vi.resetModules();
        const { default: SyncService } = await import('../src/service/SyncService.js');
        return new SyncService();
    }

    const UUID = '11111111-1111-4111-8111-111111111111';

    /**
     * Corpo mínimo que passa pelo schema real da entidade.
     *
     * Desde que o lote valida `dados` contra o mesmo schema do REST, um `{}`
     * genérico seria recusado antes de chegar ao despacho — e os testes de
     * ordem/dependência/idempotência mediriam a validação em vez do que querem
     * medir.
     */
    const CORPO_VALIDO = {
        'propriedades:CREATE': { nome: 'Fazenda A' },
        'propriedades:UPDATE': { nome: 'Fazenda A' },
        'pastos:CREATE': { propriedadeId: UUID, nome: 'Pasto A' },
        'pastos:UPDATE': { nome: 'Pasto A' },
        'rebanhos:CREATE': { propriedadeId: UUID, nomeRebanho: 'Lote A', pastoAtualId: UUID },
        'rebanhos:UPDATE': { nomeRebanho: 'Lote A' },
        'manejo_rebanhos:CREATE': {
            rebanhoId: UUID,
            tipoManejoId: UUID,
            dataAtividade: '2026-08-01T12:00:00.000Z',
        },
    };

    const mutacao = (id, entidade, acao, dependeDe = null, dados = null) => ({
        id,
        entidade,
        acao,
        entidadeId: `ent-${id}`,
        dependeDe,
        dados: dados ?? CORPO_VALIDO[`${entidade}:${acao}`] ?? {},
    });

    it('aplica mutações independentes e devolve aceito', async () => {
        const service = await montar({
            despacho: {
                'pastos:CREATE': vi.fn().mockResolvedValue({ id: 'ent-a', nome: 'A' }),
            },
        });

        const { resultados } = await service.aplicarLote(
            [mutacao('a', 'pastos', 'CREATE')],
            req,
        );

        expect(resultados).toHaveLength(1);
        expect(resultados[0]).toMatchObject({
            id: 'a',
            situacao: 'aceito',
            entidade: 'pastos',
            dados: { id: 'ent-a', nome: 'A' },
        });
    });

    it('recusa a que falha e bloqueia quem depende dela', async () => {
        const erroDeConflito = Object.assign(new Error('nome duplicado'), {
            errorType: 'conflict',
            field: 'nome',
            customMessage: 'Já existe uma pastagem com este nome nesta propriedade.',
        });

        const service = await montar({
            despacho: {
                'pastos:CREATE': vi.fn().mockRejectedValue(erroDeConflito),
                'rebanhos:CREATE': vi.fn().mockResolvedValue({}),
                'manejo_rebanhos:CREATE': vi.fn().mockResolvedValue({}),
            },
        });

        const { resultados } = await service.aplicarLote(
            [
                mutacao('pasto', 'pastos', 'CREATE'),
                mutacao('rebanho', 'rebanhos', 'CREATE', 'pasto'),
                mutacao('manejo', 'manejo_rebanhos', 'CREATE', 'rebanho'),
            ],
            req,
        );

        const porId = Object.fromEntries(resultados.map((r) => [r.id, r]));
        expect(porId.pasto.situacao).toBe('recusado');
        expect(porId.pasto.erro).toMatchObject({
            tipo: 'conflict',
            campo: 'nome',
            recuperavel: false,
        });
        // Bloqueado, não recusado: o rebanho não foi tentado, então não pode
        // aparecer como erro seu. Voltar 404 aqui esconderia a causa real.
        expect(porId.rebanho).toMatchObject({
            situacao: 'bloqueado',
            bloqueadoPor: 'pasto',
        });
        expect(porId.manejo.situacao).toBe('bloqueado');
    });

    it('mutação independente entra mesmo com outra recusada', async () => {
        const service = await montar({
            despacho: {
                'pastos:CREATE': vi
                    .fn()
                    .mockRejectedValueOnce(
                        Object.assign(new Error('x'), { errorType: 'conflict' }),
                    )
                    .mockResolvedValueOnce({ id: 'ent-b' }),
            },
        });

        const { resultados } = await service.aplicarLote(
            [mutacao('a', 'pastos', 'CREATE'), mutacao('b', 'pastos', 'CREATE')],
            req,
        );

        const porId = Object.fromEntries(resultados.map((r) => [r.id, r]));
        expect(porId.a.situacao).toBe('recusado');
        expect(porId.b.situacao).toBe('aceito');
    });

    it('não reexecuta mutação já aplicada', async () => {
        const criar = vi.fn().mockResolvedValue({});
        const service = await montar({
            despacho: { 'pastos:CREATE': criar },
            jaAplicadas: new Map([
                ['a', { id: 'a', situacao: 'aceito', entidade: 'pastos', entidadeId: 'ent-a' }],
            ]),
        });

        const { resultados } = await service.aplicarLote(
            [mutacao('a', 'pastos', 'CREATE')],
            req,
        );

        expect(criar).not.toHaveBeenCalled();
        expect(resultados[0].situacao).toBe('aceito');
    });

    it('busca mutações já aplicadas escopada ao usuário autenticado', async () => {
        // O id da mutação é gerado pelo cliente. Sem filtrar por usuarioId na
        // consulta de idempotência, uma colisão de id com outro usuário
        // devolveria o resultado alheio como se fosse deste usuário.
        const service = await montar({
            despacho: { 'pastos:CREATE': vi.fn().mockResolvedValue({ id: 'ent-a' }) },
        });

        await service.aplicarLote([mutacao('a', 'pastos', 'CREATE')], req);

        expect(service.mutacoesAplicadas.buscarPorIds).toHaveBeenCalledWith('u1', ['a']);
    });

    it('erro resourceNotFound do domínio volta como recuperavel: false', async () => {
        // `ensure*Exists` dos services de domínio lança `errorType:
        // 'resourceNotFound'`, não `notFound`. Antes do fix, isso caía no
        // padrão `serverError` (recuperável) e o cliente offline reenviaria a
        // mutação morta para sempre.
        const erroDeRecurso = Object.assign(new Error('Pastagem não encontrada.'), {
            errorType: 'resourceNotFound',
            field: 'Pastagem',
            customMessage: 'Pastagem não encontrada ou não pertence ao usuário autenticado.',
        });

        const service = await montar({
            despacho: { 'pastos:UPDATE': vi.fn().mockRejectedValue(erroDeRecurso) },
        });

        const { resultados } = await service.aplicarLote(
            [mutacao('a', 'pastos', 'UPDATE')],
            req,
        );

        expect(resultados[0]).toMatchObject({
            situacao: 'recusado',
            erro: {
                tipo: 'resourceNotFound',
                recuperavel: false,
                mensagem: 'Pastagem não encontrada ou não pertence ao usuário autenticado.',
            },
        });
    });

    it('erro inesperado (sem errorType) vira recusado genérico, sem vazar texto interno nem derrubar o lote', async () => {
        const service = await montar({
            despacho: {
                'pastos:CREATE': vi.fn().mockRejectedValue(new Error('null value in column "nome" violates not-null constraint')),
            },
        });

        const { resultados } = await service.aplicarLote(
            [mutacao('a', 'pastos', 'CREATE')],
            req,
        );

        expect(resultados[0].situacao).toBe('recusado');
        expect(resultados[0].erro.tipo).toBe('serverError');
        expect(resultados[0].erro.recuperavel).toBe(true);
        expect(resultados[0].erro.mensagem).not.toMatch(/constraint|column/i);
    });

    it('erro inesperado sem forma de Error (throw de valor não-Error) não derruba o lote', async () => {
        const service = await montar({
            despacho: {
                'pastos:CREATE': vi.fn().mockRejectedValue('falha crua sem shape de Error'),
            },
        });

        await expect(
            service.aplicarLote([mutacao('a', 'pastos', 'CREATE')], req),
        ).resolves.toMatchObject({
            resultados: [{ situacao: 'recusado', erro: { tipo: 'serverError' } }],
        });
    });

    it('recusa par entidade-ação desconhecido', async () => {
        const service = await montar({ despacho: {} });

        const { resultados } = await service.aplicarLote(
            [mutacao('a', 'coisas', 'CREATE')],
            req,
        );

        expect(resultados[0]).toMatchObject({
            situacao: 'recusado',
            erro: { tipo: 'validationError' },
        });
    });

    // ================================
    // VALIDAÇÃO POR ENTIDADE
    // ================================

    it('recusa UPDATE de pasto que tenta reparentar para outra propriedade', async () => {
        // O exploit: `PastoService.update` confere a posse ATUAL do pasto, não o
        // destino. `propriedadeId` não existe em `PastoUpdateSchema`, então o
        // REST devolve 400 — mas o lote passava o campo verbatim ao Prisma e o
        // pasto ia para o tenant da vítima.
        const atualizar = vi.fn().mockResolvedValue({});
        const service = await montar({ despacho: { 'pastos:UPDATE': atualizar } });

        const { resultados } = await service.aplicarLote(
            [
                mutacao('a', 'pastos', 'UPDATE', null, {
                    nome: 'Pasto A',
                    propriedadeId: '22222222-2222-4222-8222-222222222222',
                }),
            ],
            req,
        );

        expect(resultados[0]).toMatchObject({
            situacao: 'recusado',
            erro: { tipo: 'validationError', recuperavel: false },
        });
        // O que prova que não houve reparentamento: o service nunca foi chamado.
        expect(atualizar).not.toHaveBeenCalled();
        expect(resultados[0].erro.mensagem).toMatch(/propriedadeId/);
    });

    it('recusa campo fora do schema nas demais entidades reparentáveis', async () => {
        const casos = [
            ['rebanhos', 'UPDATE', { propriedadeId: UUID }],
            ['manejo_pastos', 'UPDATE', { pastoId: UUID }],
            ['manejo_rebanhos', 'UPDATE', { rebanhoId: UUID }],
        ];

        for (const [entidade, acao, dados] of casos) {
            const executar = vi.fn().mockResolvedValue({});
            const service = await montar({ despacho: { [`${entidade}:${acao}`]: executar } });

            const { resultados } = await service.aplicarLote(
                [mutacao('a', entidade, acao, null, dados)],
                req,
            );

            expect(resultados[0].situacao, `${entidade}:${acao}`).toBe('recusado');
            expect(resultados[0].erro.tipo, `${entidade}:${acao}`).toBe('validationError');
            expect(executar, `${entidade}:${acao}`).not.toHaveBeenCalled();
        }
    });

    it('mutação bem formada continua passando, em mais de uma entidade', async () => {
        // Trava contra rigor demais: a validação não pode recusar o caminho feliz.
        const criarPasto = vi.fn().mockResolvedValue({ id: 'ent-p' });
        const criarRebanho = vi.fn().mockResolvedValue({ id: 'ent-r' });
        const atualizarPropriedade = vi.fn().mockResolvedValue({ id: 'ent-f' });

        const service = await montar({
            despacho: {
                'pastos:CREATE': criarPasto,
                'rebanhos:CREATE': criarRebanho,
                'propriedades:UPDATE': atualizarPropriedade,
            },
        });

        const { resultados } = await service.aplicarLote(
            [
                mutacao('p', 'pastos', 'CREATE'),
                mutacao('r', 'rebanhos', 'CREATE'),
                mutacao('f', 'propriedades', 'UPDATE'),
            ],
            req,
        );

        expect(resultados.map((r) => r.situacao)).toEqual(['aceito', 'aceito', 'aceito']);
        expect(criarPasto).toHaveBeenCalled();
        expect(criarRebanho).toHaveBeenCalled();
        expect(atualizarPropriedade).toHaveBeenCalled();
    });

    it('entrega ao service o dado coagido, não a string crua', async () => {
        // `z.coerce.date()` é o que o REST aplica. Sem ele, a string ISO chegava
        // ao Prisma como texto e virava PrismaClientValidationError — sem
        // `errorType`, classificado como serverError recuperável, ou seja,
        // reenvio eterno de uma mutação que nunca vai passar.
        const criar = vi.fn().mockResolvedValue({});
        const service = await montar({ despacho: { 'manejo_rebanhos:CREATE': criar } });

        await service.aplicarLote([mutacao('a', 'manejo_rebanhos', 'CREATE')], req);

        const { dados } = criar.mock.calls[0][0];
        expect(dados.dataAtividade).toBeInstanceOf(Date);
        expect(dados.dataAtividade.toISOString()).toBe('2026-08-01T12:00:00.000Z');
    });

    it('corpo inválido recusa só o item, sem derrubar o lote', async () => {
        const criar = vi.fn().mockResolvedValue({ id: 'ent-b' });
        const service = await montar({ despacho: { 'pastos:CREATE': criar } });

        const { resultados } = await service.aplicarLote(
            [
                // Falta `propriedadeId`, que `PastoCreateSchema` exige.
                mutacao('a', 'pastos', 'CREATE', null, { nome: 'Pasto A' }),
                mutacao('b', 'pastos', 'CREATE'),
            ],
            req,
        );

        const porId = Object.fromEntries(resultados.map((r) => [r.id, r]));
        expect(porId.a.situacao).toBe('recusado');
        expect(porId.a.erro.tipo).toBe('validationError');
        expect(porId.b.situacao).toBe('aceito');
    });

    it('DELETE não exige corpo', async () => {
        const remover = vi.fn().mockResolvedValue({ id: 'ent-a', ativo: false });
        const service = await montar({ despacho: { 'pastos:DELETE': remover } });

        const { resultados } = await service.aplicarLote(
            [mutacao('a', 'pastos', 'DELETE')],
            req,
        );

        expect(resultados[0].situacao).toBe('aceito');
    });

    it('lança quando há ciclo de dependência', async () => {
        const service = await montar({ despacho: {} });

        await expect(
            service.aplicarLote(
                [
                    mutacao('a', 'pastos', 'CREATE', 'b'),
                    mutacao('b', 'pastos', 'CREATE', 'a'),
                ],
                req,
            ),
        ).rejects.toMatchObject({ errorType: 'validationError' });
    });
});
