#!/usr/bin/env python3
"""Independent NumPy oracle for transform_lab (no simulator imports, no analytic Jacobians).

It builds a small deterministic experiment (a 5 × 4 block of the printed grid, cm, and its
total-station coordinates, m, with dense covariances), adjusts it with
  * a Gauss-Helmert loop written here with central finite-difference Jacobians (combined model,
    parametric model as the special case F = f(X) - La, with and without distance injunções);
  * and, for the parametric model, a plain weighted Gauss-Newton on the unconstrained Euler angles
    (a different algorithm path, used to cross-check the Gauss-Helmert result);
and writes tests/numerical-reference.json, which tests/oracle.test.mjs compares against.

Usage:  python3 transform_lab/tests/generate_reference.py
"""
import json
import os
import numpy as np

np.set_printoptions(precision=12)
rng = np.random.RandomState(20261019)


def R_euler(w, f, k):
    c, s = np.cos, np.sin
    R1 = np.array([[1, 0, 0], [0, c(w), s(w)], [0, -s(w), c(w)]])
    R2 = np.array([[c(f), 0, -s(f)], [0, 1, 0], [s(f), 0, c(f)]])
    R3 = np.array([[c(k), s(k), 0], [-s(k), c(k), 0], [0, 0, 1]])
    return R3 @ R2 @ R1


def R_quat(q):
    a, b, c, d = q
    return np.array([
        [a*a + b*b - c*c - d*d, 2*(b*c - a*d), 2*(b*d + a*c)],
        [2*(b*c + a*d), a*a - b*b + c*c - d*d, 2*(c*d - a*b)],
        [2*(b*d - a*c), 2*(c*d + a*b), a*a - b*b - c*c + d*d]])


def euler_from_R(R):
    f = np.arcsin(R[2, 0])
    return np.array([np.arctan2(-R[2, 1], R[2, 2]), f, np.arctan2(-R[1, 0], R[0, 0])])


def quat_from_R(R):
    w, v = np.linalg.eigh(np.array([
        [R[0, 0] - R[1, 1] - R[2, 2], R[1, 0] + R[0, 1], R[2, 0] + R[0, 2], R[2, 1] - R[1, 2]],
        [R[1, 0] + R[0, 1], R[1, 1] - R[0, 0] - R[2, 2], R[2, 1] + R[1, 2], R[0, 2] - R[2, 0]],
        [R[2, 0] + R[0, 2], R[2, 1] + R[1, 2], R[2, 2] - R[0, 0] - R[1, 1], R[1, 0] - R[0, 1]],
        [R[2, 1] - R[1, 2], R[0, 2] - R[2, 0], R[1, 0] - R[0, 1], R[0, 0] + R[1, 1] + R[2, 2]]]) / 3)
    x, y, z, wq = v[:, -1]
    q = np.array([wq, x, y, z])
    return q if q[0] >= 0 else -q


# ------------------------------------------------------------------ the experiment
cols, rows, sp = 5, 4, 3.0
src = np.array([[c * sp, r * sp, 0.0] for r in range(rows) for c in range(cols)])        # cm
m = len(src)
lam_true, R_true = 0.01 * (1 + 4e-4), R_euler(0.35, -0.55, 1.2)
t_true = np.array([2.1, 6.3, 0.9])
x_true_s = src + rng.normal(0, 0.01, src.shape)                                       # 0.1 mm printing noise (cm)
x_t = (t_true + lam_true * (R_true @ x_true_s.T).T)
# TS covariance: cigar along the line of sight (2 mm depth, 0.1 mm lateral)
Sig_T = []
for p in x_t:
    u = p / np.linalg.norm(p)
    a = np.cross([0, 0, 1], u); a /= np.linalg.norm(a)
    b = np.cross(u, a)
    S = 0.002 ** 2 * np.outer(u, u) + 0.0001 ** 2 * (np.outer(a, a) + np.outer(b, b))
    Sig_T.append(S)
    x_t[len(Sig_T) - 1] = p + rng.multivariate_normal(np.zeros(3), S)
Sig_T = np.array(Sig_T)
# reference covariance (cm²): 0.1 mm placement + a printer scale error of 300 ppm per axis (dense)
Sig_S = np.zeros((3 * m, 3 * m))
for i in range(m):
    Sig_S[3*i:3*i+3, 3*i:3*i+3] += np.diag([0.01 ** 2, 0.01 ** 2, 0.01 ** 2])
for i in range(m):
    for j in range(m):
        Sig_S[3*i, 3*j] += src[i, 0] * src[j, 0] * (300e-6) ** 2
        Sig_S[3*i+1, 3*j+1] += src[i, 1] * src[j, 1] * (300e-6) ** 2

