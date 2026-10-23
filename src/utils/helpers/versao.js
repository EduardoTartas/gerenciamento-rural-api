
export function comVersaoNova(data) {
    return { ...data, versao: { increment: 1 } };
}
