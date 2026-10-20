#!/usr/bin/env python3
"""Números derivados da aula sgb_altimetria.tex / Derived numbers for sgb_altimetria.tex.

Refaz, com Python puro (só os módulos math e random), toda conta que aparece nos slides: marés
e ciclo nodal, subida do mar desde a época do datum, erros do nivelamento, o exemplo de
ajustamento de 4 nós, número geopotencial e altitude normal, e a linha do tempo. Rodar nesta pasta:

    python3 sgb_altimetria_numeros.py             # imprime todos os números das aulas
    python3 sgb_altimetria_numeros.py --figuras   # imprime as macros TikZ com as coordenadas

Recomputes, in plain Python, every number shown on the slides. With --figuras it prints the
TeX macros (coordinate lists) pasted into the TikZ figures. Os dados "sintéticos" (série de NMM)
são ILUSTRATIVOS, com semente fixa: não são medidas / The "synthetic" data are ILLUSTRATIVE.
"""

import random
import sys
from math import asin, atan2, cos, degrees, pi, radians, sin, sqrt

# ---------------------------------------------------------------- constantes
H_M2 = 12.420601          # h, período da maré lunar semidiurna principal / principal lunar semidiurnal
H_S2 = 12.0               # h, solar semidiurna / solar semidiurnal
H_K1 = 23.934470          # h, luni-solar diurna / luni-solar diurnal
H_O1 = 25.819342          # h, lunar diurna / lunar diurnal
NODAL_D = 6798.383        # dias, regressão dos nodos da Lua / regression of the lunar nodes
DIA_ANO = 365.2422        # dias / days
ANO_NODAL = NODAL_D / DIA_ANO      # ≈ 18,61 anos
EPS = 23.4393             # ° obliquidade média / mean obliquity
INCL = 5.145              # ° inclinação da órbita da Lua / inclination of the lunar orbit
R_TERRA = 6_371_000.0     # m
GAMMA = 9.78              # m/s², gravidade normal média na altura do continente (ordem de grandeza)
TAXA_NMM = 2.24           # mm/ano, tendência do NMM na região de Imbituba (estudo UFPR, 2017)
TAXA_NMM_INC = 0.4        # mm/ano, incerteza informada no mesmo estudo / uncertainty in the same study
TAXA_SUBS = -3.02         # mm/ano, componente vertical do marégrafo (GNSS), mesmo estudo
EPOCA_IMBITUBA = (1949 + 1957 + 1) / 2   # = 1953,5: meio do intervalo 1949--1957 (inclusive)
ANO_ATUAL = 2026
ARCSEC = pi / 648_000.0       # rad
VOLTA_TERRA_KM = 40_075.0     # km, circunferência equatorial / equatorial circumference


def titulo(txt):
    print(f"\n{'=' * 78}\n{txt}\n{'=' * 78}")


def linha(rotulo, valor, fmt="{:.4f}", un=""):
    print(f"  {rotulo:<62} {fmt.format(valor)} {un}")


# ---------------------------------------------------------------- AULA 1
def mare_dia(t_h):
    """Maré ilustrativa (m) em t_h horas: M2 + K1, média zero. NÃO é o marégrafo de Imbituba."""
    return 0.50 * cos(2 * pi * t_h / H_M2 - 0.6) + 0.12 * cos(2 * pi * t_h / H_K1 - 1.2)


def mare_sizigia(t_h):
    """M2 + S2 (amplitudes 1 e 0,45): produz o batimento sizígia-quadratura / spring-neap beat."""
    return cos(2 * pi * t_h / H_M2) + 0.45 * cos(2 * pi * t_h / H_S2)


def envoltoria_sizigia(t_h):
    w = 2 * pi * (1 / H_S2 - 1 / H_M2)
    return sqrt(1 + 0.45 ** 2 + 2 * 0.45 * cos(w * t_h))


def decl_max_lua(ano, t0=2006.7):
    """Declinação máxima da Lua (°) ao longo do ciclo nodal; máximo em t0 (≈ 2006) / lunar max declination."""
    return EPS + INCL * cos(2 * pi * (ano - t0) / ANO_NODAL)


