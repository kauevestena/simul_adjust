#!/usr/bin/env python3
"""Números derivados da aula sgr_celestes.tex / Derived numbers for sgr_celestes.tex.

Refaz, com Python puro (só o módulo math), toda conta que aparece nos slides: conversões de
ângulo, precessão, ERA e hora sideral, atraso do VLBI, órbitas de GNSS, escalas de tempo,
relatividade nos relógios do GPS e o orçamento de erros. Rodar nesta pasta:

    python3 sgr_celestes_numeros.py             # imprime todos os números das aulas
    python3 sgr_celestes_numeros.py --figuras   # imprime as coordenadas usadas nas figuras TikZ

Recomputes, in plain Python, every number shown on the slides. With --figuras it prints the
coordinate lists pasted into the TikZ figures (ground track, celestial sphere, pole circle).
"""

import sys
from math import (acos, asin, atan2, cos, degrees, log10, pi, radians, sin, sqrt, tan)

# ---------------------------------------------------------------- constantes
C = 299_792_458.0                       # m/s
ARCSEC = pi / 648_000.0                 # rad
MAS = ARCSEC / 1e3
UAS = ARCSEC / 1e6
R_MEAN = 6_371_000.0                    # m, raio médio / mean radius
A_GRS80 = 6_378_137.0                   # m
F_GRS80 = 1 / 298.257222101
E2_GRS80 = F_GRS80 * (2 - F_GRS80)
OMEGA = 7.292115e-5                     # rad/s, nominal (GRS80, IERS)
GM = 3.986004418e14                     # m³/s²
W0_IAU = 62_636_856.0                   # m²/s², W0 implícito em L_G (IAU 2000 B1.9)
L_G = 6.969290134e-10
ERA_RATE = 1.00273781191135448          # voltas por dia UT1 / revolutions per UT1 day (IAU 2000 B1.8)
GMST_POLY1 = 4612.156534                # ″/século, IAU 2006 / arcsec per century
GMST_RATE = ERA_RATE + GMST_POLY1 / (36525.0 * 1_296_000.0)
LY = 9.4607304725808e15                 # m
YEAR_S = 365.25 * 86400.0
EPS_J2000 = radians(84381.406 / 3600.0)  # obliquidade média J2000, IAU 2006


def titulo(txt):
    print(f"\n{'=' * 78}\n{txt}\n{'=' * 78}")


def linha(rotulo, valor, fmt="{:.4f}", un=""):
    print(f"  {rotulo:<58} {fmt.format(valor)} {un}")


