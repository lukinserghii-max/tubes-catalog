"""Import every content page from the Ukrainian Tubes International PDF."""

from __future__ import annotations

import json
import multiprocessing
import os
import re
import sys
from collections import Counter
from pathlib import Path

import pymupdf


OUT = Path(__file__).parents[1] / "src" / "data"
DOCUMENT: pymupdf.Document | None = None
TOP_SECTIONS: list[tuple[int, str]] = []


def slugify(value: str) -> str:
    return re.sub(r"-+", "-", re.sub(r"[^\w]+", "-", value.lower(), flags=re.UNICODE)).strip("-_")


def clean_text(value: str) -> str:
    value = value.replace("\x00", " ").replace(" -\n", "")
    value = re.sub(r"(?<=\w)-\s*\n\s*(?=\w)", "", value)
    return re.sub(r"\s+", " ", value).strip()


def excerpt(value: str, title: str) -> str:
    value = value.replace(title, " ", 1)
    value = re.sub(r"\b(?:Індекс|Номенклатура)\b.*", "", value, flags=re.IGNORECASE)
    value = clean_text(value)
    return value[:420].rsplit(" ", 1)[0] + ("…" if len(value) > 420 else "")


def variant_indices(value: str) -> list[str]:
    candidates = re.findall(
        r"(?<![A-Z0-9])(?:[A-Z]{1,6})(?:-[A-Z0-9]{1,24}){1,8}\*?(?![A-Z0-9])",
        value.upper(),
    )
    ignored = ("ISO-", "DIN-", "EN-", "FDA-", "UL-", "PN-EN-")
    seen: set[str] = set()
    result: list[str] = []
    for candidate in candidates:
        candidate = candidate.rstrip("*")
        if candidate.startswith(ignored) or not any(character.isdigit() for character in candidate):
            continue
        if candidate not in seen and len(candidate) <= 64:
            seen.add(candidate)
            result.append(candidate)
    return result


def page_fields(page: pymupdf.Page, page_number: int) -> tuple[str, list[str], str, list[dict]]:
    rows: list[dict] = []
    image_boxes: list[list[float]] = []
    for block in page.get_text("dict", sort=True)["blocks"]:
        if block["type"] == 1:
            x0, y0, x1, y1 = block["bbox"]
            width, height = x1 - x0, y1 - y0
            if y0 >= 70 and width >= 20 and height >= 20 and width * height >= 1500:
                image_boxes.append([round(value, 2) for value in block["bbox"]])
            continue
        for line in block.get("lines", []):
            spans = line.get("spans", [])
            text = clean_text("".join(span["text"] for span in spans))
            if not text:
                continue
            rows.append({
                "text": text,
                "y": line["bbox"][1],
                "size": max(span["size"] for span in spans),
                "bold": any("Bold" in span["font"] for span in spans),
            })

    def at_y(low: float, high: float) -> str:
        return " ".join(row["text"] for row in rows if low <= row["y"] < high)

    section = at_y(15, 34) or "Каталог TUBES"
    breadcrumb = [part.strip() for part in at_y(34, 48).strip(" / ").split("/") if part.strip()]
    subsection = at_y(48, 68)
    category_path: list[str] = []
    for part in [section, *breadcrumb, subsection]:
        if part and (not category_path or part.casefold() != category_path[-1].casefold()):
            category_path.append(part)

    body = [row for row in rows if 74 <= row["y"] < 780]
    heading = next((row for row in body if row["bold"] and row["size"] >= 13.5), None)
    if heading is None:
        heading = next((row for row in body if row["bold"] and row["size"] >= 11.5), None)
    title = heading["text"] if heading else (subsection or section)
    if heading:
        following = [
            row["text"] for row in body
            if row is not heading
            and row["bold"]
            and abs(row["size"] - heading["size"]) < 0.2
            and 0 < row["y"] - heading["y"] <= 17
        ]
        if following:
            title = clean_text(" ".join([title, *following]))
    first_image_y = min((box[1] for box in image_boxes), default=0)
    main_images = [box for box in image_boxes if box[1] <= first_image_y + 30]
    image_crops = [
        {"src": f"/catalog-products/{page_number}-{index}.webp", "bbox": box}
        for index, box in enumerate(main_images, start=1)
    ]
    return title, category_path, section, image_crops


