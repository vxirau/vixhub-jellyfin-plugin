#!/bin/sh
set -eu

repo_dir=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
version="${VIXHUB_VERSION:-0.6.8.0}"
artifact_dir="$repo_dir/artifacts"
publish_dir="$artifact_dir/publish"
package_file="$artifact_dir/vixhub-plugin_$version.zip"

rm -rf "$publish_dir"
mkdir -p "$publish_dir"

dotnet publish \
    "$repo_dir/Jellyfin.Plugin.VixHub/Jellyfin.Plugin.VixHub.csproj" \
    --configuration Release \
    --output "$publish_dir"

rm -f "$package_file"
(
    cd "$publish_dir"
    zip -q -j "$package_file" Jellyfin.Plugin.VixHub.dll
)

cp "$repo_dir/bootstrap/apply-web-customizations.sh" "$artifact_dir/apply-web-customizations.sh"
chmod 0755 "$artifact_dir/apply-web-customizations.sh"

printf 'Package: %s\n' "$package_file"
printf 'MD5: '
if command -v md5sum >/dev/null 2>&1; then
    md5sum "$package_file" | awk '{print toupper($1)}'
else
    md5 -q "$package_file" | tr '[:lower:]' '[:upper:]'
fi
