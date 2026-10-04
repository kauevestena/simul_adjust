"""Independent NumPy/SciPy oracle: no simulator imports or analytic Jacobians.

Covariance is computed with centered finite differences and LAPACK QR solves.
MDB uses scipy.stats.norm + scipy.optimize.brentq for the exact two-sided power.
Regenerate: python network_preanalysis/tests/generate_reference.py
"""
import json
from pathlib import Path
import numpy as np
import scipy
from scipy.stats import norm
from scipy.optimize import brentq


def point(id, E, N, control='unknown', type='station'):
    return dict(id=id, label=id, E=E, N=N, U=0, HI=1.5, HT=1.5,
                omega=0, active=True, type=type, control=control,
                controlSigma=[0.01, 0.012, 0.02])


def reference(stochastic=False):
    points = [point('A', -200, -50, 'fixed'), point('S', -60, 40),
              point('T', 80, -10), point('B', 220, 70, 'fixed')]
    if stochastic:
        points[0]['control'] = points[-1]['control'] = 'stochastic'
        points[0]['controlCovariance'] = [[1e-4, 3e-5, -2e-5], [3e-5, 1.44e-4, 1e-5], [-2e-5, 1e-5, 4e-4]]
    sights = [dict(id=f'{a}-{b}', **{'from': a, 'to': b}, active=True,
                   components=dict(direction=True, zenith=True, distance=True))
              for a, b in [('A', 'S'), ('S', 'A'), ('S', 'T'), ('T', 'S'), ('T', 'B'), ('B', 'T'), ('S', 'B')]]
    network = dict(version=1, level=0, scenario='reference', points=points, sights=sights,
                   instrument=dict(directionArcsec=2, zenithArcsec=3, distanceMm=2, ppm=2),
                   statistics=dict(alpha=.001, power=.8))
    by_id = {p['id']: p for p in points}
    orientations = list(dict.fromkeys(s['from'] for s in sights))
    parameters = [(p['id'], a) for p in points if p['control'] != 'fixed' for a in ['E', 'N', 'U']]
    parameters += [(p, 'omega') for p in orientations]
    definitions = [(s, c) for s in sights for c in ['direction', 'zenith', 'distance']]
    controls = [(p['id'], c) for p in points if p['control'] == 'stochastic' for c in ['E', 'N', 'U']]

    def observe():
        values = []
        for s, c in definitions:
            a, b = by_id[s['from']], by_id[s['to']]
            e, n = b['E']-a['E'], b['N']-a['N']
            u = b['U']+b['HT']-a['U']-a['HI']
            values.append({'direction': np.arctan2(e, n)-a['omega'],
                           'zenith': np.arctan2(np.hypot(e, n), u),
                           'distance': np.sqrt(e*e+n*n+u*u)}[c])
        return np.array(values + [by_id[p][c] for p, c in controls])

    A = np.zeros((len(definitions)+len(controls), len(parameters)))
    for j, (p, c) in enumerate(parameters):
        step = 1e-6 if c == 'omega' else 1e-3
        initial = by_id[p][c]
        by_id[p][c] = initial + step
        plus = observe()
        by_id[p][c] = initial - step
        minus = observe()
        by_id[p][c] = initial
        A[:, j] = (plus-minus)/(2*step)
    qobs = np.zeros((len(A), len(A)))
    for i, (s, c) in enumerate(definitions):
        a, b = by_id[s['from']], by_id[s['to']]
        distance = np.linalg.norm([b['E']-a['E'], b['N']-a['N'], b['U']+b['HT']-a['U']-a['HI']])
        sigma = {'direction': np.deg2rad(2/3600), 'zenith': np.deg2rad(3/3600),
                 'distance': np.hypot(.002, 2e-6*distance)}[c]
        qobs[i, i] = sigma*sigma
    at = len(definitions)
    for p in points:
        if p['control'] == 'stochastic':
            qobs[at:at+3, at:at+3] = p.get('controlCovariance', np.diag(np.array(p['controlSigma'])**2))
            at += 3
    B = np.linalg.solve(np.linalg.cholesky(qobs), A)
    _, R = np.linalg.qr(B)
    invR = np.linalg.solve(R, np.eye(len(parameters)))
    covariance = invR @ invR.T
    PA = np.linalg.solve(qobs, A)
    gain = covariance @ PA.T
    residual = np.eye(len(A)) - A @ gain
    critical = norm.ppf(1-.001/2)
    delta = brentq(lambda d: norm.cdf(-critical-d)+norm.sf(critical-d)-.8, 0, 10)
    pmat = np.linalg.solve(qobs, np.eye(len(A)))
    w = np.diag(pmat - PA @ covariance @ PA.T)
    mdb = [float(delta/np.sqrt(x)) if x > pmat[i, i]*1e-10 else None for i, x in enumerate(w)]
    return dict(network=network, parameters=parameters, covariance=covariance.tolist(),
                redundancy=np.diag(residual).tolist(), mdb=mdb, delta=delta)


out = dict(provenance=dict(method='central differences + NumPy LAPACK QR; SciPy normal power root',
                          numpy=np.__version__, scipy=scipy.__version__),
           cases=[reference(), reference(True)])
Path(__file__).with_name('numerical-reference.json').write_text(json.dumps(out, indent=2)+'\n')
