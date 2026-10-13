#!/usr/bin/env python3
"""Builds SyncDeck/Localizable.xcstrings from scripts/translations.tsv and
copies the shared provider presets catalogue into the app.

The English source strings are the keys used in the Swift code. Add a row to
the TSV (tab separated, one column per language) when adding UI text, then run
this script. Keys listed in KEEP are brand names or symbols and stay as is.
"""
import csv
import json
import pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
TSV = ROOT / "scripts" / "translations.tsv"
OUT = ROOT / "SyncDeck" / "Localizable.xcstrings"
PRESETS_SRC = ROOT.parent.parent / "sources" / "provider-presets.json"
PRESETS_OUT = ROOT / "SyncDeck" / "provider-presets.json"
KEEP = {"", "%@:", "%lld%%", "rclone.org", "sidrelabs.com/syncdeck", '--exclude "*.tmp" --transfers 2'}


def unescape(text: str) -> str:
    return text.replace("\\\\", "\\")


def main() -> None:
    with TSV.open(encoding="utf-8") as handle:
        rows = list(csv.reader(handle, delimiter="\t", quoting=csv.QUOTE_NONE))
    header, body = rows[0], rows[1:]
    languages = header[1:]
    strings = {}
    for row in body:
        if len(row) != len(header):
            raise SystemExit(f"bad column count for {row[0]!r}: {len(row)}")
        key = unescape(row[0])
        strings[key] = {
            "localizations": {
                lang: {"stringUnit": {"state": "translated", "value": unescape(value)}}
                for lang, value in zip(languages, row[1:])
            }
        }
    for key in KEEP:
        strings[key] = {"shouldTranslate": False}
    catalog = {"sourceLanguage": "en", "strings": dict(sorted(strings.items())), "version": "1.0"}
    OUT.write_text(json.dumps(catalog, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"{len(strings)} strings x {len(languages)} languages -> {OUT.relative_to(ROOT)}")

    # The well-known services catalogue is shared with the desktop app; the
    # app bundle gets a copy (SyncDeckTests checks it matches the source).
    PRESETS_OUT.write_bytes(PRESETS_SRC.read_bytes())
    print(f"{PRESETS_SRC.name} -> {PRESETS_OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
