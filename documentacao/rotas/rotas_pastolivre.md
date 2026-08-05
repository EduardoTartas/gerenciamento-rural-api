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

> ⚠️ **Divergência conhecida:** o filtro `?ativo=false` está definido no schema de query mas
> não é aplicado — o `PropriedadeController.list` valida a query sem atribuí-la a
> `req._parsedQuery`, e o `PropriedadeService.list` não repassa `ativo` aos filtros. Na
> prática, não há como listar propriedades arquivadas por esta rota.

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

### 3.2 GET /pastagens
**Caso de Uso:** Listar os pastos.
**Regras de Negócio:**
- Retorna por padrão apenas pastos `ativo: true`.
- Filtragem opcional por `propriedadeId`, `nome`, `status` (Ex: "Vazio", "Ocupado") e `tipoPastagem`.

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
> Os dias de descanso **não são persistidos**: são derivados de `dataUltimaSaida`
> na leitura, o que dispensa job agendado e nunca fica defasado. O período de
> referência (30 dias) é alvo visual do aplicativo — a API não bloqueia a entrada
> antes do prazo, porque quem conhece a chuva e o estágio do capim é o produtor.

### 3.4 PATCH /pastagens/:id
**Caso de Uso:** Atualizar dados do Pasto (área, tipo de capim e status).
**Regras de Negócio:**
- **Status Coerente:** Bloqueia a tentativa de forçar o status para `Vazio` ou `Descanso` caso a contagem indique que há **Rebanhos** ativos ali alojados.
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
**Caso de Uso:** Corrigir erros de lançamento (data errada, tipo de manejo trocado).

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

### 7.5 DELETE /rebanhos/manejos/:id
**Caso de Uso:** Remover um manejo lançado por engano.
**Regras de Negócio:**
- **Hard-Delete:** a linha é removida definitivamente do banco.

---

## 8. /catalogos/:entidade
Tabelas de referência **compartilhadas entre todos os usuários** da plataforma — não pertencem a nenhuma propriedade.

**Entidades disponíveis em `:entidade`:**
`racas` · `sistemas-producao` · `regimes-alimentares` · `tipos-manejo-rebanho` · `tipos-manejo-pasto`

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
- **Campo:** apenas `nome` (2 a 100 caracteres).
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
- **Ação Própria:** somente o próprio usuário pode alterar seus dados (403 caso contrário).
- **E-mail Único:** validado contra os demais cadastros.

### 9.4 DELETE /usuarios/:id
**Caso de Uso:** Excluir a conta.
**Regras de Negócio:**
- **Ação Própria:** somente o próprio usuário pode excluir sua conta.
- **Revogação de Sessões:** todas as sessões ativas são revogadas antes da exclusão.
- **Hard-Delete em Cascata:** a exclusão remove o usuário e, por cascata, todas as suas propriedades, pastos, rebanhos e históricos. A operação é irreversível.

---

## 10. /sync
Aplicação em lote de mutações acumuladas pelo app enquanto operava offline.

### 10.1 POST /sync
**Caso de Uso:** Ao reconectar, o app envia de uma vez a fila de criações, edições e exclusões feitas offline.
**Regras de Negócio:**
- **Envelope:** `{ mutacoes: [...] }`, de **1 a 100** mutações por requisição.
- **Campos de cada mutação:** `id` (UUID da mutação, usado para idempotência), `entidade`, `acao` (`CREATE`/`UPDATE`/`DELETE`), `entidadeId` (UUID da entidade afetada), `dependeDe` (opcional, UUID de outra mutação do mesmo lote) e `dados` (obrigatório em `CREATE`/`UPDATE`, ausente em `DELETE`).
- **Identificador único:** `entidadeId` é a única fonte do id — `dados` nunca pode conter a chave `id`.
- **Entidades suportadas:** `propriedades`, `pastos`, `rebanhos`, `manejo_pastos`, `manejo_rebanhos`, `historico_movimentacoes`. Esta última não aceita `UPDATE` (movimentação é evento imutável).
- **Ordenação por dependência:** o servidor reordena as mutações pelo grafo formado por `dependeDe` antes de aplicar (ex.: criar o pasto antes do rebanho que aponta para ele), independentemente da ordem de envio. `dependeDe` sempre referencia outra mutação do lote, nunca uma entidade do banco.
- **Uma mutação, uma transação:** cada mutação é aplicada e registrada atomicamente, mas **o lote inteiro não é atômico** — uma mutação recusada não derruba as demais.
- **Cascata de bloqueio:** se uma mutação é recusada, toda mutação que dependia dela (direta ou indiretamente) sai como `bloqueado` em vez de ser tentada.
- **Idempotência:** reenviar o mesmo `id` de mutação já aplicado devolve o resultado registrado da primeira tentativa, sem repetir o efeito. O registro de idempotência é mantido por 30 dias.
- **Delegação:** cada mutação é despachada para o service de domínio correspondente — o `/sync` não reimplementa regra de negócio nenhuma.
- **Validação por entidade:** antes do despacho, `dados` é validado contra o **mesmo schema Zod da rota REST equivalente** (`pastos:UPDATE` → o schema do `PATCH /pastagens/:id`, e assim por diante), incluindo a recusa de campos fora do schema e a coerção de tipos (datas em texto viram `DateTime`). Um `pastos:UPDATE` carregando `propriedadeId`, por exemplo, é recusado — trocar o vínculo de propriedade não é edição de pasto, e aceitá-lo permitiria mover o registro para a fazenda de outro usuário. A recusa é do item (`situacao: recusado`, `erro.tipo: validationError`, `recuperavel: false`) e não derruba o lote.

**Resposta:** **Sempre HTTP 200**, mesmo com mutações recusadas ou bloqueadas — o status HTTP descreve o transporte do lote, não o resultado de cada item (um 4xx faria o interceptor do app descartar o resultado das mutações que entraram). O corpo é `{ message: "N de M mutações aplicadas.", data: { resultados }, errors: [] }`, onde `resultados` traz um item por mutação enviada, na mesma ordem do envio, cada um com `situacao` (`aceito`, `recusado` ou `bloqueado`), `entidade`, `entidadeId` e, conforme o caso, `dados` (registro gravado), `erro` (`{ tipo, campo, mensagem, recuperavel }`) ou `bloqueadoPor` (id da mutação recusada que bloqueou esta).
`400` só ocorre por erro de construção do lote em si (`dependeDe` apontando para fora do lote, ou ciclo de dependência) — nesse caso nenhuma mutação chega a ser tentada.

---

## 11. Rotas Operacionais

### 11.1 GET /health
**Caso de Uso:** Verificação de saúde para orquestração (Kubernetes) e monitoramento.
**Resposta:** `200` com `{ status, database, timestamp, uptime }` quando a consulta ao banco responde; `503` caso contrário. Não exige autenticação.

### 11.2 GET /docs
**Caso de Uso:** Documentação interativa Swagger UI. A rota `/` redireciona para cá.
