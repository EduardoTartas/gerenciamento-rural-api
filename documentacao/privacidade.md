# Privacidade e titularidade dos dados (LGPD)

Este documento descreve quais dados pessoais o Pasto Livre trata, para quê, por quanto tempo e como o
titular exerce os direitos da Lei Geral de Proteção de Dados (Lei 13.709/2018). Vale para a API; o
aplicativo (`gerenciamento-rural-mobile`) tem issue par para a parte visível ao usuário.

## Dados tratados

| Dado | Onde fica | Finalidade |
| :--- | :--- | :--- |
| Nome e e-mail | `users` | Identificar a conta e permitir o login |
| Foto de perfil (opcional) | `users.image` e bucket | Exibir o perfil; pode vir do login com Google |
| Provedor de login e credenciais | `accounts`, `sessions` | Autenticar. A senha é guardada com hash; tokens e sessões nunca saem da API |
| Localização e área das propriedades | `propriedades` | Organizar o manejo e calcular a taxa de lotação |
| Pastos, rebanhos (por lote), insumos e seus eventos | tabelas do domínio rural | Apoiar o manejo, o estoque e o controle financeiro |
| Fotos das atividades | bucket (`atividades/<id>.jpeg`) e `fotos_atividade` | Registrar visualmente o manejo |
| Notificações | `notificacoes` | Avisar sobre pastos, lotação e estoque |
| Mutações aplicadas do sync | `mutacoes_aplicadas` | Evitar que um reenvio de dados duplique registros |

Não há dado sensível no sentido do art. 5º, II, da LGPD.

## Base legal

- **Execução de contrato** (art. 7º, V): o tratamento do cadastro e dos dados de manejo é necessário
  para o app funcionar.
- **Consentimento** (art. 7º, I): foto de perfil e notificações push. O aceite da política no cadastro
  é registrado pelo aplicativo.

## Retenção

- Os dados ficam armazenados enquanto a conta existir.
- Registros excluídos pelo usuário no app usam exclusão lógica (`ativo: false`) e **continuam
  armazenados** até a exclusão da conta. Por isso entram na exportação.
- A exclusão da conta é **definitiva e em cascata**: remove usuário, sessões, propriedades, pastos,
  rebanhos, insumos, eventos e notificações; apaga as mutações do sync e, do bucket, a foto de perfil e
  as fotos das atividades. Não há prazo de recuperação.

## Direitos do titular (art. 18)

| Direito | Como exercer |
| :--- | :--- |
| Acesso e portabilidade (incisos II e V) | `GET /v1/usuarios/:id/exportacao`: devolve todos os dados da conta em JSON. Só o próprio titular exporta |
| Eliminação (inciso VI) | `DELETE /v1/usuarios/:id`: apaga a conta e tudo o que ela guarda |
| Correção (inciso III) | `PATCH /v1/usuarios/:id` e as telas de edição do app |
| Informação sobre o tratamento (inciso VII) | Este documento e a política exibida no app |

A exportação nunca inclui senha, tokens nem sessões.

## Quem mantém o serviço

O Pasto Livre é um projeto acadêmico (Trabalho de Conclusão de Curso), mantido pelo autor.

- **Infraestrutura:** servidor virtual (VPS) com k3s na Oracle Cloud, publicado via Cloudflare Tunnel.
  Detalhes em `deployment/infrastructure_diagram.md`.
- **Custo:** arcado pelo autor. Não há cobrança dos usuários nem contrato de nível de serviço.
- **Encerramento:** se o serviço for desativado, os usuários serão avisados com antecedência para
  exportar seus dados, e os dados restantes serão apagados do servidor e do bucket.

## Contato do encarregado

Pendente: definir o canal de contato (e-mail) do autor como encarregado pelo tratamento.
