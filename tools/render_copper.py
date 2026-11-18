"""Make aligned web masks from front and back KiCad routing plots.

Use SVG plots from the same origin with Edge.Cuts and drill marks, viewed
from the front. Leave zones unfilled so the routed connections are visible.
Requires PyMuPDF and Pillow only when regenerating the bundled images.
"""

import argparse
from pathlib import Path
import re

from PIL import Image, ImageChops
import pymupdf


def routing_mask(plot):
    svg = plot.read_text(encoding="utf-8")
    # In KiCad's colour plots, white represents the hole in a pad or via.
    svg = re.sub(r"#[0-9a-fA-F]{6}", lambda m: "#000000" if m[0].upper() == "#FFFFFF" else "#FFFFFF", svg)
    with pymupdf.open(stream=svg.encode(), filetype="svg") as doc:
        pix = doc[0].get_pixmap(matrix=pymupdf.Matrix(3.6, 3.6), colorspace=pymupdf.csGRAY, alpha=True)
        # MuPDF premultiplies luminance by alpha, so empty space and drills are zero.
        return Image.frombytes("LA", (pix.width, pix.height), pix.samples).getchannel("L")


def render(front, back, destination):
    masks = [routing_mask(front), routing_mask(back)]
    if masks[0].size != masks[1].size:
        raise ValueError("Both plots must use the same page size and board origin.")
    bounds = ImageChops.lighter(*masks).getbbox()
    if not bounds:
        raise ValueError("The plots contain no visible copper.")
    for side, mask in zip(("front", "back"), masks):
        cropped = mask.crop(bounds)
        cropped.thumbnail((1400, 1400), Image.Resampling.LANCZOS)
        image = Image.new("RGBA", cropped.size, "white")
        image.putalpha(cropped)
        image.save(destination / f"copper-{side}.webp", lossless=True, method=6)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("front", type=Path)
    parser.add_argument("back", type=Path)
    parser.add_argument("destination", type=Path)
    args = parser.parse_args()
    render(args.front, args.back, args.destination)