def hms(segundos):
    h = int(segundos // 3600)
    m = int((segundos - 3600 * h) // 60)
    s = segundos - 3600 * h - 60 * m
    return f"{h} h {m:02d} min {s:05.2f} s"


def jd_gregoriano(y, m, d, hh=0, mm=0, ss=0.0):
    """Data juliana de uma data gregoriana (hora civil) / Julian date of a Gregorian date."""
    a = (14 - m) // 12
    yy = y + 4800 - a
    mm_ = m + 12 * a - 3
    jdn = d + (153 * mm_ + 2) // 5 + 365 * yy + yy // 4 - yy // 100 + yy // 400 - 32045
    return jdn - 0.5 + (hh + mm / 60 + ss / 3600) / 24


def era_graus(jd_ut1):
    """Ângulo de rotação da Terra, IERS Conventions 2010 eq. 5.15 / Earth Rotation Angle."""
    tu = jd_ut1 - 2451545.0
    return 360.0 * ((0.7790572732640 + ERA_RATE * tu) % 1.0)


def prec_j2000_para_data(ra_deg, dec_deg, T):
    """Precessão (ângulos de Lieske/IAU 1976, fórmulas de Meeus 21.4), T em séculos de J2000."""
    zeta = (2306.2181 * T + 0.30188 * T**2 + 0.017998 * T**3) * ARCSEC
    z = (2306.2181 * T + 1.09468 * T**2 + 0.018203 * T**3) * ARCSEC
    th = (2004.3109 * T - 0.42665 * T**2 - 0.041833 * T**3) * ARCSEC
    a0, d0 = radians(ra_deg), radians(dec_deg)
    a_ = cos(d0) * sin(a0 + zeta)
    b_ = cos(th) * cos(d0) * cos(a0 + zeta) - sin(th) * sin(d0)
    c_ = sin(th) * cos(d0) * cos(a0 + zeta) + cos(th) * sin(d0)
    return degrees(atan2(a_, b_) + z) % 360.0, degrees(asin(c_)), (zeta, z, th)


def separacao(ra1, dec1, ra2, dec2):
    """Distância angular entre dois pontos do céu, em graus / angular separation in degrees."""
    a1, d1, a2, d2 = map(radians, (ra1, dec1, ra2, dec2))
    c = sin(d1) * sin(d2) + cos(d1) * cos(d2) * cos(a1 - a2)
    return degrees(acos(max(-1.0, min(1.0, c))))


def ecliptica(ra_deg, dec_deg):
    a, d = radians(ra_deg), radians(dec_deg)
    lam = atan2(sin(a) * cos(EPS_J2000) + tan(d) * sin(EPS_J2000), cos(a))
    bet = asin(sin(d) * cos(EPS_J2000) - cos(d) * sin(EPS_J2000) * sin(a))
    return degrees(lam) % 360.0, degrees(bet)


def hms_para_graus(h, m, s):
    return 15.0 * (h + m / 60 + s / 3600)


def dms_para_graus(sinal, d, m, s):
    return sinal * (d + m / 60 + s / 3600)


# estrelas (Hipparcos, J2000.0) / stars
SIRIUS = (hms_para_graus(6, 45, 8.9173), dms_para_graus(-1, 16, 42, 58.017))
ACRUX = (hms_para_graus(12, 26, 35.8952), dms_para_graus(-1, 63, 5, 56.734))
POLARIS = (hms_para_graus(2, 31, 49.09), dms_para_graus(1, 89, 15, 50.8))
THUBAN = (hms_para_graus(14, 4, 23.35), dms_para_graus(1, 64, 22, 33.1))
VEGA = (hms_para_graus(18, 36, 56.34), dms_para_graus(1, 38, 47, 1.3))
PM_SIRIUS = (-546.01, -1223.07)         # mas/ano, Hipparcos (μα*, μδ)
PM_BARNARD = 10358.0                    # mas/ano, movimento próprio total / total proper motion


# ================================================================ AULA 1
def aula1():
    titulo("AULA 1 · Um céu que não gira / A sky that doesn't spin")

    print("\n-- Horas viram graus / hours to degrees")
    linha("1 h = 15°; 1 min = 15′; 1 s = 15″ → 6h45m (graus)", hms_para_graus(6, 45, 0), "{:.2f}", "°")
    linha("Sirius, AR (graus), Dec (graus)", SIRIUS[0], "{:.4f}", f"° ; Dec = {SIRIUS[1]:.4f}°")
    linha("Acrux,  AR (graus), Dec (graus)", ACRUX[0], "{:.4f}", f"° ; Dec = {ACRUX[1]:.4f}°")
    linha("Sirius: o simulador de Astrometria usa AR = 101.287, Dec = -16.716", 0, "{:.0f}")
    linha("Acrux:  o simulador de Astrometria usa AR = 186.649, Dec = -63.099", 0, "{:.0f}")

    print("\n-- Precessão / precession")
    p_cent = 5028.796195                # ″/século, IAU 2006 P03 em J2000
    linha("precessão geral em longitude (″/ano)", p_cent / 100, "{:.3f}", "″/ano")
    linha("período do ciclo (anos) = 360°·3600/(″/ano)", 1_296_000 / (p_cent / 100), "{:.0f}", "anos")
    linha("deslocamento do equinócio em 100 anos (°)", p_cent / 3600, "{:.3f}", "°")
    linha("anos para 1° de deslocamento", 3600 / (p_cent / 100), "{:.1f}", "anos")
    linha("obliquidade média J2000 (°)", degrees(EPS_J2000), "{:.4f}", "°")
    linha("velocidade do polo no céu = precessão × sen ε (″/ano)", p_cent / 100 * sin(EPS_J2000), "{:.2f}", "″/ano")
    linha("raio do círculo do polo = ε (°)", degrees(EPS_J2000), "{:.2f}", "°")
    linha("circunferência/período: volta do polo em ″/ano (conferência)",
          2 * pi * degrees(EPS_J2000) * 3600 / (1_296_000 / (p_cent / 100)), "{:.2f}", "″/ano")
    print("  Hiparco: ~144 anos entre Timocharis (~273 a.C.) e Hiparco (~129 a.C.)")
    linha("  deslocamento de Spica em 144 anos (°)", 144 * p_cent / 100 / 3600, "{:.2f}", "°")

    print("\n-- Data de referência da aula: 18/10/2026, 12:00 TT")
    jd = jd_gregoriano(2026, 10, 18, 12)
    T = (jd - 2451545.0) / 36525.0
    linha("JD", jd, "{:.1f}")
    linha("T (séculos desde J2000.0)", T, "{:.5f}")
    linha("anos desde J2000.0", T * 100, "{:.2f}", "anos")
    for nome, (ra, dec) in (("Sirius", SIRIUS), ("Acrux", ACRUX)):
        ra2, dec2, ang = prec_j2000_para_data(ra, dec, T)
        sep = separacao(ra, dec, ra2, dec2)
        print(f"  {nome}: J2000 ({ra:.4f}°, {dec:.4f}°) → de {2000 + T * 100:.1f} "
              f"({ra2:.4f}°, {dec2:.4f}°)  Δα={ (ra2 - ra) * 3600:+.0f}″  Δδ={(dec2 - dec) * 3600:+.0f}″  "
              f"separação={sep:.4f}° = {sep * 60:.1f}′")
    zeta, z, th = ang
    linha("ângulo θ_A (pólo desloca-se em relação ao de J2000)", degrees(th) * 3600, "{:.1f}", "″")
    linha("  em graus", degrees(th), "{:.4f}", "°")
    linha("  em minutos de arco", degrees(th) * 60, "{:.2f}", "′")
    linha("  quando projetado na Terra (km) a 30,87 m/″", degrees(th) * 3600 * 30.87 / 1000, "{:.1f}", "km")
    linha("máximo possível de deslocamento por precessão desde J2000 (°)", p_cent / 100 * T * 100 / 3600, "{:.3f}", "°")
    linha("  em posição na Terra a 111,2 km/° (km)", p_cent / 100 * T * 100 / 3600 * 111.2, "{:.1f}", "km")
    eps_data = 84381.406 - 46.836769 * T - 0.0001831 * T**2 + 0.00200340 * T**3
    linha("obliquidade média da data (″ → °)", eps_data / 3600, "{:.4f}", "°")
    linha("  variação anual da obliquidade (″/ano)", -46.836769 / 100, "{:.3f}", "″/ano")

    # movimento próprio de Sirius no mesmo intervalo
    dt = T * 100
    linha("Sirius, movimento próprio total (″/ano)", sqrt(PM_SIRIUS[0] ** 2 + PM_SIRIUS[1] ** 2) / 1000, "{:.3f}", "″/ano")
    linha("  em Δδ no intervalo (″)", PM_SIRIUS[1] * dt / 1000, "{:+.1f}", "″")
    linha("  em Δα* no intervalo (″)", PM_SIRIUS[0] * dt / 1000, "{:+.1f}", "″")

    print("\n-- Movimento próprio / proper motion")
    linha("Barnard (″/ano)", PM_BARNARD / 1000, "{:.2f}", "″/ano")
    linha("anos para andar meio grau (1800″) — o diâmetro da Lua", 1800 / (PM_BARNARD / 1000), "{:.0f}", "anos")
    linha("Sirius: anos para andar 1800″", 1800 / (sqrt(PM_SIRIUS[0] ** 2 + PM_SIRIUS[1] ** 2) / 1000), "{:.0f}", "anos")

    print("\n-- Nutação / nutation (termo principal)")
    omega_node = 360.0 / 19.3413        # regressão do nodo lunar, ° por ano → período
    linha("período da nutação principal (anos)", omega_node, "{:.2f}", "anos")
    linha("amplitude em longitude (″), em obliquidade (″)", 17.2, "{:.1f}", "″ ; 9.2″")
    linha("amplitude em obliquidade na Terra (m) a 30,87 m/″", 9.2 * 30.87, "{:.0f}", "m")
    linha("amplitude em longitude × sen ε (″), componente X do polo", 17.2 * sin(EPS_J2000), "{:.2f}", "″")
    linha("polo médio avança em 18,6 anos (″)", 20.0 * 18.6, "{:.0f}", "″")

    print("\n-- O que o Simulador de Astrometria deixa de fora")
    linha("precessão desde J2000 (máx., °)", p_cent / 100 * dt / 3600, "{:.3f}", "°")
    linha("UT1−UTC ≤ 0,9 s → erro de giro (″) a 15,04″/s", 0.9 * 15.0411, "{:.1f}", "″")
    linha("  em metros no Equador", 0.9 * OMEGA * A_GRS80, "{:.0f}", "m")

    print("\n-- Pêndulo de Foucault em Curitiba / Foucault pendulum")
    phi = radians(-25.454167)
    dia_estelar = 86400.0 / ERA_RATE
    linha("período (horas)", dia_estelar / abs(sin(phi)) / 3600, "{:.2f}", "h")
    linha("período (dias)", dia_estelar / abs(sin(phi)) / 86400, "{:.2f}", "dias")
    linha("giro do plano por dia sideral (°)", 360 * abs(sin(phi)), "{:.1f}", "°")

    print("\n-- Carrossel: gravidade (callback) / centrifugal at Equator")
    linha("a_centrífuga no Equador = ω²a (m/s²)", OMEGA**2 * A_GRS80, "{:.4f}", "m/s²")


# ================================================================ AULA 2
def aula2():
    titulo("AULA 2 · Os faróis do Universo / The beacons of the Universe")

    print("\n-- Quanto se mexe: estrela próxima × quasar / apparent motion")
    v = 1.0e6                           # m/s lateral
    for nome, d_ly in (("quasar a 10 Gly", 1e10), ("quasar 3C 273 (~2 Gly)", 2e9), ("quasar a 5 Gly", 5e9)):
        mu = v / (d_ly * LY) * YEAR_S / UAS
        print(f"  {nome:<28} v=1000 km/s → {mu:.3f} µas/ano")
    mu_q = v / (1e10 * LY) * YEAR_S / UAS
    linha("Barnard (µas/ano)", PM_BARNARD * 1000, "{:.0f}", "µas/ano")
    linha("razão Barnard / quasar(10 Gly)", PM_BARNARD * 1000 / mu_q, "{:.2e}")
    linha("Sirius (µas/ano)", sqrt(PM_SIRIUS[0] ** 2 + PM_SIRIUS[1] ** 2) * 1000, "{:.0f}", "µas/ano")

    print("\n-- Unidades de ângulo / angle units")
    linha("1″ em mas", 1000, "{:.0f}")
    linha("1″ em µas", 1e6, "{:.0f}")
    linha("1° em ″", 3600, "{:.0f}")

    print("\n-- Resolução / resolution")
    lam = C / 8.4e9                     # banda X
    linha("λ da banda X (8,4 GHz) (cm)", lam * 100, "{:.3f}", "cm")
    th_prato = 1.22 * lam / 100.0
    linha("prato de 100 m: 1,22 λ/D (″)", th_prato / ARCSEC, "{:.1f}", "″")
    linha("linha de base 10 000 km: λ/B (mas)", lam / 1e7 / MAS, "{:.3f}", "mas")
    linha("razão prato/VLBI", th_prato / (lam / 1e7), "{:.2e}")

    print("\n-- Duas orelhas / two ears")
    linha("orelhas a 0,20 m: atraso máximo (ms) a 343 m/s", 0.20 / 343 * 1e3, "{:.2f}", "ms")

    print("\n-- Atraso do VLBI / VLBI delay  τ = B cosθ / c")
    linha("B = 10 000 km: τ máximo (ms)", 1e7 / C * 1e3, "{:.2f}", "ms")
    for B, th in ((6.0e6, 60.0), (6.0e6, 90.0)):
        print(f"  B = {B/1e3:.0f} km, θ = {th:.0f}°  → τ = {B * cos(radians(th)) / C * 1e3:.3f} ms")
    for dtheta_mas, th in ((1.0, 60.0), (0.03, 60.0)):
        dtau = 6.0e6 * sin(radians(th)) * dtheta_mas * MAS / C
        print(f"  B = 6000 km, θ = {th:.0f}°, δθ = {dtheta_mas} mas  → δτ = {dtau * 1e12:.1f} ps")
    linha("δτ = 10 ps com B = 10 000 km, θ=90° → δθ (µas)", C * 10e-12 / 1e7 / UAS, "{:.1f}", "µas")

    # linha de base de exemplo: Fortaleza–Wettzell (posições aproximadas)
    def ecef(lat, lon, h=0.0):
        phi, lam_ = radians(lat), radians(lon)
        n = A_GRS80 / sqrt(1 - E2_GRS80 * sin(phi) ** 2)
        return ((n + h) * cos(phi) * cos(lam_), (n + h) * cos(phi) * sin(lam_),
                (n * (1 - E2_GRS80) + h) * sin(phi))
    fort, wett = ecef(-3.877, -38.426, 20), ecef(49.144, 12.878, 670)
    B = sqrt(sum((a - b) ** 2 for a, b in zip(fort, wett)))
    linha("linha de base Fortaleza–Wettzell, aprox. (km)", B / 1e3, "{:.0f}", "km")
    linha("  atraso máximo B/c (ms)", B / C * 1e3, "{:.2f}", "ms")
    west = ecef(42.613, -71.493, 90)
    B2 = sqrt(sum((a - b) ** 2 for a, b in zip(west, wett)))
    linha("linha de base Westford–Wettzell, aprox. (km)", B2 / 1e3, "{:.0f}", "km")

    print("\n-- Ângulo × comprimento na Terra / angle × length on Earth")
    linha("1 mas na superfície (mm), R = 6371 km", MAS * R_MEAN * 1e3, "{:.2f}", "mm")
    linha("30 µas (mm)", 30 * UAS * R_MEAN * 1e3, "{:.2f}", "mm")
    linha("1 mm em µas", 1e-3 / R_MEAN / UAS, "{:.1f}", "µas")
    linha("1 cm em mas", 1e-2 / R_MEAN / MAS, "{:.2f}", "mas")
    linha("1″ na superfície (m)", ARCSEC * R_MEAN, "{:.2f}", "m")
    linha("30 µas na Lua (cm), 384 400 km", 30 * UAS * 384_400e3 * 100, "{:.1f}", "cm")
    linha("1 µas: um objeto de 1 cm está a (milhões de km)", 0.01 / UAS / 1e9, "{:.2f}", "milhões de km")

    print("\n-- ICRS × J2000: viés de quadro / frame bias")
    xi0, eta0, da0 = -16.6170, -6.8192, -14.6
    linha("deslocamento do polo ICRS (mas)", sqrt(xi0**2 + eta0**2), "{:.1f}", "mas")
    linha("  na superfície (cm)", sqrt(xi0**2 + eta0**2) * MAS * R_MEAN * 100, "{:.1f}", "cm")
    linha("origem de AR (mas) na superfície (cm)", abs(da0) * MAS * R_MEAN * 100, "{:.1f}", "cm")

    print("\n-- Gerações do ICRF / ICRF generations")
    for nome, tot, defin in (("ICRF1 (1998)", 608, 212), ("ICRF2 (2010)", 3414, 295), ("ICRF3 (2019)", 4536, 303)):
        print(f"  {nome:<14} {tot:5d} fontes, {defin:3d} definidoras ({100 * defin / tot:.1f} %)")
    linha("Gaia-CRF3 (~1,6 milhão) / ICRF3 S/X (4536)", 1.6e6 / 4536, "{:.0f}", "×")

    print("\n-- Aceleração galáctica / galactic acceleration")
    mu = 5.8 * UAS / YEAR_S             # rad/s
    linha("a = μ c (m/s²) com μ = 5,8 µas/ano", mu * C, "{:.2e}", "m/s²")
    R0, v0 = 8.2e3 * 3.0856775814914e16, 2.3e5
    linha("v²/R com 8,2 kpc e 230 km/s (m/s²)", v0**2 / R0, "{:.2e}", "m/s²")
    linha("período = 2πR/v (milhões de anos)", 2 * pi * R0 / v0 / YEAR_S / 1e6, "{:.0f}", "Ma")
    linha("em 10 anos o deslocamento seria (µas)", 5.8 * 10, "{:.0f}", "µas")

    print("\n-- Escada de precisões / precision ladder (em segundos de arco)")
    for nome, v_as in (("olho nu (1′)", 60.0), ("Tycho Brahe (~1′)", 60.0), ("FK5 (décimos de ″)", 0.1),
                       ("Hipparcos (1 mas)", 1e-3), ("ICRF2 piso (40 µas)", 40e-6), ("ICRF3 piso (30 µas)", 30e-6)):
        print(f"  {nome:<26} {v_as:>10.6f}″  (log10 = {log10(v_as):+.2f})")

    print("\n-- Baricentro / barycenter")
    r_sun = 6.957e8
    linha("1 R☉ (km)", r_sun / 1e3, "{:.0f}", "km")
    linha("Júpiter: baricentro Sol–Júpiter (km do centro do Sol), M_J/M_S=1/1047.35",
          5.2044 * 1.495978707e11 / (1 + 1047.35) / 1e3, "{:.0f}", "km")
    linha("  em raios solares", 5.2044 * 1.495978707e11 / (1 + 1047.35) / r_sun, "{:.2f}", "R☉")


# ================================================================ AULA 3
def aula3():
    titulo("AULA 3 · A ponte entre o céu e o chão / The bridge between sky and ground")

    print("\n-- Dia solar × dia sideral / solar × sidereal day")
    dia_estelar = 86400.0 / ERA_RATE
    dia_sideral = 86400.0 / GMST_RATE
    linha("ERA: volta em relação ao céu fixo (s)", dia_estelar, "{:.4f}", "s")
    print(f"    = {hms(dia_estelar)}")
    linha("hora sideral: volta em relação ao equinócio (s)", dia_sideral, "{:.4f}", "s")
    print(f"    = {hms(dia_sideral)}")
    linha("diferença para 24 h (s)", 86400 - dia_sideral, "{:.3f}", "s")
    print(f"    = {int((86400 - dia_sideral) // 60)} min {(86400 - dia_sideral) % 60:.3f} s")
    linha("graus por dia solar (ERA)", 360 * ERA_RATE, "{:.4f}", "°")
    linha("graus por dia solar (hora sideral)", 360 * GMST_RATE, "{:.5f}", "° (o simulador usa 360.98564736629)")
    linha("excesso sobre 360° por dia solar", 360 * (ERA_RATE - 1), "{:.4f}", "°")
    linha("360°/365,2422 = movimento da Terra na órbita (°/dia)", 360 / 365.2422, "{:.4f}", "°/dia")
    linha("graus por hora", 360 * ERA_RATE / 24, "{:.4f}", "°/h")
    linha("ω = 2π/dia estelar (rad/s)", 2 * pi / dia_estelar, "{:.8e}", "rad/s")
    linha("ω nominal (GRS80/IERS) (rad/s)", OMEGA, "{:.6e}", "rad/s")
    linha("diferença GMST − ERA em taxa (voltas/dia)", GMST_RATE - ERA_RATE, "{:.3e}")

    print("\n-- Velocidades / speeds")
    linha("no Equador (m/s)", OMEGA * A_GRS80, "{:.2f}", "m/s")
    linha("no Equador (km/h)", OMEGA * A_GRS80 * 3.6, "{:.0f}", "km/h")
    for nome, lat, h in (("Curitiba", -25.454167, 910.0), ("Fortaleza", -3.877, 20.0)):
        phi = radians(lat)
        n = A_GRS80 / sqrt(1 - E2_GRS80 * sin(phi) ** 2)
        p = (n + h) * cos(phi)
        print(f"  {nome:<10} φ = {lat:8.4f}°  raio do paralelo = {p / 1e3:8.1f} km  v = {OMEGA * p:6.1f} m/s = "
              f"{OMEGA * p * 3.6:6.0f} km/h")

    print("\n-- ERA em datas / ERA at dates")
    linha("ERA em 2000-01-01 12:00 UT1 (°)", era_graus(2451545.0), "{:.7f}", "°")
    jd0 = jd_gregoriano(2026, 10, 18, 0)
    linha("ERA em 2026-10-18 00:00 UT1 (°)", era_graus(jd0), "{:.5f}", "°")
    linha("  Tu (dias desde J2000.0)", jd0 - 2451545.0, "{:.1f}")
    linha("ERA em 2026-10-18 06:00 UT1 (°)", era_graus(jd0 + 0.25), "{:.5f}", "°")
    linha("ERA em 2026-10-18 12:00 UT1 (°)", era_graus(jd0 + 0.5), "{:.5f}", "°")
    linha("diferença em 6 h (°)", (era_graus(jd0 + 0.25) - era_graus(jd0)) % 360, "{:.4f}", "°")
    # hora sideral de Greenwich (polinômio IAU 2006)
    T = (jd0 + 0.5 - 2451545.0 - 0.5 + 0.0008 / 1.0) / 36525.0   # ≈ T (TT≈UT1+69 s, desprezível aqui)
    gmst = era_graus(jd0) + (0.014506 + 4612.156534 * T + 1.3915817 * T**2) / 3600.0
    linha("GMST em 2026-10-18 00:00 UT1 (°)", gmst % 360, "{:.5f}", "°")
    linha("  GMST em horas", (gmst % 360) / 15, "{:.5f}", "h")
    linha("  diferença GMST − ERA (″)", (0.014506 + 4612.156534 * T + 1.3915817 * T**2), "{:.1f}", "″")
    # fórmula de Meeus, a do simulador
    d = jd0 - 2451545.0
    meeus = (280.46061837 + 360.98564736629 * d + 0.000387933 * (d / 36525) ** 2) % 360
    linha("GMST pela fórmula do simulador (Meeus) (°)", meeus, "{:.5f}", "°")

    print("\n-- Rotação irregular / irregular rotation")
    linha("1 ms de UT1 = giro de (mas)", 1e-3 * OMEGA / MAS, "{:.2f}", "mas")
    linha("  no Equador (m)", 1e-3 * OMEGA * A_GRS80, "{:.3f}", "m")
    linha("  em Curitiba (m)", 1e-3 * OMEGA * 5_763_400, "{:.3f}", "m (p = 5 763 km)")
    linha("  na órbita do GPS, r = 26 560 km (m)", 1e-3 * OMEGA * 26_559_700, "{:.3f}", "m")
    linha("0,1 ms (cm no Equador)", 1e-4 * OMEGA * A_GRS80 * 100, "{:.1f}", "cm")
    linha("1 cm no Equador corresponde a (µs)", 0.01 / (OMEGA * A_GRS80) * 1e6, "{:.1f}", "µs")
    linha("terremoto: 6,8 µs → mas", 6.8e-6 * OMEGA / MAS, "{:.3f}", "mas")

    print("\n-- Movimento polar / polar motion")
    linha("1″ no polo (m)", ARCSEC * R_MEAN, "{:.2f}", "m")
    linha("0,3″ (m)", 0.3 * ARCSEC * R_MEAN, "{:.1f}", "m")
    linha("1 mas (cm)", MAS * R_MEAN * 100, "{:.2f}", "cm")
    p_ch, p_an = 433.0, 365.25
    linha("batimento Chandler × anual (dias)", abs(1 / (1 / p_ch - 1 / p_an)), "{:.0f}", "dias")
    linha("  em anos", abs(1 / (1 / p_ch - 1 / p_an)) / 365.25, "{:.2f}", "anos")
    linha("razão Chandler / Euler = 433 / 305", 433 / 305, "{:.2f}")

    print("\n-- Tamanho de cada passo da cadeia / size of each step")
    jd = jd_gregoriano(2026, 10, 18, 12)
    Tc = (jd - 2451545.0) / 36525.0
    _, _, (zeta, z, th) = prec_j2000_para_data(0.0, 0.0, Tc)
    passos = (
        ("rotação R(t): 1 volta por dia sideral", None),
        ("precessão desde J2000 (polo), θ_A", degrees(th) * 3600),
        ("nutação principal, amplitude em obliquidade", 9.2),
        ("movimento polar, até", 0.3),
        ("viés do ICRS (polo)", 0.0179),
        ("correções dX, dY típicas (0,2 mas)", 0.0002),
        ("UT1 com erro de 0,1 ms (″)", 1e-4 * OMEGA / ARCSEC),
    )
    for nome, valor in passos:
        if valor is None:
            print(f"  {nome:<50} 360° por dia")
        else:
            print(f"  {nome:<50} {valor:12.4f}″  = {valor * ARCSEC * R_MEAN:12.3f} m")

    print("\n-- Cadeia só com a rotação / chain with rotation only")
    for era in (0.0, 90.0, 180.0):
        th_ = radians(era)
        x, y = 26_560.0, 0.0
        print(f"  ERA = {era:5.1f}° → ITRF ({x * cos(th_) + y * sin(th_):10.1f}, {-x * sin(th_) + y * cos(th_):10.1f}) km")
    linha("2 h de rotação (°)", 2 * 360 * ERA_RATE / 24, "{:.3f}", "°")

    print("\n-- Quasar × satélite / ground track by hour")
    for h in (0, 3, 6, 12):
        print(f"  t = {h:2d} h → longitude do ponto inercial fixo = {-(h * 360 * ERA_RATE / 24) % 360:7.2f}° (≡ {((-(h * 360 * ERA_RATE / 24) + 180) % 360) - 180:7.2f}°)")


# ================================================================ AULA 4
FOLHAS = ((1972, 6), (1972, 12), (1973, 12), (1974, 12), (1975, 12), (1976, 12), (1977, 12),
          (1978, 12), (1979, 12), (1981, 6), (1982, 6), (1983, 6), (1985, 6), (1987, 12),
          (1989, 12), (1990, 12), (1992, 6), (1993, 6), (1994, 6), (1995, 12), (1997, 6),
          (1998, 12), (2005, 12), (2008, 12), (2012, 6), (2015, 6), (2016, 12))


def aula4():
    titulo("AULA 4 · O tempo e a prática / Time and practice")

    print("\n-- Segundos intercalares / leap seconds")
    linha("quantos desde 1972", len(FOLHAS), "{:.0f}")
    linha("TAI − UTC = 10 + intercalares (s)", 10 + len(FOLHAS), "{:.0f}", "s")
    jd_ult = jd_gregoriano(2016, 12, 31)
    jd_hoje = jd_gregoriano(2026, 10, 18)
    linha("anos desde o último (31/12/2016) até 18/10/2026", (jd_hoje - jd_ult) / 365.25, "{:.1f}", "anos")
    antes = [a for a, _ in FOLHAS if a <= 1999]
    linha("intercalares entre 1972 e 1998", len(antes), "{:.0f}")
    linha("intercalares entre 1999 e 2016", len(FOLHAS) - len(antes), "{:.0f}")
    linha("anos entre o primeiro (1972,5) e o último (2017,0)", 2017.0 - 1972.5, "{:.1f}", "anos")

    print("\n-- Escadas de tempo em 2026 (relativo ao UTC) / time scale offsets")
    tai_utc, tt_tai = 37.0, 32.184
    for nome, off in (("TT", tai_utc + tt_tai), ("TAI", tai_utc), ("GPST", tai_utc - 19.0),
                      ("BDT (BeiDou)", tai_utc - 33.0), ("UTC", 0.0)):
        print(f"  {nome:<14} UTC {off:+8.3f} s")
    linha("GPST − UTC (s)", tai_utc - 19, "{:.0f}", "s")
    linha("TAI − GPST (s)", 19, "{:.0f}", "s")
    linha("GPST − BDT (s)", 33 - 19, "{:.0f}", "s")
    linha("TT − UTC (s)", tai_utc + tt_tai, "{:.3f}", "s")
    linha("segundos a mais que 24 h em um dia com leap second", 1, "{:.0f}")

    print("\n-- Órbitas de GNSS / GNSS orbits")
    dia_estelar = 86400.0 / ERA_RATE
    a_gps = 26_559_700.0
    T_gps = 2 * pi * sqrt(a_gps**3 / GM)
    linha("GPS: período (s)", T_gps, "{:.1f}", "s")
    print(f"    = {hms(T_gps)}  (meio dia sideral = {hms(dia_estelar / 2)})")
    linha("GPS: velocidade orbital (m/s)", sqrt(GM / a_gps), "{:.1f}", "m/s")
    linha("GPS: altitude (km)", (a_gps - A_GRS80) / 1e3, "{:.0f}", "km")
    linha("GPS: voltas por dia sideral", dia_estelar / T_gps, "{:.4f}")
    linha("Terra gira em um período orbital (°)", 360 * ERA_RATE * T_gps / 86400, "{:.2f}", "°")
    for nome, dias, voltas in (("GPS", 1, 2), ("Galileo", 10, 17), ("GLONASS", 8, 17), ("BeiDou MEO", 7, 13)):
        T = dias * dia_estelar / voltas
        a = (GM * (T / (2 * pi)) ** 2) ** (1 / 3)
        print(f"  {nome:<11} {voltas:2d} voltas em {dias:2d} dias siderais → T = {hms(T)}, a = {a / 1e3:8.1f} km "
              f"(altitude {(a - A_GRS80) / 1e3:7.0f} km)")
    linha("atraso diário da repetição (4 min) = dia solar − sideral (s)", 86400 - 86400 / GMST_RATE, "{:.1f}", "s")

    print("\n-- Relatividade nos relógios do GPS / relativity")
    a = a_gps
    grav = GM / C**2 * (1 / R_MEAN - 1 / a)
    vel = -(GM / a) / (2 * C**2)
    linha("efeito gravitacional (µs/dia), R médio", grav * 86400e6, "{:.1f}", "µs/dia")
    linha("efeito da velocidade (µs/dia)", vel * 86400e6, "{:.1f}", "µs/dia")
    linha("soma, versão simples (µs/dia)", (grav + vel) * 86400e6, "{:.1f}", "µs/dia")
    total = (W0_IAU - 1.5 * GM / a) / C**2
    linha("Δf/f = (W0 − 3GM/2a)/c², com W0 do geoide", total, "{:.4e}")
    linha("  em µs/dia", total * 86400e6, "{:.1f}", "µs/dia")
    linha("  frequência de 10,23 MHz fica (MHz)", 10.23 * (1 - total), "{:.11f}", "MHz")
    linha("  erro de posição em um dia se não corrigisse (km)", total * 86400 * C / 1e3, "{:.1f}", "km")
    linha("L_G ≈ W0/c² (conferência)", W0_IAU / C**2, "{:.6e}")
    linha("L_G definido pela IAU", L_G, "{:.9e}")
    linha("diferença W0(IAU) − W0(IHRS 62 636 853,4) (m²/s²)", W0_IAU - 62_636_853.4, "{:.2f}", "m²/s²")
    linha("  em altura (m) ÷ 9,8 m/s²", (W0_IAU - 62_636_853.4) / 9.8, "{:.2f}", "m")
    linha("  em fração de frequência", (W0_IAU - 62_636_853.4) / C**2, "{:.2e}")

    print("\n-- Relógios que medem altura / chronometric geodesy")
    linha("g/c² por metro", 9.80665 / C**2, "{:.4e}", "/m")
    linha("  por centímetro", 9.80665 / C**2 / 100, "{:.3e}", "/cm")
    linha("  para 450 m", 9.80665 / C**2 * 450, "{:.2e}")
    linha("  1 s de erro a cada (bilhões de anos) para 1,1e-18", 1 / 1.09e-18 / YEAR_S / 1e9, "{:.1f}", "bilhões de anos")

    print("\n-- Orçamento de erros / error budget (efeito no chão e na órbita)")
    linhas_err = (
        ("UT1 (ou erro de giro) de 1 ms: no Equador", 1e-3 * OMEGA * A_GRS80),
        ("UT1 de 1 ms: na órbita do GPS (r = 26 560 km)", 1e-3 * OMEGA * 26_559_700),
        ("UT1−UTC ignorado (até 0,9 s): no Equador", 0.9 * OMEGA * A_GRS80),
        ("UT1−UTC ignorado (até 0,9 s): na órbita do GPS", 0.9 * OMEGA * 26_559_700),
        ("movimento polar de 0,3″", 0.3 * ARCSEC * R_MEAN),
        ("nutação principal (9,2″)", 9.2 * ARCSEC * R_MEAN),
        ("precessão não aplicada (θ_A em 2026,8)", 537.0 * ARCSEC * R_MEAN),
        ("viés do ICRS (17,9 mas)", 17.9 * MAS * R_MEAN),
        ("relógio de 1 µs (em distância)", 1e-6 * C),
        ("relógio de 1 ns (em distância)", 1e-9 * C),
        ("relatividade do GPS, um dia (km)", total * 86400 * C),
    )
    for nome, m in linhas_err:
        print(f"  {nome:<54} {m:12.3f} m")

    print("\n-- Aula 4, exercícios / exercises")
    gpst_utc = 18
    linha("GPST se UTC = 12:00:00 (hora GPS) → segundos de adiantamento", gpst_utc, "{:.0f}")
    linha("TT se UTC = 12:00:00 → adiantamento (s)", 69.184, "{:.3f}")
    linha("GLONASS: UTC + 3 h", 3, "{:.0f}", "h")


# ================================================================ figuras
def trilha_gps(inc_graus=55.0, passo_min=5):
    """Trilha de um satélite com 2 voltas por dia sideral (como o GPS): segmentos (lon, lat)."""
    inc = radians(inc_graus)
    dia = 86400.0 / ERA_RATE
    n = int(dia / (passo_min * 60.0)) + 1
    pts = []
    for k in range(n + 1):
        t = k * passo_min * 60.0
        era = 2 * pi * t / dia           # giro da Terra
        u = 2 * era                      # duas voltas por dia sideral
        x, y, z = cos(u), sin(u) * cos(inc), sin(u) * sin(inc)
        xe, ye = x * cos(era) + y * sin(era), -x * sin(era) + y * cos(era)
        lon = degrees(atan2(ye, xe))
        lat = degrees(asin(z))
        pts.append((lon, lat, t / 3600.0))
    segs, atual = [], [pts[0]]
    for p in pts[1:]:
        if abs(p[0] - atual[-1][0]) > 180:
            segs.append(atual)
            atual = []
        atual.append(p)
    segs.append(atual)
    return segs


def esfera(alpha0=40.0, elev=22.0):
    """Projeção ortográfica da esfera celeste (visão a partir de AR=alpha0, elevação elev)."""
    a0, e = radians(alpha0), radians(elev)
    right = (-sin(a0), cos(a0), 0.0)
    up = (-sin(e) * cos(a0), -sin(e) * sin(a0), cos(e))
    view = (cos(e) * cos(a0), cos(e) * sin(a0), sin(e))

    def proj(p):
        x = sum(a * b for a, b in zip(p, right))
        y = sum(a * b for a, b in zip(p, up))
        d = sum(a * b for a, b in zip(p, view))
        return x, y, d

    def eq(alpha, delta):
        a, d = radians(alpha), radians(delta)
        return (cos(d) * cos(a), cos(d) * sin(a), sin(d))

    def ecl(lam):
        l = radians(lam)
        return (cos(l), sin(l) * cos(EPS_J2000), sin(l) * sin(EPS_J2000))

    return proj, eq, ecl


def partes(pontos):
    """Separa uma curva em trechos visíveis (d>0) e ocultos (d<=0)."""
    vis, oc, atual, estado = [], [], [], None
    for x, y, d in pontos:
        s = d > 0
        if estado is None:
            estado = s
        if s != estado:
            (vis if estado else oc).append(atual)
            atual = [atual[-1]] if atual else []
            estado = s
        atual.append((x, y, d))
    if atual:
        (vis if estado else oc).append(atual)
    return vis, oc


def tikz_coords(seg, esc=1.0, nd=3):
    return " ".join(f"({x * esc:.{nd}f},{y * esc:.{nd}f})" for x, y, *_ in seg)


def fibonacci_esfera(n):
    """n pontos quase uniformes na esfera (espiral de Fibonacci): lista de (AR, Dec) em graus."""
    ouro = pi * (3 - sqrt(5))
    pts = []
    for i in range(n):
        z = 1 - 2 * (i + 0.5) / n
        pts.append((degrees(i * ouro) % 360.0, degrees(asin(z))))
    return pts


def hammer(lon_deg, lat_deg):
    """Projeção equivalente de Hammer: (x, y) com meia-largura 2√2 e meia-altura √2."""
    lam, phi = radians(lon_deg), radians(lat_deg)
    d = sqrt(1 + cos(phi) * cos(lam / 2))
    return 2 * sqrt(2) * cos(phi) * sin(lam / 2) / d, sqrt(2) * sin(phi) / d


def mapa_fontes(n=303, esc=3.0 / (2 * sqrt(2))):
    """Coordenadas TikZ (cm) de n fontes ilustrativas, distribuição uniforme, projeção de Hammer."""
    return [tuple(c * esc for c in hammer(ra - 180.0, dec)) for ra, dec in fibonacci_esfera(n)]


def figuras():
    print("% ---- trilha do satélite (lon, lat) em graus, 5 min, 2 voltas por dia sideral")
    for i, seg in enumerate(trilha_gps()):
        print(f"% segmento {i + 1}")
        print("  ".join(f"({lon:.1f},{lat:.1f})" for lon, lat, _ in seg))
    marcas = {}
    for seg in trilha_gps():
        for lon, lat, t in seg:
            if abs(t - round(t)) < 1e-9 and int(round(t)) % 3 == 0 and int(round(t)) not in marcas:
                marcas[int(round(t))] = (lon, lat)
    print("% marcas a cada 3 h:", {h: (round(a, 1), round(b, 1)) for h, (a, b) in marcas.items()})

    print("\n% ---- esfera celeste (AR0=40°, elevação 22°), raio 1")
    proj, eq, ecl = esfera(40.0, 22.0)
    eqt = [proj(eq(a, 0.0)) for a in range(0, 361, 5)]
    v, o = partes(eqt)
    print("% equador visível:", [tikz_coords(s) for s in v])
    print("% equador oculto:", [tikz_coords(s) for s in o])
    ec = [proj(ecl(l)) for l in range(0, 361, 5)]
    v, o = partes(ec)
    print("% eclíptica visível:", [tikz_coords(s) for s in v])
    print("% eclíptica oculta:", [tikz_coords(s) for s in o])
    for nome, pt in (("gama (AR 0, Dec 0)", eq(0, 0)), ("polo norte", (0.0, 0.0, 1.0)),
                     ("estrela AR75 Dec30", eq(75, 30)), ("pé da estrela AR75 Dec0", eq(75, 0)),
                     ("solstício junho", ecl(90)), ("solstício dezembro", ecl(270)),
                     ("equinócio setembro", ecl(180))):
        x, y, d = proj(pt)
        print(f"% {nome}: ({x:.3f},{y:.3f}) profundidade {d:+.3f}")
    arco_ra = [proj(eq(a, 0.0)) for a in range(0, 76, 5)]
    arco_dec = [proj(eq(75.0, dd)) for dd in range(0, 31, 3)]
    print("% arco de AR:", tikz_coords(arco_ra))
    print("% arco de Dec:", tikz_coords(arco_dec))

    print("\n% ---- mapa ilustrativo das fontes definidoras (303 pontos, Hammer, raio x=3 cm, y=1,5 cm)")
    print(" ".join(f"({x:.2f},{y:.2f})" for x, y in mapa_fontes()))

    print("\n% ---- círculo do polo: longitude/latitude eclípticas J2000 das estrelas do polo")
    for nome, (ra, dec) in (("Polaris", POLARIS), ("Thuban", THUBAN), ("Vega", VEGA)):
        lam, bet = ecliptica(ra, dec)
        print(f"% {nome}: λ = {lam:.2f}°, β = {bet:.2f}°, distância ao polo da eclíptica = {90 - bet:.2f}°")
    print("% ano em que o polo passa por λ: ano = 2000 + (90° − λ)·25771/360")
    per = 1_296_000 / (5028.796195 / 100)
    for nome, (ra, dec) in (("Polaris", POLARIS), ("Thuban", THUBAN), ("Vega", VEGA)):
        lam, _ = ecliptica(ra, dec)
        d = (90.0 - lam)
        if d > 180:
            d -= 360
        if d < -180:
            d += 360
        print(f"% {nome}: ano de maior aproximação ≈ {2000 + d * per / 360:.0f}")


def main():
    if "--figuras" in sys.argv:
        figuras()
        return
    aula1()
    aula2()
    aula3()
    aula4()


if __name__ == "__main__":
    main()
