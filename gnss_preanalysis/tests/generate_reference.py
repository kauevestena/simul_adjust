#!/usr/bin/env python3
"""Independent NumPy/SciPy reference for gnss_preanalysis (written separately from the JS model).

The baseline covariance is formed in matrix form (Σ_ENU → Rᵀ Σ R), the session model as
D·blkdiag(Σ_station)·Dᵀ + blkdiag(Σ_length), and the network by dense least squares
(Σxx = (Aᵀ P A)⁻¹ with numpy.linalg). MDB uses scipy.stats.norm and brentq.

    python gnss_preanalysis/tests/generate_reference.py
"""
import json
import math
from pathlib import Path

import numpy as np
import scipy
from scipy.optimize import brentq
from scipy.stats import norm

A_WGS, F_WGS = 6378137.0, 1 / 298.257223563
E2 = F_WGS * (2 - F_WGS)
OUT = Path(__file__).with_name('numerical-reference.json')

POINTS = {
    'UFPR': (-25.44836778, -49.23095501, 925.861, 'cors'), 'PRPI': (-25.38673185, -49.12654345, 910.018, 'cors'),
    'P1': (-25.4000, -49.2300, 921.0), 'P2': (-25.4250, -49.1500, 905.0), 'P3': (-25.4800, -49.1700, 898.0),
    'P4': (-25.4600, -49.2800, 934.0), 'PRGU': (-25.38399727, -51.48757808, 1043.182, 'cors'), 'PG': (-25.0950, -50.1620, 975.0),
}
PRESETS = {'static': (3, 0.5, 5, 0.5), 'hpStatic': (3, 0.1, 3.5, 0.4), 'rtk': (8, 1, 15, 1), 'ibge2008': (10, 1, 10, 1)}


def llh2xyz(lat, lon, h):
    p, l = math.radians(lat), math.radians(lon)
    n = A_WGS / math.sqrt(1 - E2 * math.sin(p) ** 2)
    return np.array([(n + h) * math.cos(p) * math.cos(l), (n + h) * math.cos(p) * math.sin(l), (n * (1 - E2) + h) * math.sin(p)])


def xyz2latlon(x):
    lon = math.atan2(x[1], x[0]); p = math.hypot(x[0], x[1]); lat = math.atan2(x[2], p * (1 - E2))
    for _ in range(30):
        n = A_WGS / math.sqrt(1 - E2 * math.sin(lat) ** 2)
        lat = math.atan2(x[2] + E2 * n * math.sin(lat), p)
    return math.degrees(lat), math.degrees(lon)


def rot(lat, lon):
    p, l = math.radians(lat), math.radians(lon)
    return np.array([[-math.sin(l), math.cos(l), 0], [-math.sin(p) * math.cos(l), -math.sin(p) * math.sin(l), math.cos(p)],
                     [math.cos(p) * math.cos(l), math.cos(p) * math.sin(l), math.sin(p)]])


def settings(**kw):
    s = dict(preset='static', combination='linear', horizontal='component', setupNew=(1.0, 2.0), setupCors=(0.0, 0.0),
             sessionCorrelation=False, trivial='flag', frequency='dual', alpha=0.001, power=0.8)
    s.update(kw)
    s['aH'], s['bH'], s['aV'], s['bV'] = PRESETS[s['preset']]
    return s


def nominal(km, s):
    aH, aV = s['aH'], s['aV']
    if s['preset'] == 'ibge2008':
        aH = aV = 10.0 if km <= 20 else 5.0
    c = (lambda a, b: math.hypot(a, b)) if s['combination'] == 'quadratic' else (lambda a, b: a + b)
    sh, sv = c(aH, s['bH'] * km), c(aV, s['bV'] * km)
    e = sh / math.sqrt(2) if s['horizontal'] == 'radial' else sh
    return e, sv


def setup(pid, s):
    return s['setupCors'] if POINTS[pid][3:] == ('cors',) else s['setupNew']


