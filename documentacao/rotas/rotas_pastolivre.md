# Documentação de Endpoints – Pasto Livre API

Esta documentação descreve as rotas, casos de uso e regras de negócio da API de Gerenciamento Rural (Pasto Livre).

---

## Segurança em todos os endpoints
- **Autenticação Obrigatória:** A maioria das rotas exige um Token de Sessão válido gerenciado pelo `BetterAuth` (enviado via header `Authorization` ou Cookie de sessão).
- **Isolamento Multi-Tenant:** Um pecuarista só consegue visualizar, editar e interagir com os dados (Propriedades, Pastos e Manejos) que pertencem à sua própria conta.
- **Inativação de Segurança (Soft-Delete):** Entidades arquiteturais primárias não são excluídas fisicamente para preservar o histórico de rentabilidade e rastreabilidade zootécnica.

---

## 1. /api/auth
Rotas padrão de autenticação providas nativamente pelo framework BetterAuth.

### 1.1 POST /api/auth/sign-up/email
**Caso de Uso:** Cadastro de um novo Pecuarista/Usuário.
**Regras de Negócio:**
- E-mail deve ser único na plataforma.
- A senha deve atender a critérios básicos de segurança.
**Resposta:** 
- Retorna o usuário criado e define o cookie de sessão.

### 1.2 POST /api/auth/sign-in/email
**Caso de Uso:** Login na plataforma utilizando e-mail e senha.
**Regras de Negócio:**
- Validação de credenciais existentes.
**Resposta:** 
- Retorno de dados do usuário e definição do token de sessão.

### 1.3 POST /api/auth/sign-in/social
**Caso de Uso:** Login/cadastro via Google, usado pelo app mobile (fluxo de `idToken` nativo, não redirect web).
**Regras de Negócio:**
- Corpo: `{ provider: "google", idToken: { token } }`.
- O app deve pedir o token ao SDK do Google usando `serverClientId` = Client ID **Web** — é ele que vira o `aud` do token validado pelo backend, não o Client ID Android.
- Client IDs aceitos configurados via `GOOGLE_WEB_CLIENT_ID`/`GOOGLE_ANDROID_CLIENT_ID`.
- Primeiro login com uma conta Google cria o usuário automaticamente, com e-mail já verificado.
- **Vínculo com conta local existente exige `emailVerified: true`** (regra do BetterAuth). Este projeto não tem fluxo de verificação de e-mail no cadastro por senha — na prática, ninguém que se cadastrou por e-mail/senha consegue logar depois com Google usando o mesmo e-mail; a tentativa retorna 401 (`OAUTH_LINK_ERROR`). Comportamento correto de segurança (evita sequestro de conta não verificada), mas significa que hoje só funciona pra conta criada direto pelo Google.
**Resposta:**
- 200 com dados da sessão e do usuário. 401 se o `idToken` for inválido/expirado/audience errado (`INVALID_TOKEN`) ou se o e-mail já existir localmente sem verificação (`OAUTH_LINK_ERROR`).

---

## 2. /propriedades
Gerenciamento de Fazendas, Sítios e Arrendamentos rurais do produtor. 

### 2.1 POST /propriedades
**Caso de Uso:**  Cadastrar uma nova Propriedade Rural.
**Regras de Negócio:**
- **Campos:** `nome` (obrigatório) e `localizacao` (opcional).
- **Validações:** O `nome` da propriedade deve ser exclusivo para aquele usuário logado.

### 2.2 GET /propriedades
**Caso de Uso:** Listar todas as propriedades do usuário logado.
**Regras de Negócio:**
- **Paginação e Filtros:** Suporta `page`, `limit`, busca por `nome` e `localizacao`.
- **Filtro Inteligente:** Retorna por padrão apenas propriedades ATIVAS (`ativo: true`).
- **Filtro `ativo`:** `?ativo=false` lista só as arquivadas; `?ativo=true` lista só as ativas (mesmo comportamento padrão).

### 2.3 GET /propriedades/:id
**Caso de Uso:** Obter detalhes de uma Propriedade específica.
**Regras de Negócio:**
- Usuário deve ser dono da entidade.

### 2.4 PATCH /propriedades/:id
**Caso de Uso:** Editar os dados (como nome e localização) ou o status ativo da Propriedade.
**Regras de Negócio:** 
- Mesmo bloqueio de nome duplicado (se alterar o nome).
- **Trava de Integridade:** Se a edição tentar mudar a Propriedade para `ativo: false`, o sistema barra a ação (Erro 400) **caso existam rebanhos atualmente alocados** nos pastos desta propriedade.

### 2.5 DELETE /propriedades/:id
**Caso de Uso:** Excluir ou arquivar uma Propriedade.
**Regras de Negócio:**
- **Soft-Delete:** Essa operação atua unicamente virando o campo `ativo` para `false` (arquivamento de segurança).
- Entra na mesma trava de integridade: bloqueia a exclusão se houver Gado (rebanhos ativos) usando a Fazenda.

---

## 3. /pastagens
Gerenciamento das subdivisões vitais da propriedade: Piquetes, Pastos e Invernadas.

### 3.1 POST /pastagens
**Caso de Uso:** Cadastrar novo piquete associado a uma Propriedade.
**Regras de Negócio:**
- **Campos Mínimos:** `nome`, `propriedadeId`. 
- **Trava Estrutural:** Não é possível criar pastas em propriedades inativas.
- **Duplicidade Flexível:** O `nome` do pasto precisa ser único dentro daquela Propriedade apenas se ele estiver *ativo*. Se existir um pasto com o mesmo nome que foi arquivado (inativo), o sistema permite a "reciclagem" do nome.
- **Forrageira:** `tipoPastagemId` (opcional) referencia um item **ativo** do catálogo `tipos-pastagem` (404 se inexistente ou inativo).
- **Descanso por pasto:** `diasDescanso` (opcional, inteiro de 1 a 365) é o ajuste do produtor para aquele pasto. Nulo = usa o padrão da forrageira (`tipoPastagem.diasDescanso`); sem forrageira, o app usa 30 dias.

### 3.2 GET /pastagens
**Caso de Uso:** Listar os pastos.
**Regras de Negócio:**
- Retorna por padrão apenas pastos `ativo: true`.
- Filtragem opcional por `propriedadeId`, `nome`, `status` (Ex: "Vazio", "Ocupado") e `tipoPastagemId`.
- Cada pasto traz `tipoPastagemId`, `diasDescanso` (ajuste, pode ser nulo) e `tipoPastagem: { id, nome, diasDescanso }`, para o app calcular o descanso efetivo sem outra consulta: `diasDescanso` do pasto ?? `tipoPastagem.diasDescanso` ?? 30.

### 3.3 GET /pastagens/:id
**Caso de Uso:** Obter detalhes do pasto com listagem contendo cálculos de extensão e status.

> **Ciclo de status do pasto**
>
> | Status | Significado |
> | :--- | :--- |
> | `Vazio` | Recém-cadastrado, nunca recebeu lote. |
> | `Ocupado` | Tem ao menos um rebanho ativo. |
> | `Descanso` | Esvaziou e está em rebrota desde `dataUltimaSaida`. |
>
> A transição é automática: ao sair o último lote — por movimentação (6.1) ou
> inativação de rebanho (5.5) — o pasto passa a `Descanso` e `dataUltimaSaida`
> vira o marco zero da rebrota. Ao receber lote, volta a `Ocupado` e a contagem
> é descartada; ela recomeça do zero na próxima saída.
>
> Os dias **já decorridos** de descanso não são persistidos: são derivados de
> `dataUltimaSaida` na leitura, o que dispensa job agendado e nunca fica defasado.
> O **alvo** de descanso vem do pasto (`diasDescanso`) ou da forrageira
> (`tipoPastagem.diasDescanso`), com 30 dias quando nenhum dos dois existe. É alvo
> visual do aplicativo — a API não bloqueia a entrada antes do prazo, porque quem
> conhece a chuva e o estágio do capim é o produtor.

