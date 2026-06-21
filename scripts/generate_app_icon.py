"""
Generate premium app icon for 解码阅读 (Decode Reading).
Design: Neon Decode Book — dark background, glowing geometric book,
cyan & orange accent neon lines, digital scan/decoder elements.

Output: 1024px source + density-specific PNGs for Android.
"""
import math
import os
from PIL import Image, ImageDraw, ImageFilter, ImageFont

OUT_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "static", "branding")
SIZE = 1024
CENTER = SIZE // 2

# ── Color palette (matches app dark + neon theme) ──────────────────────────
BG_DARK = (13, 17, 23)          # near-black
BG_MID = (22, 27, 34)           # dark gray-blue
BG_ACCENT = (16, 42, 46)        # dark teal tint

CYAN_NEON = (103, 255, 242)     # #67fff2 — primary glow
CYAN_DIM = (46, 158, 148)       # muted cyan
CYAN_DEEP = (20, 85, 80)        # dark cyan for depth

ORANGE_NEON = (226, 95, 53)     # #e25f35 — accent warm
ORANGE_WARM = (255, 138, 88)    # lighter orange
ORANGE_DIM = (191, 63, 45)      # deep red-orange

WHITE_SOFT = (244, 249, 255)    # near-white
WHITE_DIM = (200, 215, 210)     # muted


def create_gradient_bg(size):
    """Dark radial + linear gradient background."""
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # Base dark fill
    for y in range(size):
        t = y / size
        r = int(BG_DARK[0] + (BG_MID[0] - BG_DARK[0]) * t)
        g = int(BG_DARK[1] + (BG_MID[1] - BG_DARK[1]) * t)
        b = int(BG_DARK[2] + (BG_MID[2] - BG_DARK[2]) * t)
        draw.line([(0, y), (size, y)], fill=(r, g, b))

    # Subtle radial glow from upper-right
    glow_cx, glow_cy = 640, 280
    glow_r = 620
    glow_layer = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    glow_draw = ImageDraw.Draw(glow_layer)
    for i in range(glow_r, 0, -1):
        alpha = int(18 * (1 - i / glow_r))
        glow_draw.ellipse(
            [glow_cx - i, glow_cy - i, glow_cx + i, glow_cy + i],
            fill=(46, 158, 148, alpha),
        )
    img = Image.alpha_composite(img, glow_layer)

    return img


def rounded_rectangle_mask(size, radius):
    """Create rounded rectangle mask."""
    mask = Image.new("L", (size, size), 0)
    draw = ImageDraw.Draw(mask)
    draw.rounded_rectangle([0, 0, size - 1, size - 1], radius=radius, fill=255)
    return mask