def geometry(a, b):
    xa, xb = llh2xyz(*POINTS[a][:3]), llh2xyz(*POINTS[b][:3])
    mid = xyz2latlon((xa + xb) / 2)
    return xb - xa, np.linalg.norm(xb - xa) / 1000, mid


def baseline_cov(a, b, s):
    _, km, mid = geometry(a, b)
    e, v = nominal(km, s)
    ca, ha = setup(a, s); cb, hb = setup(b, s)
    enu = np.diag([e ** 2 + ca ** 2 + cb ** 2, e ** 2 + ca ** 2 + cb ** 2, v ** 2 + ha ** 2 + hb ** 2]) * 1e-6
    r = rot(*mid)
    return r.T @ enu @ r


def session_cov(pairs, s):
    stations = sorted({p for pair in pairs for p in pair})
    k, n = len(pairs), len(stations)
    D = np.zeros((3 * k, 3 * n))
    for i, (a, b) in enumerate(pairs):
        D[3 * i:3 * i + 3, 3 * stations.index(a):3 * stations.index(a) + 3] = -np.eye(3)
        D[3 * i:3 * i + 3, 3 * stations.index(b):3 * stations.index(b) + 3] = np.eye(3)
    a_min_h = 5.0 if s['preset'] == 'ibge2008' else s['aH']
    a_min_v = 5.0 if s['preset'] == 'ibge2008' else s['aV']
    a_e = a_min_h / math.sqrt(2) if s['horizontal'] == 'radial' else a_min_h
    S = np.zeros((3 * n, 3 * n))
    for j, pid in enumerate(stations):
        c, h = setup(pid, s)
        enu = np.diag([a_e ** 2 / 2 + c ** 2, a_e ** 2 / 2 + c ** 2, a_min_v ** 2 / 2 + h ** 2]) * 1e-6
        r = rot(*POINTS[pid][:2])
        S[3 * j:3 * j + 3, 3 * j:3 * j + 3] = r.T @ enu @ r
    L = np.zeros((3 * k, 3 * k))
    for i, (a, b) in enumerate(pairs):
        _, km, mid = geometry(a, b)
        e, v = nominal(km, s)
        enu = np.diag([e ** 2 - a_e ** 2, e ** 2 - a_e ** 2, v ** 2 - a_min_v ** 2]) * 1e-6
        r = rot(*mid)
        L[3 * i:3 * i + 3, 3 * i:3 * i + 3] = r.T @ enu @ r
    return D @ S @ D.T + L


def dependent(pairs):
    parent = {}
    def find(x):
        parent.setdefault(x, x)
        while parent[x] != x:
            x = parent[x]
        return x
    out = []
    for i, (a, b) in enumerate(pairs):
        ra, rb = find(a), find(b)
        if ra == rb:
            out.append(i)
        else:
            parent[ra] = rb
    return out


def delta(alpha, power):
    c = norm.ppf(1 - alpha / 2)
    return brentq(lambda d: norm.cdf(-c - d) + norm.sf(c - d) - power, 0, 15, xtol=1e-14)


