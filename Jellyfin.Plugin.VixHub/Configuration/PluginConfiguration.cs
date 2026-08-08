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

    public bool EnableLocalTrailerVideo { get; set; } = true;

    public int HeroHeightVh { get; set; } = 64;
}
