// Confere todos os números citados em poligonal_e_irradiacao.tex.
// Execute com:  node surveyor_valley/explanations/poligonal_irradiacao.js
//
// Um único levantamento fictício, mas coerente, costura as duas partes da aula:
//   Parte 1 — uma POLIGONAL ABERTA sai do marco M1 (coordenadas conhecidas), orientada
//             pela visada ao marco M2, e caminha por P1, P2 e P3.
//   Parte 2 — dos vértices P1 e P2 os detalhes são levantados por IRRADIAÇÃO.
//
// A regra de transporte de azimute é uma só, e vale nos dois casos:
//     Az(vante) = Az(ré) + ângulo horário - 180°      (somando ou tirando 360°)
// Ela reproduz exatamente o exercício 9.3.1 de "Fundamentos de Topografia" (Veiga,
// Zanetti & Faggion, UFPR) e o Exemplo 10.11 de Wolf & Ghilani, "Elementary Surveying"
// — as duas conferências estão no fim deste arquivo.
//
// Tudo é planimetria: só X (leste) e Y (norte). Azimutes contados do Norte, no sentido
// horário, de 0° a 360°.

'use strict';

// ------------------------------------------------------------------ ângulos
const gms = (g, m, s) => g + m / 60 + s / 3600;
const rad = d => d * Math.PI / 180;

function fmtGMS(a) {
    a = ((a % 360) + 360) % 360;
    let t = Math.round(a * 3600);
    const g = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = t % 60;
    return `${g}° ${String(m).padStart(2, '0')}' ${String(s).padStart(2, '0')}"`;
}

// ------------------------------------------------------------------ as duas contas da aula
// Transporte de azimute: o "vante" tanto pode ser o próximo vértice (poligonal) quanto
// um ponto de detalhe (irradiação) — a conta é a mesma.
const transporta = (azRe, anguloHorario) => (((azRe + anguloHorario - 180) % 360) + 360) % 360;

// Ponto lançado: de coordenadas polares para retangulares.
function lanca(P, az, d) {
    return { X: P.X + d * Math.sin(rad(az)), Y: P.Y + d * Math.cos(rad(az)) };
}

// Problema inverso: de duas coordenadas para distância e azimute.
function inverso(P, Q) {
    const dX = Q.X - P.X, dY = Q.Y - P.Y;
    return { d: Math.hypot(dX, dY), az: ((Math.atan2(dX, dY) * 180 / Math.PI) % 360 + 360) % 360 };
}

// ------------------------------------------------------------------ os dados de campo
const M1 = { X: 1000.000, Y: 2000.000 };          // marco de partida, coordenadas conhecidas
const AZ_PARTIDA = gms(62, 14, 20);               // azimute M2 -> M1, dado pela base

// Poligonal: em cada vértice, o ângulo horário da ré para a vante, e a distância à vante.
const POLIGONAL = [
    { nome: 'P1', ang: gms(236, 17, 50), d: 87.432 },
    { nome: 'P2', ang: gms(127, 15, 20), d: 112.906 },
    { nome: 'P3', ang: gms(242, 17, 25), d: 94.178 },
];

// Irradiação: a partir de P1 e de P2, com a ré no vértice anterior da poligonal.
const IRRADIACAO = {
    P1: [
        { nome: 'E1', ang: gms(88, 14, 5), d: 23.145, o: 'esquina da casa' },
        { nome: 'E2', ang: gms(152, 40, 30), d: 41.802, o: 'poste' },
        { nome: 'AR', ang: gms(305, 18, 40), d: 17.560, o: 'árvore' },
    ],
    P2: [
        { nome: 'E2\'', ang: gms(346, 34, 10), d: 77.290, o: 'o MESMO poste, de outra estação' },
        { nome: 'E3', ang: gms(74, 52, 15), d: 34.907, o: 'tampa de poço' },
    ],
};

// ------------------------------------------------------------------ Parte 1: a poligonal
console.log('\n============ PARTE 1 · POLIGONAL ABERTA ============\n');
console.log(`marco de partida M1   X = ${M1.X.toFixed(3)}   Y = ${M1.Y.toFixed(3)}`);
console.log(`azimute de partida    M2 -> M1 = ${fmtGMS(AZ_PARTIDA)}\n`);

