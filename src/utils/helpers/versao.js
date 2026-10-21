// src/utils/helpers/versao.js

/**
 * Acrescenta ao `data` de um update a subida da versão do registro (issue #76).
 *
 * Só as edições do usuário passam por aqui (PATCH, exclusão lógica, lote):
 * é a versão que o aparelho guarda ao baixar o registro e devolve ao editar,
 * para o servidor perceber que outra edição entrou no meio. Efeito colateral do
 * servidor (status do pasto, peso médio, contagem de cabeças) não passa, ou o
 * aparelho teria conflito com a consequência das próprias mutações.
 *
 * @param {object} data Campos a gravar.
 */
export function comVersaoNova(data) {
    return { ...data, versao: { increment: 1 } };
}
