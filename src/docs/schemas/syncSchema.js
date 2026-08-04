// src/docs/schemas/syncSchema.js

const syncSchemas = {
    Mutacao: {
        type: "object",
        properties: {
            id:         { type: "string", format: "uuid", description: "Identificador da mutação em si (gerado pelo cliente), usado para idempotência.", example: "11111111-1111-4111-8111-111111111111" },
            entidade:   { type: "string", description: "Nome da entidade alvo. Suportadas: propriedades, pastos, rebanhos, manejo_pastos, manejo_rebanhos, historico_movimentacoes.", example: "pastos" },
            acao:       { type: "string", enum: ["CREATE", "UPDATE", "DELETE"], description: "historico_movimentacoes não aceita UPDATE — movimentação é evento, não é editada." },
            entidadeId: { type: "string", format: "uuid", description: "Identificador da entidade afetada. Fonte única do id — não deve ser repetido dentro de `dados`.", example: "22222222-2222-4222-8222-222222222222" },
            dependeDe:  { type: "string", format: "uuid", nullable: true, description: "Id de outra mutação deste mesmo lote que precisa ser aplicada antes desta. Referencia sempre uma mutação, nunca uma entidade do banco." },
            dados:      { type: "object", additionalProperties: true, description: "Corpo da mutação. Obrigatório em CREATE e UPDATE; ausente em DELETE. Nunca deve conter a chave `id`." },
        },
        required: ["id", "entidade", "acao", "entidadeId"],
        description: "Uma mutação individual dentro do lote de sincronização."
    },

    SyncLote: {
        type: "object",
        properties: {
            mutacoes: {
                type: "array",
                items: { $ref: "#/components/schemas/Mutacao" },
                minItems: 1,
                maxItems: 100,
                description: "Lote de 1 a 100 mutações, na ordem em que o app as gerou. O servidor reordena internamente por dependência antes de aplicar."
            }
        },
        required: ["mutacoes"],
        description: "Envelope enviado pelo app ao reconectar, contendo a fila de mutações pendentes."
    },

    MutacaoResultado: {
        type: "object",
        properties: {
            id:          { type: "string", format: "uuid", description: "Mesmo id da mutação enviada." },
            situacao:    { type: "string", enum: ["aceito", "recusado", "bloqueado"] },
            entidade:    { type: "string", example: "pastos" },
            entidadeId:  { type: "string", format: "uuid" },
            dados:       { type: "object", additionalProperties: true, description: "Presente apenas quando situacao = aceito: o registro gravado." },
            erro: {
                type: "object",
                description: "Presente apenas quando situacao = recusado.",
                properties: {
                    tipo:       { type: "string", example: "validationError" },
                    campo:      { type: "string", nullable: true },
                    mensagem:   { type: "string" },
                    recuperavel: { type: "boolean", description: "Indica se reenviar a mesma mutação, sem alteração, pode ter sucesso mais tarde." }
                }
            },
            bloqueadoPor: { type: "string", format: "uuid", description: "Presente apenas quando situacao = bloqueado: id da mutação recusada da qual esta dependia (via dependeDe, direta ou indiretamente)." }
        },
        description: "Resultado de uma mutação após a tentativa de aplicação."
    },

    SyncResultado: {
        type: "object",
        properties: {
            resultados: {
                type: "array",
                items: { $ref: "#/components/schemas/MutacaoResultado" },
                description: "Um resultado por mutação enviada, na mesma ordem em que o app as enviou (não na ordem de execução)."
            }
        },
        description: "Resultado da aplicação do lote."
    }
};

export default syncSchemas;
