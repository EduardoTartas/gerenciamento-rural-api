import { beforeEach, describe, expect, it, vi } from 'vitest';
import sharp from 'sharp';
import { api } from '../../apoio/cliente.js';
import { criarUsuario } from '../../apoio/auth.js';

// Mock do client Garage/MinIO (único mock permitido nesta rota). `ensureGarageEnv` é
// preservado via `importOriginal` — só o client de storage é trocado por um espião.
const { putObject, removeObject, getGarageClientMock } = vi.hoisted(() => {
    const putObject = vi.fn().mockResolvedValue(undefined);
    const removeObject = vi.fn().mockResolvedValue(undefined);
    const getGarageClientMock = vi.fn().mockResolvedValue({ putObject, removeObject });
    return { putObject, removeObject, getGarageClientMock };
});

vi.mock('../../../src/config/garageConnect.js', async (importOriginal) => {
    const actual = await importOriginal();
    return {
        ...actual,
        default: getGarageClientMock,
        getGarageClient: getGarageClientMock,
    };
});

const criarImagem = (formato, largura = 800, altura = 600) =>
    sharp({
        create: { width: largura, height: altura, channels: 3, background: { r: 10, g: 20, b: 30 } },
    })[formato]().toBuffer();

describe('POST /v1/uploads/imagens', () => {
    let a;

    beforeEach(async () => {
        a = await criarUsuario();
        putObject.mockReset().mockResolvedValue(undefined);
        removeObject.mockReset().mockResolvedValue(undefined);
        getGarageClientMock.mockReset().mockResolvedValue({ putObject, removeObject });
    });

    const enviar = (usuario, buffer, { filename = 'foto.jpg', contentType = 'image/jpeg' } = {}) => {
        const req = api().post('/v1/uploads/imagens');
        if (usuario) req.set('Authorization', usuario.bearer);
        if (buffer) req.attach('file', buffer, { filename, contentType });
        return req;
    };

    it('UPL-POST-01 envia JPEG válido', async () => {
        const buffer = await criarImagem('jpeg');
        const r = await enviar(a, buffer, { filename: 'foto.jpg', contentType: 'image/jpeg' });

        expect(r.status).toBe(201);
        expect(r.body.errors).toEqual([]);
        expect(r.body.message).toBe('Imagem enviada com sucesso.');
        expect(r.body.data.url.startsWith(process.env.GARAGE_PUBLIC_URL)).toBe(true);
        expect(r.body.data.fileName.endsWith('.jpeg')).toBe(true);
        expect(putObject).toHaveBeenCalledTimes(1);
        const [bucket, fileName, enviado, tamanho, meta] = putObject.mock.calls[0];
        expect(bucket).toBe(process.env.GARAGE_BUCKET_FOTOS);
        expect(fileName).toBe(r.body.data.fileName);
        expect(tamanho).toBe(enviado.length);
        expect(meta).toMatchObject({ 'Content-Type': 'image/jpeg' });
    });

    it('UPL-POST-02 envia PNG válido', async () => {
        const buffer = await criarImagem('png');
        const r = await enviar(a, buffer, { filename: 'foto.png', contentType: 'image/png' });

        expect(r.status).toBe(201);
        expect(r.body.errors).toEqual([]);
        expect(r.body.message).toBe('Imagem enviada com sucesso.');
        expect(r.body.data.fileName.endsWith('.jpeg')).toBe(true);
        expect(r.body.data.url.startsWith(process.env.GARAGE_PUBLIC_URL)).toBe(true);
        expect(putObject).toHaveBeenCalledTimes(1);
        expect(putObject.mock.calls[0][4]).toMatchObject({ 'Content-Type': 'image/jpeg' });
    });

    it('UPL-POST-03 nenhum arquivo enviado', async () => {
        const r = await enviar(a, null);

        expect(r.status).toBe(400);
        expect(r.body.tipo).toBe('validationError');
        expect(r.body.message).toBe('Nenhum arquivo enviado.');
        expect(r.body.errors).toEqual([]);
        expect(putObject).not.toHaveBeenCalled();
    });

    it('UPL-POST-04 extensão fora da whitelist', async () => {
        const buffer = Buffer.from('conteudo qualquer de gif');
        const r = await enviar(a, buffer, { filename: 'foto.gif', contentType: 'image/gif' });

        expect(r.status).toBe(400);
        expect(r.body.tipo).toBe('validationError');
        expect(r.body.message).toBe('Extensão inválida (.gif). Permitido: jpg, jpeg, png.');
        expect(putObject).not.toHaveBeenCalled();
    });

    it('UPL-POST-05 mimetype divergente da extensão (adulteração)', async () => {
        const buffer = Buffer.from('conteudo de texto disfarcado de imagem');
        const r = await enviar(a, buffer, { filename: 'foto.jpg', contentType: 'text/plain' });

        expect(r.status).toBe(400);
        expect(r.body.tipo).toBe('validationError');
        expect(r.body.message).toBe('Tipo de arquivo inválido ou adulterado.');
        expect(putObject).not.toHaveBeenCalled();
    });

    it('UPL-POST-06 arquivo acima de 5MB (limite do serviço)', async () => {
        const buffer = Buffer.alloc(6 * 1024 * 1024, 1);
        const r = await enviar(a, buffer, { filename: 'foto.jpg', contentType: 'image/jpeg' });

        expect(r.status).toBe(400);
        expect(r.body.tipo).toBe('validationError');
        expect(r.body.message).toBe('Arquivo excede o tamanho máximo de 5MB.');
        expect(putObject).not.toHaveBeenCalled();
    });

    it('UPL-POST-06b arquivo acima de 50MB (limite global do express-fileupload) responde no envelope', async () => {
        const buffer = Buffer.alloc(51 * 1024 * 1024, 1);
        const r = await enviar(a, buffer, { filename: 'foto.jpg', contentType: 'image/jpeg' });

        expect(r.status).toBe(413);
        expect(r.body.tipo).toBe('validationError');
        expect(r.body.message).toBe('Arquivo excede o limite de 50MB aceito pelo servidor.');
        expect(r.body.errors).toBeDefined();
        expect(putObject).not.toHaveBeenCalled();
    });

    it('UPL-POST-07 arquivo cujos bytes não são uma imagem decodificável', async () => {
        const buffer = Buffer.from('isto nao e uma imagem valida de verdade'.repeat(50));
        const r = await enviar(a, buffer, { filename: 'foto.jpg', contentType: 'image/jpeg' });

        expect(r.status).toBe(400);
        expect(r.body.tipo).toBe('validationError');
        expect(r.body.message).toBe('Não foi possível processar a imagem enviada.');
        expect(putObject).not.toHaveBeenCalled();
    });

    it('UPL-POST-08 falha do storage (Garage indisponível)', async () => {
        putObject.mockRejectedValueOnce(new Error('conexão recusada'));
        const buffer = await criarImagem('jpeg');
        const r = await enviar(a, buffer, { filename: 'foto.jpg', contentType: 'image/jpeg' });

        expect(r.status).toBe(503);
        expect(r.body.tipo).toBe('storageError');
        expect(r.body.recuperavel).toBe(true);
        expect(r.body.message).toBe('Falha ao enviar o arquivo. Tente novamente mais tarde.');
    });

    it('UPL-POST-09 imagem é redimensionada para 512x512 antes do envio', async () => {
        const buffer = await criarImagem('jpeg', 1024, 768);
        const r = await enviar(a, buffer, { filename: 'foto.jpg', contentType: 'image/jpeg' });

        expect(r.status).toBe(201);
        const bufferEnviado = putObject.mock.calls[0][2];
        const metadata = await sharp(bufferEnviado).metadata();
        expect(metadata.width).toBe(512);
        expect(metadata.height).toBe(512);
        expect(metadata.format).toBe('jpeg');
    });

    it('UPL-POST-10 401 sem token', async () => {
        const buffer = await criarImagem('jpeg');
        const r = await enviar(null, buffer, { filename: 'foto.jpg', contentType: 'image/jpeg' });

        expect(r.status).toBe(401);
        expect(r.body.tipo).toBe('unauthorized');
        expect(putObject).not.toHaveBeenCalled();
    });

    it('UPL-POST-11 resposta não associa a nenhuma entidade', async () => {
        const buffer = await criarImagem('jpeg');
        const r = await enviar(a, buffer, { filename: 'foto.jpg', contentType: 'image/jpeg' });

        expect(r.status).toBe(201);
        expect(Object.keys(r.body.data).sort()).toEqual(['fileName', 'url']);
    });
});
