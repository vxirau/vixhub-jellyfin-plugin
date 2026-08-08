using System.Reflection;
using Jellyfin.Plugin.VixHub.Configuration;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Jellyfin.Plugin.VixHub.Controllers;

/// <summary>
/// Serves the VixHub web bundle from the installed plugin.
/// </summary>
[ApiController]
[Route("VixHub")]
public sealed class VixHubController : ControllerBase
{
    private static readonly IReadOnlyDictionary<string, string> ContentTypes =
        new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
        {
            ["vixhub.js"] = "text/javascript; charset=utf-8",
            ["vixhub.css"] = "text/css; charset=utf-8",
            ["vixhub-mark.png"] = "image/png",
            ["vixhub-splash-icon.png"] = "image/png",
            ["vixhub-splash-banner.png"] = "image/png",
            ["touchicon.png"] = "image/png",
            ["touchicon144.png"] = "image/png",
            ["favicon.ico"] = "image/x-icon",
            ["manifest.json"] = "application/manifest+json"
        };

    [HttpGet("Assets/{fileName}")]
    [AllowAnonymous]
    public IActionResult GetAsset(string fileName)
    {
        if (!ContentTypes.TryGetValue(fileName, out var contentType))
        {
            return NotFound();
        }

        var assembly = typeof(Plugin).Assembly;
        var suffix = ".Web." + fileName;
        var resourceName = assembly
            .GetManifestResourceNames()
            .FirstOrDefault(name => name.EndsWith(suffix, StringComparison.OrdinalIgnoreCase));
        if (resourceName is null)
        {
            return NotFound();
        }

        // The URLs injected into Jellyfin Web intentionally remain stable. Make every
        // client revalidate them so installing a newer plugin cannot leave an old CSS,
        // JavaScript, icon, or manifest cached for a week.
        var pluginVersion = assembly.GetName().Version?.ToString() ?? "unknown";
        var entityTag = $"\"vixhub-{pluginVersion}-{fileName.ToLowerInvariant()}\"";
        Response.Headers.ETag = entityTag;
        Response.Headers.CacheControl = "public, max-age=0, must-revalidate";

        if (Request.Headers.IfNoneMatch.Any(value =>
                string.Equals(value, entityTag, StringComparison.Ordinal)))
        {
            return StatusCode(304);
        }

        var stream = assembly.GetManifestResourceStream(resourceName);
        return stream is null ? NotFound() : File(stream, contentType);
    }

    [HttpGet("Settings")]
    [Authorize]
    [ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
    public ActionResult<PluginConfiguration> GetSettings()
    {
        return Plugin.Instance?.Configuration ?? new PluginConfiguration();
    }
}
