#!/usr/bin/env python3
"""Scale all fonts to 1.8x from original, SVG boxes proportionally."""
import re

def r(v, f=1.8):
    return int(v * f)

def scale_css(content):
    """Scale CSS font-size values in <style> block."""
    def repl(m):
        return f'font-size:{r(int(m.group(1)))}px'
    parts = content.split('<style>')
    if len(parts) < 2:
        return content
    style_parts = parts[1].split('</style>')
    s = style_parts[0]
    s = re.sub(r'font-size:(\d+)px', repl, s)
    # Scale spacing proportionally
    spacing = [
        ('margin-bottom:16px', r(16)), ('margin-bottom:20px', r(20)),
        ('margin-bottom:24px', r(24)), ('margin-bottom:28px', r(28)),
        ('margin-bottom:32px', r(32)), ('margin-bottom:48px', r(48)),
        ('margin-top:4px', r(4)), ('margin-top:8px', r(8)),
        ('margin-top:12px', r(12)), ('margin-top:16px', r(16)),
        ('margin-top:20px', r(20)), ('margin-top:72px', r(72)),
        ('margin:14px 0', r(14)), ('margin:20px 0', r(20)),
        ('margin:24px 0', r(24)), ('margin:48px 0', r(48)),
        ('margin:8px 0', r(8)),
        ('padding:56px 64px', f'{r(56)}px {r(64)}px'),
        ('padding:48px 56px', f'{r(48)}px {r(56)}px'),
        ('padding:28px 32px', f'{r(28)}px {r(32)}px'),
        ('padding:20px 28px', f'{r(20)}px {r(28)}px'),
        ('padding:32px', f'{r(32)}px'), ('padding:20px', f'{r(20)}px'),
        ('bottom:32px;left:64px', f'bottom:{r(32)}px;left:{r(64)}px'),
        ('bottom:24px;left:56px', f'bottom:{r(24)}px;left:{r(56)}px'),
        ('gap:20px', r(20)), ('gap:16px', r(16)),
        ('letter-spacing:4px', r(4)),
        ('height:2px', f'height:{r(2)}px'),
        ('height:3px', f'height:{r(3)}px'),
        ('border-radius:16px', r(16)), ('border-radius:14px', r(14)),
        ('border-radius:12px', r(12)), ('border-radius:20px', r(20)),
        ('line-height:1.9', '1.75'), ('line-height:1.8', '1.65'),
        ('line-height:2.2', '2.0'), ('line-height:2', '1.85'),
        ('opacity:.1;margin:20px 0 32px', f'opacity:.1;margin:{r(20)}px 0 {r(32)}px'),
        ('opacity:.1;margin:16px 0 18px', f'opacity:.1;margin:{r(16)}px 0 {r(18)}px'),
    ]
    for old, new in spacing:
        s = s.replace(old, str(new))
    style_parts[0] = s
    parts[1] = '</style>'.join(style_parts)
    return '<style>'.join(parts)

def scale_inline(content, factor=1.8):
    """Scale font-size in inline styles (outside <style> block)."""
    def repl(m):
        return f'{m.group(1)}font-size:{r(int(m.group(2)), factor)}px'
    parts = content.split('<style>')
    if len(parts) > 1:
        rest = parts[1].split('</style>', 1)
        if len(rest) > 1:
            rest[1] = re.sub(r'(style="[^"]*?)font-size:(\d+)px', repl, rest[1])
            parts[1] = '</style>'.join(rest)
    else:
        content = re.sub(r'(style="[^"]*?)font-size:(\d+)px', repl, content)
    return '<style>'.join(parts) if len(parts) > 1 else content

def scale_svg_fonts(content, factor=1.8):
    """Scale font-size in SVG text elements."""
    def repl(m):
        return f'{m.group(1)}font-size="{r(int(m.group(2)), factor)}"'
    return re.sub(r'(<text[^>]*?\s)font-size="(\d+)"', repl, content)

def scale_svg_attrs(content, attrs_factor_map):
    """Scale specific SVG numeric attributes. Must match ' attr="' to avoid false positives like viewBox."""
    for attr, factor in attrs_factor_map.items():
        def repl(m, a=attr, f=factor):
            prefix = m.group(1)
            vals = m.group(2).split()
            new_vals = []
            for v in vals:
                try:
                    new_vals.append(str(round(float(v) * f)))
                except ValueError:
                    new_vals.append(v)
            return f'{prefix}{a}="{" ".join(new_vals)}"'
        # Match ' attr="' at word boundary to avoid matching inside other attributes
        content = re.sub(rf'(?<=\s)({attr}=")([^"]+)(")', repl, content)
    return content

