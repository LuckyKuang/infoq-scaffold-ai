#!/usr/bin/env python3
import argparse
import json
import re
import sys


def parse_args():
    parser = argparse.ArgumentParser(description="Recognize an InfoQ captcha image with ddddocr.")
    parser.add_argument("--image", required=True, help="Path to captcha image bytes.")
    return parser.parse_args()


def main():
    args = parse_args()
    try:
        import ddddocr
    except Exception as exc:
        raise RuntimeError(
            "Python package ddddocr is required. Install it with: python3 -m pip install ddddocr"
        ) from exc

    with open(args.image, "rb") as file:
        image_bytes = file.read()

    ocr = ddddocr.DdddOcr(show_ad=False)
    raw_text = ocr.classification(image_bytes)
    normalized_text = re.sub(r"\s+", "", str(raw_text or ""))

    print(json.dumps({"raw": raw_text, "text": normalized_text}, ensure_ascii=False))


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(json.dumps({"error": str(exc)}, ensure_ascii=False), file=sys.stderr)
        sys.exit(1)