# horizontal and vertical neighbours of the block (31 pairs), nominal distances in the TS unit
pairs = []
for r in range(rows):
    for c in range(cols):
        i = r * cols + c
        if c + 1 < cols: pairs.append((i, i + 1))
        if r + 1 < rows: pairs.append((i, i + cols))
D_nom = np.array([np.linalg.norm(src[i] - src[j]) * 0.01 for i, j in pairs])
# propagated sigma_d (cm → m)
sig_D = []
for (i, j) in pairs:
    u = (src[i] - src[j]) / np.linalg.norm(src[i] - src[j])
    g = np.zeros(3 * m); g[3*i:3*i+3] = u; g[3*j:3*j+3] = -u
    sig_D.append(np.sqrt(g @ Sig_S @ g) * 0.01)
sig_D = np.array(sig_D)


# ------------------------------------------------------------------ Gauss-Helmert with finite differences
def jac(f, x, h=1e-6):
    f0 = np.atleast_1d(f(x)); J = np.zeros((len(f0), len(x)))
    for k in range(len(x)):
        xp, xm = x.copy(), x.copy(); step = h * max(1.0, abs(x[k]))
        xp[k] += step; xm[k] -= step
        J[:, k] = (np.atleast_1d(f(xp)) - np.atleast_1d(f(xm))) / (2 * step)
    return J


def solve_gh(method, rotation, estimate_scale, inj_type=None, constrain=True, iters=30):
    """Returns the solution of the (combined|parametric) model."""
    s = 3 if rotation == 'euler' else 4
    Rf = (lambda p: R_euler(*p)) if rotation == 'euler' else R_quat
    comb = method == 'combinado'
    # initial values from the same closed form would be circular: start from a crude linear fit
    # (centroid + Procrustes via SVD), then converge.
    cs, cd = src.mean(0), x_t.mean(0)
    H = (src - cs).T @ (x_t - cd)
    U, _, Vt = np.linalg.svd(H)
    d = np.sign(np.linalg.det(Vt.T @ U.T))
    R0 = Vt.T @ np.diag([1, 1, d]) @ U.T
    lam0 = 0.01
    t0 = cd - lam0 * R0 @ cs
    p0 = euler_from_R(R0) if rotation == 'euler' else quat_from_R(R0)
    X = np.r_[t0, p0, lam0 if estimate_scale else []]
    n_obs = 3 * m + (3 * m if comb else 0) + (len(pairs) if inj_type == 'relative' else 0)
    Lb = np.r_[x_t.ravel(), (src.ravel() if comb else [])]
    if inj_type == 'relative':
        Lb = np.r_[Lb, D_nom]
    Sig = np.zeros((n_obs, n_obs))
    for i in range(m):
        Sig[3*i:3*i+3, 3*i:3*i+3] = Sig_T[i]
    if comb:
        Sig[3*m:6*m, 3*m:6*m] = Sig_S           # the reference stays in cm: its covariance is in cm²
    if inj_type == 'relative':
        base = 6 * m if comb else 3 * m
        for k in range(len(pairs)):
            Sig[base + k, base + k] = sig_D[k] ** 2
    lam_fixed = 0.01

    def split(x):
        t = x[:3]; p = x[3:3 + s]; lam = x[3 + s] if estimate_scale else lam_fixed
        return t, p, lam

    def F(x, La):
        t, p, lam = split(x); R = Rf(p)
        TS = La[:3 * m].reshape(m, 3)
        if comb:
            Sx = La[3 * m:6 * m].reshape(m, 3)
            f = (TS - (t + lam * (R @ Sx.T).T)).ravel()
        else:
            f = ((t + lam * (R @ src.T).T) - TS).ravel()
        if inj_type is not None and not (not comb and inj_type == 'absolute'):
            base = 6 * m if comb else 3 * m
            h = np.array([np.linalg.norm(TS[i] - TS[j]) for i, j in pairs])
            f = np.r_[f, h - (La[base:base + len(pairs)] if inj_type == 'relative' else D_nom)]
        return f

    def cons(x):
        t, p, lam = split(x)
        g = []
        if constrain and rotation == 'quaternion':
            g.append(p @ p - 1)
        if not comb and inj_type == 'absolute' and estimate_scale:
            g.append((lam - lam_fixed) / lam_fixed)
        return np.array(g)

    La = Lb.copy()
    for it in range(iters):
        A = jac(lambda x: F(x, La), X)
        B = jac(lambda l: F(X, l), La)
        W = F(X, La) + B @ (Lb - La)
        M = B @ Sig @ B.T
        Mi = np.linalg.inv(M)
        N = A.T @ Mi @ A; U_ = A.T @ Mi @ W
        C = jac(cons, X) if len(cons(X)) else np.zeros((0, len(X)))
        g = cons(X)
        k = len(g)
        Nb = np.block([[N, C.T], [C, np.zeros((k, k))]])
        sol = np.linalg.solve(Nb, np.r_[-U_, -g])
        dX = sol[:len(X)]
        K = -Mi @ (A @ dX + W)
        V = Sig @ B.T @ K
        X = X + dX
        La = Lb + V
        if np.max(np.abs(dX) / np.r_[np.ones(3 + s), [0.01] if estimate_scale else []]) < 1e-12:
            break
    A = jac(lambda x: F(x, La), X); B = jac(lambda l: F(X, l), La)
    M = B @ Sig @ B.T; Mi = np.linalg.inv(M); N = A.T @ Mi @ A
    C = jac(cons, X) if len(cons(X)) else np.zeros((0, len(X)))
    k = len(C)
    Q = np.linalg.inv(np.block([[N, C.T], [C, np.zeros((k, k))]]))[:len(X), :len(X)]
    Omega = float(K @ M @ K)
    n_eq = len(F(X, La))
    r = n_eq - len(X) + k
    t, p, lam = split(X)
    return dict(X=X.tolist(), R=Rf(p).tolist(), t=t.tolist(), lam=float(lam), Omega=Omega, r=int(r),
                sigmas_apriori=np.sqrt(np.maximum(np.diag(Q), 0)).tolist(), V_T=V[:3 * m].tolist())