def serie_nmm_sintetica(n_meses, rng, a_anual=8.0, sigma=6.0, rho=0.5, a_nodal=2.0):
    """NMM mensal sintético (cm), média verdadeira = 0: ciclo anual + ciclo nodal + ruído AR(1).
    Parâmetros ilustrativos (não medidos) / illustrative parameters (not measured)."""
    fase_nodal = rng.uniform(0, 2 * pi)
    mes0 = rng.uniform(0, 12)
    ruido = rng.gauss(0, sigma)
    out = []
    for k in range(n_meses):
        ruido = rho * ruido + sqrt(1 - rho ** 2) * rng.gauss(0, sigma)
        t_ano = (mes0 + k) / 12.0
        v = (a_anual * cos(2 * pi * t_ano) + a_nodal * cos(2 * pi * t_ano / ANO_NODAL + fase_nodal)
             + ruido)
        out.append(v)
    return out


def erro_por_janela(janelas_meses, n_trials=4000, seed=20261019):
    """Erro rms (cm) do NMM estimado com a média de L meses, por Monte Carlo (série sintética)."""
    rng = random.Random(seed)
    soma2 = {L: 0.0 for L in janelas_meses}
    n_max = max(janelas_meses)
    for _ in range(n_trials):
        s = serie_nmm_sintetica(n_max, rng)
        acc = 0.0
        for k, v in enumerate(s, start=1):
            acc += v
            if k in soma2:
                soma2[k] += (acc / k) ** 2
    return {L: sqrt(soma2[L] / n_trials) for L in janelas_meses}


JANELAS = (1, 12, 24, 108, 228)     # meses: 1 mês, 1 ano, 2 anos (Santana), 9 anos (Imbituba), 19 anos


def haversine_km(lat1, lon1, lat2, lon2):
    p1, p2 = radians(lat1), radians(lat2)
    dl = radians(lon2 - lon1)
    a = sin((p2 - p1) / 2) ** 2 + cos(p1) * cos(p2) * sin(dl / 2) ** 2
    return 2 * R_TERRA / 1000 * asin(sqrt(a))


# cidades e pontos do litoral (lat, lon) graus decimais, aproximados / approximate coastal points
COSTA = [
    (4.40, -51.53, "Cabo Orange"), (1.70, -49.90, "Cabo Norte"), (-0.70, -48.50, "Marajó"),
    (-0.60, -47.40, "Salinópolis"), (-2.50, -44.30, "São Luís"), (-2.90, -41.80, "Parnaíba"),
    (-3.73, -38.52, "Fortaleza"), (-5.16, -35.48, "Ponta do Calcanhar"), (-7.15, -34.79, "Cabo Branco"),
    (-8.05, -34.88, "Recife"), (-9.67, -35.73, "Maceió"), (-12.97, -38.50, "Salvador"),
    (-14.80, -39.03, "Ilhéus"), (-17.73, -39.25, "Caravelas"), (-20.32, -40.34, "Vitória"),
    (-22.88, -42.02, "Cabo Frio"), (-22.91, -43.17, "Rio de Janeiro"), (-23.96, -46.33, "Santos"),
    (-25.52, -48.51, "Paranaguá"), (-27.60, -48.55, "Florianópolis"), (-29.34, -49.73, "Torres"),
    (-32.03, -52.10, "Rio Grande"), (-33.69, -53.46, "Chuí"),
]
PONTOS = {
    "Torres": (-29.34, -49.73), "Imbituba": (-28.24, -48.67), "Santana": (-0.06, -51.18),
    "Belém": (-1.46, -48.50), "Arraial do Cabo": (-22.97, -42.02), "Salvador": (-12.97, -38.50),
    "Fortaleza": (-3.73, -38.52),
}