const vertices = { M1 };
const azLado = {};     // azimute do lado que CHEGA em cada vértice
let az = AZ_PARTIDA, atual = M1, anterior = 'M1';

console.log('vért.  ângulo horário   distância     azimute do lado        dX        dY         X           Y');
console.log('-'.repeat(103));
console.log(`M1                                                                          ${M1.X.toFixed(3).padStart(10)}  ${M1.Y.toFixed(3).padStart(10)}`);
for (const v of POLIGONAL) {
    az = transporta(az, v.ang);
    const dX = v.d * Math.sin(rad(az)), dY = v.d * Math.cos(rad(az));
    const Q = lanca(atual, az, v.d);
    azLado[v.nome] = az;
    vertices[v.nome] = Q;
    console.log(`${v.nome}     ${fmtGMS(v.ang).padStart(14)}  ${v.d.toFixed(3).padStart(8)} m  ${fmtGMS(az).padStart(15)}  ` +
                `${dX.toFixed(3).padStart(9)} ${dY.toFixed(3).padStart(9)}  ` +
                `${Q.X.toFixed(3).padStart(10)}  ${Q.Y.toFixed(3).padStart(10)}`);
    atual = Q; anterior = v.nome;
}

const total = POLIGONAL.reduce((s, v) => s + v.d, 0);
const fecha = inverso(M1, vertices.P3);
console.log(`\ncomprimento total do caminhamento: ${total.toFixed(3)} m`);
console.log(`linha de fechamento M1 -> P3:  ${fecha.d.toFixed(3)} m,  azimute ${fmtGMS(fecha.az)}`);
console.log('  (numa poligonal aberta essa linha é RESULTADO, não confronto: não há com o que comparar)');

// ------------------------------------------------------------------ o preço de não ter confronto
console.log('\n---- e se um ângulo estivesse errado? (erro introduzido no vértice P1) ----\n');
function refaz(erroSegundos) {
    let a = AZ_PARTIDA, p = M1; const out = {};
    POLIGONAL.forEach((v, i) => {
        // o erro entra no ângulo lido EM P1, que é o segundo da lista (índice 1)
        const ang = v.ang + (i === 1 ? erroSegundos / 3600 : 0);
        a = transporta(a, ang);
        p = lanca(p, a, v.d);
        out[v.nome] = p;
    });
    return out;
}
for (const [rotulo, segundos] of [['1 segundo', 1], ['1 minuto', 60], ['1 grau', 3600]]) {
    const e = refaz(segundos);
    const d2 = inverso(vertices.P2, e.P2).d, d3 = inverso(vertices.P3, e.P3).d;
    console.log(`erro de ${rotulo.padEnd(10)} em P1  ->  P2 desloca ${d2.toFixed(3)} m,  P3 desloca ${d3.toFixed(3)} m`);
}
console.log('\n  Nenhum desses erros produz qualquer sinal: a poligonal aberta aceita todos calada.');

// ------------------------------------------------------------------ Parte 2: irradiação
console.log('\n\n============ PARTE 2 · IRRADIAÇÃO ============\n');
const detalhes = {};
for (const [estacao, lista] of Object.entries(IRRADIACAO)) {
    const azRe = azLado[estacao];   // o azimute do lado que chegou nesta estação
    console.log(`estação ${estacao}   X = ${vertices[estacao].X.toFixed(3)}   Y = ${vertices[estacao].Y.toFixed(3)}` +
                `   ré no vértice anterior, azimute ${fmtGMS(azRe)}`);
    console.log('  ponto   ângulo horário    distância      azimute            X            Y');
    console.log('  ' + '-'.repeat(84));
    for (const p of lista) {
        const a = transporta(azRe, p.ang);
        const Q = lanca(vertices[estacao], a, p.d);
        detalhes[p.nome] = Q;
        console.log(`  ${p.nome.padEnd(6)}  ${fmtGMS(p.ang).padStart(14)}  ${p.d.toFixed(3).padStart(9)} m  ${fmtGMS(a).padStart(16)}  ` +
                    `${Q.X.toFixed(3).padStart(10)}  ${Q.Y.toFixed(3).padStart(10)}   ${p.o}`);
    }
    console.log('');
}

