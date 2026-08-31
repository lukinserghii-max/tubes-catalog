"""Render product images using the exact image boundaries stored by the importer."""

from __future__ import annotations

import json
import sys
from io import BytesIO
from pathlib import Path

import pymupdf
from PIL import Image


def main(pdf_path: str, force: bool = False) -> None:
    root = Path(__file__).parents[1]
    products = json.loads((root / "src" / "data" / "catalog-content.json").read_text(encoding="utf-8"))
    output = root / "public" / "catalog-products"
    output.mkdir(parents=True, exist_ok=True)
    document = pymupdf.open(pdf_path)
    expected: set[str] = set()
    total = sum(len(product.get("imageCrops", [])) for product in products)
    rendered = 0

    for product in products:
        page = document[int(product["page"]) - 1]
        for crop in product.get("imageCrops", []):
            target = root / "public" / crop["src"].lstrip("/")
            expected.add(target.name)
            if force or not target.exists():
                pixmap = page.get_pixmap(matrix=pymupdf.Matrix(2, 2), clip=pymupdf.Rect(crop["bbox"]), alpha=False)
                image = Image.open(BytesIO(pixmap.tobytes("png"))).convert("RGB")
                image.save(target, format="WEBP", quality=82, method=4)
            rendered += 1
            if rendered % 100 == 0 or rendered == total:
                print(f"{rendered}/{total}", flush=True)

    for stale in output.glob("*.webp"):
        if stale.name not in expected:
            stale.unlink()

    old_output = root / "public" / "catalog-pages"
    if old_output.exists() and old_output.parent == root / "public":
        for old_file in old_output.glob("*.webp"):
            old_file.unlink()
        old_output.rmdir()
        print("removed=public/catalog-pages", flush=True)
    print(f"rendered={rendered}")


if __name__ == "__main__":
    if len(sys.argv) not in (2, 3):
        raise SystemExit("Pass the PDF path and optional --force")
    main(sys.argv[1], "--force" in sys.argv[2:])
