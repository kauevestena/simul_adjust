/* Browser regression checks. Starts a local server in this process, then closes it.
   Run from any directory: node camera_proj/tests/browser.cjs (requires Playwright).
   Set CAMERA_PROJ_SCREENSHOTS to an output directory to retain review screenshots. */
const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "../..");
const server = http.createServer((req, res) => {
  let p = path.resolve(root, "." + decodeURIComponent(req.url.split("?")[0]));
  if (!p.startsWith(root + path.sep) && p !== root) {
    res.writeHead(403);
    res.end();
    return;
  }
  try {
    if (fs.statSync(p).isDirectory()) p = path.join(p, "index.html");
    res.setHeader(
      "Content-Type",
      /\.m?js$/.test(p)
        ? "text/javascript"
        : p.endsWith(".css")
          ? "text/css"
          : p.endsWith(".json")
            ? "application/json"
            : "text/html",
    );
    res.end(fs.readFileSync(p));
  } catch {
    res.writeHead(404);
    res.end("Not found");
  }
});
let browser;
async function main() {
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  browser = await chromium.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--use-angle=swiftshader",
      "--enable-unsafe-swiftshader",
    ],
  });
  const page = await browser.newPage({
      viewport: { width: 1440, height: 1000 },
    }),
    errors = [],
    external = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  page.on("request", (r) => {
    if (
      !r.url().startsWith("http://127.0.0.1:") &&
      !r.url().startsWith("data:")
    )
      external.push(r.url());
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  const settle = () =>
    page.evaluate(
      () =>
        new Promise((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(resolve)),
        ),
    );
  const state = () =>
    page.evaluate(async () => (await import("./app.mjs")).getState());
  const selection = () =>
    page.evaluate(async () => (await import("./app.mjs")).getSelection());
  async function field(id, value) {
    const loc = page.locator("#" + id);
    await loc.fill(String(value));
    await loc.press("Tab");
    await settle();
  }
  async function choose(id, value) {
    await page.selectOption("#" + id, value);
    await settle();
  }
  async function openSection(key) {
    const summary = page
      .locator("summary")
      .filter({ has: page.locator(`[data-t="${key}"]`) });
    if (!(await summary.evaluate((e) => e.parentElement.open)))
      await summary.click();
  }
  const screenshot = async (name) => {
    if (process.env.CAMERA_PROJ_SCREENSHOTS) {
      fs.mkdirSync(process.env.CAMERA_PROJ_SCREENSHOTS, { recursive: true });
      await page.screenshot({
        path: path.join(process.env.CAMERA_PROJ_SCREENSHOTS, name + ".png"),
        fullPage: true,
      });
    }
  };
  await page.goto(base + "/camera_proj/");
  await page.waitForFunction(
    () =>
      document.querySelector("#resolution-badge").textContent === "700 × 480",
  );
  await settle();
  assert.equal((await state()).plane, "physical");
  assert.equal(await page.getAttribute("html", "lang"), "pt-BR");
  assert.equal(await page.locator("#graphics-error").isVisible(), false);
  await page.locator('[data-lang="en"]').click();
  await settle();
  assert.equal(await page.title(), "camera_proj · Image formation");
  assert.match(await page.locator("#plane-caption").textContent(), /inverted/);
  await page.locator('[data-lang="pt-BR"]').click();

  // Find a rendered cube face from the actual screenshot, then use real mouse input.
  const png = (await page.screenshot()).toString("base64");
  const face = await page.evaluate(async (encoded) => {
    const img = new Image();
    img.src = "data:image/png;base64," + encoded;
    await img.decode();
    const c = document.createElement("canvas");
    c.width = img.width;
    c.height = img.height;
    const ctx = c.getContext("2d");
    ctx.drawImage(img, 0, 0);
    const data = ctx.getImageData(0, 0, c.width, c.height).data;
    const b = document.querySelector("#world-canvas").getBoundingClientRect();
    let xsum = 0,
      ysum = 0,
      n = 0;
    for (let y = b.top + 150; y < b.bottom - 210; y += 2)
      for (let x = b.left + 50; x < b.right - 265; x += 2) {
        const i = (Math.floor(y) * c.width + Math.floor(x)) * 4;
        if (
          Math.abs(data[i] - 238) < 2 &&
          Math.abs(data[i + 1] - 114) < 2 &&
          Math.abs(data[i + 2] - 91) < 2
        ) {
          xsum += x;
          ysum += y;
          n++;
        }
      }
    return n ? { x: xsum / n, y: ysum / n } : null;
  }, png);
  assert.ok(face, "a colored cube face is rendered outside overlays");
  await page.mouse.move(face.x, face.y);
  await settle();
  assert.ok(await selection(), "hover selects a cube surface point");
  await page.mouse.click(face.x, face.y);
  await page.mouse.move(250, 30);
  await settle();
  const pinned = await selection();
  assert.ok(pinned);
  assert.match(await page.locator(".point-status").textContent(), /fixado/);
  await screenshot("camera-proj-physical");
  const before = await state();
  const rect = await page.locator("#world-canvas").boundingBox();
  await page.mouse.move(
    rect.x + rect.width * 0.35,
    rect.y + rect.height * 0.48,
  );
  await page.mouse.down();
  await page.mouse.move(
    rect.x + rect.width * 0.4,
    rect.y + rect.height * 0.53,
    { steps: 8 },
  );
  await page.mouse.up();
  await page.mouse.move(250, 30);
  await settle();
  assert.deepEqual((await state()).center, before.center);
  assert.deepEqual((await state()).q, before.q);
  assert.deepEqual((await selection()).world, pinned.world);
  await page.locator("#reset-view").click();

  await choose("sampling", "pixels");
  await field("resolution", 70);
  assert.equal(
    await page.locator("#formed-image").evaluate((e) => e.width),
    70,
  );
  await page.evaluate(() => {
    const c = document.querySelector("#formed-image"),
      copy = document.createElement("canvas");
    copy.width = c.width;
    copy.height = c.height;
    copy.getContext("2d").drawImage(c, 0, 0);
    window.physicalPixels = copy
      .getContext("2d")
      .getImageData(0, 0, c.width, c.height).data;
  });
  await choose("plane", "virtual");
  assert.equal(
    await page.evaluate(() => {
      const c = document.querySelector("#formed-image"),
        copy = document.createElement("canvas");
      copy.width = c.width;
      copy.height = c.height;
      copy.getContext("2d").drawImage(c, 0, 0);
      const b = copy
          .getContext("2d")
          .getImageData(0, 0, c.width, c.height).data,
        a = window.physicalPixels;
      let n = 0;
      for (let i = 0; i < b.length; i += 4) {
        const j = b.length - 4 - i;
        for (let k = 0; k < 3; k++) if (Math.abs(a[i + k] - b[j + k]) > 1) n++;
      }
      return n;
    }),
    0,
    "physical/virtual images are exact 180-degree counterparts",
  );

  // Compare the shader's independently implemented inverse mapping and ray/cube
  // intersection with the OpenCV-validated CPU model at actual pixel centers.
  async function checkImage(label) {
    const result = await page.evaluate(async () => {
      const m = await import("./model.mjs"),
        s = (await import("./app.mjs")).getState(),
        c = document.querySelector("#formed-image"),
        copy = document.createElement("canvas");
      copy.width = c.width;
      copy.height = c.height;
      copy.getContext("2d").drawImage(c, 0, 0);
      const a = copy
        .getContext("2d")
        .getImageData(0, 0, c.width, c.height).data;
      let mismatch = 0,
        colored = 0;
      const examples = [];
      for (let y = 0; y < c.height; y++)
        for (let x = 0; x < c.width; x++) {
          const ray = m.imageRay([x, y], s),
            hit = ray ? m.hitCube(s.center, ray, s) : null;
          const color = hit ? m.FACE_COLORS[hit.face] : "#0c1216",
            rgb = [1, 3, 5].map((i) => parseInt(color.slice(i, i + 2), 16)),
            i = (y * c.width + x) * 4;
          if (hit) colored++;
          if (rgb.some((v, k) => Math.abs(v - a[i + k]) > 2)) {
            mismatch++;
            if (examples.length < 5)
              examples.push({ x, y, rgb, actual: [...a.slice(i, i + 3)] });
          }
        }
      return { mismatch, colored, examples };
    });
    assert.ok(result.mismatch <= 2, label + ": " + JSON.stringify(result));
    assert.ok(result.colored > 20, label + " has a visible cube");
    console.log(label, result);
  }
  await checkImage("Undistorted virtual image");
  await openSection("distortion");
  await choose("distortion", "full");
  await field("k1", -0.3);
  await field("k2", 0.08);
  await field("k3", 0.02);
  await field("p1", 0.025);
  await field("p2", -0.015);
  await field("offset-x", 1.2);
  await field("offset-y", -0.8);
  await checkImage("Distorted image with principal-point offset");
  await choose("plane", "physical");
  await checkImage("Distorted physical image");
  await choose("sampling", "continuous");
  assert.ok(
    await page.locator("#formed-image").evaluate((e) => e.width >= 700),
  );

  await openSection("camera");
  await field("cy", "1,25");
  assert.equal((await state()).center[1], 1.25);
  await field("cy", 0);
  await field("rotation-0", 15);
  await field("rotation-1", -20);
  await field("rotation-2", 35);
  await page.locator("#apply-rotation").click();
  await settle();
  const rotated = await state();
  await choose("representation", "quaternion");
  for (let i = 0; i < 4; i++) await field("rotation-" + i, rotated.q[i] * 3);
  await page.locator("#apply-rotation").click();
  await settle();
  (await state()).q.forEach((v, i) =>
    assert.ok(Math.abs(v - rotated.q[i]) < 1e-8),
  );
  const validQuaternion = (await state()).q;
  await choose("representation", "matrix");
  await field("rotation-0", 2);
  await page.locator("#apply-rotation").click();
  await settle();
  assert.ok(await page.locator("#form-error").isVisible());
  assert.deepEqual((await state()).q, validQuaternion);
  for (let i = 0; i < 9; i++) await field("rotation-" + i, i % 4 === 0 ? 1 : 0);
  await page.locator("#apply-rotation").click();
  await settle();
  assert.deepEqual((await state()).q, [1, 0, 0, 0]);
  await choose("representation", "angles");
  await field("rotation-1", 180);
  await page.locator("#apply-rotation").click();
  await settle();
  await choose("vertex", "4");
  assert.equal((await selection()).status, "behind");
  await field("cx", 2);
  await field("cy", 1);
  await field("cz", -0.5);
  const center = (await state()).center;
  await page.locator("#face-object").click();
  await settle();
  assert.deepEqual((await state()).center, center);
  const aim = await page.evaluate(async () => {
    const s = (await import("./app.mjs")).getState(),
      m = await import("./model.mjs");
    return m.worldToCamera(s.cubeCenter, s);
  });
  assert.ok(Math.abs(aim[0]) < 1e-10 && Math.abs(aim[1]) < 1e-10 && aim[2] > 0);
  const focal = (await state()).focal;
  await field("focal", "");
  assert.ok(await page.locator("#form-error").isVisible());
  assert.equal((await state()).focal, focal);
  await field("focal", focal);
  await page.locator("#reset").click();
  await settle();
  assert.equal((await state()).plane, "physical");
  assert.deepEqual((await state()).q, [1, 0, 0, 0]);
  await choose("vertex", "4");
  await page.locator('[data-lang="en"]').click();
  await settle();
  await screenshot("camera-proj-english");
  await page.locator("#theory").click();
  assert.ok(await page.locator("#theory-dialog").isVisible());
  await page.keyboard.press("Escape");
  await page.setViewportSize({ width: 390, height: 844 });
  await settle();
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
    "no horizontal page overflow on mobile",
  );
  const noOverlap = await page.evaluate(() => {
    const a = document.querySelector(".pose-readout").getBoundingClientRect(),
      b = document.querySelector(".point-readout").getBoundingClientRect();
    return a.bottom <= b.top;
  });
  assert.ok(noOverlap, "orientation and point readouts do not overlap");
  await screenshot("camera-proj-mobile");
  assert.deepEqual(errors, [], "no JS, WebGL, or resource errors");
  assert.deepEqual(external, [], "runtime is self-contained");
  console.log(
    "Browser checks passed: picking, pinning, orbit, image inversion, shader/CPU agreement, all rotation editors, look-at, validation, translations, and mobile layout.",
  );
}
main()
  .then(async () => {
    await browser?.close();
    server.close();
  })
  .catch(async (e) => {
    console.error(e);
    await browser?.close();
    server.close();
    process.exitCode = 1;
  });