def aula1():
    titulo("AULA 1 — Onde fica o zero? / Class 1 — Where is the zero?")
    print("\n  Marés / Tides")
    linha("período M2 (h)", H_M2, "{:.4f}")
    linha("período S2 (h)", H_S2, "{:.4f}")
    bat = 1 / (1 / H_S2 - 1 / H_M2) / 24
    linha("batimento M2 x S2 = ciclo sizígia-quadratura (dias)", bat, "{:.2f}")
    linha("ciclo nodal (anos)", ANO_NODAL, "{:.2f}")
    linha("ciclos de M2 em um ciclo nodal", ANO_NODAL * DIA_ANO * 24 / H_M2, "{:.0f}")
    linha("declinação máxima da Lua, mínimo do ciclo (°)", EPS - INCL, "{:.1f}")
    linha("declinação máxima da Lua, máximo do ciclo (°)", EPS + INCL, "{:.1f}")
    linha("máximos nodais: 2006,7 + 18,61 (ano)", 2006.7 + ANO_NODAL, "{:.1f}")
    linha("mínimo nodal entre eles (ano)", 2006.7 + ANO_NODAL / 2, "{:.1f}")

    print("\n  Quanto tempo de média? (série sintética ILUSTRATIVA) / How long to average?")
    err = erro_por_janela(JANELAS)
    nomes = {1: "1 mês", 12: "1 ano (Torres)", 24: "2 anos (Santana)", 108: "9 anos (Imbituba)",
             228: "19 anos (padrão)"}
    for L in JANELAS:
        linha(f"erro rms do NMM com {nomes[L]} (cm)", err[L], "{:.1f}")
    linha("fração do ciclo nodal em 9 anos", 9 / ANO_NODAL, "{:.2f}")
    linha("fração do ciclo nodal em 2 anos", 2 / ANO_NODAL, "{:.2f}")
    linha("fração do ciclo nodal em 1 ano", 1 / ANO_NODAL, "{:.2f}")

    print("\n  O mar sobe, a altitude não / The sea rises, the altitude does not")
    anos = ANO_ATUAL - EPOCA_IMBITUBA
    linha("anos desde o meio do intervalo 1949-1957", anos, "{:.1f}")
    linha("subida do NMM desde a época do datum (cm)", TAXA_NMM * anos / 10, "{:.1f}")
    linha("incerteza (cm), só da taxa", TAXA_NMM_INC * anos / 10, "{:.1f}")
    linha("subsidência do marégrafo no mesmo intervalo (cm), se constante", -TAXA_SUBS * anos / 10,
          "{:.1f}")

    print("\n  Distâncias / Distances")
    d = haversine_km(*PONTOS["Santana"], *PONTOS["Belém"])
    linha("Santana -- Belém, círculo máximo (km)", d, "{:.0f}")
    d = haversine_km(*PONTOS["Torres"], *PONTOS["Imbituba"])
    linha("Torres -- Imbituba (km)", d, "{:.0f}")
    linha("Imbituba -- Santana, círculo máximo (km)",
          haversine_km(*PONTOS["Imbituba"], *PONTOS["Santana"]), "{:.0f}")

    print("\n  Linha do tempo / Timeline (anos)")
    linha("Torres: ligação da rede (dez/1946) a partir do início (1945) (anos)", 1946.9 - 1945.8,
          "{:.1f}")
    linha("1945 -> troca Torres/Imbituba (1958-59)", 1958.5 - 1945.8, "{:.0f}")
    linha("janela de observação do datum de Imbituba (anos)", 1957 - 1949 + 1, "{:.0f}")
    linha("janela de observação do datum de Santana (anos)", 1958 - 1957 + 1, "{:.0f}")
    linha("de Santana 1957-58 à adoção 1980-81 (anos)", 1980.5 - 1957.5, "{:.0f}")


# ---------------------------------------------------------------- AULA 2
def curvatura_mm(s_m, k_ref=0.0):
    """Efeito da curvatura da Terra numa visada de s_m metros, em mm: c = (1 - k) s^2 / 2R."""
    return (1 - k_ref) * s_m ** 2 / (2 * R_TERRA) * 1000


def tol_mm(K_km, c=3.0):
    """Tolerância c * sqrt(K) em mm (c = 3 mm sqrt(K): valor citado para a R.PR 22/1983; a conferir)."""
    return c * sqrt(K_km)


def passeios(n_linhas=6, n_km=100, sigma_mm=1.0, seed=42):
    """Erros acumulados de n_linhas linhas de n_km km (passo de 1 km, desvio-padrão sigma_mm)."""
    rng = random.Random(seed)
    out = []
    for _ in range(n_linhas):
        acc, pts = 0.0, [(0, 0.0)]
        for k in range(1, n_km + 1):
            acc += rng.gauss(0, sigma_mm)
            pts.append((k, acc))
        out.append(pts)
    return out


