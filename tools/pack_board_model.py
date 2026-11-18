#!/usr/bin/env python3
"""Compress a KiCad GLB into a script that works offline with the portfolio."""

import argparse
import base64
import gzip
from pathlib import Path


def encoded_glb(path):
    data = path.read_bytes()
    if data[:4] != b"glTF" or int.from_bytes(data[4:8], "little") != 2:
        raise ValueError(f"{path} must be a binary glTF 2.0 model")
    return base64.b64encode(gzip.compress(data, mtime=0)).decode("ascii")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("glb_file", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--light-model", type=Path, help="Optional simplified GLB for software-rendered views")
    options = parser.parse_args()
    try:
        data = f'window.portfolioPcbModel = "{encoded_glb(options.glb_file)}";\n'
        if options.light_model:
            data += f'window.portfolioPcbLightModel = "{encoded_glb(options.light_model)}";\n'
    except ValueError as error:
        parser.error(str(error))
    options.output.write_text(data, encoding="ascii")
