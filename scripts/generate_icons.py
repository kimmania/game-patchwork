#!/usr/bin/env python3
"""Generate Patchwork PWA icons using a tiny pure-Python PNG encoder (zlib only)."""
from pathlib import Path
import struct
import zlib

OUT = Path(__file__).resolve().parent.parent / "public" / "icons"
OUT.mkdir(parents=True, exist_ok=True)

BG: tuple[int, int, int] = (26, 46, 26)
NODE: tuple[int, int, int] = (74, 222, 128)
EDGE: tuple[int, int, int] = (91, 140, 91)
HIGHLIGHT: tuple[int, int, int] = (250, 204, 21)

def write_png(path: Path, pixels: list[list[tuple[int, int, int]]]) -> None:
    height = len(pixels)
    width = len(pixels[0])
    raw = bytearray()
    for row in pixels:
        raw.append(0)  # filter type None
        for r, g, b in row:
            raw.extend((r, g, b))
    compressed = zlib.compress(bytes(raw), level=9)

    def chunk(typ: bytes, data: bytes) -> bytes:
        return struct.pack(">I", len(data)) + typ + data + struct.pack(">I", zlib.crc32(typ + data) & 0xffffffff)

    header = struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0)
    out = b"\x89PNG\r\n\x1a\n"
    out += chunk(b"IHDR", header)
    out += chunk(b"IDAT", compressed)
    out += chunk(b"IEND", b"")
    path.write_bytes(out)

def draw_circle(pixels: list[list[tuple[int, int, int]]], cx: int, cy: int, radius: int, fill: tuple[int, int, int], outline: tuple[int, int, int] | None = None) -> None:
    size = len(pixels)
    r2 = radius * radius
    for y in range(max(0, cy - radius), min(size, cy + radius + 1)):
        for x in range(max(0, cx - radius), min(size, cy + radius + 1)):
            dx, dy = x - cx, y - cy
            if dx * dx + dy * dy <= r2:
                pixels[y][x] = fill
    if outline:
        for angle in range(0, 3600):
            rad = angle / 1800 * 3.141592653589793
            x = int(cx + radius * 0.98 * (rad))
            y = int(cy + radius * 0.98 * (rad))

def draw_line(pixels: list[list[tuple[int, int, int]]], x0: int, y0: int, x1: int, y1: int, color: tuple[int, int, int], width: int) -> None:
    size = len(pixels)
    steps = max(abs(x1 - x0), abs(y1 - y0)) + 1
    for i in range(steps):
        t = i / max(1, steps - 1)
        cx = int(x0 + (x1 - x0) * t)
        cy = int(y0 + (y1 - y0) * t)
        for dy in range(-width // 2, width // 2 + 1):
            for dx in range(-width // 2, width // 2 + 1):
                nx, ny = cx + dx, cy + dy
                if 0 <= nx < size and 0 <= ny < size:
                    pixels[ny][nx] = color

def build_icon(size: int) -> list[list[tuple[int, int, int]]]:
    pixels = [[BG for _ in range(size)] for _ in range(size)]
    cx, cy = size // 2, size // 2
    coords = [
        (cx, cy - size // 4),
        (cx - size // 3, cy + size // 5),
        (cx + size // 3, cy + size // 5),
    ]
    line_w = max(2, size // 32)
    node_r = max(size // 10, 8)
    for a, b in [(0, 1), (1, 2), (2, 0)]:
        draw_line(pixels, coords[a][0], coords[a][1], coords[b][0], coords[b][1], EDGE, line_w)
    for i, (x, y) in enumerate(coords):
        color = HIGHLIGHT if i == 0 else NODE
        draw_circle(pixels, x, y, node_r, color)
    return pixels

def save(name: str, size: int) -> None:
    pixels = build_icon(size)
    write_png(OUT / name, pixels)

save("icon-512.png", 512)
save("icon-192.png", 192)
save("apple-touch-icon.png", 180)
print(f"Icons written to {OUT}")