def solve(case):
    s, sessions = case['settings'], case['sessions']
    controls = case.get('controls', {})
    fixed = [p for p in case['points'] if POINTS[p][3:] == ('cors',) and p not in controls]
    included = []
    for sid, pairs in sessions:
        dep = dependent(pairs)
        for i, pair in enumerate(pairs):
            if not (i in dep and s['trivial'] == 'exclude'):
                included.append((sid, pair, i in dep))
    used = [p for p in case['points'] if any(p in pair for _, pair, _ in included)]
    unknown = [p for p in used if p not in fixed]
    col = {p: i for i, p in enumerate(unknown)}
    m = 3 * len(included) + 3 * len(controls)
    A = np.zeros((m, 3 * len(unknown)))
    Q = np.zeros((m, m))
    for i, (_, (a, b), _) in enumerate(included):
        for k in range(3):
            if b in col: A[3 * i + k, 3 * col[b] + k] += 1
            if a in col: A[3 * i + k, 3 * col[a] + k] -= 1
    if s['sessionCorrelation']:
        start = 0
        for sid, _ in sessions:
            pairs = [pair for ss, pair, _ in included if ss == sid]
            if pairs:
                Q[start:start + 3 * len(pairs), start:start + 3 * len(pairs)] = session_cov(pairs, s)
                start += 3 * len(pairs)
    else:
        for i, (_, (a, b), _) in enumerate(included):
            Q[3 * i:3 * i + 3, 3 * i:3 * i + 3] = baseline_cov(a, b, s)
    row = 3 * len(included)
    for pid, sig in controls.items():
        r = rot(*POINTS[pid][:2])
        Q[row:row + 3, row:row + 3] = r.T @ np.diag(np.array(sig) ** 2 * 1e-6) @ r
        for k in range(3):
            A[row + k, 3 * col[pid] + k] = 1
        row += 3
    P = np.linalg.inv(Q)
    N = A.T @ P @ A
    rank = int(np.linalg.matrix_rank(A))
    out = {'name': case['name'], 'rank': rank, 'dof': m - rank, 'unknowns': 3 * len(unknown), 'observations': m}
    if rank < A.shape[1]:
        out['solvable'] = False
        return out
    Sxx = np.linalg.inv(N)
    R = np.eye(m) - A @ Sxx @ A.T @ P
    M = P - P @ A @ Sxx @ A.T @ P
    d = delta(s['alpha'], s['power'])
    out['solvable'] = True
    out['precision'] = {}
    for p in unknown:
        cx = Sxx[3 * col[p]:3 * col[p] + 3, 3 * col[p]:3 * col[p] + 3]
        r = rot(*POINTS[p][:2])
        ce = r @ cx @ r.T
        w, v = np.linalg.eigh(ce[:2, :2])
        major = v[:, 1]
        out['precision'][p] = {'sigma': np.sqrt(np.diag(ce)).tolist(), 'major': math.sqrt(w[1]), 'minor': math.sqrt(max(w[0], 0)),
                               'azimuth': math.atan2(major[0], major[1]) % math.pi, 'covXYZ': cx.tolist()}
    out['baselines'] = []
    for i, (sid, (a, b), trivial) in enumerate(included):
        rows = slice(3 * i, 3 * i + 3)
        _, km, mid = geometry(a, b)
        e = rot(*mid)
        Mb, Pb = M[rows, rows], P[rows, rows]
        mdb = [d / math.sqrt(e[k] @ Mb @ e[k]) if e[k] @ Mb @ e[k] > 1e-10 * (e[k] @ Pb @ e[k]) else None for k in range(3)]
        J = np.zeros((3, 3 * len(unknown)))
        if b in col: J[:, 3 * col[b]:3 * col[b] + 3] += np.eye(3)
        if a in col: J[:, 3 * col[a]:3 * col[a] + 3] -= np.eye(3)
        adj = e @ (J @ Sxx @ J.T) @ e.T
        out['baselines'].append({'id': f'{a}-{b}@{sid}', 'km': km, 'trivial': trivial, 'redundancy': float(np.trace(R[rows, rows])),
                                 'mdb': mdb, 'apriori': np.sqrt(np.diag(e @ Q[rows, rows] @ e.T)).tolist(),
                                 'adjusted': np.sqrt(np.diag(adj)).tolist()})
    out['redundancySum'] = float(np.trace(R))
    return out


NETWORK = [('S1', [('UFPR', 'P1'), ('UFPR', 'P4')]), ('S2', [('PRPI', 'P1'), ('PRPI', 'P2')]),
           ('S3', [('UFPR', 'P3'), ('P3', 'P2')]), ('S4', [('P4', 'P3'), ('P4', 'P1')])]
