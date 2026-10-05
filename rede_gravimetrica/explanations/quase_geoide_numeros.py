"""Números derivados da aula quase_geoide.tex / Derived numbers for quase_geoide.tex.

Refaz, com Python puro, toda conta que aparece nos slides (GRS80, Somigliana, gravidade normal
em altitude, redução de Poincaré-Prey, altitudes ortométrica e normal, separação geoide/
quase-geoide, anomalia de Molodensky e os exercícios). Rodar nesta pasta:

    python3 quase_geoide_numeros.py

Recomputes, in plain Python, every number shown on the slides.
"""

from math import cos, pi, radians, sin, sqrt

# ---------------------------------------------------------------- GRS80 (Moritz 1980)
A = 6378137.0                    # m
B = 6356752.3141                 # m
F = 1 / 298.257222101
GAMMA_E = 9.7803267715           # m/s²
GAMMA_P = 9.8321863685           # m/s²
OMEGA = 7292115e-11              # rad/s
GM = 3986005e8                   # m³/s²
M = OMEGA**2 * A**2 * B / GM     # ω²a²b/GM
E2 = 0.00669438002290
K = B * GAMMA_P / (A * GAMMA_E) - 1
G_NEWTON = 6.674e-11

# Gradientes simples usados nas aulas / simple gradients used in class (mGal/m)
FREE_AIR = 0.3086
BOUGUER_2670 = 0.1119            # 2πGρ, ρ = 2670 kg/m³, rounded as in gravimetria.tex
MGAL = 1e-5                      # m/s²


def gamma0(phi_deg):
    """Somigliana: normal gravity on the ellipsoid (m/s²)."""
    s2 = sin(radians(phi_deg)) ** 2
    return GAMMA_E * (1 + K * s2) / sqrt(1 - E2 * s2)


def gamma_h(phi_deg, h):
    """Normal gravity at ellipsoidal height h, second order (H&M 2006, eq. 2-215)."""
    s2 = sin(radians(phi_deg)) ** 2
    return gamma0(phi_deg) * (1 - 2 * (1 + F + M - 2 * F * s2) * h / A + 3 * h**2 / A**2)


def gamma_bar(phi_deg, h):
    """Mean normal gravity between the ellipsoid and height h (H&M 2006, eq. 4-62)."""
    s2 = sin(radians(phi_deg)) ** 2
    return gamma0(phi_deg) * (1 - (1 + F + M - 2 * F * s2) * h / A + h**2 / A**2)


def normal_height(phi_deg, c):
    """H* = C / γ̄, iterated because γ̄ depends on H*."""
    h = c / gamma0(phi_deg)
    for _ in range(10):
        h = c / gamma_bar(phi_deg, h)
    return h


def two_pi_g_rho(rho):
    """Bouguer plate gradient 2πGρ in mGal/m."""
    return 2 * pi * G_NEWTON * rho / MGAL


def prey_mean_g(g_mgal, h, rho=None):
    """Mean real gravity along the plumb line (Poincaré-Prey), mGal.

    With rho=None it uses the rounded classroom numbers 0.3086 and 2 × 0.1119.
    """
    plate = BOUGUER_2670 if rho is None else two_pi_g_rho(rho)
    return g_mgal + (FREE_AIR - 2 * plate) / 2 * h


def orthometric_height(c, g_mgal, rho):
    """H = C / ḡ(H), iterated."""
    h = c / (g_mgal * MGAL)
    for _ in range(10):
        h = c / (prey_mean_g(g_mgal, h, rho) * MGAL)
    return h


def dms(d, m, s):
    sign = -1 if d < 0 else 1
    return sign * (abs(d) + m / 60 + s / 3600)


def line(label, value, fmt="{:.4f}"):
    print(f"  {label:<46} {fmt.format(value)}")


# ================================================================ Aula 1
print("AULA 1 — Curitiba (RENEGA), the density problem")
PHI_CWB = dms(-25, 27, 15)
G_CWB = 978760.387               # mGal (RENEGA, via the thesis in source_info/)
H_CWB = 910.0                    # m, approximate (as in gravimetria.tex)
g0_cwb = gamma0(PHI_CWB) / MGAL
line("gamma0 Curitiba (mGal)", g0_cwb, "{:.2f}")
line("free-air anomaly (mGal)", G_CWB + FREE_AIR * H_CWB - g0_cwb, "{:.1f}")
print("  Bouguer plate and anomaly for three densities:")
for rho in (2350, 2670, 3000):
    plate = two_pi_g_rho(rho)
    dg_b = G_CWB + FREE_AIR * H_CWB - plate * H_CWB - g0_cwb
    print(f"      rho={rho}:  2πGρ = {plate:.4f} mGal/m  plate = {plate * H_CWB:.1f} mGal"
          f"  Δg_B = {dg_b:.1f} mGal")

gbar_cwb = prey_mean_g(G_CWB, H_CWB)
C_CWB = gbar_cwb * MGAL * H_CWB
line("Prey gradient inside rock (mGal/m)", FREE_AIR - 2 * BOUGUER_2670)
line("ḡ - g = 0.0424 H (mGal)", gbar_cwb - G_CWB, "{:.1f}")
line("ḡ Curitiba (mGal)", gbar_cwb, "{:.1f}")
line("C Curitiba, illustrative (m²/s²)", C_CWB, "{:.2f}")
for rho in (2350, 2670, 3000):
    print(f"      rho={rho}:  H = {orthometric_height(C_CWB, G_CWB, rho):.4f} m")

