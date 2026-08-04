// src/service/sync/grafoDeDependencia.js

/**
 * Ordenação topológica das mutações de um lote.
 *
 * `dependeDe` referencia outra mutação do **mesmo lote**, nunca uma entidade
 * qualquer. Isso deixa o grafo inteiro contido no payload: o servidor não
 * consulta o banco nem adivinha relação a partir dos dados.
 */
export function ordenarPorDependencia(mutacoes) {
    const porId = new Map(mutacoes.map((m) => [m.id, m]));

    for (const mutacao of mutacoes) {
        if (mutacao.dependeDe && !porId.has(mutacao.dependeDe)) {
            return {
                ordem: [],
                erro: `A mutação ${mutacao.id} depende de ${mutacao.dependeDe}, que não está neste lote.`,
            };
        }
    }

    const ordem = [];
    const visitado = new Map(); // id -> 'visitando' | 'pronto'

    function visitar(id, caminho) {
        const estado = visitado.get(id);
        if (estado === 'pronto') return null;
        if (estado === 'visitando') {
            return `Ciclo de dependência: ${[...caminho, id].join(' -> ')}.`;
        }

        visitado.set(id, 'visitando');
        const dependencia = porId.get(id).dependeDe;
        if (dependencia) {
            const erro = visitar(dependencia, [...caminho, id]);
            if (erro) return erro;
        }
        visitado.set(id, 'pronto');
        ordem.push(id);
        return null;
    }

    for (const mutacao of mutacoes) {
        const erro = visitar(mutacao.id, []);
        if (erro) return { ordem: [], erro };
    }

    return { ordem, erro: null };
}

/**
 * Todas as mutações que dependem de [idRaiz], direta ou indiretamente.
 *
 * É o que faz a cascata de bloqueio: recusado o pasto, o rebanho que aponta
 * para ele e o manejo que aponta para o rebanho saem como `bloqueado`, não como
 * recusados por 404.
 */
export function descendentes(mutacoes, idRaiz) {
    const filhos = new Map();
    for (const mutacao of mutacoes) {
        if (!mutacao.dependeDe) continue;
        if (!filhos.has(mutacao.dependeDe)) filhos.set(mutacao.dependeDe, []);
        filhos.get(mutacao.dependeDe).push(mutacao.id);
    }

    const encontrados = new Set();
    const fila = [...(filhos.get(idRaiz) ?? [])];
    while (fila.length > 0) {
        const id = fila.shift();
        if (encontrados.has(id)) continue;
        encontrados.add(id);
        fila.push(...(filhos.get(id) ?? []));
    }
    return encontrados;
}
