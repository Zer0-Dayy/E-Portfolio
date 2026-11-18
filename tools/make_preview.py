#!/usr/bin/env python3
"""Combine the three release pages into one portable HTML file."""

import argparse
import base64
from functools import cache
from mimetypes import guess_type
from pathlib import Path
import re


SITE = Path(__file__).resolve().parents[1] / "dist"
PAGE_IDS = {"index": "about", "projects": "projects", "cv": "cv"}
SCRIPT_TAG = re.compile(r'^  <script src="([^"]+)" defer></script>\n', re.MULTILINE)

ROUTER = """
(() => {
  const pages = [...document.querySelectorAll("main[data-preview-page]")];
  const navLinks = document.querySelectorAll(".site-nav a");
  const skipLink = document.querySelector(".skip-link");
  let activePage;

  function showRoute(moveFocus) {
    const fragment = location.hash.slice(1);
    const target = fragment ? document.getElementById(fragment) : null;
    const page = target?.closest("main[data-preview-page]") || pages[0];
    const changedPage = page !== activePage;

    for (const entry of pages) entry.hidden = entry !== page;
    for (const link of navLinks) {
      if (link.hash === "#" + page.id) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    }
    skipLink.hash = page.id;
    document.title = page.dataset.previewPage;
    activePage = page;

    if (moveFocus && target) target.focus({ preventScroll: true });
    if (target && target !== page) target.scrollIntoView();
    else if (changedPage || moveFocus) window.scrollTo(0, 0);
  }

  window.addEventListener("hashchange", () => showRoute(true));
  showRoute(false);
})();
"""


def read_text(path):
    return path.read_text(encoding="utf-8")


@cache
def asset_data_url(reference):
    asset = SITE / reference
    media_type = "font/woff" if asset.suffix == ".woff" else guess_type(asset.name)[0]
    if media_type is None:
        raise ValueError(f"Unrecognized media type for {reference}")
    payload = base64.b64encode(asset.read_bytes()).decode("ascii")
    return f"data:{media_type};base64,{payload}"


def main_fragment(markup, filename):
    match = re.search(r"<main\b[\s\S]*?</main>", markup)
    title = re.search(r"<title>([^<]+)</title>", markup)
    if match is None or title is None:
        raise ValueError(f"{filename}.html must contain a main element and a title")
    return match.group().replace("<main ", f'<main data-preview-page="{title[1]}" ', 1)


def create_preview():
    pages = {stem: read_text(SITE / f"{stem}.html") for stem in PAGE_IDS}
    combined = "\n\n".join(main_fragment(html, stem) for stem, html in pages.items())
    markup = re.sub(r"<main\b[\s\S]*?</main>", lambda _: combined, pages["index"], count=1)
    paths = dict.fromkeys(path for html in pages.values() for path in SCRIPT_TAG.findall(html))
    script_blocks = [read_text(SITE / path) for path in paths] + [ROUTER]
    if any(re.search(r"</script", block, re.IGNORECASE) for block in script_blocks):
        raise ValueError("A script contains an HTML end tag and cannot be inlined")
    markup = SCRIPT_TAG.sub("", markup)
    markup = re.sub(
        r'href="(index|projects|cv)\.html(#[^"]*)?"',
        lambda match: f'href="{match[2] or "#" + PAGE_IDS[match[1]]}"',
        markup,
    )
    markup = re.sub(
        r'(src|href)="(assets/[^"]+)"',
        lambda match: f'{match[1]}="{asset_data_url(match[2])}"',
        markup,
    )
    stylesheet = read_text(SITE / "styles.css")
    stylesheet = re.sub(
        r'url\("(assets/[^"]+)"\)',
        lambda match: f'url("{asset_data_url(match[1])}")',
        stylesheet,
    )
    markup = markup.replace('  <link rel="stylesheet" href="styles.css">', f"  <style>\n{stylesheet}  </style>")
    notices = "\n\n".join(read_text(path) for path in sorted((SITE / "assets/fonts").glob("*.txt")))
    markup = markup.replace("</head>", f"<!-- Bundled fonts are Latin subsets converted to WOFF.\n{notices}\n-->\n</head>")
    scripts = "".join(f"<script>\n{block}\n</script>\n" for block in script_blocks)
    return markup.replace("</body>", scripts + "</body>")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("output", type=Path, help="Path to write the standalone HTML file")
    args = parser.parse_args()
    args.output.write_text(create_preview(), encoding="utf-8")