print("  δH ≈ 2πGδρH²/g, δρ = 300 kg/m³ (cm):")
for h in (500, 1000, 2000, 3000, 4000, 8849):
    dh = 2 * pi * G_NEWTON * 300 * h**2 / 9.80
    print(f"      H = {h:>5} m  ->  {100 * dh:6.1f} cm")
print(f"  plot coefficient for δH(cm) = c·H² (H in m): c = {100 * 2 * pi * G_NEWTON * 300 / 9.80:.4e}")

print("  exercise 1: station at 2000 m")
line("ḡ - g (mGal)", 0.0424 * 2000, "{:.1f}")
line("δH for δρ = 300 (cm)", 100 * 2 * pi * G_NEWTON * 300 * 2000**2 / 9.80, "{:.1f}")

# ================================================================ Aula 2
print("\nAULA 2 — normal heights")
Hs_cwb = normal_height(PHI_CWB, C_CWB)
gb_cwb_star = gamma_bar(PHI_CWB, Hs_cwb) / MGAL
line("γ̄ Curitiba (mGal)", gb_cwb_star, "{:.1f}")
line("γ̄ simple: γ0 - 0.1543 H* (mGal)", g0_cwb - FREE_AIR / 2 * Hs_cwb, "{:.1f}")
line("H* Curitiba (m)", Hs_cwb, "{:.3f}")
line("H Curitiba (m)", H_CWB, "{:.3f}")
line("H* - H = N - ζ (cm)", 100 * (Hs_cwb - H_CWB), "{:.1f}")
dg_b_cwb = G_CWB + (FREE_AIR - BOUGUER_2670) * H_CWB - g0_cwb
line("Δg_B·H/γ̄ (cm)", 100 * dg_b_cwb * MGAL * H_CWB / (gb_cwb_star * MGAL), "{:.1f}")

print("  exercise 2: φ = 45°, H* = 1000 m")
g0_45 = gamma0(45) / MGAL
line("γ0(45°) (mGal)", g0_45, "{:.1f}")
line("γ̄ simple (mGal)", g0_45 - FREE_AIR / 2 * 1000, "{:.1f}")
line("γ̄ exact (mGal)", gamma_bar(45, 1000) / MGAL, "{:.1f}")
C_EX2 = gamma_bar(45, 1000) * 1000
line("C for H* = 1000 m (m²/s²)", C_EX2, "{:.2f}")
line("H* from C = 9804.66 and simple γ̄", 9804.66 / ((g0_45 - FREE_AIR / 2 * 1000) * MGAL), "{:.2f}")

print("  N - ζ ≈ Δg_B·H/γ (cm), illustrative cases:")
for dgb, h in ((-47.8, 910), (-100, 1000), (-200, 2000), (-300, 3000), (-400, 5000)):
    print(f"      Δg_B = {dgb:>6} mGal, H = {h:>4} m  ->  {100 * dgb * MGAL * h / 9.79:7.1f} cm")

# ================================================================ Aula 3
print("\nAULA 3 — Molodensky anomaly")
gq_cwb = gamma_h(PHI_CWB, Hs_cwb) / MGAL
line("γ_Q Curitiba, exact (mGal)", gq_cwb, "{:.1f}")
line("γ_Q simple: γ0 - 0.3086 H* (mGal)", g0_cwb - FREE_AIR * Hs_cwb, "{:.1f}")
line("Δg = g_P - γ_Q exact (mGal)", G_CWB - gq_cwb, "{:.1f}")
line("Δg simple (mGal)", G_CWB - (g0_cwb - FREE_AIR * Hs_cwb), "{:.1f}")

print("  exercise 3: φ = 45°, H* = 2000 m, g_P = 980 052.7 mGal")
G_EX3 = 980052.7
gq_simple = g0_45 - FREE_AIR * 2000
line("γ_Q simple (mGal)", gq_simple, "{:.1f}")
line("Δg simple (mGal)", G_EX3 - gq_simple, "{:.1f}")
line("γ_Q exact (mGal)", gamma_h(45, 2000) / MGAL, "{:.1f}")
line("Δg exact (mGal)", G_EX3 - gamma_h(45, 2000) / MGAL, "{:.1f}")

print("  weights 1/l² and 1/l³:")
for d in (1, 2, 3, 10):
    print(f"      l = {d:>2}:  1/l² = 1/{d**2:<4}  1/l³ = 1/{d**3}")

print("  Δg - δg = γ_P - γ_Q ≈ -0.3086 ζ (mGal):")
for z in (-5, 5, 20):
    print(f"      ζ = {z:>3} m  ->  {-FREE_AIR * z:+.1f} mGal")

# ================================================================ Aula 4
print("\nAULA 4 — GNSS + quasigeoid")
H_GNSS, ZETA = 812.47, -3.21
line("illustrative H* = h - ζ (m)", H_GNSS - ZETA, "{:.2f}")
hs = H_GNSS - ZETA
line("γ̄ at 45° for that H* (mGal)", gamma_bar(45, hs) / MGAL, "{:.1f}")
line("C = γ̄ H* (m²/s²)", gamma_bar(45, hs) * hs, "{:.2f}")
line("W_P = W0 - C (m²/s²)", 62636853.4 - gamma_bar(45, hs) * hs, "{:.2f}")

print("  pipe from geoide_e_alturas.tex: h = 812.00 m, N_A = -8.40, N_B = -8.12")
for name, n in (("A", -8.40), ("B", -8.12)):
    zeta = n - (-47.8 * MGAL * 820 / 9.79)   # ζ = N - (N - ζ), Δg_B ≈ -47.8 mGal, H ≈ 820 m
    print(f"      {name}: ζ = {zeta:.2f} m  H* = {812.00 - zeta:.2f} m  H = {812.00 - n:.2f} m")