### 3.4 PATCH /pastagens/:id
**Caso de Uso:** Atualizar dados do Pasto (área, forrageira, descanso e status).
**Regras de Negócio:**
- **Forrageira:** trocar `tipoPastagemId` exige item ativo do catálogo. Reenviar o tipo atual é aceito mesmo que ele tenha sido desativado depois, para não travar a edição de outros campos. `null` remove a forrageira; `diasDescanso: null` volta ao padrão dela.
- **Status Coerente:** Bloqueia a tentativa de forçar o status para `Vazio` ou `Descanso` caso a contagem indique que há **Rebanhos** ativos ali alojados. Também bloqueia forçar `Ocupado` quando não há nenhum rebanho ativo vinculado ao pasto (Erro 400) — o status manual não pode divergir da realidade.
- **Inativação Segura:** Se mudar o `ativo` para `false`, também barra se o pasto estiver ocupado por gado.

### 3.5 DELETE /pastagens/:id
**Caso de Uso:** Excluir ou arquivar o pasto.
**Regras de Negócio:**
- **Soft-Delete:** O pasto é arquivado (`ativo: false`) para salvar o histórico atrelado. Fica invisível à interface principal.
- **Trava de Segurança:** A operação é bloqueada com erro caso o usuário tente inativar um pasto que ainda contenha rebanhos (evitando que o gado fique "escondido" em um pasto deletado).

---

## 4. /pastagens/manejos
Gerenciamento de eventos operacionais aplicados a um espaço físico (ex: Adubação, Roçada, Queimada Controlada).

### 4.1 POST /pastagens/manejos
**Caso de Uso:** Registrar execução de um lote de serviço em um Pasto.
**Regras de Negócio:**
- **Campos:** `pastoId`, `tipoManejo`, `dataAtividade`.
- **Consistência:** Bloqueia a criação do registro caso o Pasto alvo esteja marcado como inativo. Apenas pastos produtivos podem receber manejos.

### 4.2 GET /pastagens/manejos
**Caso de Uso:** Obter os históricos de manejo de uma fazenda, permitindo cruzar eventos de custo e mão-de-obra com relatórios.
**Regras de Negócio:**
- Permite paginação com filtros por período (`dataAtividade`), `tipoManejo` e `pastoId`.
- **Filtro `ativo`:** por padrão devolve só manejos vigentes. `?ativo=false` lista os excluídos.
- **Leitura por diferença:** com `?atualizadoDesde=<ISO 8601>` o filtro padrão de `ativo` **sai**, e a resposta traz vigentes e excluídos juntos — é assim que o app fica sabendo da exclusão. Cada item carrega `ativo` e `updatedAt`: `ativo` distingue a linha excluída da vigente, e `updatedAt` é a marca d'água para o próximo `atualizadoDesde`.

### 4.3 GET /pastagens/manejos/:id
**Caso de Uso:** Resgatar detalhamento de um manejo específico.

### 4.4 PATCH /pastagens/manejos/:id
**Caso de Uso:** Corrigir erros de lançamento (data errada, tipo de manejo trocado, insumos consumidos errados).
**Regras de Negócio:**
- **Campo `itens` (opcional):** ausente preserva o consumo de insumo já registrado; presente — mesmo `[]` — substitui por completo as movimentações ativas ligadas ao manejo (desativa as antigas, cria as novas). Mesma validação de propriedade/destino/saldo do `POST`.
- A resposta sempre traz `data.itens` com o consumo atualmente ativo do manejo, independente de o `PATCH` ter enviado `itens` ou não.

### 4.5 DELETE /pastagens/manejos/:id
**Caso de Uso:** Apagar um log de manejo lançado por engano.
**Regras de Negócio:**
- **Soft-Delete (`ativo: false`):** a linha continua no banco. Apagá-la de verdade tirava dela o `updatedAt` que a leitura por diferença precisa para reportar a exclusão, e o app ficava com um registro fantasma para sempre.

---

## 5. /rebanhos
Gerenciamento dos lotes de gado da propriedade.

