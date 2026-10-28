const HTTP_METHODS = ['get', 'post', 'put', 'patch', 'delete'];

const INDENT_WIDTH = 4;

// As descrições dos endpoints são escritas com "+ Título:" e itens indentados em 4 espaços.
// Em markdown isso vira bloco de código; aqui viram títulos em negrito e listas.
const normalizeDescription = (text) => {
    const lines = text.replace(/\t/g, '    ').split('\n');
    const filled = lines.filter((l) => l.trim());
    if (!filled.length) return text.trim();

    const base = Math.min(...filled.map((l) => l.match(/^ */)[0].length));
    const out = [];

    for (const raw of lines) {
        if (!raw.trim()) {
            if (out.length && out[out.length - 1] !== '') out.push('');
            continue;
        }

        const indent = raw.match(/^ */)[0].length - base;
        const level = Math.floor(indent / INDENT_WIDTH);
        const content = raw.trim();
        const heading = content.match(/^\+\s+(.+?):\s*(.*)$/);

        if (heading && level === 0) {
            if (out.length && out[out.length - 1] !== '') out.push('');
            out.push(`**${heading[1]}**`, '');
            if (heading[2]) out.push(heading[2], '');
            continue;
        }

        const item = content.replace(/^[-+•]\s+/, '');
        const isItem = item !== content || level > 0;
        if (isItem) {
            const depth = Math.max(level - 1, 0);
            out.push(`${' '.repeat(depth * INDENT_WIDTH)}- ${item}`);
        } else {
            out.push(content);
        }
    }

    return out.join('\n').trim();
};

const normalizeDescriptions = (paths) => {
    for (const route of Object.values(paths)) {
        for (const method of HTTP_METHODS) {
            const op = route[method];
            if (op && typeof op.description === 'string') {
                op.description = normalizeDescription(op.description);
            }
        }
    }
    return paths;
};

export default normalizeDescriptions;
