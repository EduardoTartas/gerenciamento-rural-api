# Plano de Teste para Endpoints de Upload

Rota de upload de imagem para o bucket Garage/MinIO, sem persistência em banco e sem associação a
nenhuma entidade — a URL retornada só é vinculada em outro endpoint (ex.: foto de perfil). Fonte
técnica: `documentacao/testes/uploads/uploads.md`. Suíte automatizada: `test/endpoints/uploads/`.

## POST /v1/uploads/imagens

| Método & Endpoint | Cenário / Descrição | Verificações / Payloads / Headers | Critérios de Aceite Detalhados |
| :--- | :--- | :--- | :--- |
| POST /v1/uploads/imagens | [UPL-POST-01] envia JPEG válido | A autenticado; arquivo `.jpg`, mimetype `image/jpeg`, < 5MB; storage mockado com sucesso | HTTP 201, envelope; `data.url` inicia com `GARAGE_PUBLIC_URL`; `data.fileName` termina em `.jpeg`; mensagem "Imagem enviada com sucesso."; `putObject` do mock chamado com bucket, nome gerado e `Content-Type: image/jpeg` |
| POST /v1/uploads/imagens | [UPL-POST-02] envia PNG válido | A autenticado; arquivo `.png`, mimetype `image/png`, < 5MB; storage mockado com sucesso | HTTP 201, mesmo formato de resposta; imagem reencodada sempre sai como `.jpeg` (Sharp força JPEG independente da extensão de entrada) |
| POST /v1/uploads/imagens | [UPL-POST-03] nenhum arquivo enviado | A autenticado; requisição multipart sem campo `file` (ou sem corpo multipart) | HTTP 400, `tipo` `validationError`; mensagem "Nenhum arquivo enviado." (sem `errors[].path` — `UploadService` não anexa `details` a este erro); storage não é chamado |
| POST /v1/uploads/imagens | [UPL-POST-04] extensão fora da whitelist | A autenticado; arquivo `.gif` | HTTP 400, mensagem cita a extensão rejeitada e as permitidas (`jpg, jpeg, png`); storage não é chamado |
| POST /v1/uploads/imagens | [UPL-POST-05] mimetype divergente da extensão (adulteração) | A autenticado; arquivo nomeado `foto.jpg` mas com `Content-Type` diferente de `image/jpeg`/`image/png` (ex.: `.txt` renomeado) | HTTP 400, mensagem "Tipo de arquivo inválido ou adulterado."; storage não é chamado |
| POST /v1/uploads/imagens | [UPL-POST-06] arquivo acima de 5MB (limite do serviço) | A autenticado; arquivo válido de extensão/mimetype, entre 5MB e 50MB | HTTP 400, mensagem cita o limite de 5MB; storage não é chamado |
| POST /v1/uploads/imagens | [UPL-POST-07] arquivo cujos bytes não são uma imagem decodificável | A autenticado; arquivo com extensão/mimetype válidos mas conteúdo corrompido (Sharp real, sem mock, deve falhar ao processar) | HTTP 400, mensagem "Não foi possível processar a imagem enviada."; storage não é chamado |
| POST /v1/uploads/imagens | [UPL-POST-08] falha do storage (Garage indisponível) | A autenticado; arquivo válido; mock do client rejeita `putObject` | HTTP 503, `tipo` `storageError`; `recuperavel === true`; mensagem "Falha ao enviar o arquivo. Tente novamente mais tarde." |
| POST /v1/uploads/imagens | [UPL-POST-09] imagem é redimensionada para 512x512 antes do envio | A autenticado; arquivo válido maior que 512x512 | HTTP 201, o buffer passado a `putObject` no mock corresponde à imagem processada (dimensão/formato JPEG) |
| POST /v1/uploads/imagens | [UPL-POST-10] 401 sem token | sem header `Authorization` | HTTP 401, `tipo` `unauthorized`; storage não é chamado |
| POST /v1/uploads/imagens | [UPL-POST-11] resposta não associa a nenhuma entidade | A autenticado; upload de sucesso | HTTP 201, `data` só contém `url` e `fileName` — nenhum campo de dono/propriedade; a URL fica "órfã" até ser registrada em outro endpoint (ex.: `PATCH /usuarios/:id/foto`) |

## Bugs conhecidos

- `abortOnLimit: true` no `express-fileupload` responde diretamente quando o corpo excede 50MB, antes de chegar ao `UploadController`/`errorHandler` — a resposta não segue o envelope `CommonResponse` nem carrega `tipo`/`recuperavel`. Não há cenário de teste de endpoint para o limite de 50MB (custoso e redundante com o limite de negócio de 5MB, já coberto por UPL-POST-06); registrado só para não ser confundido com bug caso alguém tente validar o envelope nesse caso.
- `UploadController.create` não valida a presença de `req.files` antes de acessar `req.files?.file` — o optional chaining evita `TypeError`, mas a ausência total de corpo multipart e um campo `file` ausente produzem a mesma mensagem genérica "Nenhum arquivo enviado." (UPL-POST-03 cobre ambos os casos como um só, já que o comportamento observável é idêntico).
