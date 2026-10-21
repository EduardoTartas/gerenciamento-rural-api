# Contrato — conflito de edição por versão do registro

Issue da API: #76. Issue acoplada do app: #78 (`gerenciamento-rural-mobile`).

Este documento é o que o aplicativo precisa saber para detectar e resolver edições concorrentes.
A regra de negócio completa está em `rotas_pastolivre.md`, § 11.1.

## O problema

Duas edições do mesmo registro (uma feita offline no aparelho, outra no servidor) eram resolvidas
por ordem de chegada: a última a chegar sobrescrevia a outra, sem aviso. Agora o servidor percebe
que o registro mudou no meio do caminho e devolve o veredito `conflito` em vez de aplicar.

## Campo `versao`

- Inteiro, **nasce em 1** e sobe de 1 em 1 a cada **edição do usuário**.
- Existe em oito entidades, exatamente as que aceitam `UPDATE` no `/sync` (menos `notificacoes`):

  | Entidade no lote | Recurso REST |
  | :--- | :--- |
  | `propriedades` | `/propriedades` |
  | `pastos` | `/pastagens` |
  | `rebanhos` | `/rebanhos` |
  | `insumos` | `/insumos` |
  | `manejo_pastos` | `/pastagens/manejos` |
  | `manejo_rebanhos` | `/rebanhos/manejos` |
  | `movimentacoes_insumo` | `/insumos/movimentacoes` (lançamentos) |
  | `regimes_consumo_insumo` | `/rebanhos/regimes-consumo` |

- Vem em **toda leitura** dessas entidades: `GET` por id, listagens e o pull por diferença
  (`atualizadoDesde`), e no `dados` de toda mutação `aceito` (inclusive `CREATE`, que devolve `1`).
- Sobe em: `PATCH`, exclusão lógica (`DELETE` REST, `DELETE` do lote) e `UPDATE` do lote.
- **Não** sobe por consequência do servidor: status do pasto ao entrar/sair lote, peso médio do
  rebanho ao registrar pesagem, quantidade de cabeças por saída ou movimentação. O aparelho não
  entra em conflito com o efeito das próprias mutações.
- O app **guarda a `versao` junto com o registro** no SQLite e a atualiza com o `dados.versao` de
  cada mutação aceita e com cada pull.

## Envio: `versaoBase`

Em mutações `UPDATE`, o app acrescenta `versaoBase` com a `versao` do registro **no momento em que o
usuário o editou**:

```json
{
  "id": "11111111-1111-4111-8111-111111111111",
  "entidade": "pastos",
  "acao": "UPDATE",
  "entidadeId": "22222222-2222-4222-8222-222222222222",
  "versaoBase": 3,
  "dados": { "nome": "Pasto da sede" }
}
```

| Regra | Detalhe |
| :--- | :--- |
| Tipo | inteiro maior que zero. `0`, negativo, decimal ou texto: **HTTP 400**, lote inteiro recusado |
| Opcional | ausente (ou `null`) = aparelho antigo: aplica como antes, a última edição vence |
| Só em `UPDATE` | `CREATE` e `DELETE` aceitam o campo mas o ignoram |
| Entidade sem versão | `historico_movimentacoes`, `saidas_rebanho`, `fotos_atividade`, `notificacoes`: o campo é ignorado |

### Várias edições seguidas do mesmo registro

Cada edição aceita sobe a versão. Se a fila tem duas edições do mesmo registro, a segunda deve sair
com `versaoBase` = versão resultante da primeira (`base + 1`). O app sabe disso porque é ele quem
monta a fila; se enviasse `versaoBase` igual nas duas, a segunda entraria em conflito com a primeira.
(Enquanto o app não atualiza a versão local ao enfileirar, uma saída simples é enviar `versaoBase`
só na **primeira** edição do registro no lote.)

## Veredito: `situacao: "conflito"`

Resposta **HTTP 200**, como todo o lote. O item em conflito:

```json
{
  "id": "11111111-1111-4111-8111-111111111111",
  "situacao": "conflito",
  "entidade": "pastos",
  "entidadeId": "22222222-2222-4222-8222-222222222222",
  "versaoBase": 3,
  "versaoServidor": 5,
  "erro": {
    "tipo": "conflict",
    "campo": "versaoBase",
    "mensagem": "Este registro foi alterado por outra edição depois que você o baixou. Escolha qual versão manter.",
    "recuperavel": false
  }
}
```

(O texto da mensagem pode mudar; o app deve decidir por `situacao`, nunca pela mensagem.)

| Campo | Significado |
| :--- | :--- |
| `situacao` | `conflito`. Quarto valor, ao lado de `aceito`, `recusado`, `bloqueado` |
| `versaoBase` | a versão que o app enviou |
| `versaoServidor` | a versão que o registro tem agora no servidor |
| `erro.tipo` | `conflict` (HTTP 409 se fosse uma chamada REST), `recuperavel: false`: reenviar **igual** não adianta |

Não há `dados` no veredito. O registro do servidor vem pelo **pull** (`GET` do recurso, ou
`atualizadoDesde`), que já traz `versao`.

### O que o servidor garante

- **A mutação não foi aplicada.** O registro do servidor está intacto.
- **Não fica registrada como aplicada** (`mutacoes_aplicadas`): reenviar o mesmo `id` reavalia a
  versão. Enquanto o servidor continuar adiante, o veredito se repete idêntico.
- **Bloqueia os dependentes**, como uma recusa: toda mutação do lote com `dependeDe` apontando para
  a que conflitou (direta ou indiretamente) volta `bloqueado`, com `bloqueadoPor` = id da mutação
  em conflito, e não é aplicada.
- **Não derruba o lote:** os demais itens são aplicados normalmente.
- **Atômico e sem corrida:** a comparação e a gravação acontecem na mesma transação, com a linha
  travada. Dois lotes simultâneos com a mesma `versaoBase`: um é `aceito`, o outro `conflito`.
- **Sem vazamento:** registro de outro usuário (ou inexistente) **nunca** devolve `conflito` nem
  `versaoServidor`; segue o `recusado` de sempre (`resourceNotFound`).

## Resolução (a escolha do produtor)

O produtor decide qual edição vale. Os dois caminhos usam só endpoints existentes:

1. **Manter a edição do aparelho.** O app cria uma **nova mutação** `UPDATE` (novo `id`!) com os
   mesmos `dados` e `versaoBase` = `versaoServidor` do veredito. Aplica e a versão sobe para
   `versaoServidor + 1`. A mutação antiga em conflito sai da fila.
2. **Aceitar a do servidor.** O app descarta a mutação em conflito da fila, baixa o registro (pull)
   e sobrescreve o local, versão incluída.

A nova mutação do caminho 1 pode voltar `conflito` de novo, se uma terceira edição entrou no meio.
O app repete a pergunta.

## Idempotência (retenção de 30 dias)

Inalterada. Mutação **aceita** é registrada pelo `id` por 30 dias; reenviá-la devolve o resultado
gravado da primeira vez, **sem reavaliar a versão** (o `UPDATE` já aplicado não vira conflito só
porque a versão subiu depois dele). Mutação **em conflito** não é registrada.

## Limitações conhecidas

- A versão cobre edição **do usuário**. Se outra edição mudou só efeito colateral (por exemplo, a
  quantidade de cabeças por uma saída), o campo editado pode ser sobrescrito sem aviso.
- Detecta conflito do **registro inteiro**, não por campo: duas edições de campos diferentes do mesmo
  pasto também são conflito.
- `DELETE` não é checado: excluir um registro editado por outro cliente é aplicado.
- Registros que já existiam antes da migration entram na versão 1.
