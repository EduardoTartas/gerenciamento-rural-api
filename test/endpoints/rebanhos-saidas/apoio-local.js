// Fábrica local: registra saída via HTTP (não via Prisma direto), pois a baixa
// de cabeças e a finalização só existem depois de passar pela transação de
// `SaidaRebanhoRepository.createComTransacao`.
import { api } from '../../apoio/cliente.js';

export async function registrarSaida(usuario, dados) {
    const r = await api()
        .post('/v1/rebanhos/saidas')
        .set('Authorization', usuario.bearer)
        .send(dados);
    if (r.status !== 201) {
        throw new Error(`registrarSaida falhou: ${r.status} ${JSON.stringify(r.body)}`);
    }
    return r.body.data;
}