def process_svg_slide(content, font_scale=1.8):
    """Process slides with SVG: compress layout, enlarge text."""
    content = scale_css(content)
    content = scale_inline(content, font_scale)
    
    # Scale viewBox only (NOT element width/height — keep pixel size the same)
    # Larger viewBox = zoom out, content appears smaller
    # We want content bigger, so we DON'T scale viewBox up.
    # Instead: scale viewBox UP by svg_scale (content appears same size),
    # scale coordinates by svg_scale (content occupies same proportion),
    # then scale fonts additionally by font_scale/svg_scale for total font_scale effect.
    # 
    # Wait — that gives identical visual. 
    # 
    # CORRECT approach: Keep viewBox the SAME. Scale coordinates DOWN by 1/svg_scale
    # (so content is more compact). Scale fonts by font_scale.
    # This way: layout is compressed but text is bigger.
    #
    # Actually simpler: just scale viewBox up by svg_scale, keep coordinates the same.
    # Content appears smaller (zoomed out), but then we scale fonts to compensate.
    # Net font = font_scale, net layout = 1/svg_scale (more compact).
    
    # DON'T touch viewBox or SVG element dimensions.
    # Just scale coordinates down to compress layout, and scale fonts up.
    
    # Scale all coordinate/size attributes DOWN by 1/1.3 to compress layout
    # Exclude SVG element's own width/height (only scale inside elements like rect, line, text)
    layout_shrink = 1 / 1.3
    for attr in ['x', 'y', 'x1', 'y1', 'x2', 'y2']:
        content = scale_svg_attrs(content, {attr: layout_shrink})
    # For width/height, only match inside rect/circle etc (not on <svg> tag)
    # We'll handle these manually to avoid touching <svg width="960">
    for tag in ['rect']:
        def scale_rect_wh(m, f=layout_shrink):
            return f'<rect{m.group(1)}width="{round(float(m.group(2))*f)}"{m.group(3)}height="{round(float(m.group(4))*f)}"'
        content = re.sub(
            r'(<rect[^>]*?)width="(\d+)"([^>]*?)height="(\d+)"',
            scale_rect_wh, content
        )
    # rx/ry on rects
    content = re.sub(
        r'(<rect[^>]*?)rx="(\d+)"',
        lambda m: f'{m.group(1)}rx="{round(float(m.group(2))*layout_shrink)}"',
        content
    )
    # Keep stroke-width the same (not too thin)
    
    # Scale SVG text by font_scale (direct, since viewBox unchanged)
    content = scale_svg_fonts(content, font_scale)
    
    return content

for i in range(1, 10):
    fname = f"slide-{i:02d}.html"
    with open(fname) as f:
        c = f.read()
    
    if i == 1:
        c = scale_css(c)
        c = scale_inline(c)
        c = c.replace('font-size:140px', f'font-size:{r(140)}px')
        c = c.replace('width:100px;height:3px', f'width:{r(100)}px;height:{r(3)}px')
        c = c.replace('margin-bottom:20px', f'margin-bottom:{r(20)}px')
        c = c.replace('margin-bottom:48px', f'margin-bottom:{r(48)}px')
        c = c.replace('margin:0 auto 36px', f'margin:0 auto {r(36)}px')
    elif i == 2:
        c = scale_css(c)
        c = scale_inline(c)
        c = c.replace('font-size:90px', f'font-size:{r(90)}px')
        c = c.replace('margin-top:12px', f'margin-top:{r(12)}px')
    elif i == 3:
        c = process_svg_slide(c, font_scale=1.8)
    elif i in [4, 5, 6, 7, 8]:
        c = process_svg_slide(c, font_scale=1.8)
    elif i == 9:
        def repl(m):
            return f'{m.group(1)}font-size:{r(int(m.group(2)))}px'
        c = re.sub(r'(style="[^"]*?)font-size:(\d+)px', repl, c)
        c = c.replace('margin-bottom:20px', f'margin-bottom:{r(20)}px')
        c = c.replace('margin-top:72px', f'margin-top:{r(72)}px')
        c = c.replace('width:580px;height:380px', f'width:{r(580)}px;height:{r(380)}px')
        c = c.replace('border-radius:20px', f'border-radius:{r(20)}px')
        c = c.replace('bottom:36px;right:64px', f'bottom:{r(36)}px;right:{r(64)}px')
        c = c.replace('bottom:36px;left:64px', f'bottom:{r(36)}px;left:{r(64)}px')
    
    with open(fname, 'w') as f:
        f.write(c)
    print(f"✅ {fname}")

print("\nDone!")
