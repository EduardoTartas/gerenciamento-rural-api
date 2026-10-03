# /rebanhos/saidas

Controller `SaidaRebanhoController` · Service `SaidaRebanhoService` ·
Repository `SaidaRebanhoRepository` · Schema `SaidaRebanhoCreateSchema` (única — recurso é
imutável), `SaidaRebanhoQuerySchema`, `SaidaRebanhoIdSchema` · Regras: rotas_pastolivre.md § 6A

Pré-condições comuns: usuário A e usuário B autenticados via BetterAuth. A tem um rebanho ativo
(`rebanhoA`, 50 cabeças) num pasto `Ocupado` (`pastoA`). O corpo base é uma **venda** com
`precoArroba` e `valorTotal`; os cenários de outro motivo os removem.

**Recurso imutável**: não há `PATCH` nem `DELETE` — corrigir uma saída fica para a edição de
lançamentos. Nenhuma rota usa `AdminMiddleware`: o admin recebe o mesmo 404 de qualquer não-dono.

## POST /rebanhos/saidas

Arquivo: `test/endpoints/rebanhos-saidas/post-rebanhos-saidas.test.js`

| ID | Cenário | Pré-condição | Status | Verifica |
| :--- | :--- | :--- | :--- | :--- |
| SAI-POST-01 | saída parcial | 10 de 50 cabeças | 201 | rebanho fica com 40, ativo, no mesmo pasto; pasto segue `Ocupado`; `finalizouRebanho: false` |
| SAI-POST-02 | aceita `id` gerado pelo cliente (offline-first) | — | 201 | `data.id` igual ao enviado |
| SAI-POST-03 | saída total finaliza | 50 de 50, com `dataSaida` | 201 | mensagem "rebanho finalizado"; rebanho `ativo: false`, 0 cabeças, sem pasto; pasto `Descanso` com `dataUltimaSaida` = `dataSaida` |
| SAI-POST-04 | `finalizar: true` com saída parcial | 3 de 50 | 201 | rebanho inativo com 47 cabeças; pasto `Descanso` |
| SAI-POST-05 | finalizar com outro lote no pasto | segundo rebanho ativo no `pastoA` | 201 | pasto segue `Ocupado`, sem `dataUltimaSaida` |
| SAI-POST-06 | status do pasto recalculado por contagem | `pastoA` com `status` defasado (`Vazio`) | 201 | pasto vai para `Descanso` (não lê o campo `status`) |
| SAI-POST-07 | quantidade acima das cabeças atuais | 51 de 50 | 409 | `tipo: conflict`, `recuperavel: false`, `path: quantidadeCabecas`; nada gravado |
| SAI-POST-08 | rebanho sem quantidade, saída parcial | `quantidadeCabecas: null` | 400 | mensagem "Preencha a quantidade de cabeças" |
| SAI-POST-09 | rebanho sem quantidade, `finalizar: true` | `quantidadeCabecas: null` | 201 | rebanho inativo; contagem continua `null` |
| SAI-POST-10 | rebanho inativo | — | 400 | `path: rebanhoId`, "Rebanho está inativo" |
| SAI-POST-11 | corpo vazio | — | 400 | `errors[0].path: body` |
| SAI-POST-12 | campo extra (`.strict()`) | `valor` no corpo | 400 | `tipo: validationError` |
| SAI-POST-13 | motivo fora da lista | `Doação` | 400 | mensagem lista os motivos aceitos |
| SAI-POST-14 | quantidade zero, negativa ou fracionada | — | 400 | `path: quantidadeCabecas` |
| SAI-POST-15 | falta `quantidadeCabecas` | — | 400 | validação Zod |
| SAI-POST-16 | `dataSaida` no futuro | — | 400 | "não pode ser no futuro" |
| SAI-POST-17 | sem token | — | 401 | `tipo: unauthorized` |
| SAI-POST-18 | B registra saída do rebanho de A | — | 404 | `resourceNotFound`; cabeças intactas |
| SAI-POST-19 | admin (não dono) registra saída do rebanho de A | token admin | 404 | sem bypass |
| SAI-POST-20 | `rebanhoId` inexistente | — | 404 | `resourceNotFound` |
| SAI-POST-21 | duas saídas simultâneas de 30 | 50 cabeças | 201 + 409 | sobra 20; só uma saída gravada |
| SAI-POST-22 | saídas em sequência até zerar | 20 e depois 30 | 201 | a segunda finaliza o rebanho |
| SAI-POST-23 | venda com preço, peso e valor | — | 201 | os três campos gravados e devolvidos |
| SAI-POST-24 | venda com valor diferente de peso/15 × arroba | 5400 kg, R$ 300/@, R$ 100.000 | 201 | valor informado prevalece |
| SAI-POST-25 | venda sem `precoArroba` ou sem `valorTotal` | — | 400 | `path` do campo faltante; nada gravado |
| SAI-POST-26 | morte com `valorTotal` | — | 400 | "só são informados quando o motivo é Venda" |
| SAI-POST-27 | valores de venda zerados ou negativos | — | 400 | `validationError` |
| SAI-POST-28 | abate sem dados de venda | — | 201 | `precoArroba` e `valorTotal` nulos |

## GET /rebanhos/saidas

Arquivo: `test/endpoints/rebanhos-saidas/get-rebanhos-saidas.test.js`

| ID | Cenário | Pré-condição | Status | Verifica |
| :--- | :--- | :--- | :--- | :--- |
| SAI-GET-01 | lista saídas de A | duas saídas | 200 | mensagem com total; itens trazem `rebanho`, `ativo`, `updatedAt` |
| SAI-GET-02 | sem saídas | — | 200 | "Nenhuma saída registrada." |
| SAI-GET-03 | filtro sem resultado | `rebanhoId` aleatório | 200 | "Nenhuma saída encontrada com os filtros informados." |
| SAI-GET-04 | ordenação | três datas | 200 | `dataSaida` decrescente |
| SAI-GET-05 | filtro `rebanhoId` | saídas em dois rebanhos | 200 | só o rebanho pedido |
| SAI-GET-06 | filtro `propriedadeId` | saídas em duas propriedades | 200 | só a propriedade pedida |
| SAI-GET-07 | filtro `motivo` | Venda e Morte | 200 | só `Morte` |
| SAI-GET-08 | `motivo` inválido | — | 400 | `validationError` |
| SAI-GET-09 | `dataInicio`/`dataFim` | três datas | 200 | só a do intervalo |
| SAI-GET-10 | `atualizadoDesde` | saída antes e depois da marca | 200 | só a posterior |
| SAI-GET-11 | parâmetro desconhecido (`.strict()`) | — | 400 | `validationError` |
| SAI-GET-12 | B não vê saídas de A | — | 200 | lista vazia |
| SAI-GET-13 | sem token | — | 401 | — |

## GET /rebanhos/saidas/:id

Arquivo: `test/endpoints/rebanhos-saidas/get-rebanhos-saidas.test.js`

| ID | Cenário | Pré-condição | Status | Verifica |
| :--- | :--- | :--- | :--- | :--- |
| SAI-GET-ID-01 | busca saída de A | saída de 4 de 10 | 200 | dados da saída; `rebanho.quantidadeCabecas: 6` |
| SAI-GET-ID-02 | id não é UUID | — | 400 | `validationError` |
| SAI-GET-ID-03 | id inexistente | — | 404 | `resourceNotFound` |
| SAI-GET-ID-04 | B busca saída de A | — | 404 | — |