def aula2():
    titulo("AULA 2 — Medir a altitude lance a lance / Class 2 — Leg by leg")
    print("\n  Um lance / One setup")
    re_, vante = 1.482, 0.937
    linha("ré (m)", re_, "{:.3f}")
    linha("vante (m)", vante, "{:.3f}")
    linha("desnível = ré - vante (m)", re_ - vante, "{:.3f}")
    linha("H_A = 12,000 m  ->  H_B (m)", 12.000 + re_ - vante, "{:.3f}")

    print("\n  Visadas curtas e iguais / Short, equal sights")
    for sdist in (30, 50, 100):
        linha(f"curvatura em {sdist} m (mm)", curvatura_mm(sdist), "{:.3f}")
    linha("curvatura em 50 m com refração k=0,13 (mm)", curvatura_mm(50, 0.13), "{:.3f}")
    linha("curvatura em 100 m com refração k=0,13 (mm)", curvatura_mm(100, 0.13), "{:.3f}")
    dif = (50 ** 2 - 30 ** 2) / (2 * R_TERRA) * 1000
    linha("curvatura: visadas de 30 m e 50 m, diferença (mm)", dif, "{:.3f}")
    eps = 10 * ARCSEC
    linha("colimação de 10\": erro por lance, distâncias desiguais de 20 m (mm)", eps * 20 * 1000,
          "{:.2f}")
    linha("... em 100 lances, mesmo sinal (mm)", 100 * eps * 20 * 1000, "{:.0f}")
    linha("... com distâncias iguais (mm)", 0.0, "{:.1f}")

    print("\n  Ida e volta / Forward and back")
    ida, volta, K = 12.347, -12.343, 3.2
    linha("discrepância ida+volta (mm)", abs(ida + volta) * 1000, "{:.1f}")
    linha("média |ida|, |volta| (m)", (abs(ida) + abs(volta)) / 2, "{:.3f}")
    linha("tolerância 3 sqrt(K), K = 3,2 km (mm)", tol_mm(K), "{:.1f}")
    ida2, volta2, K2 = 8.912, -8.904, 5.0
    linha("Sua vez: discrepância (mm)", abs(ida2 + volta2) * 1000, "{:.1f}")
    linha("Sua vez: tolerância, K = 5 km (mm)", tol_mm(K2), "{:.1f}")

    print("\n  O erro que cresce / The error that grows")
    eta, delta = 1.0, 0.1       # mm/sqrt(km); mm/km
    for Kk in (4, 100, 400, 2000):
        linha(f"aleatório eta sqrt(K), K = {Kk} km (mm)", eta * sqrt(Kk), "{:.1f}")
        linha(f"sistemático delta K, K = {Kk} km (mm)", delta * Kk, "{:.1f}")
    linha("K onde os dois se igualam: (eta/delta)^2 (km)", (eta / delta) ** 2, "{:.0f}")
    for Kk in (4, 16, 39, 100):
        linha(f"tolerância 3 sqrt(K), K = {Kk} km (mm)", tol_mm(Kk), "{:.1f}")

    print("\n  Circuito / Loop")
    sec = [(10, 15.4301), (8, -4.2276), (12, -13.7819), (9, 2.5854)]
    w = sum(d for _, d in sec)
    Kp = sum(k for k, _ in sec)
    linha("perímetro K (km)", Kp, "{:.0f}")
    linha("fechamento w = soma dos desníveis (mm)", w * 1000, "{:.1f}")
    linha("tolerância 3 sqrt(K) (mm)", tol_mm(Kp), "{:.1f}")
    linha("w / sqrt(K) (mm por raiz de km)", w * 1000 / sqrt(Kp), "{:.2f}")

    print("\n  A rede / The network (IBGE, resumos de busca)")
    linha("voltas à Terra: 230 000 km (1992)", 230_000 / VOLTA_TERRA_KM, "{:.1f}")
    linha("voltas à Terra: 370 000 km (2011)", 370_000 / VOLTA_TERRA_KM, "{:.1f}")
    linha("RRNN 2011 / RRNN 1992", 69_590 / 43_079, "{:.2f}")
    linha("RRNN hoje (71 475) / RRNN 2011", 71_475 / 69_590, "{:.3f}")

    print("\n  O que o nível não vê / What the level does not see")
    for H, dg_mgal in ((1000, 20), (1000, 50), (500, 20)):
        dH = H * (dg_mgal * 1e-5) / GAMMA
        linha(f"H = {H} m, Δg = {dg_mgal} mGal: ΔH = H Δg / γ (mm)", dH * 1000, "{:.1f}")
    linha("variação de g na Terra (valores do IBGE): 9,834 - 9,764 (m/s²)", 9.834 - 9.764, "{:.3f}")
    linha("... em mGal", (9.834 - 9.764) / 1e-5, "{:.0f}")


