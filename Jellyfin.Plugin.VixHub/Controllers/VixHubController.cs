using System.Reflection;
using System.Net.Http.Headers;
using System.Text.Json;
using Jellyfin.Data;
using Jellyfin.Database.Implementations.Enums;
using Jellyfin.Plugin.VixHub.Configuration;
using MediaBrowser.Common.Api;
using MediaBrowser.Controller.Library;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace Jellyfin.Plugin.VixHub.Controllers;

/// <summary>
/// Serves the VixHub web bundle from the installed plugin.
/// </summary>
[ApiController]
[Route("VixHub")]
public sealed class VixHubController : ControllerBase
{
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly IUserManager _userManager;

    public VixHubController(
        IHttpClientFactory httpClientFactory,
        IUserManager userManager)
    {
        _httpClientFactory = httpClientFactory;
        _userManager = userManager;
    }

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
        // Include the build MVID as well as the public version. This keeps normal update
        // caching efficient while ensuring a rebuilt candidate of the same version is
        // never mistaken for the previous bundle during validation or rollback.
        var buildId = assembly.ManifestModule.ModuleVersionId.ToString("N");
        var entityTag = $"\"vixhub-{pluginVersion}-{buildId}-{fileName.ToLowerInvariant()}\"";
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
    public ActionResult<object> GetSettings()
    {
        var configuration = Plugin.Instance?.Configuration ?? new PluginConfiguration();
        return Ok(new
        {
            configuration.EnableHero,
            configuration.EnableNavbar,
            configuration.EnableHomeSections,
            configuration.EnableDiscovery,
            configuration.LockHomeLayout,
            configuration.EnableLocalTrailerVideo,
            configuration.HeroHeightVh,
            configuration.SeerrUrl,
            SeerrConfigured = !string.IsNullOrWhiteSpace(configuration.SeerrApiKey)
        });
    }

