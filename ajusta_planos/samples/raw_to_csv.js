// Converte o bruto da estação total (pasta raw/) para o CSV de 7 colunas lido pelo simulador.
//
//   node ajusta_planos/samples/raw_to_csv.js            confere todos os CSVs contra o bruto
//   node ajusta_planos/samples/raw_to_csv.js piso.txt   imprime o CSV de um arquivo
//
// Formato bruto: registros SS (número do ponto) e SD (azimute, zenital, distância inclinada),
// com os ângulos em DDD.MMSS — 316.2342 é 316° 23' 42".
const fs = require('fs');
const path = require('path');

const RAW = path.join(__dirname, 'raw');

function dmmss(token) {
    const t = token.trim();
    const dot = t.indexOf('.');
    const g = parseInt(dot < 0 ? t : t.slice(0, dot), 10);
    const frac = (dot < 0 ? '' : t.slice(dot + 1)).padEnd(4, '0');
    if (frac.length > 4) throw new Error(`ângulo com mais de 4 decimais: ${token}`);
    const m = parseInt(frac.slice(0, 2), 10);
    const s = parseInt(frac.slice(2, 4), 10);
    if (m > 59 || s > 59) throw new Error(`minuto ou segundo inválido: ${token}`);
    return [g, m, s];
}

// Devolve o conteúdo CSV completo, com CRLF, como os arquivos versionados
function converter(rawPath) {
    const linhas = [];
    fs.readFileSync(rawPath, 'latin1').split(/\r?\n/).forEach(linha => {
        const m = linha.match(/^SD\s+(\S+)/);
        if (!m) return;
        const [az, zen, sd] = m[1].split(',');
        linhas.push([...dmmss(az), ...dmmss(zen), sd].join(','));
    });
    if (!linhas.length) throw new Error(`nenhum registro SD em ${rawPath}`);
    return linhas.join('\r\n') + '\r\n';
}

// Cada bruto e o CSV que deve sair dele
const PARES = {
    'parede_frontal.txt': 'parede_frontal.csv',
    'parede_traseira.txt': 'parede_traseira_7col.csv',
    'parede_esquerda.txt': 'parede_esquerda_7col.csv',
    'parede_direita.txt': 'parede_direita_7col.csv',
    'piso.txt': 'piso_7col.csv',
    'teto.txt': 'teto_7col.csv'
};

// Confere cada par; devolve a lista de divergências (vazia = tudo certo)
function conferir() {
    const falhas = [];
    Object.entries(PARES).forEach(([bruto, csv]) => {
        const esperado = converter(path.join(RAW, bruto));
        const atual = fs.readFileSync(path.join(__dirname, csv), 'utf8');
        if (esperado !== atual) falhas.push({ bruto, csv, esperado, atual });
    });
    return falhas;
}

module.exports = { converter, conferir, PARES, RAW };

if (require.main === module) {
    const alvo = process.argv[2];
    if (alvo) {
        process.stdout.write(converter(path.join(RAW, alvo)));
    } else {
        const falhas = conferir();
        falhas.forEach(f => console.error(
            `DIVERGE  ${f.bruto} -> ${f.csv}  (bruto ${f.esperado.trimEnd().split('\r\n').length} obs, ` +
            `csv ${f.atual.trimEnd().split(/\r?\n/).length} obs)`));
        console.log(falhas.length
            ? `\n${falhas.length} CSV fora de sincronia com raw/`
            : `${Object.keys(PARES).length} CSVs conferem byte a byte com raw/`);
        process.exit(falhas.length ? 1 : 0);
    }
}