### 5.1 POST /rebanhos
**Caso de Uso:** Cadastrar um novo lote de gado.
**Regras de Negócio:**
- **Campos obrigatórios:** `propriedadeId`, `nomeRebanho`, `pastoAtualId`.
- **Campos opcionais:** `quantidadeCabecas`, `pesoMedioAtual`, `dataEntradaPastoAtual`, `racaId`, `sistemaProducaoId`, `regimeAlimentarId`, e `id` (UUID gerado pelo cliente offline).
- **Compra do lote (issue #71):** `valorCompra` (R$ pago pelo lote inteiro), `pesoCompraKg`, `precoArrobaCompra`, `dataCompra` e `cabecasCompra` (cabeças na compra, base do custo por cabeça), todos opcionais e independentes. Números > 0 (`cabecasCompra` inteiro), `dataCompra` não futura (tolera 5 min). As leituras devolvem os Decimal como texto. O cálculo de custo e resultado por lote é feito no app.
- **Propriedade Ativa:** Bloqueia a criação em propriedade inativa.
- **Nome Único:** O `nomeRebanho` deve ser exclusivo entre os rebanhos *ativos* da mesma propriedade.
- **Pasto Válido:** O pasto informado deve existir, estar ativo e pertencer à **mesma propriedade** do rebanho.
- **Pasto Livre:** o pasto informado não pode ter outro rebanho ativo. Para juntar lotes de propósito, envie `permitirLotacaoConjunta: true`. A checagem conta os rebanhos ativos do pasto em vez de ler o campo `status`, que é cache e pode estar defasado após falha de sincronização.
- **Transação Atômica:** A criação do rebanho e a mudança do pasto para o status `Ocupado` ocorrem na mesma transação.

### 5.2 GET /rebanhos
**Caso de Uso:** Listar os lotes do produtor.
**Regras de Negócio:**
- Retorna por padrão apenas rebanhos `ativo: true`.
- Filtros: `nomeRebanho`, `propriedadeId`, `pastoAtualId`, `racaId`, `sistemaProducaoId`, `regimeAlimentarId`, `ativo`, além de `page` e `limit`.
- Cada item traz os objetos aninhados `propriedade`, `pastoAtual`, `raca`, `sistemaProducao` e `regimeAlimentar`.

### 5.3 GET /rebanhos/:id
**Caso de Uso:** Obter detalhes de um lote específico.

### 5.4 PATCH /rebanhos/:id
**Caso de Uso:** Corrigir dados do lote (nome, contagem de cabeças, peso médio, catálogos).
**Regras de Negócio:**
- **Troca de Pasto Proibida:** Qualquer tentativa de alterar `pastoAtualId` em um rebanho já ativo retorna erro 400. A mudança de pasto só é permitida pela rota de movimentação, para preservar o histórico.
- Enviar `ativo: false` redireciona internamente para a inativação descrita em 5.5.
- **Compra do lote:** os campos de 5.1 podem ser informados ou corrigidos depois (lote antigo recebe o valor pela edição); `null` limpa o campo.
- **Reativação exige pasto:** enviar `ativo: true` em um rebanho inativo exige `pastoAtualId` no corpo (pasto ativo, da mesma propriedade). Sem isso, retorna 400 — evita reativar um lote sem pasto vinculado, estado que a criação já proíbe. A reativação roda em transação atômica e marca o pasto como `Ocupado`.

### 5.5 DELETE /rebanhos/:id
**Caso de Uso:** Inativar um lote (venda, abate ou encerramento).
**Regras de Negócio:**
- **Soft-Delete:** Marca `ativo: false`, desvincula do pasto (`pastoAtualId: null`) e limpa `dataEntradaPastoAtual`.
- **Liberação do Pasto:** Se o pasto de origem ficar sem nenhum rebanho ativo, ele entra em `Descanso` e `dataUltimaSaida` é preenchida como marco zero da rebrota.
- Toda a operação é executada em transação atômica.

---

## 6. /rebanhos/movimentacoes
Registro histórico da transferência de lotes entre pastos. **Recurso imutável**: não há PATCH — o histórico não pode ser editado. O DELETE não apaga um registro: desfaz a última movimentação do rebanho, revertendo seus efeitos.

### 6.1 POST /rebanhos/movimentacoes
**Caso de Uso:** Registrar a transferência de um lote para outro pasto.
**Regras de Negócio:**
- **Campos:** `rebanhoId`, `pastoDestinoId`, e opcionalmente `dataMovimentacao`, `observacoes` e `permitirLotacaoConjunta`.
- O `pastoOrigemId` é preenchido automaticamente com o pasto atual do rebanho.
- **Rebanho Ativo:** Não é possível movimentar um lote inativo.
- **Destino Válido:** O pasto de destino deve existir, estar ativo, e pertencer à mesma propriedade do rebanho.
- **Destino Diferente da Origem:** Bloqueia a movimentação se o lote já estiver no pasto informado.
- **Destino Livre:** o destino não pode ter outro rebanho ativo. Para juntar lotes de propósito (desmama, formação de lote de venda), envie `permitirLotacaoConjunta: true`. A checagem conta os rebanhos ativos do destino, ignorando o próprio lote que está sendo movido, em vez de ler o campo `status` — que é cache e pode estar defasado.
- **Descanso não bloqueia:** um pasto em `Descanso` pode receber lote. A decisão de interromper a rebrota é do produtor; o aplicativo apenas avisa antes de confirmar.
- **Data Não Futura:** `dataMovimentacao` não pode ser posterior ao momento atual.
- **Transação Atômica:** Cria o histórico, atualiza o pasto atual do rebanho, marca o destino como `Ocupado` e, caso a origem fique sem lotes, coloca-a em `Descanso` com `dataUltimaSaida`. A contagem de rebanhos restantes é feita dentro da transação, evitando condição de corrida.

### 6.2 GET /rebanhos/movimentacoes
**Caso de Uso:** Consultar a linha do tempo de movimentações.
**Regras de Negócio:**
- Ordenado por `dataMovimentacao` decrescente.
- Filtros: `rebanhoId`, `propriedadeId`, `pastoOrigemId`, `pastoDestinoId`, `dataInicio`, `dataFim`, `ativo`, `page`, `limit`.
- **Filtro `ativo`:** por padrão devolve só movimentações válidas. `?ativo=false` lista as desfeitas.
- **Leitura por diferença:** com `?atualizadoDesde=<ISO 8601>` o filtro padrão de `ativo` **sai**, e válidas e desfeitas vêm juntas. Cada item carrega `ativo` (distingue a desfeita da válida) e `updatedAt` (marca d'água para o próximo `atualizadoDesde`).

### 6.3 GET /rebanhos/movimentacoes/:id
**Caso de Uso:** Detalhar um registro específico de movimentação.

### 6.4 DELETE /rebanhos/movimentacoes/:id
**Caso de Uso:** Desfazer um lançamento incorreto de movimentação.
**Regras de Negócio:**
- **Somente a Última:** só a movimentação mais recente e ativa do rebanho pode ser desfeita. Desfazer uma do meio da cadeia deixaria o histórico incoerente (o lote apareceria num pasto onde nunca entrou). Tentar desfazer qualquer outra retorna 409.
- **Transação Atômica:** marca a movimentação como `ativo: false`, devolve o rebanho ao `pastoOrigemId` (restaurando `dataEntradaPastoAtual` para a data da movimentação desfeita) e recalcula o `status` de origem e destino contando rebanhos ativos — nunca lendo o campo `status`, que é cache.
- Se o pasto ficar sem nenhum rebanho ativo após a reversão, entra em `Descanso` com `dataUltimaSaida` atualizada; caso contrário, `Ocupado`.

---

## 6A. /rebanhos/saidas
Saída de animais do rebanho: venda, morte, abate ou outro motivo. **Recurso imutável**: não há PATCH nem DELETE — corrigir uma saída fica para a edição de lançamentos.

### 6A.1 POST /rebanhos/saidas
**Caso de Uso:** Lançar a venda, morte ou abate de cabeças de um lote e, quando o lote acaba, encerrar o ciclo dele.
**Regras de Negócio:**
- **Campos:** `rebanhoId`, `motivo` (`Venda`, `Morte`, `Abate` ou `Outro`), `quantidadeCabecas` (inteiro > 0) e opcionalmente `dataSaida`, `observacoes`, `finalizar` e, na venda, `precoArroba`, `pesoTotalKg` e `valorTotal`.
- **Rebanho Ativo:** não é possível registrar saída de um lote finalizado ou inativo (400).
- **Saldo:** a saída não pode passar das cabeças atuais do rebanho — retorna **409** (`conflict`, não recuperável).
- **Rebanho sem contagem:** com `quantidadeCabecas` vazio no rebanho, a saída parcial é recusada (400) com orientação para preencher a quantidade; só a saída com `finalizar: true` é aceita, e a contagem continua vazia.
- **Baixa:** `rebanho.quantidadeCabecas` diminui pela quantidade da saída.
- **Finalização:** a saída que zera o rebanho, ou qualquer saída com `finalizar: true`, encerra o lote: `ativo: false`, `pastoAtualId` e `dataEntradaPastoAtual` nulos. O pasto que o lote ocupava tem o `status` recalculado contando rebanhos ativos (nunca lendo o campo `status`, mesma regra do desfazer movimentação): sem outro lote, entra em `Descanso` com `dataUltimaSaida` = data da saída. A saída grava `finalizouRebanho: true`.
- **Data Não Futura:** `dataSaida` não pode ser posterior ao momento atual.
- **Dados da venda:** com `motivo: Venda`, `precoArroba` (R$/@) e `valorTotal` (R$) são obrigatórios e maiores que zero; `pesoTotalKg` é opcional. Nos outros motivos esses campos são recusados (400). `valorTotal` é sempre o informado — o valor real do negócio pode divergir de `pesoTotalKg / 15 × precoArroba` (desconto, ágio), e a API não recalcula nem bloqueia. Os três voltam como decimal em texto, nulos fora de Venda.
- **Transação Atômica:** baixa, finalização, pasto e registro da saída entram juntos. A baixa é condicional (`quantidadeCabecas >= saída`) dentro da transação: duas saídas simultâneas do mesmo lote não tiram, juntas, mais cabeças do que existem — a segunda recebe 409.
- **Resposta:** a saída com o rebanho **depois** da baixa (`quantidadeCabecas`, `ativo`, `pastoAtualId`).

### 6A.2 GET /rebanhos/saidas
**Caso de Uso:** Consultar o histórico de saídas.
**Regras de Negócio:**
- Ordenado por `dataSaida` decrescente.
- Filtros: `rebanhoId`, `propriedadeId`, `motivo`, `dataInicio`, `dataFim`, `ativo`, `atualizadoDesde`, `page`, `limit`.
- **Leitura por diferença:** com `?atualizadoDesde=<ISO 8601>` o filtro padrão de `ativo` sai; cada item carrega `ativo` e `updatedAt` (marca d'água).

### 6A.3 GET /rebanhos/saidas/:id
**Caso de Uso:** Detalhar uma saída.

---

## 7. /rebanhos/manejos
Eventos sanitários e zootécnicos aplicados a um lote (vacinação, vermifugação, pesagem).

### 7.1 POST /rebanhos/manejos
**Caso de Uso:** Registrar um manejo aplicado ao rebanho.
**Regras de Negócio:**
- **Campos:** `rebanhoId`, `tipoManejoId`, `dataAtividade`; opcionalmente `medicamentoVacina`, `pesoRegistrado` e `observacoes`.
- **Rebanho Ativo:** Bloqueia o registro em lote inativo.
- **Tipo Válido:** O `tipoManejoId` deve referenciar um item ativo do catálogo `tipos-manejo-rebanho`.
- **Data Não Futura:** `dataAtividade` não pode ser posterior ao momento atual.
- **Efeito de Pesagem:** Se `pesoRegistrado` for informado, o campo `pesoMedioAtual` do rebanho é atualizado com esse valor.

> ⚠️ **Limitação conhecida:** a atualização do peso não compara `dataAtividade` com a última
> pesagem registrada, e ocorre fora da transação de criação do manejo. Uma pesagem
> retroativa sincronizada tardiamente sobrescreve o peso atual do lote.

### 7.2 GET /rebanhos/manejos
**Caso de Uso:** Consultar o histórico sanitário de um lote.
**Regras de Negócio:**
- Filtros: `rebanhoId`, `tipoManejoId`, `propriedadeId`, `dataInicio`, `dataFim`, `ativo`, `page`, `limit`.
- **Filtro `ativo`:** por padrão devolve só manejos vigentes. `?ativo=false` lista os excluídos.
- **Leitura por diferença:** com `?atualizadoDesde=<ISO 8601>` o filtro padrão de `ativo` **sai**, e vigentes e excluídos vêm juntos. Cada item carrega `ativo` e `updatedAt`.

### 7.3 GET /rebanhos/manejos/:id
**Caso de Uso:** Detalhar um manejo específico.

### 7.4 PATCH /rebanhos/manejos/:id
**Caso de Uso:** Corrigir um lançamento (tipo, data, medicamento, peso, observações).
**Regras de Negócio:**
- **Efeito de Pesagem:** se `pesoRegistrado` for alterado e este manejo for a pesagem mais recente do rebanho, `pesoMedioAtual` é recalculado com o novo valor — mesma regra do `POST`. Corrigir uma pesagem que não é a mais recente não mexe no peso atual.

### 7.5 DELETE /rebanhos/manejos/:id
**Caso de Uso:** Remover um manejo lançado por engano.
**Regras de Negócio:**
- **Soft-Delete (`ativo: false`):** a linha continua no banco, mesmo padrão de `pastagens/manejos` — sustenta a leitura por diferença (`atualizadoDesde`).

---

## 8. /catalogos/:entidade
Tabelas de referência **compartilhadas entre todos os usuários** da plataforma — não pertencem a nenhuma propriedade.

**Entidades disponíveis em `:entidade`:**
`racas` · `sistemas-producao` · `regimes-alimentares` · `tipos-manejo-rebanho` · `tipos-manejo-pasto` · `tipos-insumo` · `tipos-pastagem`

**`tipos-pastagem`** é o único catálogo com campo extra: `diasDescanso`, o descanso padrão
da forrageira em dias (inteiro, 1 a 365) — obrigatório no POST, opcional no PATCH; as
demais entidades rejeitam o campo. O catálogo base nasce da migration
`20261001120000_tipo_pastagem_descanso`, com a média da faixa recomendada para o período
das águas, sem considerar solo, região e época do ano (Embrapa Cerrados, Comunicado
Técnico 101, Tabela 2):

| Forrageira | Faixa (dias) | Padrão |
| :--- | :--- | :--- |
| Brachiaria brizantha | 28 a 42 | 35 |
| Brachiaria decumbens | 28 a 42 | 35 |
| Brachiaria humidicola | 20 a 30 | 25 |
| Panicum maximum (Mombaça) | 28 a 42 | 35 |
| Panicum maximum (Tanzânia) | 28 a 42 | 35 |
| Tifton 85 | 25 a 35 | 30 |
| Coast-cross | 25 a 35 | 30 |
| Capim-elefante | 30 a 45 | 38 |
| Andropógon | 25 a 30 | 28 |

Uma entidade não reconhecida retorna 404 com a lista de valores aceitos.

### 8.1 GET /catalogos/:entidade
**Caso de Uso:** Popular os campos de seleção do aplicativo.
**Regras de Negócio:**
- Retorna por padrão apenas itens `ativo: true`, ordenados por nome.
- Filtros: `nome`, `ativo`, `page`, `limit`.

### 8.2 GET /catalogos/:entidade/:id
**Caso de Uso:** Detalhar um item do catálogo.

### 8.3 POST /catalogos/:entidade
**Caso de Uso:** Cadastrar um novo item de catálogo. **Somente admin.**
**Regras de Negócio:**
- **Perfil Administrativo:** exige `admin: true` no usuário autenticado (403 caso contrário).
- **Campo:** `nome` (2 a 100 caracteres); em `tipos-pastagem`, também `diasDescanso` (obrigatório).
- **Nome Único:** validado globalmente, sem diferenciar maiúsculas de minúsculas.

### 8.4 PATCH /catalogos/:entidade/:id
**Caso de Uso:** Corrigir o nome ou reativar um item de catálogo. **Somente admin.**

### 8.5 DELETE /catalogos/:entidade/:id
**Caso de Uso:** Arquivar um item de catálogo. **Somente admin.**
**Regras de Negócio:**
- **Soft-Delete:** marca `ativo: false`.
- **Trava de Dependência:** bloqueia a operação (409) se houver registros vinculados — por exemplo, uma raça em uso por algum rebanho.

---

## 9. /usuarios
Gerenciamento de usuários. Perfil próprio para usuário comum; leitura completa para admin.

### 9.1 GET /usuarios
**Caso de Uso:** Listar todos os usuários da plataforma. **Somente admin.**
**Regras de Negócio:**
- **Perfil Administrativo:** exige `admin: true` no usuário autenticado (403 caso contrário).
- Filtros: `name`, `email`, `page`, `limit`.

### 9.2 GET /usuarios/:id
**Caso de Uso:** Consultar dados de um usuário.
**Regras de Negócio:**
- **Admin:** pode consultar qualquer ID.
- **Usuário comum:** só pode consultar o próprio ID (403 caso contrário).
- **Não Encontrado:** 404 se o ID não existir.

### 9.3 PATCH /usuarios/:id
**Caso de Uso:** Atualizar nome, e-mail ou imagem do perfil.
**Regras de Negócio:**
- **Ação Própria:** somente o próprio usuário pode alterar seus dados (403 caso contrário). **Admin:** pode alterar dados de qualquer usuário.
- **E-mail Único:** validado contra os demais cadastros.

### 9.4 DELETE /usuarios/:id
**Caso de Uso:** Excluir a conta.
**Regras de Negócio:**
- **Ação Própria:** somente o próprio usuário pode excluir sua conta. **Admin:** pode excluir a conta de qualquer usuário.
- **Revogação de Sessões:** todas as sessões ativas são revogadas antes da exclusão.
- **Hard-Delete em Cascata:** a exclusão remove o usuário e, por cascata, todas as suas propriedades, pastos, rebanhos e históricos. A operação é irreversível.

### 9.5 PATCH /usuarios/:id/foto
**Caso de Uso:** Registrar a foto de perfil após envio via `POST /uploads/imagens`.
**Regras de Negócio:**
- **Ação Própria:** somente o próprio usuário pode alterar sua foto (403 caso contrário). **Admin:** pode alterar a foto de qualquer usuário.
- **Fluxo em duas etapas:** o cliente primeiro envia o arquivo em `POST /uploads/imagens` (recebe a URL), depois registra essa URL aqui. O upload em si não altera o perfil.
- **Origem da URL:** rejeita (400) qualquer URL que não pertença ao bucket configurado (`GARAGE_PUBLIC_URL`) — impede associar imagens externas arbitrárias.
- **Rollback:** se o cadastro falhar, a imagem recém-enviada é deletada do bucket, evitando arquivo órfão.
- **Substituição:** se já havia uma foto anterior, ela é removida do bucket em segundo plano após o sucesso.

---

## 10. /uploads
Upload genérico de imagens para o Garage. Desacoplado de qualquer entidade — a associação (ex.: foto de perfil) é feita em uma chamada separada.

### 10.1 POST /uploads/imagens
**Caso de Uso:** Enviar um arquivo de imagem e receber sua URL pública.
**Regras de Negócio:**
- **Autenticação:** requer sessão válida.
- **Validação:** extensão (`.jpg`, `.jpeg`, `.png`) e mimetype real do binário; máximo 5MB (limite de negócio, 400). Acima de 50MB (limite global do servidor), a resposta é 413 no mesmo envelope `CommonResponse`.
- **Processamento:** redimensiona para 512x512 (`cover`) e reencoda em JPEG (Sharp) antes de enviar.
- **Sem associação:** a imagem enviada fica órfã no bucket até algum recurso registrar sua URL (ex.: `PATCH /usuarios/:id/foto`).
- **Decisão de escopo — sem vínculo de dono:** o upload não registra quem enviou o arquivo. Qualquer usuário autenticado que descubra a URL de outro (nome é UUID, não enumerável, mas pode vazar) pode registrá-la como sua própria foto em `PATCH /usuarios/:id/foto`. Nesse caso, se o dono original trocar de foto depois, a limpeza do avatar antigo remove o arquivo que o outro usuário também referenciava. Risco aceito conscientemente para o escopo deste TCC — não implementar vínculo de dono por upload a menos que o risco de vazamento de URL aumente (ex.: exposição em listagens públicas).

---

## 11. /sync
Aplicação em lote de mutações acumuladas pelo app enquanto operava offline.

### 11.1 POST /sync
**Caso de Uso:** Ao reconectar, o app envia de uma vez a fila de criações, edições e exclusões feitas offline.
**Regras de Negócio:**
- **Envelope:** `{ mutacoes: [...] }`, de **1 a 100** mutações por requisição.
- **Campos de cada mutação:** `id` (UUID da mutação, usado para idempotência), `entidade`, `acao` (`CREATE`/`UPDATE`/`DELETE`), `entidadeId` (UUID da entidade afetada), `dependeDe` (opcional, UUID de outra mutação do mesmo lote) e `dados` (obrigatório em `CREATE`/`UPDATE`, ausente em `DELETE`).
- **Identificador único:** `entidadeId` é a única fonte do id — `dados` nunca pode conter a chave `id`.
- **Entidades suportadas:** `propriedades`, `pastos`, `rebanhos`, `manejo_pastos`, `manejo_rebanhos`, `historico_movimentacoes`, `saidas_rebanho`, `insumos`, `movimentacoes_insumo`, `regimes_consumo_insumo`, `notificacoes`. `historico_movimentacoes` e `movimentacoes_insumo` não aceitam `UPDATE` (movimentação é evento imutável): `historico_movimentacoes` aceita `CREATE`/`DELETE`, `movimentacoes_insumo` aceita `CREATE`/`DELETE`, `saidas_rebanho` aceita só `CREATE`, `insumos` e `regimes_consumo_insumo` aceitam `CREATE`/`UPDATE`/`DELETE`. `notificacoes` aceita só `UPDATE` com `{ lida }` (a notificação nasce no servidor; ver [Notificações](#notificações)).
- **Ordenação por dependência:** o servidor reordena as mutações pelo grafo formado por `dependeDe` antes de aplicar (ex.: criar o pasto antes do rebanho que aponta para ele), independentemente da ordem de envio. `dependeDe` sempre referencia outra mutação do lote, nunca uma entidade do banco.
- **Uma mutação, uma transação:** cada mutação é aplicada e registrada atomicamente, mas **o lote inteiro não é atômico** — uma mutação recusada não derruba as demais.
- **Cascata de bloqueio:** se uma mutação é recusada, toda mutação que dependia dela (direta ou indiretamente) sai como `bloqueado` em vez de ser tentada.
- **Idempotência:** reenviar o mesmo `id` de mutação já aplicado devolve o resultado registrado da primeira tentativa, sem repetir o efeito. O registro de idempotência é mantido por 30 dias.
- **Delegação:** cada mutação é despachada para o service de domínio correspondente — o `/sync` não reimplementa regra de negócio nenhuma.
- **Validação por entidade:** antes do despacho, `dados` é validado contra o **mesmo schema Zod da rota REST equivalente** (`pastos:UPDATE` → o schema do `PATCH /pastagens/:id`, e assim por diante), incluindo a recusa de campos fora do schema e a coerção de tipos (datas em texto viram `DateTime`). Um `pastos:UPDATE` carregando `propriedadeId`, por exemplo, é recusado — trocar o vínculo de propriedade não é edição de pasto, e aceitá-lo permitiria mover o registro para a fazenda de outro usuário. A recusa é do item (`situacao: recusado`, `erro.tipo: validationError`, `recuperavel: false`) e não derruba o lote.

**Resposta:** **Sempre HTTP 200**, mesmo com mutações recusadas ou bloqueadas — o status HTTP descreve o transporte do lote, não o resultado de cada item (um 4xx faria o interceptor do app descartar o resultado das mutações que entraram). O corpo é `{ message: "N de M mutações aplicadas.", data: { resultados }, errors: [] }`, onde `resultados` traz um item por mutação enviada, na mesma ordem do envio, cada um com `situacao` (`aceito`, `recusado` ou `bloqueado`), `entidade`, `entidadeId` e, conforme o caso, `dados` (registro gravado), `erro` (`{ tipo, campo, mensagem, recuperavel }`) ou `bloqueadoPor` (id da mutação recusada que bloqueou esta).
`400` só ocorre por erro de construção do lote em si (`dependeDe` apontando para fora do lote, ou ciclo de dependência) — nesse caso nenhuma mutação chega a ser tentada.

---

## 12. Rotas Operacionais

### 12.1 GET /health
**Caso de Uso:** Verificação de saúde para orquestração (Kubernetes) e monitoramento.
**Resposta:** `200` com `{ status, database, timestamp, uptime }` quando a consulta ao banco responde; `503` caso contrário. Não exige autenticação.

### 11.2 GET /docs
**Caso de Uso:** Documentação interativa Swagger UI. A rota `/` redireciona para cá.

---

## 13. /insumos

Controle de estoque de insumos da propriedade (ração, sal mineral, vacina, medicamento, fertilizante, semente, defensivo). Regras de negócio detalhadas em [`docs/superpowers/specs/2026-08-28-insumos-design.md`](../../docs/superpowers/specs/2026-08-28-insumos-design.md).

**Modelo:**
- **Insumo** pertence à **propriedade**, com `destino` (`Pasto` / `Rebanho` / `Ambos`). Estoque único por insumo.
- **Estoque por ledger:** não há coluna de saldo. O saldo é a soma das `movimentacoesInsumo` — evento imutável. `saldoReal = Σ(Entrada) − Σ(Saida)`. Não há ajuste nem contagem (issue #67).
- **Saldo real vs. projetado:** a leitura de um insumo devolve o pacote `saldo` calculado na hora: `saldoReal` (soma do ledger), `consumoProjetado` (consumo dos regimes ainda não lançado, contado desde o último consumo lançado (saída `ConsumoRebanho`) ou contagem antiga (`AjusteContagem`), ou desde o início de cada regime — compra, perda, devolução, "Outro" e manejo não mexem nesse marco), `saldoProjetado` (`saldoReal − consumoProjetado`), `consumoDiaTotal` (soma de `quantidadeDia` dos regimes vigentes), `diasRestantes`, `previsaoTermino`, `esgotado` (`saldoProjetado <= 0`) e `estoqueBaixo` (há `estoqueMinimo` e `saldoProjetado <= estoqueMinimo`).
- **Custo da leitura:** `GET /insumos/:id` traz o ledger inteiro do insumo e calcula o `saldo` a partir das linhas. `GET /insumos` (listagem) **não** traz o ledger: agrega no banco (soma por tipo + data do último marco de consumo, via `groupBy`) e projeta em cima disso — o pacote `saldo` é idêntico.
- **Regime de consumo:** consumo diário recorrente de um insumo por um rebanho. **Nunca escreve no ledger** — só alimenta a projeção. Criar um regime para um par (rebanho, insumo) que já tem regime em aberto **encerra o anterior** (`dataFim` = `dataInicio` do novo, `ativo: false`) na mesma transação. Um regime em aberto por par.
- **Itens de insumo nos manejos:** o `POST` de `/pastagens/manejos` e `/rebanhos/manejos` aceita `itens: [{ id?, insumoId, quantidade, observacoes? }]`. Cada item vira uma movimentação de `Saida` (origem `ManejoPasto` / `ManejoRebanho`) criada na mesma transação do manejo. O `id` do item é opcional: quando presente, é o UUID que o app gerou localmente e vira o `id` da movimentação criada — assim o pull seguinte reconhece a linha em vez de duplicá-la (offline-first). **Saldo insuficiente avisa, não bloqueia** — o saldo pode ficar negativo; a resposta de criação traz `itens` e, quando aplicável, `avisos`.
- **Exclusão do manejo estorna os itens:** ao excluir um manejo de pasto ou de rebanho (`DELETE`), as movimentações de insumo vinculadas a ele são desativadas (`ativo: false`) na mesma transação — deixam de debitar o saldo, acompanhando o manejo que some das leituras.
- **Soft-delete:** `insumo` e `regimeConsumoInsumo` usam `ativo: false`; `DELETE` delega ao update de `ativo`. **Excluir um insumo desativa os regimes de consumo ativos dele na mesma transação** (`ativo: false`, `dataFim = max(agora, dataInicio)`, mesma regra da exclusão de um regime); movimentações e itens de manejo continuam — são o histórico. `movimentacaoInsumo` também é soft-delete (`ativo: false`) — a linha some do saldo mas fica no banco para a leitura por diferença.
- **Multi-tenancy:** toda query é escopada ao usuário autenticado via `insumo.propriedade.usuarioId` / `rebanho.propriedade.usuarioId`.
- **Offline-first:** todos os schemas de criação aceitam `id` (UUID) opcional gerado pelo cliente. Leitura por diferença com `?atualizadoDesde=<ISO 8601 UTC>` traz vigentes e excluídos juntos.

**Enums (aplicação):**
- `destino`: `Pasto` · `Rebanho` · `Ambos`
- `unidadeMedida`: `kg` · `g` · `L` · `mL` · `dose` · `saco` · `unidade`
- movimentação `tipo`: `Entrada` · `Saida`
- movimentação `origem` (motivo) — Entrada: `Compra` · `CadastroInicial` · `Devolucao` · `Outro`; Saída: `ManejoRebanho` · `ManejoPasto` · `ConsumoRebanho` · `Perda` · `Outro` — o `POST /insumos/movimentacoes` avulso **recusa** `ManejoRebanho` e `ManejoPasto` (essas origens só nascem pelo fluxo de manejo). As contagens antigas (`tipo: Ajuste`) foram convertidas pela migration `estoque_sem_contagem` em entrada ou saída, pelo sinal, mantendo a origem `AjusteContagem` (legado só de leitura, que segue valendo como marco da projeção) e a observação original; ajuste zerado ficou inativo.

### 13.1 POST /insumos
**Caso de Uso:** Cadastrar um insumo da propriedade.
**Regras de Negócio:**
- **Campos obrigatórios:** `propriedadeId`, `tipoInsumoId`, `nome`, `destino`, `unidadeMedida`.
- **Campos opcionais:** `estoqueMinimo` (≥ 0), e `id` (UUID gerado pelo cliente offline).
- A propriedade deve existir e pertencer ao usuário. O `tipoInsumoId` deve referenciar um item **ativo** do catálogo global `tipos-insumo`.
- **Nome único:** `nome` exclusivo (case-insensitive) entre os insumos **ativos** da mesma propriedade (409 em conflito).
- O estoque começa em zero — a quantidade inicial entra como uma movimentação de origem `CadastroInicial`.
- A resposta já traz o pacote `saldo`.

### 13.2 GET /insumos
**Caso de Uso:** Popular a tela de estoque de insumos.
**Regras de Negócio:**
- Retorna lista paginada, apenas insumos de propriedades do usuário logado.
- Filtros: `propriedadeId`, `tipoInsumoId`, `destino`, `nome`, `ativo`, `atualizadoDesde`, `page`, `limit`.
- Por padrão devolve só `ativo: true`. Cada item traz `tipoInsumo`, `propriedade` e o pacote `saldo`.

### 13.3 GET /insumos/:id
**Caso de Uso:** Detalhar um insumo, com `saldo` calculado na leitura.

### 13.4 PATCH /insumos/:id
**Caso de Uso:** Corrigir dados do insumo (`tipoInsumoId`, `nome`, `destino`, `unidadeMedida`, `estoqueMinimo`, `ativo`).
**Regras de Negócio:**
- Pelo menos um campo deve ser enviado. Trocar o `nome` revalida a unicidade por propriedade (409).
- Enviar `ativo: false` inativa o insumo (equivale ao DELETE); `ativo: true` reativa.

### 13.5 DELETE /insumos/:id
**Caso de Uso:** Excluir um insumo lançado por engano ou fora de uso.
**Regras de Negócio:**
- **Soft-delete (`ativo: false`):** a linha permanece no banco para a leitura por diferença reportar a exclusão. O ledger de movimentações não é afetado.

### 13.6 POST /insumos/movimentacoes
**Caso de Uso:** Lançar entrada (compra, cadastro inicial, devolução) ou saída (consumo, perda) de estoque, sempre com motivo.
**Regras de Negócio:**
- **Campos obrigatórios:** `insumoId`, `tipo`, `quantidade`, `data`, `origem`. **Opcionais:** `rebanhoId`, `pastoId`, `observacoes` (máx 500), `valorTotal`, `id`.
- O insumo deve pertencer ao usuário logado.
- `tipo`: `Entrada` ou `Saida` — não existe mais contagem/ajuste (issue #67).
- **Motivo por tipo** (`origem`): Entrada: `Compra`, `CadastroInicial`, `Devolucao`, `Outro`. Saída: `ConsumoRebanho`, `Perda`, `Outro`. Motivo de outro tipo → 400. `ManejoRebanho` e `ManejoPasto` **não são aceitos** aqui.
- `observacoes` **obrigatória** quando o motivo é `Outro`.
- **Valor pago** (`valorTotal`, opcional, > 0, issue #70): quanto foi pago pela entrada inteira, em R$. Só em `Entrada` (inclusive `CadastroInicial`, o estoque inicial do cadastro do insumo); em `Saida` → 400. Alimenta o custo médio do insumo no relatório do app; sem valor, aquele insumo só fica sem custo. As leituras devolvem `valorTotal` como texto (Decimal), ou `null`.
- `quantidade` > 0.
- `data` não pode ser no futuro.
- **Compatibilidade com app antigo:** `tipo: Ajuste` ainda é aceito (REST e `/sync`) e **convertido** antes de gravar — positivo vira `Entrada`, negativo vira `Saida` com a quantidade em módulo, ambos com origem `AjusteContagem` e a observação original (é uma contagem de verdade e vale como marco). Ajuste zerado → 400 ("Ajuste sem quantidade não altera o estoque."). Sem isso, uma contagem parada na fila offline seria recusada para sempre. Lançamento **novo** com `origem: AjusteContagem` (sem `tipo: Ajuste`) é recusado.
- **Marco da projeção:** os regimes são projetados a partir do último consumo lançado (saída `ConsumoRebanho` — encerra a estimativa até ali) ou da última contagem antiga (`AjusteContagem` — era conferência física). Compra, perda, devolução, "Outro" e manejo **não** mexem no marco: uma compra não diz quanto o rebanho já comeu.
- Corrigir um lançamento é pelo `PATCH` (13.9.1); o `DELETE` não desfaz mais.

### 13.7 GET /insumos/movimentacoes
**Caso de Uso:** Consultar o extrato (ledger) de um insumo, ou sincronizar por diferença todas as movimentações da propriedade.
**Regras de Negócio:**
- **`insumoId` é obrigatório**, exceto quando `atualizadoDesde` é informado. Com `atualizadoDesde` e sem `insumoId`, a chamada é uma leitura por diferença de todas as movimentações da propriedade do usuário — um único request por ciclo de sync, em vez de iterar insumo a insumo. Pode ser restrita com `propriedadeId`.
- Sem `insumoId` **e** sem `atualizadoDesde` retorna 400.
- Quando informado, o insumo deve pertencer ao usuário logado. Toda consulta é escopada ao usuário autenticado (via `insumo.propriedade.usuarioId`) — um `propriedadeId` de outro usuário devolve lista vazia.
- Lista paginada ordenada por `data` decrescente. Índice `movimentacoes_insumo(updatedAt)` sustenta o delta por propriedade.
- Filtros: `insumoId`, `propriedadeId`, `tipo`, `origem`, `dataInicio`, `dataFim`, `ativo`, `atualizadoDesde`, `page`, `limit`.

### 13.8 GET /insumos/movimentacoes/:id
**Caso de Uso:** Detalhar uma movimentação de estoque.

### 13.9 DELETE /insumos/movimentacoes/:id
**Caso de Uso:** Nenhum desde a issue #68 — a rota só recusa.
**Regras de Negócio:**
- **Sempre 409** (`conflict`, "Lançamento sincronizado não pode ser desfeito; edite para corrigir."), sem alterar nada. Desfazer só existe no app, enquanto o lançamento está pendente na fila — e pendente nunca chegou ao servidor. O que chega aqui está sincronizado: corrige-se com o `PATCH` (13.9.1).
- A rota (e `movimentacoes_insumo:DELETE` no `/sync`) continua existindo para que um aparelho antigo com desfazer na fila receba uma recusa **não recuperável** e descarte a mutação, em vez de travar a fila com "rota inexistente".
- Inexistente ou de outro usuário segue 404. A exclusão de um manejo continua desativando as movimentações geradas por ele (cascata interna, não passa por aqui).

### 13.9.1 PATCH /insumos/movimentacoes/:id
**Caso de Uso:** Corrigir um lançamento de estoque já sincronizado (quantidade, data ou motivo errados).
**Regras de Negócio:**
- **Campos editáveis:** `quantidade`, `data`, `origem` (motivo), `observacoes`, `valorTotal` (valor pago, só em lançamento de `Entrada`; `null` limpa; em saída → 400). Pelo menos um. `insumoId`, `tipo` ou qualquer outro campo → 400 (`.strict()`): trocar o insumo ou inverter entrada/saída é outro lançamento.
- Mesmas validações do POST: `quantidade` > 0, `data` não futura, motivo do `tipo` **gravado** e "Outro" com observação — conferido no resultado do merge (apagar a observação de um "Outro" também é recusado). `observacoes: null` limpa o campo.
- **Gerada por manejo** (`ManejoRebanho`/`ManejoPasto`) → 400 "Lançamento gerado por manejo: edite pelo manejo."
- **Contagem antiga** (`AjusteContagem`) → 400 "Contagem antiga não pode ser editada." — é marco da projeção e não tem motivo de entrada/saída.
- Inativa, inexistente ou de outro usuário → 404.
- Avança `updatedAt`: a leitura por diferença leva a correção aos outros aparelhos. No `/sync`: `movimentacoes_insumo:UPDATE`, mesmo schema, idempotente pelo `id` da mutação.

### 13.10 POST /rebanhos/regimes-consumo
**Caso de Uso:** Registrar que um rebanho consome uma quantidade fixa de um insumo por dia.
**Regras de Negócio:**
- **Campos obrigatórios:** `rebanhoId`, `insumoId`, `quantidadeDia`, `dataInicio`. **Opcionais:** `dataFim`, `id`.
- O rebanho deve existir e pertencer ao usuário. O insumo deve ser da **mesma propriedade** do rebanho e ter `destino` `Rebanho` ou `Ambos`.
- `quantidadeDia` > 0. `dataInicio <= dataFim` quando `dataFim` for informada.
- **Um regime em aberto por par (rebanho, insumo):** criar um novo para um par que já tem regime em aberto **encerra o anterior** (`dataFim` = `dataInicio` do novo, `ativo: false`) na mesma transação.
- O regime **nunca escreve no ledger** — só alimenta `saldoProjetado` e `previsaoTermino` na leitura do insumo.

### 13.11 GET /rebanhos/regimes-consumo
**Caso de Uso:** Ver o consumo diário recorrente de insumos por rebanho.
**Regras de Negócio:**
- Apenas regimes de rebanhos de propriedades do usuário logado. Lista paginada ordenada por `dataInicio` decrescente.
- Filtros: `rebanhoId`, `insumoId`, `propriedadeId`, `emAberto` (`true` = só os com `dataFim` nula), `ativo`, `atualizadoDesde`, `page`, `limit`. `propriedadeId` de outro usuário devolve lista vazia, nunca dado de outro tenant.

### 13.12 GET /rebanhos/regimes-consumo/:id
**Caso de Uso:** Detalhar um regime de consumo.

### 13.13 PATCH /rebanhos/regimes-consumo/:id
**Caso de Uso:** Ajustar a `quantidadeDia` ou encerrar o regime via `dataFim`.
**Regras de Negócio:**
- Aceita `quantidadeDia` (> 0) e `dataFim`. Enviar `dataFim` encerra o regime (`ativo: false`).

### 13.14 DELETE /rebanhos/regimes-consumo/:id
**Caso de Uso:** Encerrar um regime de consumo.
**Regras de Negócio:**
- **Exclusão lógica:** marca `ativo: false` e preenche `dataFim` com o momento atual. A partir daí o regime deixa de contar no `consumoDiaTotal` e na projeção.

---

## 14. Notificações

Avisos da fazenda (issue #62). O servidor avalia periodicamente as fazendas de cada usuário, guarda as situações que pedem atenção na **caixa de notificações** e envia o push pelo **NPaaS** (serviço de notificações do FSLab, que fala com o Firebase). O app lê a caixa pela API e só recebe o push para avisar com o app fechado.

**Situações avaliadas** (mesmas regras que o app já mostra na Home e nas fichas):

| Tipo | Quando | Entidade | `rota` no app | Push |
| :--- | :--- | :--- | :--- | :--- |
| `PASTO_PRONTO` | pasto em `Descanso` há pelo menos os dias de descanso dele (ajuste do pasto, senão da forrageira, senão 30) contados de `dataUltimaSaida` | pasto | `/pastos/{id}` | sim |
| `PASTO_PRONTO_AMANHA` | pasto em `Descanso` a no máximo 1 dia de concluir o descanso (véspera; encerra quando nasce o `PASTO_PRONTO`) | pasto | `/pastos/{id}` | sim |
| `LOTACAO_ALTA` | UA da fazenda ÷ hectares dos pastos ativos **> 2,0 UA/ha**. UA = cabeças × peso médio ÷ 450; sem peso, estimado pelo sistema de produção (cria 400, recria 300, engorda/terminação 450, ciclo completo 350, leite 450, demais 450) | propriedade | `/pastos` | sim |
| `LOTE_SEM_PASTO` | lote ativo sem pasto vinculado | rebanho | `/rebanhos/{id}` | sim |
| `INSUMO_ESGOTADO` | saldo projetado ≤ 0 | insumo | `/insumos/{id}` | sim |
| `INSUMO_ABAIXO_MINIMO` | saldo projetado ≤ `estoqueMinimo` | insumo | `/insumos/{id}` | sim |
| `INSUMO_ACABANDO` | com consumo diário, o estoque dura **até 7 dias** | insumo | `/insumos/{id}` | sim |
| `RESUMO_MES` | **dia 1** do mês (fuso da fazenda): por fazenda, cabeças vendidas e receita (saídas `Venda`, soma de `valorTotal`) do mês anterior, mais as outras saídas. Mês sem nenhuma saída não gera resumo | propriedade | `/home/relatorio` | sim |
| `PASTO_SEM_AREA` | pasto ativo sem `extensaoHa` (fica fora da lotação) | pasto | `/pastos/{id}` | **só caixa** |
| `LOTE_SEM_VALOR_COMPRA` | lote com venda ou finalizado (inclusive inativo) sem `valorCompra` (resultado do lote sem custo) | rebanho | `/rebanhos/{id}` | **só caixa** |
| `INSUMO_SEM_PRECO` | insumo com consumo no mês (saída de consumo — `ConsumoRebanho`, `ManejoRebanho`, `ManejoPasto` — desde o dia 1, ou regime vigente) e nenhuma entrada com `valorTotal` (custo "sem preço") | insumo | `/insumos/{id}` | **só caixa** |

- Insumo tem **um** aviso por vez, o mais grave (esgotado > abaixo do mínimo > acabando). Insumo sem nenhuma entrada não gera aviso.
- **Sem duplicar:** uma notificação aberta por usuário, tipo e entidade (`chaveAtiva` única no banco). Enquanto a situação persistir, a verificação não cria outra nem manda outro push.
- **Resolução e reaparecimento:** quando a situação deixa de valer, a notificação continua na caixa (histórico) e a chave é liberada; o push que ainda não saiu é descartado. Se a situação voltar, nasce uma notificação nova.
- **Dados faltando** (`PASTO_SEM_AREA`, `LOTE_SEM_VALOR_COMPRA`, `INSUMO_SEM_PRECO`): avisam **uma vez por item** e **só na caixa** (`pushStatus: somenteCaixa`) — não é urgência, e um push por cadastro incompleto incomodaria. Resolvido (dado preenchido), se encerra e **não reabre**.
- **Resumo do mês:** a chave leva o mês de referência (`<usuario>:RESUMO_MES:<AAAA-MM>:<propriedadeId>`, ex.: `RESUMO_MES:2026-09:...` no dia 1º de outubro), por isso nunca duplica e não se "resolve" no dia seguinte. Os limites do mês são no fuso da fazenda (UTC−4, Cuiabá sem horário de verão).
- **Horário de silêncio:** push só entre **6h e 21h** no fuso `America/Cuiaba`. Fora disso a notificação já entra na caixa e o push sai na primeira verificação dentro do horário.
- **Rajada:** mais de 3 pushes pendentes para o mesmo usuário viram **um** push de resumo ("N avisos da fazenda", `tipo: RESUMO`, `rota: /notificacoes`).
- **Push:** `dados` (todos string) = `notificacaoId`, `tipo`, `rota`, `propriedadeId`, `entidadeId`. Falha do NPaaS volta o push para a fila; após 3 tentativas, `falhou`. Push preso em envio (processo caiu) volta para a fila depois de 15 min.
- **NPaaS ausente** (`NPAAS_URL`/`NPAAS_API_KEY` não configurados): a caixa funciona normalmente, nenhum push é tentado (`pushStatus: desligado`). Falha do NPaaS **nunca** derruba uma requisição nem a verificação.
- **Agendamento:** `setInterval` no processo da API, a cada `NOTIFICACOES_INTERVALO_MIN` minutos (padrão 60; `0` desliga), primeira execução 1 min depois de subir. Não roda em teste (`NODE_ENV=test`). **Limitação:** cada réplica teria o seu agendador. Não duplica notificação (chave única) nem push (reserva atômica `pendente` → `enviando`), mas repete o trabalho de leitura; o deploy atual usa 1 réplica.

### 14.1 GET /notificacoes
**Caso de Uso:** Ler a caixa de notificações.
**Regras de Negócio:**
- Só as do usuário logado, da mais nova para a mais antiga, paginada (`page`, `limit` ≤ 100).
- Filtros: `lida` (`true`/`false`), `propriedadeId`, `ativo`, `atualizadoDesde` (leitura por diferença: tudo o que mudou depois do instante, inclusive as lidas).
- Item: `id`, `tipo`, `titulo`, `mensagem`, `lida`, `lidaEm`, `entidade`, `entidadeId`, `propriedadeId`, `rota`, `ativo`, `createdAt`, `updatedAt`. A resposta traz `naoLidas` (ativas não lidas do usuário, independente dos filtros) para o badge.

### 14.2 GET /notificacoes/:id
**Caso de Uso:** Detalhar uma notificação. De outro usuário ou inexistente → 404.

### 14.3 PATCH /notificacoes/:id
**Caso de Uso:** Marcar como lida (ou não lida).
**Regras de Negócio:**
- Corpo `{ "lida": true }`. Qualquer outro campo → 400 (`.strict()`). De outro usuário → 404.
- Grava `lidaEm` e avança `updatedAt`. No `/sync`: `notificacoes:UPDATE` com o mesmo schema.

### 14.4 PATCH /notificacoes/lidas
**Caso de Uso:** Marcar todas como lidas. `{ "propriedadeId": "..." }` opcional restringe a uma fazenda. Responde `{ marcadas }`.

### 14.5 POST /notificacoes/verificar
**Caso de Uso:** Rodar a verificação na hora, só para o usuário autenticado (testes e demonstração). Ignora o horário de silêncio. Responde `{ abertas, resolvidas, enviadas, foraDoHorario }`. Idempotente.

### 14.6 POST /dispositivos/registrar
**Caso de Uso:** Registrar o aparelho para o push (após login e quando o token FCM muda).
**Regras de Negócio:**
- Corpo: `tokenFcm` (obrigatório), `plataforma` (`android` padrão, ou `ios`), `versaoApp` (opcional).
- Repassa ao NPaaS (`POST /dispositivos`) com o usuário `<usuarioId>_mobile`. Falha ou ausência do NPaaS responde 200 com `registrado: false` — o app segue funcionando com a caixa.

### 14.7 POST /dispositivos/desativar-token
**Caso de Uso:** Parar o push no aparelho (logout). Corpo `{ tokenFcm }`. Responde `{ desativado }`, 200 mesmo com o NPaaS fora.