    [HttpGet("LiveTvPrograms")]
    [Authorize(Policy = Policies.LiveTvAccess)]
    [ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
    public async Task<IActionResult> GetLiveTvPrograms(
        [FromQuery] int limit = 18,
        CancellationToken cancellationToken = default)
    {
        var configuration = Plugin.Instance?.Configuration;
        var guideUser = _userManager.GetUsers()
            .FirstOrDefault(user => user.HasPermission(PermissionKind.IsAdministrator));
        if (configuration is null ||
            guideUser is null ||
            string.IsNullOrWhiteSpace(configuration.JellyfinApiKey) ||
            !Uri.TryCreate(configuration.JellyfinUrl, UriKind.Absolute, out var baseUri) ||
            (baseUri.Scheme != Uri.UriSchemeHttp && baseUri.Scheme != Uri.UriSchemeHttps))
        {
            return StatusCode(StatusCodes.Status503ServiceUnavailable);
        }

        var relativePath = "/LiveTv/Programs?" + string.Join("&",
        [
            $"UserId={guideUser.Id:N}",
            "IsAiring=true",
            $"Limit={Math.Clamp(limit, 1, 36)}",
            "ImageTypeLimit=1",
            "EnableImageTypes=Primary,Thumb,Backdrop",
            "EnableTotalRecordCount=true",
            "Fields=ChannelInfo,PrimaryImageAspectRatio,Overview"
        ]);
        using var response = await SendJellyfinRequest(
            baseUri,
            configuration.JellyfinApiKey,
            HttpMethod.Get,
            relativePath,
            cancellationToken).ConfigureAwait(false);
        if (!response.IsSuccessStatusCode)
        {
            return StatusCode((int)response.StatusCode);
        }

        var content = await response.Content.ReadAsStringAsync(cancellationToken).ConfigureAwait(false);
        if (!HasItems(content) &&
            !await HasLiveTvChannels(baseUri, configuration.JellyfinApiKey, guideUser.Id, cancellationToken)
                .ConfigureAwait(false) &&
            await RefreshLiveTvGuide(baseUri, configuration.JellyfinApiKey, cancellationToken).ConfigureAwait(false))
        {
            using var retry = await SendJellyfinRequest(
                baseUri,
                configuration.JellyfinApiKey,
                HttpMethod.Get,
                relativePath,
                cancellationToken).ConfigureAwait(false);
            if (retry.IsSuccessStatusCode)
            {
                content = await retry.Content.ReadAsStringAsync(cancellationToken).ConfigureAwait(false);
            }
        }
        return Content(content, response.Content.Headers.ContentType?.ToString() ?? "application/json");
    }

    private static bool HasItems(string content)
    {
        try
        {
            using var document = JsonDocument.Parse(content);
            return document.RootElement.TryGetProperty("Items", out var items) && items.GetArrayLength() > 0;
        }
        catch (JsonException)
        {
            return false;
        }
    }

    private async Task<bool> HasLiveTvChannels(
        Uri baseUri,
        string apiKey,
        Guid userId,
        CancellationToken cancellationToken)
    {
        using var response = await SendJellyfinRequest(
            baseUri,
            apiKey,
            HttpMethod.Get,
            $"/LiveTv/Channels?UserId={userId:N}&Limit=1&EnableTotalRecordCount=true",
            cancellationToken).ConfigureAwait(false);
        return response.IsSuccessStatusCode &&
            HasItems(await response.Content.ReadAsStringAsync(cancellationToken).ConfigureAwait(false));
    }

    private async Task<bool> RefreshLiveTvGuide(
        Uri baseUri,
        string apiKey,
        CancellationToken cancellationToken)
    {
        using var tasksResponse = await SendJellyfinRequest(
            baseUri,
            apiKey,
            HttpMethod.Get,
            "/ScheduledTasks",
            cancellationToken).ConfigureAwait(false);
        if (!tasksResponse.IsSuccessStatusCode)
        {
            return false;
        }

        using var tasks = JsonDocument.Parse(
            await tasksResponse.Content.ReadAsStringAsync(cancellationToken).ConfigureAwait(false));
        var refreshTask = tasks.RootElement.EnumerateArray().FirstOrDefault(task =>
            task.TryGetProperty("Key", out var key) && key.GetString() == "RefreshGuide");
        if (refreshTask.ValueKind == JsonValueKind.Undefined ||
            !refreshTask.TryGetProperty("Id", out var idElement) ||
            string.IsNullOrWhiteSpace(idElement.GetString()))
        {
            return false;
        }

        using var trigger = await SendJellyfinRequest(
            baseUri,
            apiKey,
            HttpMethod.Post,
            $"/ScheduledTasks/Running/{idElement.GetString()}",
            cancellationToken).ConfigureAwait(false);
        if (!trigger.IsSuccessStatusCode)
        {
            return false;
        }

        await Task.Delay(TimeSpan.FromSeconds(6), cancellationToken).ConfigureAwait(false);
        return true;
    }

    private async Task<HttpResponseMessage> SendJellyfinRequest(
        Uri baseUri,
        string apiKey,
        HttpMethod method,
        string relativePath,
        CancellationToken cancellationToken)
    {
        using var request = new HttpRequestMessage(method, new Uri(baseUri, relativePath));
        request.Headers.TryAddWithoutValidation("Authorization", $"MediaBrowser Token=\"{apiKey}\"");
        var client = _httpClientFactory.CreateClient(nameof(VixHubController) + ".LiveTv");
        client.Timeout = TimeSpan.FromSeconds(10);
        return await client.SendAsync(request, HttpCompletionOption.ResponseHeadersRead, cancellationToken)
            .ConfigureAwait(false);
    }

    [HttpGet("Seerr")]
    [Authorize]
    [ResponseCache(Duration = 300, Location = ResponseCacheLocation.Client)]
    public async Task<IActionResult> GetSeerrData(
        [FromQuery] string resource,
        [FromQuery] int page = 1,
        [FromQuery] int? tmdbId = null,
        CancellationToken cancellationToken = default)
    {
        var relativePath = resource switch
        {
            "popular-movies" => $"/api/v1/discover/movies?page={Math.Clamp(page, 1, 8)}&language=en",
            "popular-tv" => $"/api/v1/discover/tv?page={Math.Clamp(page, 1, 8)}&language=en",
            "movie-genres" => "/api/v1/discover/genreslider/movie?language=en",
            "tv-genres" => "/api/v1/discover/genreslider/tv?language=en",
            "movie-recommendations" when tmdbId > 0 =>
                $"/api/v1/movie/{tmdbId.Value}/recommendations?page={Math.Clamp(page, 1, 3)}&language=en",
            "tv-recommendations" when tmdbId > 0 =>
                $"/api/v1/tv/{tmdbId.Value}/recommendations?page={Math.Clamp(page, 1, 3)}&language=en",
            _ => null
        };

        if (relativePath is null)
        {
            return BadRequest(new { message = "Unsupported Seerr resource." });
        }

        var response = await SendSeerrRequest(relativePath, cancellationToken).ConfigureAwait(false);
        if (response is null)
        {
            return StatusCode(StatusCodes.Status503ServiceUnavailable, new { message = "Seerr is not configured." });
        }

        using (response)
        {
            var content = await response.Content.ReadAsStringAsync(cancellationToken).ConfigureAwait(false);
            return new ContentResult
            {
                StatusCode = (int)response.StatusCode,
                ContentType = response.Content.Headers.ContentType?.ToString() ?? "application/json; charset=utf-8",
                Content = content
            };
        }
    }

    [HttpGet("SeerrImage")]
    [Authorize]
    [ResponseCache(Duration = 86400, Location = ResponseCacheLocation.Client)]
    public async Task<IActionResult> GetSeerrImage(
        [FromQuery] string path,
        [FromQuery] string kind = "backdrop",
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(path) ||
            !path.StartsWith("/", StringComparison.Ordinal) ||
            path.Contains("..", StringComparison.Ordinal) ||
            path.Any(character => !(char.IsLetterOrDigit(character) || character is '/' or '-' or '_' or '.')))
        {
            return BadRequest();
        }

        var profile = kind switch
        {
            "poster" => "w300_and_h450_face",
            "logo" => "w780",
            _ => "w780"
        };
        var response = await SendSeerrRequest(
            $"/imageproxy/tmdb/t/p/{profile}{path}",
            cancellationToken).ConfigureAwait(false);
        if (response is null)
        {
            return NotFound();
        }

        using (response)
        {
            if (!response.IsSuccessStatusCode)
            {
                return StatusCode((int)response.StatusCode);
            }

            var bytes = await response.Content.ReadAsByteArrayAsync(cancellationToken).ConfigureAwait(false);
            Response.Headers.CacheControl = "private, max-age=86400";
            return File(bytes, response.Content.Headers.ContentType?.MediaType ?? "image/jpeg");
        }
    }

    private async Task<HttpResponseMessage?> SendSeerrRequest(
        string relativePath,
        CancellationToken cancellationToken)
    {
        var configuration = Plugin.Instance?.Configuration;
        if (configuration is null ||
            string.IsNullOrWhiteSpace(configuration.SeerrApiKey) ||
            !Uri.TryCreate(configuration.SeerrUrl, UriKind.Absolute, out var baseUri) ||
            (baseUri.Scheme != Uri.UriSchemeHttp && baseUri.Scheme != Uri.UriSchemeHttps))
        {
            return null;
        }

        using var request = new HttpRequestMessage(HttpMethod.Get, new Uri(baseUri, relativePath));
        request.Headers.TryAddWithoutValidation("X-Api-Key", configuration.SeerrApiKey);
        request.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));
        var client = _httpClientFactory.CreateClient(nameof(VixHubController));
        client.Timeout = TimeSpan.FromSeconds(12);
        return await client.SendAsync(request, HttpCompletionOption.ResponseHeadersRead, cancellationToken)
            .ConfigureAwait(false);
    }
}
