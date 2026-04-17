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
- **Filtro Inteligente:** Retorna por padrão apenas propriedades ATIVAS (`ativo: true`). Para visualizar o arquivo morto, deve-se passar a query `?ativo=false`.

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

### 4.3 GET /pastagens/manejos/:id
**Caso de Uso:** Resgatar detalhamento de um manejo específico.

### 4.4 PATCH /pastagens/manejos/:id
**Caso de Uso:** Corrigir erros de lançamento (data errada, tipo de manejo trocado).

### 4.5 DELETE /pastagens/manejos/:id
**Caso de Uso:** Apagar definitivamente um log de manejo lançado por engano.
**Regras de Negócio:**
- **Hard-Delete (Exclusão Real):** Como os Manejos são entradas de livro-caixa operacional que não possuem dependências, a exclusão remove a linha definitivamente do banco para evitar lixo de dados.
