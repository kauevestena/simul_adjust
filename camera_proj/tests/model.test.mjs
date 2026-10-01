import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as M from "../model.mjs";
const fixture = JSON.parse(
  readFileSync(new URL("./opencv-4.13-reference.json", import.meta.url)),
);
function near(actual, expected, tol = 1e-9) {
  assert.equal(actual.length, expected.length);
  actual.forEach((v, i) =>
    assert.ok(
      Math.abs(v - expected[i]) <= tol,
      `${v} != ${expected[i]} (tolerance ${tol})`,
    ),
  );
}

for (const c of fixture.cases)
  test(`OpenCV 4.13: ${c.name}`, () => {
    const s = {
      ...M.defaults(),
      ...c,
      q: M.anglesQuaternion(c.angles),
      plane: "virtual",
    };
    near(M.transpose(M.quaternionMatrix(s.q)), c.rotation, 1e-12);
    assert.equal(M.intrinsics(s).height, c.height);
    c.world.forEach((p, i) => {
      const result = M.project(p, s);
      near(result.camera, c.camera[i], 1e-12);
      near(result.cv, c.expected[i], 1e-8);
      const ray = M.imageRay(c.expected[i], s);
      near(M.unit(ray), M.unit(M.sub(p, s.center)), 1e-9);
      const physical = M.project(p, { ...s, plane: "physical" });
      near(
        physical.uv,
        [c.width - 1 - c.expected[i][0], c.height - 1 - c.expected[i][1]],
        1e-8,
      );
    });
  });
test("analytic physical image, millimeters, pixel centers, and principal-point offset", () => {
  const s = M.defaults(),
    p = [0.1, 0.2, 2],
    r = M.project(p, s);
  near(r.cv, [399.5, 339.5]);
  near(r.uv, [299.5, 139.5]);
  near(r.mm, [-2.5, -5]);
  near(r.ideal, [-0.0025, -0.005, -0.05]);
  const shifted = M.project(p, { ...s, offset: [1, -2] });
  near(shifted.cv, [419.5, 299.5]);
  near(shifted.uv, [279.5, 179.5]);
  const translated = M.project(p, { ...s, center: [0.1, 0, 0] });
  near(translated.cv, [349.5, 339.5]);
  const high = M.project(p, { ...s, width: 1400 });
  near(
    high.cv.map((v) => v + 0.5),
    r.cv.map((v) => 2 * (v + 0.5)),
  );
});
test("all orientation representations agree, including gimbal lock and 180-degree rotations", () => {
  for (const angles of [
    [0, 0, 0],
    [90, 0, 0],
    [0, 90, 0],
    [0, -90, 0],
    [180, 0, 0],
    [0, 180, 0],
    [0, 0, 180],
    [17, 43, -29],
    [30, 90, 50],
    [30, -90, 50],
  ]) {
    const q = M.anglesQuaternion(angles),
      m = M.quaternionMatrix(q),
      out = M.quaternionAngles(q);
    near(M.quaternionMatrix(M.anglesQuaternion(out.angles)), m, 1e-7);
    near(M.quaternionMatrix(M.matrixQuaternion(m)), m, 1e-12);
    near(M.quaternionMatrix(q.map((v) => -v)), m);
  }
  near(
    M.mv(
      M.transpose(M.quaternionMatrix(M.anglesQuaternion([90, 0, 0]))),
      [0, 1, 0],
    ),
    [0, 0, -1],
  );
  assert.equal(
    M.quaternionAngles(M.anglesQuaternion([0, 90, 0])).singular,
    true,
  );
});
test("invalid matrices and quaternions are rejected", () => {
  for (const m of [
    [1, 0, 0, 0, 1, 0, 0, 0, -1],
    [2, 0, 0, 0, 1, 0, 0, 0, 1],
    [1, 1, 0, 0, 1, 0, 0, 0, 1],
  ])
    assert.throws(() => M.matrixQuaternion(m), /invalidRotation/);
  assert.throws(() => M.normalizeQuaternion([0, 0, 0, 0]), /invalidRotation/);
  near(M.normalizeQuaternion([2, 0, 0, 0]), [1, 0, 0, 0]);
});
test("look-at preserves camera position and targets correctly, including parallel up directions", () => {
  for (const target of [
    [0, 0, 5],
    [0, 5, 0],
    [0, -5, 0],
    [0, 0, -5],
    [3, 2, 1],
  ]) {
    const center = [0, 0, 0],
      q = M.lookAtQuaternion(center, target);
    near(M.mv(M.quaternionMatrix(q), [0, 0, 1]), M.unit(target));
    near(center, [0, 0, 0]);
  }
  assert.throws(() => M.lookAtQuaternion([1, 2, 3], [1, 2, 3]), /zeroVector/);
});
test("opaque cube visibility, behind-camera rejection, and off-sensor projections", () => {
  const s = { ...M.defaults(), cubeQ: [1, 0, 0, 0] };
  assert.equal(M.project([0, 0, 4.5], s).status, "visible");
  assert.equal(M.project([0, 0, 5.5], s).status, "occluded");
  assert.equal(M.project([0, 0, -1], s).status, "behind");
  assert.equal(M.project([1, 0, 0], s).status, "behind");
  assert.equal(M.project([100, 0, 5], s).status, "outside");
  assert.equal(M.hitCube([0, 0, 0], [0, 0, -1], s), null);
  assert.equal(M.hitCube([0, 0, 0], [0, 0, 1], s).face, 5);
  near(M.hitCube([0, 0, 5], [1, 0, 0], s).point, [0.5, 0, 5]);
});
test("distortion coefficient subsets and non-invertible regions", () => {
  const s = { ...M.defaults(), coefficients: [0.1, 0.2, 0.3, 0.4, 0.5] };
  near(M.coefficients({ ...s, distortion: "none" }), [0, 0, 0, 0, 0]);
  near(M.coefficients({ ...s, distortion: "radial" }), [0.1, 0.2, 0, 0, 0]);
  near(
    M.coefficients({ ...s, distortion: "tangential" }),
    [0.1, 0.2, 0.3, 0.4, 0],
  );
  near(M.coefficients({ ...s, distortion: "full" }), [0.1, 0.2, 0.3, 0.4, 0.5]);
  near(M.distort([1, 0], [0.1, 0, 0, 0, 0]), [1.1, 0]);
  assert.equal(M.undistort([1, 0], [-1, 0, 0, 0, 0]), null);
});
test("strict localized numeric parsing", () => {
  assert.equal(M.parseNumber(" 1,25 "), 1.25);
  assert.equal(M.parseNumber("-2e-3"), -0.002);
  for (const v of ["", " ", "1abc", "1,2,3", "Infinity", "NaN", "1e999"])
    assert.throws(() => M.parseNumber(v), /invalidNumber/);
});
test("field of view follows actual shifted sensor boundaries", () => {
  const s = M.defaults();
  near(M.fieldOfView(s), [
    (2 * Math.atan(0.35)) / M.DEG,
    (2 * Math.atan(0.24)) / M.DEG,
  ]);
  const shifted = { ...s, offset: [17.5, 0] };
  near(M.fieldOfView(shifted), [
    Math.atan(0.7) / M.DEG,
    (2 * Math.atan(0.24)) / M.DEG,
  ]);
});
