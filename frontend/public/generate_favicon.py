"""Generate MotoSync favicon.ico (32x32 and 16x16) using only stdlib."""
import struct, zlib, io

def make_png(size):
    # Draw a simple motorcycle icon on black+aqua
    w = h = size
    s = size // 32  # scale factor
    # RGBA pixel grid
    img = [[(0,0,0,255)] * w for _ in range(h)]
    aqua = (0, 229, 255, 255)
    white = (255, 255, 255, 255)
    dim = (0, 180, 200, 180)

    def fill_circle(cx, cy, r, color, border=None, bw=0):
        for y in range(h):
            for x in range(w):
                dx, dy = x - cx, y - cy
                dist = (dx*dx + dy*dy) ** 0.5
                if border and abs(dist - r) < bw:
                    img[y][x] = border
                elif dist <= r - bw:
                    if color:
                        img[y][x] = color

    def draw_line(x0, y0, x1, y1, color, thickness=1):
        dx, dy = x1-x0, y1-y0
        steps = max(abs(dx), abs(dy))
        if steps == 0:
            return
        for i in range(steps+1):
            fx = int(x0 + dx*i/steps)
            fy = int(y0 + dy*i/steps)
            for ty in range(-thickness, thickness+1):
                for tx in range(-thickness, thickness+1):
                    ny, nx = fy+ty, fx+tx
                    if 0 <= ny < h and 0 <= nx < w:
                        img[ny][nx] = color

    cx, cy = w//2, h//2

    # Outer ring
    fill_circle(cx, cy, cx-1, None, aqua, max(1, s))

    # Rear wheel  (left)
    rw_cx, rw_cy = int(cx * 0.55), int(cy * 1.15)
    fill_circle(rw_cx, rw_cy, int(w*0.22), None, aqua, max(1,s))
    fill_circle(rw_cx, rw_cy, int(w*0.06), aqua, None, 0)

    # Front wheel (right)
    fw_cx, fw_cy = int(cx * 1.38), int(cy * 1.15)
    fill_circle(fw_cx, fw_cy, int(w*0.22), None, aqua, max(1,s))
    fill_circle(fw_cx, fw_cy, int(w*0.06), aqua, None, 0)

    t = max(1, s)
    # Frame
    draw_line(rw_cx, rw_cy, cx, int(cy*0.72), aqua, t)
    draw_line(cx, int(cy*0.72), fw_cx, fw_cy, aqua, t)
    draw_line(cx, int(cy*0.72), fw_cx, int(cy*0.55), aqua, t)

    # Seat
    draw_line(int(cx*0.85), int(cy*0.72), int(cx*1.1), int(cy*0.72), aqua, max(1,t))

    # GPS dot at top
    gps_y = int(cy*0.35)
    fill_circle(cx, gps_y, max(2,s*2), aqua, None, 0)

    # Encode PNG
    def pack_png_chunk(name, data):
        c = zlib.crc32(name + data) & 0xffffffff
        return struct.pack('>I', len(data)) + name + data + struct.pack('>I', c)

    raw = b''
    for row in img:
        raw += b'\x00'
        for r,g,b,a in row:
            raw += bytes([r,g,b,a])
    compressed = zlib.compress(raw, 9)

    png = b'\x89PNG\r\n\x1a\n'
    png += pack_png_chunk(b'IHDR', struct.pack('>IIBBBBB', w, h, 8, 2, 0, 0, 0)[:13])
    # Actually IHDR is colortype=6 (RGBA)
    png = b'\x89PNG\r\n\x1a\n'
    ihdr = struct.pack('>II', w, h) + bytes([8, 6, 0, 0, 0])
    png += pack_png_chunk(b'IHDR', ihdr)
    png += pack_png_chunk(b'IDAT', compressed)
    png += pack_png_chunk(b'IEND', b'')
    return png

# Write favicon.ico with two sizes (16x16 and 32x32)
p16 = make_png(16)
p32 = make_png(32)

def write_ico(images):
    n = len(images)
    # ICO header
    ico = struct.pack('<HHH', 0, 1, n)
    offset = 6 + n * 16
    sizes = []
    for img_bytes in images:
        # Read W/H from PNG header
        w = struct.unpack('>I', img_bytes[16:20])[0]
        h = struct.unpack('>I', img_bytes[20:24])[0]
        sizes.append((w, h, len(img_bytes), offset))
        offset += len(img_bytes)
    for w, h, sz, off in sizes:
        ico += struct.pack('<BBBBHHII',
            w if w < 256 else 0,
            h if h < 256 else 0,
            0, 0, 1, 32, sz, off)
    for img_bytes in images:
        ico += img_bytes
    return ico

ico_data = write_ico([p16, p32])
with open('favicon.ico', 'wb') as f:
    f.write(ico_data)

# Also write standalone PNGs
with open('favicon-32.png', 'wb') as f:
    f.write(p32)

print("favicon.ico + favicon-32.png generated successfully")
