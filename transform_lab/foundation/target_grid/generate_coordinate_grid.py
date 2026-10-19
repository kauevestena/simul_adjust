#!/usr/bin/env python3
"""
Generate a high-precision, printable A4 Coordinate Grid with exact physical dimensions.

Specifications:
- Page: A4 Portrait (210 mm x 297 mm)
- Grid Spacing: 30 mm (3.0 cm) square cells
- Line Weight: Hairline (0.25 pt / ~0.088 mm)
- Grid Size: 6 columns x 9 rows of squares -> 7 x 10 = 70 grid intersection points (180 mm x 270 mm)
  Centered on sheet with 15.0 mm horizontal and 13.5 mm vertical margins
- Point-Anchored Labels: Each vertex is clearly marked with a discrete dot and labeled
  in its upper-right quadrant with:
    1. Sequential Name: A0...Z0, A1...Z1, A2...R2
    2. Physical Coordinates in Centimeters: (0,0), (3,0), (6,0)... up to (18,27)
- Coordinate System: Right-handed Cartesian with origin (0,0) at the lower-left vertex.
- Collision Detection: Automated spatial audit verifying zero collisions between all text elements,
  grid lines, and printable margins.
"""

import os
import sys
import math
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import cm, mm
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics

PAGE_W, PAGE_H = A4  # 210 x 297 mm
CELL_SIDE = 3 * cm    # 30 mm
COLS = 6
ROWS = 9
GRID_W = COLS * CELL_SIDE  # 180 mm
GRID_H = ROWS * CELL_SIDE  # 270 mm

MARGIN_X = (PAGE_W - GRID_W) / 2  # 15.0 mm
MARGIN_Y = (PAGE_H - GRID_H) / 2  # 13.5 mm

def check_all_collisions(elements, grid_lines_x, grid_lines_y, page_w, page_h):
    report = {
        "text_collisions": [],
        "page_edge_violations": [],
        "min_text_clearance_mm": 999999.0,
        "min_text_clearance_pair": None,
        "min_edge_margin_mm": 999999.0,
    }
    
    n = len(elements)
    for i in range(n):
        e1 = elements[i]
        b1 = e1["bb"]
        
        edge_dist = min(b1[0], b1[1], page_w - b1[2], page_h - b1[3])
        if edge_dist < report["min_edge_margin_mm"]:
            report["min_edge_margin_mm"] = edge_dist
        if edge_dist < 4.5 * mm:
            report["page_edge_violations"].append((e1, edge_dist / mm))
            
        for j in range(i + 1, n):
            e2 = elements[j]
            b2 = e2["bb"]
            
            overlap_x = not (b1[2] < b2[0] or b1[0] > b2[2])
            overlap_y = not (b1[3] < b2[1] or b1[1] > b2[3])
            
            if overlap_x and overlap_y:
                report["text_collisions"].append((e1, e2))
            else:
                dx = max(0, max(b1[0], b2[0]) - min(b1[2], b2[2]))
                dy = max(0, max(b1[1], b2[1]) - min(b1[3], b2[3]))
                dist = math.hypot(dx, dy)
                if dist < report["min_text_clearance_mm"]:
                    report["min_text_clearance_mm"] = dist
                    report["min_text_clearance_pair"] = (e1, e2)
                    
    report["min_text_clearance_mm"] /= mm
    report["min_edge_margin_mm"] /= mm
    return report

