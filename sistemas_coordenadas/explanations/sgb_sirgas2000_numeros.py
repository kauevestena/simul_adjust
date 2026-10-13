"""Números derivados da aula sgb_sirgas2000.tex / Derived numbers for sgb_sirgas2000.tex.

Refaz, com Python puro, toda conta que aparece nos slides: elipsoides dos data brasileiros,
transformação SAD69 -> SIRGAS2000 por 3 translações (R.PR 1/2005 / IBGE, 2006), deslocamento
horizontal e vertical por cidade, tamanho do vetor, razão em ppm dos 13 m do ajuste de 1996,
e o que 1 segundo de arco vale no chão. Rodar nesta pasta:

    python3 sgb_sirgas2000_numeros.py

Recomputes, in plain Python, every number shown on the slides.

Dados de entrada (fonte primária, IBGE) / input data (primary source, IBGE):
  - Córrego Alegre: Hayford 1924, a = 6 378 388 m, 1/f = 297        (rel_sad69.pdf, seção 2.2)
  - SAD69: UGGI67, a = 6 378 160 m, 1/f = 298,25; datum Chuá         (rel_sad69.pdf, seção 2.2)
        ξ = 0,31", η = -3,52", N = 0
        (o relatório imprime a latitude astronômica de Chuá como 19°45'14,34", que é um erro de
        digitação: com 19°45'41,34" a diferença para a geodésica 19°45'41,6527" dá 0,31", que
        é o ξ publicado / the report prints 14.34", a typo for 41.34")
  - SIRGAS2000: GRS80, a = 6 378 137 m, 1/f = 298,257222101           (IBGE; SIRGAS)
  - SAD69 -> SIRGAS2000: ΔX = -67,35 m, ΔY = +3,88 m, ΔZ = -38,22 m  (rel_sirgas2000.pdf, tab. 9,
        63 estações, só translações; no relatório a tabela vem no sentido oposto, com os sinais
        trocados / the table in the report has the opposite sign convention)
"""

from math import atan2, cos, degrees, hypot, radians, sin, sqrt

# ---------------------------------------------------------------- elipsoides / ellipsoids
HAYFORD = (6378388.0, 1 / 297.0)               # Córrego Alegre
UGGI67 = (6378160.0, 1 / 298.25)               # SAD69
GRS80 = (6378137.0, 1 / 298.257222101)         # SIRGAS2000

# SAD69 -> SIRGAS2000 (translações / translations), metros
DXYZ = (-67.35, +3.88, -38.22)

# Cidades / cities: (nome, latitude °, longitude °). Altura geodésica ~ 0 (efeito < 1 m).
CIDADES = [
    ("Chuá (datum SAD69)", -(19 + 45 / 60 + 41.6527 / 3600), -(48 + 6 / 60 + 4.0639 / 3600)),
    ("Curitiba", -(25 + 27 / 60 + 15 / 3600), -49.2646),
    ("Fortaleza", -3.7319, -38.5267),
    ("Manaus", -3.1190, -60.0217),
    ("Porto Alegre", -30.0346, -51.2177),
    ("Brasília", -15.7939, -47.8828),
    ("Oiapoque", 3.8433, -51.8331),
    ("Chuí", -33.6867, -53.4600),
    ("Cruzeiro do Sul", -7.6306, -72.6739),
]


def n_radius(a, f, lat):
    e2 = f * (2 - f)
    return a / sqrt(1 - e2 * sin(lat) ** 2)


def geodetic_to_ecef(lat, lon, h, ell):
    a, f = ell
    e2 = f * (2 - f)
    n = n_radius(a, f, lat)
    return ((n + h) * cos(lat) * cos(lon),
            (n + h) * cos(lat) * sin(lon),
            (n * (1 - e2) + h) * sin(lat))


def ecef_to_geodetic(x, y, z, ell):
    a, f = ell
    e2 = f * (2 - f)
    lon = atan2(y, x)
    p = hypot(x, y)
    lat = atan2(z, p * (1 - e2))
    for _ in range(10):
        n = n_radius(a, f, lat)
        h = p / cos(lat) - n
        lat = atan2(z, p * (1 - e2 * n / (n + h)))
    n = n_radius(a, f, lat)
    h = p / cos(lat) - n
    return lat, lon, h