def page_tables(page: pymupdf.Page) -> list[list[list[str]]]:
    result: list[list[list[str]]] = []
    for table in page.find_tables().tables:
        matrix = [[clean_text(cell or "") for cell in row] for row in table.extract()]
        matrix = [row for row in matrix if any(row)]
        if not matrix:
            continue
        used_columns = [index for index in range(max(map(len, matrix))) if any(index < len(row) and row[index] for row in matrix)]
        trimmed = [[row[index] if index < len(row) else "" for index in used_columns] for row in matrix]
        if len(trimmed) >= 2 and len(trimmed[0]) >= 2:
            result.append(trimmed)
    return result


def init_worker(pdf_path: str, top_sections: list[tuple[int, str]]) -> None:
    global DOCUMENT, TOP_SECTIONS
    DOCUMENT = pymupdf.open(pdf_path)
    TOP_SECTIONS = top_sections


def parse_page(page_index: int) -> dict | None:
    if DOCUMENT is None:
        raise RuntimeError("PDF worker is not initialized")
    page = DOCUMENT[page_index - 1]
    catalog_text = clean_text(page.get_text("text", sort=True))
    if len(catalog_text) < 80:
        return None
    name, category_path, _, image_crops = page_fields(page, page_index)
    section = next(title for start, title in reversed(TOP_SECTIONS) if start <= page_index)
    category_path = [section, *category_path[1:]] if category_path else [section]
    product_id = f"{slugify(name) or 'produkt'}-p{page_index}"
    variants = variant_indices(catalog_text)
    return {
        "id": product_id,
        "slug": product_id,
        "name": name,
        "page": page_index,
        "categoryPath": category_path,
        "section": section,
        "excerpt": excerpt(catalog_text, name),
        "image": image_crops[0]["src"] if image_crops else "",
        "images": [crop["src"] for crop in image_crops],
        "imageCrops": image_crops,
        "tables": page_tables(page),
        "variants": [{"index": value, "label": value, "available": True} for value in variants],
        "source": {"title": "Каталог TUBES International UA", "page": page_index},
        "catalogText": catalog_text,
    }


def main(pdf_path: str) -> None:
    document = pymupdf.open(pdf_path)
    top_sections = [
        (page, re.sub(r"^\d+(?:\.\d+)?\s+", "", title))
        for level, title, page in document.get_toc()
        if level == 1
    ]
    page_count = document.page_count
    document.close()
    products: list[dict] = []
    categories: dict[tuple[str, ...], dict] = {}
    workers = min(4, os.cpu_count() or 1)
    with multiprocessing.Pool(workers, initializer=init_worker, initargs=(pdf_path, top_sections)) as pool:
        for completed, product in enumerate(pool.imap(parse_page, range(1, page_count + 1), chunksize=4), start=1):
            if product:
                products.append(product)
                for depth in range(1, len(product["categoryPath"]) + 1):
                    path = tuple(product["categoryPath"][:depth])
                    categories.setdefault(path, {"id": slugify("/".join(path)), "name": path[-1], "path": list(path), "page": product["page"]})
            if completed % 100 == 0:
                print(f"parsed={completed}/{page_count}", flush=True)

    index_products = [
        {key: value for key, value in product.items() if key not in {"catalogText", "tables", "imageCrops"}}
        for product in products
    ]
    counts = Counter(product["section"] for product in products)
    sections = [{"name": name, "slug": slugify(name), "count": count} for name, count in counts.most_common()]
    meta = {
        "source": Path(pdf_path).name,
        "pages": page_count,
        "products": len(products),
        "categories": len(categories),
        "language": "uk",
        "catalogYear": 2025,
    }

    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / "catalog-index.json").write_text(json.dumps({"meta": meta, "sections": sections, "categories": list(categories.values()), "products": index_products}, ensure_ascii=False), encoding="utf-8")
    (OUT / "catalog-content.json").write_text(json.dumps(products, ensure_ascii=False), encoding="utf-8")
    print(json.dumps(meta, ensure_ascii=False))


if __name__ == "__main__":
    if len(sys.argv) != 2:
        raise SystemExit("Pass the PDF path")
    main(sys.argv[1])