# ---------------------------------------------------------------- AULA 3
def resolve(M, v):
    """Resolve M x = v por eliminação de Gauss com pivoteamento parcial (listas de listas)."""
    n = len(v)
    A = [row[:] + [v[i]] for i, row in enumerate(M)]
    for c in range(n):
        piv = max(range(c, n), key=lambda r: abs(A[r][c]))
        A[c], A[piv] = A[piv], A[c]
        for r in range(c + 1, n):
            f = A[r][c] / A[c][c]
            for k in range(c, n + 1):
                A[r][k] -= f * A[c][k]
    x = [0.0] * n
    for r in range(n - 1, -1, -1):
        x[r] = (A[r][n] - sum(A[r][k] * x[k] for k in range(r + 1, n))) / A[r][r]
    return x


def inversa(M):
    n = len(M)
    cols = [resolve(M, [1.0 if i == j else 0.0 for i in range(n)]) for j in range(n)]
    return [[cols[j][i] for j in range(n)] for i in range(n)]


# Rede de 4 nós: A fixo (H_A = 10,000 m); observações (de, para, desnível m, K km)
H_A = 10.000
NOS = ["A", "B", "C", "D"]
OBS = [("A", "B", 2.350, 4.0), ("B", "C", -2.483, 6.0), ("C", "D", 1.254, 5.0),
       ("D", "A", -1.121, 3.0), ("A", "C", -0.133, 5.0), ("B", "D", -1.223, 7.0)]


def mmq(nos, fixos, obs, eta=1.0):
    """Mínimos quadrados ponderados do nivelamento: dh + v = H_para - H_de, peso p = 1/(eta^2 K).
    fixos = {nó: altitude}. Devolve (incógnitas, N, b, x, v, sigma0, r)."""
    inc = [n for n in nos if n not in fixos]
    idx = {n: i for i, n in enumerate(inc)}
    n = len(inc)
    N = [[0.0] * n for _ in range(n)]
    b = [0.0] * n
    for de, para, dh, K in obs:
        p = 1.0 / (eta ** 2 * K)
        # linha de projeto: +1 em 'para', -1 em 'de'; termo l = dh - (H0_para - H0_de) com fixos
        a = {}
        if para in idx:
            a[idx[para]] = 1.0
        if de in idx:
            a[idx[de]] = -1.0
        l = dh - ((fixos.get(para, 0.0)) - (fixos.get(de, 0.0)))
        for i, ai in a.items():
            b[i] += p * ai * l
            for j, aj in a.items():
                N[i][j] += p * ai * aj
    x = resolve(N, b)
    H = dict(fixos)
    for nome, i in idx.items():
        H[nome] = x[i]
    v = []
    for de, para, dh, K in obs:
        v.append(H[para] - H[de] - dh)       # resíduo: valor ajustado - observado
    vPv = sum((vi * 1000.0) ** 2 / (eta ** 2 * K) for vi, (_, _, _, K) in zip(v, obs))   # v em mm
    r = len(obs) - n
    s0 = sqrt(vPv / r) if r > 0 else float("nan")
    return inc, N, b, x, v, s0, r, H


