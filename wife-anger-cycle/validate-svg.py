#!/usr/bin/env python3
"""SVG Box-Text Fit Validator
Validates that SVG text fits within background rects and checks spacing.

Usage:
  python3 validate-svg.py [slide-01.html ...]  # check specific files
  python3 validate-svg.py                      # check all slide-*.html in cwd
"""
import re, sys, os, glob

# --- Configuration ---
MIN_H_PADDING = 2    # vertical padding inside rect (px each side) - SVG text has built-in ascent
MIN_W_PADDING = 8    # horizontal padding inside rect (px each side)
MIN_BOX_GAP = 10     # minimum vertical gap between consecutive boxes
TIGHT_RATIO = 0.90   # warn if text uses >90% of box space
# -------------------

def text_width(content, font_size):
    w = 0
    for ch in content:
        cp = ord(ch)
        if cp > 0x2000:
            w += font_size * 1.05
        elif ch == ' ':
            w += font_size * 0.3
        else:
            w += font_size * 0.55
    return w

def text_height(font_size):
    return font_size * 1.2

def check_slide(fname):
    with open(fname) as f:
        c = f.read()
    lines = c.split('\n')
    issues = []
    rects = []

    for j, line in enumerate(lines):
        rm = re.search(r'<rect x="(\d+)" y="(\d+)" width="(\d+)" height="(\d+)"', line)
        if not rm:
            continue
        rx, ry, rw, rh = int(rm.group(1)), int(rm.group(2)), int(rm.group(3)), int(rm.group(4))
        rects.append((rx, ry, rw, rh))

        # Check next line for text
        if j + 1 >= len(lines):
            continue
        tm = re.search(r'font-size="(\d+)"[^>]*>([^<]+)</text>', lines[j + 1])
        if not tm:
            continue
        fs = int(tm.group(1))
        label = tm.group(2)
        tw = text_width(label, fs)
        th = text_height(fs)

        # Width check
        needed_w = tw + MIN_W_PADDING
        if needed_w > rw:
            issues.append(("OVERFLOW_W", f"box w={rw}, text~{tw:.0f}px, need {needed_w}px | '{label[:25]}'"))
        elif tw + MIN_W_PADDING > rw * TIGHT_RATIO:
            issues.append(("TIGHT_W", f"box w={rw}, text~{tw:.0f}px ({tw+MIN_W_PADDING}/{rw}={100*(tw+MIN_W_PADDING)/rw:.0f}%) | '{label[:25]}'"))

        # Height check
        needed_h = th + MIN_H_PADDING
        if needed_h > rh:
            issues.append(("OVERFLOW_H", f"box h={rh}, text h~{th:.0f}px, need {needed_h}px | '{label[:25]}'"))
        elif needed_h > rh * TIGHT_RATIO:
            issues.append(("TIGHT_H", f"box h={rh}, text h~{th:.0f}px ({needed_h}/{rh}={100*needed_h/rh:.0f}%) | '{label[:25]}'"))

    # Vertical gap check
    for k in range(1, len(rects)):
        prev_bottom = rects[k-1][1] + rects[k-1][3]
        curr_top = rects[k][1]
        gap = curr_top - prev_bottom
        if 0 < gap < MIN_BOX_GAP:
            issues.append(("TIGHT_GAP", f"gap={gap}px between rect{k-1} and rect{k}"))

    return issues

def main():
    files = sys.argv[1:] if len(sys.argv) > 1 else sorted(glob.glob("slide-*.html"))
    if not files:
        print("No slide files found.")
        sys.exit(1)

    total_issues = 0
    all_ok = True
    for fname in files:
        if not os.path.exists(fname):
            print(f"⚠️ {fname}: not found")
            continue
        result = check_slide(fname)
        if result:
            all_ok = False
            print(f"\n=== {fname} ===")
            for severity, msg in result:
                icon = "❌" if severity.startswith("OVERFLOW") else "⚠️"
                print(f"  {icon} {msg}")
                total_issues += 1
        else:
            print(f"✅ {fname}")

    print(f"\n{'='*40}")
    if all_ok:
        print("✅ All slides pass validation!")
    else:
        print(f"❌ {total_issues} issue(s) found in {sum(1 for f in files if check_slide(f))} file(s)")
        sys.exit(1)

if __name__ == "__main__":
    main()