// ------------------------------------------------------------------ o confronto improvisado
const A = detalhes['E2'], B = detalhes["E2'"];
const dif = Math.hypot(B.X - A.X, B.Y - A.Y);
console.log('---- o único confronto possível: o poste irradiado das DUAS estações ----\n');
console.log(`  de P1:  X = ${A.X.toFixed(3)}   Y = ${A.Y.toFixed(3)}`);
console.log(`  de P2:  X = ${B.X.toFixed(3)}   Y = ${B.Y.toFixed(3)}`);
console.log(`  diferença:  ΔX = ${(B.X - A.X).toFixed(3)} m,  ΔY = ${(B.Y - A.Y).toFixed(3)} m` +
            `  ->  ${dif.toFixed(3)} m = ${(dif * 1000).toFixed(0)} mm`);

// ------------------------------------------------------------------ conferência contra os livros
console.log('\n\n============ CONFERÊNCIA CONTRA OS LIVROS ============\n');

// Fundamentos de Topografia (UFPR), exercício 9.3.1 — irradiação, estação 1
console.log('Fundamentos de Topografia (Veiga, Zanetti & Faggion), exercício 9.3.1:');
const az0F = gms(106, 52, 7), estF = { X: 320.05, Y: 560.22 };
const casosF = [
    ['A1', gms(11, 7, 15), 58.38, gms(88, 21, 40), 268.52, 587.61],
    ['P1', gms(220, 40, 32), 22.49, gms(91, 3, 12), 332.12, 541.24],
    ['B1', gms(290, 37, 24), 46.87, gms(92, 22, 9), 291.55, 523.06],
];
let okF = true;
for (const [nome, ang, Di, Z, Xliv, Yliv] of casosF) {
    const Dh = Di * Math.sin(rad(Z));                 // só aqui a zenital aparece
    const a = transporta(az0F, ang);
    const Q = lanca(estF, a, Dh);
    // 1 cm de tolerância: o livro imprime 2 casas e trunca (P1 dá 541,246 e sai como 541,24)
    const bate = Math.abs(Q.X - Xliv) < 0.011 && Math.abs(Q.Y - Yliv) < 0.011;
    okF = okF && bate;
    console.log(`  ${nome}: Dh = ${Dh.toFixed(3)}  Az = ${fmtGMS(a)}  ` +
                `X = ${Q.X.toFixed(2)} (livro ${Xliv})  Y = ${Q.Y.toFixed(2)} (livro ${Yliv})  ${bate ? 'OK' : 'DIVERGE'}`);
}

// Wolf & Ghilani, Elementary Surveying, Exemplo 10.11 — poligonal aberta e linha de fechamento
console.log('\nWolf & Ghilani, "Elementary Surveying", Exemplo 10.11 (em pés):');
let azW = 0, pW = { X: 10000.00, Y: 10000.00 };
const casosW = [
    ['B', gms(115, 18, 25), 3305.78, 7011.47, 11413.11],
    ['C', gms(161, 24, 11), 1862.40, 5161.83, 11630.72],
    ['D', gms(204, 50, 9), 1910.22, 3533.90, 12630.11],
    ['E', gms(273, 46, 37), 6001.83, 7004.05, 17527.05],
];
let okW = true;
for (const [nome, ang, d, Xliv, Yliv] of casosW) {
    azW = transporta(azW, ang);
    pW = lanca(pW, azW, d);
    const bate = Math.abs(pW.X - Xliv) < 0.02 && Math.abs(pW.Y - Yliv) < 0.02;
    okW = okW && bate;
    console.log(`  ${nome}: Az = ${fmtGMS(azW)}  X = ${pW.X.toFixed(2)} (livro ${Xliv})  ` +
                `Y = ${pW.Y.toFixed(2)} (livro ${Yliv})  ${bate ? 'OK' : 'DIVERGE'}`);
}
const fW = inverso({ X: 10000, Y: 10000 }, pW);
const okFech = Math.abs(fW.d - 8101.37) < 0.02;
console.log(`  linha de fechamento AE: ${fW.d.toFixed(2)} ft (livro 8101.37), ` +
            `azimute ${fmtGMS(fW.az)} (livro 338° 17' 46")  ${okFech ? 'OK' : 'DIVERGE'}`);

console.log(`\n${okF && okW && okFech ? '>>> A MESMA regra reproduz os dois livros, exatamente.' : '>>> ALGO DIVERGIU'}\n`);