def aula3():
    titulo("AULA 3 — Os ajustamentos e o REALT / Class 3 — Adjustments and REALT")
    print("\n  Exemplo de 4 nós: A fixo = 10,000 m (eta = 1 mm/sqrt(km), p = 1/K)")
    for de, para, dh, K in OBS:
        print(f"    {de}->{para}  dh = {dh:+.3f} m   K = {K:.0f} km   sigma = {sqrt(K):.2f} mm")
    w = sum(dh for de, para, dh, K in OBS[:4])
    linha("fechamento do circuito A-B-C-D-A (mm)", w * 1000, "{:+.1f}")
    linha("fechamento A-B-C-A (mm)", (OBS[0][2] + OBS[1][2] - OBS[4][2]) * 1000, "{:+.1f}")
    linha("fechamento A-C-D-A (mm)", (OBS[4][2] + OBS[2][2] + OBS[3][2]) * 1000, "{:+.1f}")
    linha("fechamento A-B-D-A (mm)", (OBS[0][2] + OBS[5][2] + OBS[3][2]) * 1000, "{:+.1f}")
    inc, N, b, x, v, s0, r, H = mmq(NOS, {"A": H_A}, OBS)
    print("\n  Matriz normal N (incógnitas B, C, D), unidade 1/km:")
    for row in N:
        print("    [" + "  ".join(f"{e:8.4f}" for e in row) + " ]")
    print("  termo independente b (m/km):", "  ".join(f"{e:8.5f}" for e in b))
    for n_, xi in zip(inc, x):
        linha(f"H_{n_} ajustada (m)", xi, "{:.4f}")
    for (de, para, dh, K), vi in zip(OBS, v):
        print(f"    resíduo {de}->{para}: v = {vi * 1000:+.2f} mm")
    verdade = {"B": 12.348, "C": 9.868, "D": 11.121}      # altitudes "verdadeiras" do exemplo inventado
    for n_ in ("B", "C", "D"):
        linha(f"H_{n_} verdadeira (m) e erro do ajuste (mm)", verdade[n_], "{:.3f}", f"  erro = {(H[n_] - verdade[n_]) * 1000:+.1f} mm")
    erros_obs = [("A->B", 2.350 - (12.348 - 10.000)), ("B->C", -2.483 - (9.868 - 12.348)),
                 ("C->D", 1.254 - (11.121 - 9.868)), ("D->A", -1.121 - (10.000 - 11.121)),
                 ("A->C", -0.133 - (9.868 - 10.000)), ("B->D", -1.223 - (11.121 - 12.348))]
    print("    erros injetados nas observações (mm):", "  ".join(f"{n}={e * 1000:+.0f}" for n, e in erros_obs))
    linha("graus de liberdade r = 6 - 3", r, "{:.0f}")
    linha("sigma0 a posteriori (fator de variância, sem unidade)", s0, "{:.2f}")
    Ninv = inversa(N)
    for n_, i in zip(inc, range(3)):
        linha(f"sigma de H_{n_} (mm), com sigma0 a posteriori", s0 * sqrt(Ninv[i][i]) * 1.0, "{:.2f}")
    linha("det(N)", N[0][0] * (N[1][1] * N[2][2] - N[1][2] * N[2][1])
          - N[0][1] * (N[1][0] * N[2][2] - N[1][2] * N[2][0])
          + N[0][2] * (N[1][0] * N[2][1] - N[1][1] * N[2][0]), "{:.4f}")

    print("\n  Blocos em cascata x ajuste simultâneo / Block cascade vs simultaneous")
    bloco1 = [OBS[0], OBS[1], OBS[4]]          # A-B, B-C, A-C
    inc1, N1, b1, x1, v1, s01, r1, H1 = mmq(["A", "B", "C"], {"A": H_A}, bloco1)
    bloco2 = [OBS[2], OBS[3], OBS[5]]          # C-D, D-A, B-D
    fix2 = {"A": H_A, "B": H1["B"], "C": H1["C"]}
    inc2, N2, b2, x2, v2, s02, r2, H2 = mmq(["A", "B", "C", "D"], fix2, bloco2)
    for n_ in ("B", "C", "D"):
        linha(f"H_{n_}: simultâneo (m)", H[n_], "{:.4f}")
        linha(f"H_{n_}: em blocos (m)", H2[n_], "{:.4f}")
        linha(f"  diferença blocos - simultâneo (mm)", (H2[n_] - H[n_]) * 1000, "{:+.2f}")
    N2inv = inversa(N2)
    linha("sigma de H_D a priori, bloco 2 com B e C 'sem erro' (mm)", sqrt(N2inv[0][0]), "{:.2f}")
    linha("sigma de H_D a priori, ajuste simultâneo (mm)", sqrt(Ninv[2][2]), "{:.2f}")
    linha("o bloco é otimista por (%)", (1 - sqrt(N2inv[0][0]) / sqrt(Ninv[2][2])) * 100, "{:.0f}")
    linha("bloco 1 (r = 1): sigma0 (sem unidade)", s01, "{:.2f}")

    print("\n  Linha do tempo (anos) / Timeline (years)")
    linha("1945 -> 2011: do primeiro nivelamento ao primeiro ajuste simultâneo", 2011 - 1945, "{:.0f}")
    linha("1945 -> 1975: os oito ajustamentos parciais", 1975 - 1945, "{:.0f}")
    linha("2005 -> 2011: a equipe DALTI até o ajuste simultâneo", 2011 - 2005, "{:.0f}")
    linha("2011 -> 2018: do ajuste simultâneo ao REALT-2018", 2018 - 2011, "{:.0f}")

    print("\n  Quantos circuitos independentes? / How many independent loops?")
    n_rrnn, m_obs, comp = 69_590, 74_000, 2
    linha("incógnitas = RRNN - 2 (um ponto fixo por bloco)", n_rrnn - comp, "{:.0f}")
    linha("redundância mínima r = m - incógnitas (m > 74 000)", m_obs - (n_rrnn - comp), "{:.0f}")
    linha("fração de observações 'redundantes'", (m_obs - (n_rrnn - comp)) / m_obs, "{:.3f}")
    linha("observações por RRNN", m_obs / n_rrnn, "{:.3f}")

    print("\n  Número geopotencial e altitude normal / Geopotential number and normal height")
    C = 68.392                       # m²/s², RN FICTÍCIA, valor didático
    for g in (9.78, 9.80):
        linha(f"H* = C / gamma_medio, gamma = {g} (m)", C / g, "{:.4f}")
    linha("diferença entre usar 9,78 e 9,80 (mm)", (C / 9.78 - C / 9.80) * 1000, "{:.1f}")
    linha("1 m de altitude vale (m²/s²), com gamma = 9,78", 9.78, "{:.2f}")
    linha("W0 do IHRS (m²/s²), IAG 2015", 62_636_853.4, "{:.1f}")
    linha("... em metros, com gamma = 9,8 (não usar para altitudes!)", 62_636_853.4 / 9.8, "{:.0f}")

    print("\n  Qualidade do ajustamento (resumo de busca do relatório do IBGE)")
    for k_, pct in ((1, 92.7), (2, 98.0), (3, 99.1), (4, 99.5)):
        linha(f"correções dentro de ±{k_} mm sqrt(K) (%)", pct, "{:.1f}")
    linha("fora de ±1 mm sqrt(K) (%)", 100 - 92.7, "{:.1f}")
    linha("fora de ±4 mm sqrt(K) (%)", 100 - 99.5, "{:.1f}")
    linha("em 74 000 observações, 0,5 % são", 0.005 * 74_000, "{:.0f}")

    print("\n  Gravidade / Gravity")
    linha("g máx - g mín na Terra (m/s²), 9,834 - 9,764", 9.834 - 9.764, "{:.3f}")
    linha("variação relativa (%)", (9.834 - 9.764) / 9.8 * 100, "{:.2f}")


