
import { InsumoCreateSchema, InsumoUpdateSchema } from '../../utils/validators/schemas/zod/InsumoSchema.js';
import {
    ManejoPastoCreateSchema,
    ManejoPastoUpdateSchema,
} from '../../utils/validators/schemas/zod/ManejoPastoSchema.js';
import {
    ManejoRebanhoCreateSchema,
    ManejoRebanhoUpdateSchema,
} from '../../utils/validators/schemas/zod/ManejoRebanhoSchema.js';
import { NotificacaoUpdateSchema } from '../../utils/validators/schemas/zod/NotificacaoSchema.js';
import { MovimentacaoCreateSchema } from '../../utils/validators/schemas/zod/MovimentacaoSchema.js';
import { SaidaRebanhoCreateSchema } from '../../utils/validators/schemas/zod/SaidaRebanhoSchema.js';
import {
    MovimentacaoInsumoCreateSchema,
    MovimentacaoInsumoUpdateSchema,
} from '../../utils/validators/schemas/zod/MovimentacaoInsumoSchema.js';
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

    'saidas_rebanho:CREATE': SaidaRebanhoCreateSchema,

    'insumos:CREATE': InsumoCreateSchema,
    'insumos:UPDATE': InsumoUpdateSchema,

    'movimentacoes_insumo:CREATE': MovimentacaoInsumoCreateSchema,
    'movimentacoes_insumo:UPDATE': MovimentacaoInsumoUpdateSchema,

    'regimes_consumo_insumo:CREATE': RegimeConsumoInsumoCreateSchema,
    'regimes_consumo_insumo:UPDATE': RegimeConsumoInsumoUpdateSchema,

    'notificacoes:UPDATE': NotificacaoUpdateSchema,
};

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

export function validarDadosDaMutacao({ entidade, acao, dados }) {
    const schema = SCHEMAS_DE_MUTACAO[`${entidade}:${acao}`];

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
