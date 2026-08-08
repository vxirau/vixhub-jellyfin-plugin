#!/usr/bin/env python3
"""Update the Jellyfin repository manifest from an exact release artifact."""

from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import json
from pathlib import Path


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--archive", required=True, type=Path)
    parser.add_argument("--manifest", default="manifest.json", type=Path)
    parser.add_argument("--version", required=True)
    args = parser.parse_args()

    checksum = hashlib.md5(args.archive.read_bytes(), usedforsecurity=False).hexdigest().upper()
    manifest = json.loads(args.manifest.read_text(encoding="utf-8"))
    release = manifest[0]["versions"][0]
    release["version"] = args.version
    release["sourceUrl"] = (
        "https://github.com/vxirau/vixhub-jellyfin-plugin/releases/download/"
        f"v{args.version}/vixhub-plugin_{args.version}.zip"
    )
    release["checksum"] = checksum
    release["timestamp"] = dt.datetime.now(dt.UTC).replace(microsecond=0).isoformat().replace("+00:00", "Z")
    args.manifest.write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(checksum)


if __name__ == "__main__":
    main()
