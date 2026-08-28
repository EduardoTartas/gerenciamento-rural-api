// src/service/sync/validacao.js

import { InsumoCreateSchema, InsumoUpdateSchema } from '../../utils/validators/schemas/zod/InsumoSchema.js';
import {
    ManejoPastoCreateSchema,
    ManejoPastoUpdateSchema,
} from '../../utils/validators/schemas/zod/ManejoPastoSchema.js';
import {
    ManejoRebanhoCreateSchema,
    ManejoRebanhoUpdateSchema,
} from '../../utils/validators/schemas/zod/ManejoRebanhoSchema.js';
import { MovimentacaoCreateSchema } from '../../utils/validators/schemas/zod/MovimentacaoSchema.js';
import { MovimentacaoInsumoCreateSchema } from '../../utils/validators/schemas/zod/MovimentacaoInsumoSchema.js';
import {
    RegimeConsumoInsumoCreateSchema,
    RegimeConsumoInsumoUpdateSchema,
} from '../../utils/validators/schemas/zod/RegimeConsumoInsumoSchema.js';
import {
    PastoCreateSchema,
    PastoUpdateSchema,
} from '../../utils/validators/schemas/zod/PastoSchema.js';
import {
    PropriedadeCreateSchema,
    PropriedadeUpdateSchema,
} from '../../utils/validators/schemas/zod/PropriedadeSchema.js';
import {
    RebanhoCreateSchema,
    RebanhoUpdateSchema,
} from '../../utils/validators/schemas/zod/RebanhoSchema.js';

/**
 * Liga `(entidade, ação)` ao MESMO schema Zod que o controller REST usa para a
 * mesma operação. Tabela irmã de `DESPACHO`: o que aquela faz com o método do
 * service, esta faz com a porta de entrada do dado.
 *
 * Sem isto o lote era um portão aberto: `dados` chegava como `z.record()` —
 * ou seja, sem validação nenhuma — e seguia verbatim até
 * `repository.update(id, data)`. Como todo schema REST é `.strict()`, um campo
 * que o REST recusa com 400 (`propriedadeId` num `pastos:UPDATE`, `rebanhoId`
 * num `manejo_rebanhos:UPDATE`) entrava pelo lote e reparentava o registro para
 * a propriedade de outro usuário — o service só confere a posse ATUAL do
 * registro, não para onde ele está sendo movido.
 *
 * Nenhuma regra de negócio é reescrita aqui: a validação já mora nos schemas, e
 * esta tabela só garante que o caminho do lote passe por eles como o REST passa.
 *
 * `DELETE` não aparece: exclusão não tem corpo, igual em `despacho.js`.
 */
export const SCHEMAS_DE_MUTACAO = {
    'propriedades:CREATE': PropriedadeCreateSchema,
    'propriedades:UPDATE': PropriedadeUpdateSchema,

    'pastos:CREATE': PastoCreateSchema,
    'pastos:UPDATE': PastoUpdateSchema,

    'rebanhos:CREATE': RebanhoCreateSchema,
    'rebanhos:UPDATE': RebanhoUpdateSchema,

    'manejo_pastos:CREATE': ManejoPastoCreateSchema,
    'manejo_pastos:UPDATE': ManejoPastoUpdateSchema,

    'manejo_rebanhos:CREATE': ManejoRebanhoCreateSchema,
    'manejo_rebanhos:UPDATE': ManejoRebanhoUpdateSchema,

    'historico_movimentacoes:CREATE': MovimentacaoCreateSchema,

    'insumos:CREATE': InsumoCreateSchema,
    'insumos:UPDATE': InsumoUpdateSchema,

    'movimentacoes_insumo:CREATE': MovimentacaoInsumoCreateSchema,

    'regimes_consumo_insumo:CREATE': RegimeConsumoInsumoCreateSchema,
    'regimes_consumo_insumo:UPDATE': RegimeConsumoInsumoUpdateSchema,
};

/**
 * Descreve o primeiro problema encontrado em português.
 *
 * Campo fora do schema é o caso mais comum e o mais perigoso, e a mensagem do
 * Zod para ele vem em inglês — sem tradução, o produtor leria "Unrecognized
 * key(s) in object" na tela do celular.
 */
function descreverProblema(issue, entidade) {
    if (!issue) return { campo: null, mensagem: 'Dados inválidos para esta mutação.' };

    const campo = Array.isArray(issue.path) && issue.path.length
        ? issue.path.join('.')
        : null;

    if (issue.code === 'unrecognized_keys') {
        const chaves = (issue.keys ?? []).join(', ');
        return {
            campo: chaves || campo,
            mensagem: `Campo não aceito em ${entidade}: ${chaves}.`,
        };
    }

    return { campo, mensagem: issue.message ?? 'Dados inválidos para esta mutação.' };
}

/**
 * Valida `dados` contra o schema da entidade e devolve a versão **coagida**.
 *
 * Devolver o resultado do parse, e não o objeto cru, é o que faz o lote coincidir
 * com o REST: `z.coerce.date()` transforma a string ISO em `Date` antes do
 * Prisma. Passando o cru, o Prisma recebia texto onde espera data e lançava um
 * `PrismaClientValidationError` — que, sem `errorType`, o lote classificava como
 * `serverError` recuperável e o cliente reenviava para sempre.
 *
 * Nunca lança: uma recusa aqui é recusa DE UM item, não do lote.
 *
 * @returns {{ok: true, dados: object} | {ok: false, erro: {errorType: string, field: string|null, customMessage: string}}}
 */
export function validarDadosDaMutacao({ entidade, acao, dados }) {
    const schema = SCHEMAS_DE_MUTACAO[`${entidade}:${acao}`];

    // Sem schema é DELETE (ou par já recusado por `DESPACHO`): não há corpo a validar.
    if (!schema) return { ok: true, dados };

    const resultado = schema.safeParse(dados ?? {});

    if (!resultado.success) {
        const { campo, mensagem } = descreverProblema(resultado.error.issues?.[0], entidade);
        return {
            ok: false,
            erro: {
                errorType: 'validationError',
                field: campo,
                customMessage: mensagem,
            },
        };
    }

    return { ok: true, dados: resultado.data };
}
