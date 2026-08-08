using MediaBrowser.Model.Plugins;

namespace Jellyfin.Plugin.VixHub.Configuration;

/// <summary>
/// User-configurable VixHub presentation settings.
/// </summary>
public sealed class PluginConfiguration : BasePluginConfiguration
{
    public bool EnableHero { get; set; } = true;

    public bool EnableNavbar { get; set; } = true;

    public bool EnableHomeSections { get; set; } = true;

    public bool EnableDiscovery { get; set; } = true;

    public bool LockHomeLayout { get; set; } = true;

    public bool EnableLocalTrailerVideo { get; set; } = true;

    public int HeroHeightVh { get; set; } = 64;

    public string SeerrUrl { get; set; } = "http://seerr:5055";

    public string SeerrApiKey { get; set; } = string.Empty;

    public string JellyfinUrl { get; set; } = "http://127.0.0.1:8096";

    public string JellyfinApiKey { get; set; } = string.Empty;
}
