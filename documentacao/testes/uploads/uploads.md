# /uploads

Controller `UploadController` · Service `UploadService` · Repository `UploadRepository` ·
Sem schema Zod (corpo é `multipart/form-data`, via `express-fileupload`) ·
Regras: `rotas_pastolivre.md` § 10

Pré-condições comuns: usuário A autenticado via BetterAuth. O endpoint não associa o arquivo a
nenhuma entidade nem grava linha em banco — a única persistência é o objeto no bucket Garage/MinIO.
Como consequência, "verifica" nesta rota não inclui estado de banco (não há tabela de upload); as
asserções de "regra de negócio" observam a chamada ao client de storage mockado e o `Content-Type`/
nome de arquivo gerado.

**Mock de storage:** `getGarageClient` (`src/config/garageConnect.js`) deve ser mockado nos testes de
endpoint — não subir Garage/MinIO real. Mockar o módulo para devolver um client falso com
`putObject`/`removeObject` espiáveis (`vi.fn()`), controlando sucesso (resolve) e falha
(reject) por cenário. `UploadRepository.uploadFile` traduz qualquer rejeição do client em
`CustomError` `storageError`/503 (`src/repository/UploadRepository.js:23-31`).

O middleware `express-fileupload` está configurado globalmente em `src/app.js` com
`limits: { fileSize: 50 * 1024 * 1024 }` e `abortOnLimit: false` — acima de 50MB o arquivo chega
truncado (`file.truncated === true`) e `UploadService.processarImagem` rejeita com 413 no envelope
padrão, antes de qualquer outra validação. Isso é anterior e independente do limite de negócio de
5MB que o serviço também aplica.

## POST /uploads/imagens

Arquivo: `test/endpoints/uploads/post-uploads-imagens.test.js`

| ID | Cenário | Pré-condição | Status | Verifica |
| :--- | :--- | :--- | :--- | :--- |
| UPL-POST-01 | envia JPEG válido | A autenticado; arquivo `.jpg`, mimetype `image/jpeg`, < 5MB; storage mockado com sucesso | 201 | envelope; `data.url` inicia com `GARAGE_PUBLIC_URL`; `data.fileName` termina em `.jpeg`; mensagem "Imagem enviada com sucesso."; `putObject` do mock chamado com bucket, nome gerado e `Content-Type: image/jpeg` |
| UPL-POST-02 | envia PNG válido | A autenticado; arquivo `.png`, mimetype `image/png`, < 5MB; storage mockado com sucesso | 201 | mesmo formato de resposta; imagem reencodada sempre sai como `.jpeg` (Sharp força JPEG independente da extensão de entrada) |
| UPL-POST-03 | nenhum arquivo enviado | A autenticado; requisição multipart sem campo `file` (ou sem corpo multipart) | 400 | `tipo` `validationError`; mensagem "Nenhum arquivo enviado." (sem `errors[].path` — `UploadService` não anexa `details` a este erro); storage não é chamado |
| UPL-POST-04 | extensão fora da whitelist | A autenticado; arquivo `.gif` | 400 | mensagem cita a extensão rejeitada e as permitidas (`jpg, jpeg, png`); storage não é chamado |
| UPL-POST-05 | mimetype divergente da extensão (adulteração) | A autenticado; arquivo nomeado `foto.jpg` mas com `Content-Type` diferente de `image/jpeg`/`image/png` (ex.: enviar um `.txt` renomeado) | 400 | mensagem "Tipo de arquivo inválido ou adulterado."; storage não é chamado |
| UPL-POST-06 | arquivo acima de 5MB (limite do serviço) | A autenticado; arquivo válido de extensão/mimetype, entre 5MB e 50MB | 400 | mensagem cita o limite de 5MB; storage não é chamado |
| UPL-POST-06b | arquivo acima de 50MB (limite global do express-fileupload) | A autenticado; arquivo > 50MB | 413 | `tipo` `validationError`; mensagem cita o limite de 50MB; resposta segue o envelope `CommonResponse`; storage não é chamado |
| UPL-POST-07 | arquivo cujos bytes não são uma imagem decodificável | A autenticado; arquivo com extensão/mimetype válidos mas conteúdo corrompido (Sharp real, sem mock, deve falhar ao processar) | 400 | mensagem "Não foi possível processar a imagem enviada."; storage não é chamado |
| UPL-POST-08 | falha do storage (Garage indisponível) | A autenticado; arquivo válido; mock do client rejeita `putObject` | 503 | `tipo` `storageError`; `recuperavel === true`; mensagem "Falha ao enviar o arquivo. Tente novamente mais tarde." |
| UPL-POST-09 | imagem é redimensionada para 512x512 antes do envio | A autenticado; arquivo válido maior que 512x512 | 201 | o buffer passado a `putObject` no mock corresponde à imagem processada (dimensão/formato JPEG) — inspecionar via `sharp(bufferRecebido).metadata()` no teste, se o mock capturar o buffer real |
| UPL-POST-10 | 401 sem token | sem header `Authorization` | 401 | `tipo` `unauthorized`; storage não é chamado |
| UPL-POST-11 | resposta não associa a nenhuma entidade | A autenticado; upload de sucesso | 201 | `data` só contém `url` e `fileName` — nenhum campo de dono/propriedade; a URL fica "órfã" até ser registrada em outro endpoint (ex.: `PATCH /usuarios/:id/foto`) |

## Divergências

- `UploadController.create` (`src/controllers/UploadController.js:16-21`) não valida a presença de
  `req.files` antes de acessar `req.files?.file` — o encadeamento com optional chaining evita o
  `TypeError`, mas a ausência total de corpo multipart (nenhum arquivo, nenhum campo) e um campo `file`
  ausente produzem a mesma mensagem genérica "Nenhum arquivo enviado." (UPL-POST-03 cobre ambos os
  casos como um só, já que o comportamento observável é idêntico).