# ---------------------------------------------------------------- AULA 4
def aula4():
    titulo("AULA 4 — O zero hoje e amanhã / Class 4 — The zero, now and next")
    print("\n  Do marégrafo à altitude do NMM local (números INVENTADOS) / From gauge to MSL height")
    H_RN, RN_acima_zero, leitura_media = 3.250, 4.100, 0.995
    H_zero_aparelho = H_RN - RN_acima_zero
    linha("altitude da RN (m)", H_RN, "{:.3f}")
    linha("a RN está acima do zero do aparelho (m)", RN_acima_zero, "{:.3f}")
    linha("altitude do zero do aparelho (m)", H_zero_aparelho, "{:.3f}")
    linha("leitura média do nível do mar sobre o zero do aparelho (m)", leitura_media, "{:.3f}")
    linha("altitude do NMM local no sistema do SGB (m)", H_zero_aparelho + leitura_media, "{:.3f}")

    print("\n  O chão se mexe / The ground moves")
    for v, anos in ((3.0, 30), (3.0, 10), (-3.02, 72.5)):
        linha(f"{v:+.2f} mm/ano durante {anos} anos (mm)", v * anos, "{:+.0f}")

    print("\n  Diferença entre as duas redes, por GNSS e modelo (resíduos INVENTADOS) / Offset between networks")
    resI = [0.10, 0.14, 0.12]            # h - H* - zeta_modelo nas RRNN do bloco de Imbituba (m)
    resS = [1.38, 1.44, 1.42]            # idem, Amapá (m)
    mI, mS = sum(resI) / len(resI), sum(resS) / len(resS)
    linha("média dos resíduos, bloco de Imbituba (m)", mI, "{:.3f}")
    linha("média dos resíduos, bloco do Amapá (m)", mS, "{:.3f}")
    linha("diferença entre os blocos (m)", mS - mI, "{:.3f}")
    print("  estudos publicados (resumos de busca): ~1,30 m (GOCE, BCG 2016); faixa 0,45-1,40 m (BCG 2019)")
    linha("amplitude da faixa de estudos (m)", 1.40 - 0.45, "{:.2f}")

    print("\n  Metros e m²/s² / Metres and m²/s²")
    for dm in (1.0, 1.30, 0.15):
        linha(f"{dm:.2f} m  ->  m²/s² (gamma = 9,78)", dm * GAMMA, "{:.2f}")
    linha("12,7 m²/s²  ->  metros", 12.7 / GAMMA, "{:.2f}")
    linha("W0 do IHRS (IAG 2015) (m²/s²)", 62_636_853.4, "{:.1f}")

    print("\n  Linha do tempo do SIRGAS vertical / SIRGAS vertical timeline")
    linha("1997 (GT III) -> 2015 (IHRS) (anos)", 2015 - 1997, "{:.0f}")
    linha("2001 (RMPG começa) -> 2024 (série consolidada) (anos)", 2024 - 2001, "{:.0f}")
    linha("1948 (Imbituba) -> 2026 (anos de série possível)", 2026 - 1948, "{:.0f}")
    linha("séries de 19 anos cabem em 2001--2024", (2024 - 2001) / 19, "{:.2f}")