CASES = [
    {'name': 'network', 'points': ['UFPR', 'PRPI', 'P1', 'P2', 'P3', 'P4'], 'sessions': NETWORK, 'settings': settings()},
    {'name': 'network-correlated', 'points': ['UFPR', 'PRPI', 'P1', 'P2', 'P3', 'P4'], 'sessions': NETWORK,
     'settings': settings(sessionCorrelation=True)},
    {'name': 'network-quadratic-radial-hp', 'points': ['UFPR', 'PRPI', 'P1', 'P2', 'P3', 'P4'], 'sessions': NETWORK,
     'settings': settings(preset='hpStatic', combination='quadratic', horizontal='radial', setupNew=(0.5, 1.5))},
    {'name': 'network-stochastic-control', 'points': ['UFPR', 'PRPI', 'P1', 'P2', 'P3', 'P4'], 'sessions': NETWORK,
     'settings': settings(preset='rtk'), 'controls': {'PRPI': [5.0, 5.0, 10.0]}},
    {'name': 'radial', 'points': ['UFPR', 'P1', 'P2', 'P3', 'P4'],
     'sessions': [('S1', [('UFPR', 'P1'), ('UFPR', 'P2'), ('UFPR', 'P3'), ('UFPR', 'P4')])], 'settings': settings()},
    {'name': 'trivial-flag', 'points': ['UFPR', 'P1', 'P2', 'P3'],
     'sessions': [('S1', [('UFPR', 'P1'), ('UFPR', 'P2'), ('UFPR', 'P3'), ('P1', 'P2'), ('P2', 'P3'), ('P1', 'P3')])],
     'settings': settings()},
    {'name': 'trivial-exclude', 'points': ['UFPR', 'P1', 'P2', 'P3'],
     'sessions': [('S1', [('UFPR', 'P1'), ('UFPR', 'P2'), ('UFPR', 'P3'), ('P1', 'P2'), ('P2', 'P3'), ('P1', 'P3')])],
     'settings': settings(trivial='exclude')},
    {'name': 'trivial-correlated', 'points': ['UFPR', 'P1', 'P2', 'P3'],
     'sessions': [('S1', [('UFPR', 'P1'), ('UFPR', 'P2'), ('UFPR', 'P3'), ('P1', 'P2'), ('P2', 'P3'), ('P1', 'P3')])],
     'settings': settings(sessionCorrelation=True)},
    {'name': 'long-ibge', 'points': ['UFPR', 'PRGU', 'PG'],
     'sessions': [('S1', [('UFPR', 'PG'), ('PRGU', 'PG')]), ('S2', [('UFPR', 'PG')])], 'settings': settings(preset='ibge2008')},
]

if __name__ == '__main__':
    single = settings()
    e, v = 5.5, 7.5  # 5 km static example of the text answer: σE = σN = √(5.5² + 2·1²), σU = √(7.5² + 2·2²)
    enu = np.diag([e ** 2 + 2, e ** 2 + 2, v ** 2 + 8]) * 1e-6
    r = rot(-25.0, -49.0)
    example = r.T @ enu @ r
    out = {'generator': 'tests/generate_reference.py', 'numpy': np.__version__, 'scipy': scipy.__version__,
           'points': {k: list(v[:3]) + [v[3] if len(v) > 3 else 'new'] for k, v in POINTS.items()},
           'example5km': {'lat': -25.0, 'lon': -49.0, 'enuMm': [e, v], 'xyz': example.tolist()},
           'delta': delta(0.001, 0.8), 'cases': []}
    for case in CASES:
        res = solve(case)
        res['input'] = {'points': case['points'], 'sessions': case['sessions'], 'controls': case.get('controls', {}),
                        'settings': {k: (list(v) if isinstance(v, tuple) else v) for k, v in case['settings'].items()}}
        out['cases'].append(res)
    OUT.write_text(json.dumps(out, indent=1) + '\n', encoding='utf-8')
    print('wrote', OUT, [(c['name'], c['rank'], c['dof']) for c in out['cases']])
