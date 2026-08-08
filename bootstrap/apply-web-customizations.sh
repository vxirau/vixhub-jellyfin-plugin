#!/bin/sh
set -eu

web_dir="${JELLYFIN_WEB_DIR:-/jellyfin/jellyfin-web}"
index_file="$web_dir/index.html"
marker='data-vixhub-plugin="1"'

if [ ! -f "$index_file" ]; then
    echo "VixHub bootstrap: Jellyfin Web index not found at $index_file" >&2
    exit 1
fi

# Remove both the original standalone overlay and any earlier plugin bootstrap.
# Every startup then injects one clean plugin-owned bundle reference.
sed -i -E \
    -e 's#<link data-vixhub-overlay="1"[^>]*>##g' \
    -e 's#<link data-vixhub-plugin="1"[^>]*>##g' \
    -e 's#<link[^>]+href="vixhub/slideshowpure[^"]*"[^>]*>##g' \
    -e 's#<link[^>]+href="vixhub/vixhub-media-performance[^"]*"[^>]*>##g' \
    -e 's#<link[^>]+href="vixhub/vixhub-hero[^"]*"[^>]*>##g' \
    -e 's#<link[^>]+href="/VixHub/Assets/vixhub.css[^"]*"[^>]*>##g' \
    -e 's#<script[^>]+src="vixhub/slideshowpure[^"]*"[^>]*></script>##g' \
    -e 's#<script[^>]+src="vixhub/vixhub-media-performance[^"]*"[^>]*></script>##g' \
    -e 's#<script[^>]+src="vixhub/vixhub-hero[^"]*"[^>]*></script>##g' \
    -e 's#<script[^>]+src="/VixHub/Assets/vixhub.js[^"]*"[^>]*></script>##g' \
    "$index_file"

sed -i -E \
    -e 's#<link rel="apple-touch-icon"[^>]*>#<link rel="apple-touch-icon" sizes="180x180" href="/VixHub/Assets/touchicon.png">#' \
    -e 's#<link rel="shortcut icon"[^>]*>#<link rel="shortcut icon" href="/VixHub/Assets/favicon.ico">#' \
    -e 's#<link rel="manifest"[^>]*>#<link rel="manifest" href="/VixHub/Assets/manifest.json">#' \
    -e 's#<meta name="msapplication-TileImage"[^>]*>#<meta name="msapplication-TileImage" content="/VixHub/Assets/touchicon144.png">#' \
    "$index_file"

sed -i \
    "s#</head>#<link $marker href=\"/VixHub/Assets/vixhub.css\" rel=\"stylesheet\"><script defer=\"defer\" src=\"/VixHub/Assets/vixhub.js\"></script></head>#" \
    "$index_file"

chmod 0644 "$index_file"
echo "VixHub bootstrap: plugin-owned web bundle linked into Jellyfin Web"

exec /jellyfin/jellyfin "$@"
