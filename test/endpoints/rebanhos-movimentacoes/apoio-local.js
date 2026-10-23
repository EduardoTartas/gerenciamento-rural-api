import { api } from '../../apoio/cliente.js';

export async function registrarMovimentacao(usuario, dados) {
    const r = await api()
        .post('/v1/rebanhos/movimentacoes')
        .set('Authorization', usuario.bearer)
        .send(dados);
    if (r.status !== 201) {
        throw new Error(`registrarMovimentacao falhou: ${r.status} ${JSON.stringify(r.body)}`);
    }
    return r.body.data;
}