def inputs(order_cm=True):
    return dict(src=src.tolist(), dst=x_t.tolist(), Sigma_T=Sig_T.tolist(), Sigma_S=Sig_S.tolist(),
                pairs=[list(p) for p in pairs], D=D_nom.tolist(), sigma_D=sig_D.tolist(), lambda0=0.01)


cases = {}
for method in ('combinado', 'parametrico'):
    for rotation in ('euler', 'quaternion'):
        cases[f'{method}/{rotation}/similarity'] = dict(method=method, rotation=rotation, estimateScale=True, injunctions=None,
                                                       **solve_gh(method, rotation, True))
cases['combinado/euler/rigid'] = dict(method='combinado', rotation='euler', estimateScale=False, injunctions=None, **solve_gh('combinado', 'euler', False))
for t_ in ('absolute', 'relative'):
    cases[f'combinado/euler/similarity/{t_}'] = dict(method='combinado', rotation='euler', estimateScale=True, injunctions=t_, **solve_gh('combinado', 'euler', True, t_))
    cases[f'parametrico/euler/similarity/{t_}'] = dict(method='parametrico', rotation='euler', estimateScale=True, injunctions=t_, **solve_gh('parametrico', 'euler', True, t_))


# ------------------------------------------------------------------ cross-check: weighted Gauss-Newton (parametric, Euler)
def gauss_newton_parametric():
    X = np.array(cases['parametrico/euler/similarity']['X']) + np.r_[1e-3 * np.ones(3), 1e-3 * np.ones(3), 1e-5]
    P = np.linalg.inv(np.kron(np.eye(m), np.eye(3)) * 0 + np.block([[Sig_T[i] if i == j else np.zeros((3, 3)) for j in range(m)] for i in range(m)]))

    def f(x):
        return (x[:3] + x[6] * (R_euler(*x[3:6]) @ src.T).T).ravel()
    for _ in range(25):
        J = jac(f, X)
        r_ = x_t.ravel() - f(X)
        dX = np.linalg.solve(J.T @ P @ J, J.T @ P @ r_)
        X = X + dX
        if np.max(np.abs(dX)) < 1e-14:
            break
    return X.tolist()


out = dict(
    provenance=dict(method='NumPy Gauss-Helmert with central finite differences; weighted Gauss-Newton cross-check',
                    numpy=np.__version__, seed=20261019),
    input=inputs(), cases=cases, gauss_newton_parametric_euler=gauss_newton_parametric())
path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'numerical-reference.json')
with open(path, 'w') as fh:
    json.dump(out, fh)
print('wrote', path, '-', len(cases), 'cases')
for k, v in cases.items():
    print(f'{k:42s} r={v["r"]:3d} Omega={v["Omega"]:10.4f} lambda={v["lam"]:.9f}')
d = np.max(np.abs(np.array(out['gauss_newton_parametric_euler']) - np.array(cases['parametrico/euler/similarity']['X'])))
print('max |GH - GN| parametric Euler =', d)
assert d < 1e-9
