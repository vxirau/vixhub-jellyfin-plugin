# VixHub · Plugin

VixHub packages a personalized Jellyfin home experience as one versioned release:

- a Jellyfin server plugin that owns settings and serves the web assets;
- a small, idempotent Jellyfin Web bootstrap;
- a fast recommendation hero with local-trailer playback when available;
- persistent VixHub branding, favicons, navigation, and icons;
- a fixed, high-performance discovery home backed by the local Jellyfin library;
- Live TV navigation and discovery when a tuner is configured;
- personalized recommendations that exclude titles the current user has watched;
- a coherent web design system for cards, controls, menus, dialogs, forms, and details.

The plugin targets Jellyfin Server 12 and `net10.0`. Version `0.6.8.0` has
been validated with Jellyfin Server `12.0.0-rc4`.

## Why there is a bootstrap

Jellyfin plugins can expose APIs, settings pages, and static resources, but Jellyfin Web does not currently provide a stable frontend-plugin loader. The bootstrap only adds two stable references to `index.html` and points the existing favicon/manifest tags at the plugin. All UI behavior and styling remain embedded in the plugin DLL. Plugin assets carry a version-derived ETag and require revalidation, so installing a new plugin cannot strand clients on stale CSS, JavaScript, or branding.

The bootstrap is reapplied at container start, so replacing or recreating the Jellyfin image does not remove VixHub. It is idempotent and removes older VixHub/SlideshowPure injections before adding the current bundle. Both the plugin directory and bootstrap must be mounted from persistent storage; nothing important lives in the container's writable layer.

## Client support

- Jellyfin Web and clients built around Jellyfin Web receive the full hero, navbar, branding, and custom sections.
- Fully native television and mobile clients continue to use the standard Jellyfin APIs and playback behavior. They are not modified by the web bundle.
- Local hero trailers use same-server media only. The plugin does not add YouTube embeds, tracking scripts, CDNs, or automatic trailer transcoding.

## Build

Requires the .NET 10 SDK:

```sh
./scripts/package.sh
```

The package is written to `artifacts/vixhub-plugin_0.6.8.0.zip`.

## Plugin repository

After the first release is published, add this URL to Jellyfin's plugin repositories:

```text
https://raw.githubusercontent.com/vxirau/vixhub-jellyfin-plugin/main/manifest.json
```

Jellyfin can then update the server plugin through its normal plugin update task. The persistent bootstrap continues pointing at the versioned assets embedded in whichever plugin version is installed.

## Manual development installation

1. Extract the plugin ZIP into the Jellyfin plugin directory as `VixHub Plugin_0.6.8.0`.
2. Place `bootstrap/apply-web-customizations.sh` on persistent storage.
3. Start the Jellyfin container through that script:

   ```yaml
   entrypoint:
     - /bin/sh
     - /opt/vixhub/apply-web-customizations.sh
   volumes:
     - /persistent/vixhub:/opt/vixhub:ro
   ```

4. Restart Jellyfin and force-refresh Jellyfin Web once.

If the plugin is absent or fails to load, the VixHub asset requests return `404` and the standard Jellyfin interface remains usable.

## Repository layout

```text
Jellyfin.Plugin.VixHub/  Server plugin, settings page, and embedded web bundle
bootstrap/               Update-safe Jellyfin Web loader
scripts/                 Reproducible package tooling
```

## License

GPL-3.0-only, matching Jellyfin's plugin linkage requirements.