def sad69_to_sirgas(lat_deg, lon_deg, h=0.0):
    """3-parameter geocentric translation. Returns (dlat_m, dlon_m, dh_m, horizontal_m)."""
    lat, lon = radians(lat_deg), radians(lon_deg)
    x, y, z = geodetic_to_ecef(lat, lon, h, UGGI67)
    lat2, lon2, h2 = ecef_to_geodetic(x + DXYZ[0], y + DXYZ[1], z + DXYZ[2], GRS80)
    # raios de curvatura no GRS80 para converter ângulo em metros
    a, f = GRS80
    e2 = f * (2 - f)
    n = n_radius(a, f, lat2)
    m = a * (1 - e2) / (1 - e2 * sin(lat2) ** 2) ** 1.5
    dn = (lat2 - lat) * (m + h2)
    de = (lon2 - lon) * (n + h2) * cos(lat2)
    return dn, de, h2 - h, hypot(dn, de)


def main():
    print("== Vetor de translação SAD69 -> SIRGAS2000 / translation vector")
    norm = sqrt(sum(c * c for c in DXYZ))
    print(f"  |ΔX,ΔY,ΔZ| = {norm:.2f} m  (centro do SAD69 a ~{norm:.0f} m do geocentro)")

    print("\n== Deslocamento por cidade / shift per city (N, E, h, horizontal)")
    hs = []
    for nome, la, lo in CIDADES:
        dn, de, dh, hz = sad69_to_sirgas(la, lo)
        hs.append(hz)
        print(f"  {nome:22s} dN={dn:+7.2f}  dE={de:+7.2f}  dh={dh:+7.2f}  horiz={hz:6.2f} m")
    print(f"  intervalo horizontal / horizontal range: {min(hs):.1f} a {max(hs):.1f} m; "
          f"média / mean {sum(hs) / len(hs):.1f} m")

    print("\n== Curitiba em detalhe / Curitiba in detail")
    dn, de, dh, hz = sad69_to_sirgas(CIDADES[1][1], CIDADES[1][2], 910.0)
    print(f"  h=910 m: dN={dn:+.2f}  dE={de:+.2f}  dh={dh:+.2f}  horiz={hz:.2f} m")
    azim = degrees(atan2(de, dn)) % 360
    print(f"  direção do deslocamento (azimute) / bearing: {azim:.0f}°")

    print("\n== Elipsoides / ellipsoids")
    for nome, (a, f) in (("Hayford 1924", HAYFORD), ("UGGI67", UGGI67), ("GRS80", GRS80)):
        b = a * (1 - f)
        print(f"  {nome:13s} a={a:.0f}  1/f={1 / f:.4f}  b={b:.2f}")
    print(f"  a(Hayford) - a(GRS80) = {HAYFORD[0] - GRS80[0]:.0f} m ;"
          f" a(UGGI67) - a(GRS80) = {UGGI67[0] - GRS80[0]:.0f} m")

    print("\n== 1\" de arco no chão / 1 arcsecond on the ground")
    r = 6371000.0
    um_seg = r * radians(1 / 3600)
    print(f"  1\" ≈ {um_seg:.1f} m ; 3,52\" ≈ {3.52 * um_seg:.0f} m ; 0,31\" ≈ {0.31 * um_seg:.1f} m")

    print("\n== 13 m em ppm / 13 m in ppm (distâncias aproximadas a Chuá)")
    chua = CIDADES[0]
    for nome in ("Oiapoque", "Chuí", "Cruzeiro do Sul"):
        _, la, lo = next(c for c in CIDADES if c[0] == nome)
        p1 = (radians(chua[1]), radians(chua[2]))
        p2 = (radians(la), radians(lo))
        # haversine
        dlat, dlon = p2[0] - p1[0], p2[1] - p1[1]
        h = sin(dlat / 2) ** 2 + cos(p1[0]) * cos(p2[0]) * sin(dlon / 2) ** 2
        d = 2 * r * atan2(sqrt(h), sqrt(1 - h))
        print(f"  Chuá -> {nome:16s} {d / 1000:7.0f} km ; 13 m / d = {13 / d * 1e6:5.1f} ppm")
    print(f"  13 m / 2 000 km = {13 / 2.0e6 * 1e6:.1f} ppm ; para 3 ppm em 2 000 km: "
          f"{3e-6 * 2.0e6:.0f} m")

    print("\n== Rede de 2006 / 2006 network (soma de conferência)")
    obs = {"direções": 16913, "distâncias": 1534, "azimutes": 389,
           "posições Doppler": 179, "diferenças GPS": 3196, "injunções": 21}
    for k, v in obs.items():
        print(f"  {k:18s} {v:6d}")
    print(f"  total de equações / total equations: {sum(obs.values())}")
    print(f"  estações ajustadas / adjusted stations: {4774 + 1600 - 125 - 4 + 0} "
          "(rede clássica 4 774 + GPS 1 600 - coincidentes)")


if __name__ == "__main__":
    main()