# ---------------------------------------------------------------- figuras
def fmt_coords(pts, nd=2):
    return " ".join(f"({x:.{nd}f},{y:.{nd}f})" for x, y in pts)


def figuras():
    out = []
    out.append("% ---- coordenadas das figuras: sgb_altimetria_numeros.py --figuras (série sintética: "
               "ilustrativa) ----")
    # maré de dois dias, escala: 1 h = 0,15 cm; 1 m = 2,2 cm
    pts = [(0.15 * t / 1.0, 2.2 * mare_dia(t)) for t in [0.5 * k for k in range(0, 97)]]
    out.append("\\newcommand{\\mareDia}[1]{\\draw[#1] plot[smooth] coordinates {%s};}"
               % fmt_coords(pts))
    # sizígia-quadratura, 30 dias: 1 dia = 0,3 cm (9 cm); amplitude 1 = 0,9 cm
    pts = [(0.3 * t / 24.0, 0.9 * mare_sizigia(t)) for t in [1.5 * k for k in range(0, 481)]]
    out.append("\\newcommand{\\mareSizigia}[1]{\\draw[#1] plot coordinates {%s};}" % fmt_coords(pts))
    env = [(0.3 * t / 24.0, 0.9 * envoltoria_sizigia(t)) for t in [6.0 * k for k in range(0, 121)]]
    out.append("\\newcommand{\\mareEnvSup}[1]{\\draw[#1] plot[smooth] coordinates {%s};}"
               % fmt_coords(env))
    env = [(x, -y) for x, y in env]
    out.append("\\newcommand{\\mareEnvInf}[1]{\\draw[#1] plot[smooth] coordinates {%s};}"
               % fmt_coords(env))
    # declinação máxima da Lua, 2000--2030: 1 ano = 0,3 cm, 1° = 0,28 cm (a partir de 18°)
    pts = [(0.3 * (a - 2000), 0.28 * (decl_max_lua(a) - 18.0)) for a in
           [2000 + 0.5 * k for k in range(0, 61)]]
    out.append("\\newcommand{\\declNodal}[1]{\\draw[#1] plot[smooth] coordinates {%s};}"
               % fmt_coords(pts))
    # erro rms do NMM por janela de observação (série sintética): 1 mês, 1, 2, 9 e 19 anos
    err = erro_por_janela(JANELAS)
    for nome, L in (("Nmes", 1), ("Nano", 12), ("Ndois", 24), ("Nnove", 108), ("Ndezenove", 228)):
        out.append("\\newcommand{\\e%s}{%.1f}" % (nome, err[L]))
    # seis linhas de nivelamento de 100 km (erro acumulado, mm): 1 km = 0,07 cm, 1 mm = 0,12 cm
    for i, nome in enumerate("ABCDEF"):
        pts = [(0.07 * k, 0.12 * e) for k, e in passeios()[i]]
        out.append("\\newcommand{\\passeio%s}[1]{\\draw[#1] plot coordinates {%s};}" % (nome, fmt_coords(pts)))
    # costa esquemática: x = (lon + 55) * cos(15°) * k, y = (lat + 34) * k, k = 0,16 cm/°
    k = 0.16
    c15 = cos(radians(15))
    pts = [((lon + 55) * c15 * k, (lat + 34) * k) for lat, lon, _ in COSTA]
    out.append("\\newcommand{\\costaBR}[1]{\\draw[#1] plot[smooth, tension=0.35] coordinates {%s};}"
               % fmt_coords(pts))
    for nome, (lat, lon) in PONTOS.items():
        mac = (nome.replace(' ', '').replace('é', 'e').replace('ã', 'a').replace('ç', 'c'))
        out.append("\\newcommand{\\pt%s}{%.2f,%.2f}" % (mac, (lon + 55) * c15 * k, (lat + 34) * k))
    return "\n".join(out)


def main():
    if "--figuras" in sys.argv:
        print(figuras())
        return
    aula1()
    aula2()
    aula3()
    aula4()


if __name__ == "__main__":
    main()