def draw_book(draw, cx, cy, scale=1.0):
    """
    Draw a stylized open book using geometric shapes.
    The book is constructed from:
    - Two "page wing" polygons (left/right)
    - A center spine
    - Page lines
    - Glowing edges
    Returns list of shape descriptions for layered rendering.
    """
    s = scale
    shapes = {}

    # ── Book proportions ──
    # Left page
    left_x = cx - 280 * s
    left_y = cy - 180 * s
    left_w = 260 * s
    left_h = 380 * s

    # Right page
    right_x = cx + 20 * s
    right_y = cy - 180 * s
    right_w = 260 * s
    right_h = 380 * s

    # Spine
    spine_x = cx - 14 * s
    spine_y = cy - 196 * s
    spine_w = 28 * s
    spine_h = 412 * s

    shapes["left_page"] = [
        (left_x, left_y),
        (left_x + left_w, left_y + 12 * s),
        (left_x + left_w, left_y + left_h - 8 * s),
        (left_x + 18 * s, left_y + left_h + 6 * s),
        (left_x - 28 * s, left_y + left_h - 68 * s),
        (left_x - 20 * s, left_y + 20 * s),
    ]

    shapes["right_page"] = [
        (right_x, right_y + 12 * s),
        (right_x + right_w, right_y),
        (right_x + right_w + 20 * s, right_y + 20 * s),
        (right_x + right_w + 28 * s, right_y + right_h - 68 * s),
        (right_x + right_w - 18 * s, right_y + left_h + 6 * s),
        (right_x, right_y + left_h - 8 * s),
    ]

    shapes["spine"] = [
        (spine_x, spine_y + 8 * s),
        (spine_x + spine_w, spine_y),
        (spine_x + spine_w, spine_y + spine_h),
        (spine_x, spine_y + spine_h + 8 * s),
    ]

    # ── Page text lines ──
    line_margin = 56 * s
    line_start = left_x + 60 * s
    line_end = left_x + left_w - 30 * s
    line_y_start = left_y + 80 * s
    line_spacing = 38 * s

    shapes["lines_left"] = []
    for i in range(7):
        y = line_y_start + i * line_spacing
        w = line_end - line_start
        if i == 3:
            w *= 0.72
        shapes["lines_left"].append(
            [(line_start, y), (line_start + w, y)]
        )

    rline_start = right_x + 30 * s
    rline_end = right_x + right_w - 60 * s
    shapes["lines_right"] = []
    for i in range(7):
        y = line_y_start + i * line_spacing
        w = rline_end - rline_start
        if i == 2:
            w *= 0.78
        if i == 5:
            w *= 0.65
        shapes["lines_right"].append(
            [(rline_start, y), (rline_start + w, y)]
        )

    # ── Decode bracket / chevron on the book ──
    chevron_cx = cx
    chevron_cy = cy + 40 * s
    chevron_w = 90 * s
    chevron_h = 64 * s
    shapes["decode_chevron"] = [
        (chevron_cx - chevron_w // 2, chevron_cy + chevron_h // 2),
        (chevron_cx, chevron_cy - chevron_h // 2),
        (chevron_cx + chevron_w // 2, chevron_cy + chevron_h // 2),
    ]

    return shapes


def apply_glow(draw, points, color, width, glow_color=None, glow_width=0):
    """Draw a line/polygon with an outer glow effect."""
    if glow_color is None:
        glow_color = color
    if glow_width > 0:
        if len(points) == 2:  # line
            draw.line(points, fill=glow_color, width=width + glow_width * 2)
    if len(points) == 2:
        draw.line(points, fill=color, width=width)
    else:
        draw.polygon(points, fill=color)


def draw_scan_lines(draw, cx, cy, scale=1.0):
    """Horizontal scan/decoder lines across the book."""
    s = scale
    lines = []

    # Main scan line
    scan_y = cy - 20 * s
    lines.append(
        ([(cx - 160 * s, scan_y), (cx + 160 * s, scan_y)], CYAN_NEON, 3)
    )

    # Secondary scan dots
    for offset in [-80, 0, 80]:
        x = cx + offset * s
        lines.append(
            ([(x - 4, scan_y - 8), (x + 4, scan_y + 8)], CYAN_NEON, 2)
        )

    return lines


def draw_decoder_ring(draw, cx, cy, scale=1.0):
    """Circular decoder/tech ring element top-right."""
    s = scale
    ring_cx = cx + 260 * s
    ring_cy = cy - 220 * s
    r_outer = 70 * s
    r_inner = 52 * s
    elements = []

    # Outer ring
    elements.append(("circle_outer", ring_cx, ring_cy, r_outer, CYAN_DIM, 3))
    # Inner ring
    elements.append(("circle_inner", ring_cx, ring_cy, r_inner, CYAN_NEON, 2))

    # Crosshair lines inside ring
    ch = 22 * s
    elements.append(
        ("line", [(ring_cx - ch, ring_cy), (ring_cx + ch, ring_cy)], CYAN_NEON, 2)
    )
    elements.append(
        ("line", [(ring_cx, ring_cy - ch), (ring_cx, ring_cy + ch)], CYAN_NEON, 2)
    )

    # Central dot
    elements.append(("dot", ring_cx, ring_cy, 5 * s, ORANGE_NEON))

    # Small orbiting dots
    for angle_deg in [30, 120, 240, 310]:
        rad = math.radians(angle_deg)
        dx = (r_outer + 12 * s) * math.cos(rad)
        dy = (r_outer + 12 * s) * math.sin(rad)
        dot_x = ring_cx + dx
        dot_y = ring_cy + dy
        elements.append(("small_dot", dot_x, dot_y, 4 * s, ORANGE_WARM))

    return elements


def generate_icon():
    """Main icon generation."""
    size = SIZE
    img = create_gradient_bg(size)

    # Create layers for compositing
    glow_layer = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    glow_draw = ImageDraw.Draw(glow_layer)

    main_layer = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    main_draw = ImageDraw.Draw(main_layer)

    cx, cy = CENTER, CENTER - 10
    shapes = draw_book(main_draw, cx, cy, scale=1.0)

    # ── Render: glow effects first ──
    # Page edge glow — cyan
    for key in ["left_page", "right_page"]:
        pts = shapes[key]
        # Glow strokes
        for i in range(4, 1, -1):
            alpha = int(40 / i)
            glow_draw.polygon(
                [(p[0] + i * 2, p[1] + i * 2) for p in pts],
                fill=(*CYAN_NEON, alpha),
            )

    # Spine glow
    spine_pts = shapes["spine"]
    for i in range(3, 0, -1):
        alpha = int(30 / i)
        glow_draw.polygon(
            [(p[0] + i, p[1]) for p in spine_pts],
            fill=(*CYAN_NEON, alpha),
        )

    # Decode chevron glow
    chev_pts = shapes["decode_chevron"]
    for i in range(5, 1, -1):
        alpha = int(50 / i)
        expanded = [
            (chev_pts[0][0] - i, chev_pts[0][1] + i),
            (chev_pts[1][0], chev_pts[1][1] - i * 2),
            (chev_pts[2][0] + i, chev_pts[2][1] + i),
        ]
        glow_draw.polygon(expanded, fill=(*ORANGE_WARM, alpha))

    # ── Render: main shapes ──
    # Book pages — dark fill with subtle tint
    page_fill = (22, 34, 38, 240)  # dark teal semi-transparent
    for key in ["left_page", "right_page"]:
        main_draw.polygon(shapes[key], fill=page_fill)

    # Page edges — bright cyan strokes
    for key in ["left_page", "right_page"]:
        main_draw.polygon(shapes[key], outline=CYAN_NEON, width=3)

    # Spine
    spine_fill = (15, 28, 30, 250)
    main_draw.polygon(shapes["spine"], fill=spine_fill)
    main_draw.polygon(shapes["spine"], outline=CYAN_NEON, width=2)

    # Text lines on left page
    for line_pts in shapes["lines_left"]:
        main_draw.line(line_pts, fill=CYAN_DIM, width=4)
        main_draw.line(line_pts, fill=(*CYAN_NEON, 60), width=10)

    # Text lines on right page
    for line_pts in shapes["lines_right"]:
        main_draw.line(line_pts, fill=CYAN_DIM, width=4)
        main_draw.line(line_pts, fill=(*CYAN_NEON, 60), width=10)

    # Decode chevron (V shape = open book + decode angle bracket)
    chev_pts = shapes["decode_chevron"]
    main_draw.line([chev_pts[0], chev_pts[1]], fill=ORANGE_NEON, width=5)
    main_draw.line([chev_pts[1], chev_pts[2]], fill=ORANGE_NEON, width=5)

    # Center dot at chevron
    main_draw.ellipse(
        [chev_pts[1][0] - 6, chev_pts[1][1] - 6, chev_pts[1][0] + 6, chev_pts[1][1] + 6],
        fill=ORANGE_WARM,
    )

    # ── Decoder ring (top-right) ──
    ring_elements = draw_decoder_ring(main_draw, cx, cy, scale=1.0)
    for elem in ring_elements:
        kind = elem[0]
        if kind == "circle_outer":
            _, rx, ry, rr, color, width = elem
            main_draw.ellipse(
                [rx - rr, ry - rr, rx + rr, ry + rr],
                outline=color, width=width,
            )
        elif kind == "circle_inner":
            _, rx, ry, rr, color, width = elem
            main_draw.ellipse(
                [rx - rr, ry - rr, rx + rr, ry + rr],
                outline=color, width=width,
            )
        elif kind == "line":
            _, pts, color, width = elem
            main_draw.line(pts, fill=color, width=width)
        elif kind == "dot":
            _, dx, dy, dr, color = elem
            main_draw.ellipse(
                [dx - dr, dy - dr, dx + dr, dy + dr],
                fill=color,
            )
        elif kind == "small_dot":
            _, dx, dy, dr, color = elem
            main_draw.ellipse(
                [dx - dr, dy - dr, dx + dr, dy + dr],
                fill=color,
            )

    # ── Scan line effect ──
    scan_y = cy - 20
    # Glow sweep
    for i in range(8, 0, -1):
        alpha = int(20 / i)
        glow_draw.line(
            [(cx - 180 + i, scan_y), (cx + 180 - i, scan_y)],
            fill=(*CYAN_NEON, alpha),
            width=10,
        )
    main_draw.line(
        [(cx - 170, scan_y), (cx + 170, scan_y)],
        fill=CYAN_NEON, width=3,
    )

    # Small nodes on scan line
    for offset in [-100, -40, 40, 100]:
        x = cx + offset
        main_draw.ellipse([x - 4, scan_y - 4, x + 4, scan_y + 4], fill=WHITE_SOFT)

    # ── Corner accent decoration ──
    # Top-left: small dot grid (digital/texture)
    for dx, dy in [(50, 50), (90, 50), (130, 50), (50, 90), (90, 90)]:
        main_draw.ellipse(
            [dx - 3, dy - 3, dx + 3, dy + 3],
            fill=(*CYAN_DIM, 80),
        )

    # Bottom-right: small geometric line
    br_x, br_y = size - 80, size - 80
    main_draw.line([(br_x - 40, br_y), (br_x, br_y)], fill=CYAN_DIM, width=2)
    main_draw.line([(br_x, br_y - 40), (br_x, br_y)], fill=ORANGE_DIM, width=2)

    # ── Composite layers ──
    img = Image.alpha_composite(img, glow_layer)
    img = Image.alpha_composite(img, main_layer)

    # Apply rounded corners mask
    mask = rounded_rectangle_mask(size, radius=216)
    bg = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    bg.paste(img, (0, 0), mask)

    return bg


def export_icons(img):
    """Export at all required densities."""
    os.makedirs(OUT_DIR, exist_ok=True)

    # Save 1024 source
    source_path = os.path.join(OUT_DIR, "app-icon-1024.png")
    img.save(source_path, "PNG")
    print(f"[OK] {source_path} ({img.size[0]}x{img.size[1]})")

    # Android density sizes (based on 48dp baseline)
    densities = {
        "icon-hdpi.png": 72,      # 48 * 1.5
        "icon-xhdpi.png": 96,     # 48 * 2
        "icon-xxhdpi.png": 144,   # 48 * 3
        "icon-xxxhdpi.png": 192,  # 48 * 4
    }

    for filename, target_size in densities.items():
        resized = img.resize((target_size, target_size), Image.LANCZOS)
        out_path = os.path.join(OUT_DIR, filename)
        resized.save(out_path, "PNG")
        print(f"[OK] {out_path} ({target_size}x{target_size})")

    # Also generate a preview-friendly version
    preview_path = os.path.join(OUT_DIR, "icon-preview-512.png")
    preview = img.resize((512, 512), Image.LANCZOS)
    preview.save(preview_path, "PNG")
    print(f"[OK] {preview_path} (512x512)")


def main():
    print("Generating Decode Reading premium app icon...")
    print("Design: Neon Decode Book - dark + cyan/orange glow")
    print()

    icon = generate_icon()
    export_icons(icon)

    print()
    print("Done! New icon generated successfully.")
    print(f"Output directory: {OUT_DIR}")
    print()
    print("Files generated:")
    for f in os.listdir(OUT_DIR):
        fpath = os.path.join(OUT_DIR, f)
        size_kb = os.path.getsize(fpath) / 1024
        print(f"  {f:30s} {size_kb:.1f} KB")


if __name__ == "__main__":
    main()
