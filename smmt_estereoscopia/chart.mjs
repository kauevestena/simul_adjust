// Interactive SVG Height (H) vs. Overlap (%) comparison chart
import { LIMITS } from "./model.mjs";

const SVG_NS = "http://www.w3.org/2000/svg";

function el(tag, attrs = {}, text = null) {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) {
    node.setAttribute(k, String(v));
  }
  if (text !== null) node.textContent = text;
  return node;
}

export class HeightOverlapChart {
  constructor(svgElement, onSelectHeight) {
    this.svg = svgElement;
    this.onSelectHeight = onSelectHeight;
    this.pad = { left: 52, right: 20, top: 20, bottom: 38 };
    this.width = 680;
    this.height = 240;

    this.svg.addEventListener("pointerdown", (e) => {
      if (!this.onSelectHeight) return;
      const rect = this.svg.getBoundingClientRect();
      if (!rect.width) return;
      const xSvg = ((e.clientX - rect.left) / rect.width) * this.width;
      const plotW = this.width - this.pad.left - this.pad.right;
      const u = Math.min(1, Math.max(0, (xSvg - this.pad.left) / plotW));
      const [hMin, hMax] = LIMITS.height;
      const h = Math.round((hMin + u * (hMax - hMin)) * 20) / 20;
      this.onSelectHeight(h);
    });
  }

  render(curve, currentSim, labels) {
    const svg = this.svg;
    while (svg.firstChild) svg.removeChild(svg.firstChild);

    const { left, right, top, bottom } = this.pad;
    const plotW = this.width - left - right;
    const plotH = this.height - top - bottom;
    const [hMin, hMax] = LIMITS.height;

    const sx = (h) => left + ((h - hMin) / (hMax - hMin)) * plotW;
    const sy = (pct) => top + (1 - Math.min(100, Math.max(0, pct)) / 100) * plotH;

    // Background grid
    for (let pct = 0; pct <= 100; pct += 20) {
      const y = sy(pct);
      svg.appendChild(
        el("line", {
          x1: left,
          x2: left + plotW,
          y1: y,
          y2: y,
          stroke: "#26364c",
          "stroke-width": pct === 0 ? 1.4 : 1,
        }),
      );
      svg.appendChild(
        el(
          "text",
          {
            x: left - 8,
            y: y + 4,
            "text-anchor": "end",
            fill: "#8da2bd",
            "font-size": "11",
          },
          `${pct}%`,
        ),
      );
    }

    for (let h = Math.ceil(hMin * 2) / 2; h <= hMax + 1e-6; h += 0.5) {
      const x = sx(h);
      svg.appendChild(
        el("line", {
          x1: x,
          x2: x,
          y1: top,
          y2: top + plotH,
          stroke: "#1d2a3d",
          "stroke-width": 1,
        }),
      );
      svg.appendChild(
        el(
          "text",
          {
            x,
            y: top + plotH + 16,
            "text-anchor": "middle",
            fill: "#8da2bd",
            "font-size": "11",
          },
          `${h.toFixed(1)}m`,
        ),
      );
    }

    // Target overlap dashed line
    const targetY = sy(currentSim.params.targetOverlap);
    svg.appendChild(
      el("line", {
        x1: left,
        x2: left + plotW,
        y1: targetY,
        y2: targetY,
        stroke: "#facc15",
        "stroke-width": 1.3,
        "stroke-dasharray": "5 5",
        opacity: 0.75,
      }),
    );
    svg.appendChild(
      el(
        "text",
        {
          x: left + plotW - 4,
          y: targetY - 5,
          "text-anchor": "end",
          fill: "#facc15",
          "font-size": "10.5",
        },
        `${labels.target}: ${currentSim.params.targetOverlap}%`,
      ),
    );

    const hasConvergence = Math.abs(currentSim.params.convergenceDeg) > 0.05;

    // Parallel reference curve (dashed cyan/blue)
    if (hasConvergence) {
      const parD = curve
        .map((pt, i) => `${i === 0 ? "M" : "L"}${sx(pt.height).toFixed(1)},${sy(pt.parallelOverlapPct).toFixed(1)}`)
        .join(" ");
      svg.appendChild(
        el("path", {
          d: parD,
          fill: "none",
          stroke: "#38bdf8",
          "stroke-width": 2,
          "stroke-dasharray": "6 4",
          opacity: 0.85,
        }),
      );
    }

    // Current angle curve (emerald fill + stroke)
    const curPoints = curve.map((pt) => [sx(pt.height), sy(pt.overlapAreaPct)]);
    const curD = curPoints
      .map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`)
      .join(" ");

    const areaD = `${curD} L${sx(hMax).toFixed(1)},${sy(0).toFixed(1)} L${sx(hMin).toFixed(1)},${sy(0).toFixed(1)} Z`;
    svg.appendChild(
      el("path", {
        d: areaD,
        fill: "#22c55e",
        opacity: 0.13,
      }),
    );

    svg.appendChild(
      el("path", {
        d: curD,
        fill: "none",
        stroke: "#22c55e",
        "stroke-width": 2.6,
        "stroke-linejoin": "round",
      }),
    );

    // Current H vertical cursor & dot
    const curX = sx(currentSim.params.height);
    const curY = sy(currentSim.overlapAreaPct);
    svg.appendChild(
      el("line", {
        x1: curX,
        x2: curX,
        y1: top,
        y2: top + plotH,
        stroke: "#f8fafc",
        "stroke-width": 1.2,
        "stroke-dasharray": "3 3",
        opacity: 0.6,
      }),
    );

    svg.appendChild(
      el("circle", {
        cx: curX,
        cy: curY,
        r: 5.5,
        fill: "#22c55e",
        stroke: "#0b1220",
        "stroke-width": 2,
      }),
    );

    // Callout badge near current point
    const badgeRight = curX < left + plotW * 0.68;
    const bx = badgeRight ? curX + 9 : curX - 9;
    const by = Math.max(top + 14, Math.min(top + plotH - 8, curY - 8));
    svg.appendChild(
      el(
        "text",
        {
          x: bx,
          y: by,
          "text-anchor": badgeRight ? "start" : "end",
          fill: "#f8fafc",
          "font-size": "11.5",
          "font-weight": "600",
        },
        `H=${currentSim.params.height.toFixed(2)}m · ${currentSim.overlapAreaPct.toFixed(1)}%`,
      ),
    );

    // Axis titles
    svg.appendChild(
      el(
        "text",
        {
          x: left + plotW / 2,
          y: this.height - 6,
          "text-anchor": "middle",
          fill: "#b0c0d5",
          "font-size": "11.5",
        },
        labels.axisX,
      ),
    );
    svg.appendChild(
      el(
        "text",
        {
          x: 14,
          y: top + plotH / 2,
          "text-anchor": "middle",
          fill: "#b0c0d5",
          "font-size": "11.5",
          transform: `rotate(-90 14 ${top + plotH / 2})`,
        },
        labels.axisY,
      ),
    );
  }
}