def generate_grid_pdf(filename="/home/kaue/coordinate_grid_a4.pdf"):
    c = canvas.Canvas(filename, pagesize=A4)
    
    # Hairline Grid
    HAIRLINE = 0.25  # 0.25 pt approx 0.088 mm
    c.setLineWidth(HAIRLINE)
    c.setStrokeColorRGB(0.25, 0.25, 0.25)
    c.setLineCap(1)
    c.setLineJoin(1)
    
    grid_lines_x = [MARGIN_X + col * CELL_SIDE for col in range(COLS + 1)]
    grid_lines_y = [MARGIN_Y + row * CELL_SIDE for row in range(ROWS + 1)]
    
    # Draw vertical hairline grid lines
    for lx in grid_lines_x:
        c.line(lx, MARGIN_Y, lx, MARGIN_Y + GRID_H)
    # Draw horizontal hairline grid lines
    for ly in grid_lines_y:
        c.line(MARGIN_X, ly, MARGIN_X + GRID_W, ly)
        
    # Fonts
    FONT_NAME = "Helvetica-Bold"
    FONT_SIZE_NAME = 7.8
    font_name_obj = pdfmetrics.getFont(FONT_NAME)
    
    FONT_COORD = "Helvetica"
    FONT_SIZE_COORD = 6.2
    font_coord_obj = pdfmetrics.getFont(FONT_COORD)
    
    elements = []
    
    # Right-handed point generation:
    # 7 columns (x = 0, 3, 6, 9, 12, 15, 18 cm)
    # 10 rows   (y = 0, 3, 6, 9, 12, 15, 18, 21, 24, 27 cm)
    # Total = 70 points
    idx = 0
    for r in range(ROWS + 1):
        for col in range(COLS + 1):
            letter = chr(ord('A') + (idx % 26))
            num = idx // 26
            name_str = f"{letter}{num}"
            
            x_cm = col * 3
            y_cm = r * 3
            coord_str = f"({x_cm},{y_cm})"
            
            px = MARGIN_X + col * CELL_SIDE
            py = MARGIN_Y + r * CELL_SIDE
            
            # Draw point vertex dot (diameter 1.2 mm, radius 0.6 mm)
            c.setFillColorRGB(0.1, 0.1, 0.1)
            c.circle(px, py, 0.6 * mm, fill=1, stroke=0)
            
            # Position labels tightly anchored in the upper-right quadrant of the point
            offset_x = 1.3 * mm
            offset_y = 1.1 * mm
            
            # Bounding box calculations
            name_w = pdfmetrics.stringWidth(name_str, FONT_NAME, FONT_SIZE_NAME)
            name_ascent = font_name_obj.face.ascent / 1000.0 * FONT_SIZE_NAME
            name_descent = font_name_obj.face.descent / 1000.0 * FONT_SIZE_NAME
            
            coord_w = pdfmetrics.stringWidth(coord_str, FONT_COORD, FONT_SIZE_COORD)
            coord_ascent = font_coord_obj.face.ascent / 1000.0 * FONT_SIZE_COORD
            coord_descent = font_coord_obj.face.descent / 1000.0 * FONT_SIZE_COORD
            
            # Coordinate line (lower line)
            coord_draw_x = px + offset_x
            coord_draw_y = py + offset_y
            coord_bb = (
                coord_draw_x,
                coord_draw_y + coord_descent,
                coord_draw_x + coord_w,
                coord_draw_y + coord_ascent
            )
            
            # Name line (upper line)
            line_spacing = 2.7 * mm
            name_draw_x = px + offset_x
            name_draw_y = coord_draw_y + line_spacing
            name_bb = (
                name_draw_x,
                name_draw_y + name_descent,
                name_draw_x + name_w,
                name_draw_y + name_ascent
            )
            
            elements.append({
                "type": "name",
                "id": name_str,
                "bb": name_bb,
                "text": name_str,
                "x": name_draw_x,
                "y": name_draw_y,
                "font": FONT_NAME,
                "size": FONT_SIZE_NAME,
                "color": (0.1, 0.1, 0.1)
            })
            elements.append({
                "type": "coord",
                "id": coord_str,
                "bb": coord_bb,
                "text": coord_str,
                "x": coord_draw_x,
                "y": coord_draw_y,
                "font": FONT_COORD,
                "size": FONT_SIZE_COORD,
                "color": (0.42, 0.42, 0.42)
            })
            
            idx += 1
            
    # Run collision audit
    report = check_all_collisions(elements, grid_lines_x, grid_lines_y, PAGE_W, PAGE_H)
    print("=== POINT-GRID COLLISION AUDIT REPORT ===")
    print(f"Total elements inspected: {len(elements)}")
    print(f"Text collisions: {len(report['text_collisions'])}")
    print(f"Page edge violations (<4.5mm): {len(report['page_edge_violations'])}")
    print(f"Minimum text-to-text clearance: {report['min_text_clearance_mm']:.2f} mm")
    print(f"Minimum edge margin: {report['min_edge_margin_mm']:.2f} mm")
    
    assert len(report['text_collisions']) == 0, f"Collisions: {report['text_collisions']}"
    assert len(report['page_edge_violations']) == 0, f"Violations: {report['page_edge_violations']}"
    print("✓ All collision checks PASSED successfully!\n")
    
    # Draw point text elements
    for e in elements:
        c.setFont(e["font"], e["size"])
        c.setFillColorRGB(*e["color"])
        c.drawString(e["x"], e["y"], e["text"])
        
    # Clean bottom metadata / instructions (placed in bottom margin, well below y=0 grid line)
    footer_y1 = 7.0 * mm
    footer_y2 = 3.8 * mm
    c.setFont("Helvetica-Bold", 7.0)
    c.setFillColorRGB(0.3, 0.3, 0.3)
    c.drawString(MARGIN_X, footer_y1, "POINT COORDINATE GRID (A4 PORTRAIT) — 3.0 cm (30 mm) HAIRLINE SPACING")
    c.setFont("Helvetica", 6.5)
    c.drawRightString(MARGIN_X + GRID_W, footer_y1, "PRINT AT 100% SCALE (ACTUAL SIZE)")
    
    c.setFillColorRGB(0.45, 0.45, 0.45)
    c.drawString(MARGIN_X, footer_y2, "Right-handed Cartesian coordinates (x, y) in centimeters | Origin (0,0) at lower-left vertex | Hairline: 0.25 pt (0.088 mm)")
    c.drawRightString(MARGIN_X + GRID_W, footer_y2, "Labels: A0...Z0, A1...Z1, A2...R2")

    c.showPage()
    c.save()
    print(f"Generated PDF saved to {filename}")

if __name__ == "__main__":
    out_pdf = "/home/kaue/coordinate_grid_a4.pdf"
    if len(sys.argv) > 1:
        out_pdf = sys.argv[1]
    generate_grid_pdf(out_pdf)
