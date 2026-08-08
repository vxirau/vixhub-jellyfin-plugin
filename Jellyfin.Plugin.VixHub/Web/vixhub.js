(function () {
  "use strict";

  document.documentElement.classList.add("vixhub-theme");

  var HERO_ID = "vixhub-recommendation-hero";
  var HOME_SECTION_ID = "vixhub-because-you-watched";
  var DISCOVERY_ID = "vixhub-discovery";
  var CACHE_TTL_MS = 20 * 60 * 1000;
  var ROTATION_MS = 12000;
  var API_WAIT_MS = 15000;
  var VIDEO_DELAY_MS = 2600;
  var state = {
    items: [],
    index: 0,
    timer: null,
    apiClient: null,
    hero: null,
    observer: null,
    navbarObserver: null,
    navbarNode: null,
    startedAt: Date.now(),
    touchStartX: null,
    navScheduled: false,
    videoTimer: null,
    videoGeneration: 0,
    trailerIds: {},
    homeSectionLoading: false,
    discoveryLoading: false,
    discoveryObserver: null,
    discoveryScrollHandler: null,
    imageObserver: null,
    playedSnapshotPromise: null,
    libraryCatalogPromise: null,
    routeTransitionTimer: null,
    settings: {
      EnableHero: true,
      EnableNavbar: true,
      EnableHomeSections: true,
      EnableDiscovery: true,
      LockHomeLayout: true,
      EnableLocalTrailerVideo: true,
      HeroHeightVh: 64,
      SeerrUrl: "http://seerr:5055"
    }
  };

  var lucideIcons = {
    home: '<path d="m3 11 9-8 9 8"/><path d="M5 10v10h14V10"/><path d="M9 20v-6h6v6"/>',
    heart: '<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 0 0 0-7.78Z"/>',
    film: '<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M7 3v18M17 3v18M3 7.5h4M3 16.5h4M17 7.5h4M17 16.5h4"/>',
    tv: '<rect width="20" height="15" x="2" y="7" rx="2"/><path d="m17 2-5 5-5-5"/>',
    users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
    cast: '<path d="M2 16.1a5 5 0 0 1 5 5M2 12.05a9 9 0 0 1 9 9M2 8V5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-5"/><circle cx="2" cy="21" r="1"/>',
    search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
    layers: '<path d="m12.83 2.18 8 4a2 2 0 0 1 0 3.58l-8 4a2 2 0 0 1-1.66 0l-8-4a2 2 0 0 1 0-3.58l8-4a2 2 0 0 1 1.66 0Z"/><path d="m22 12.5-9.17 4.59a2 2 0 0 1-1.66 0L2 12.5M22 17.5l-9.17 4.59a2 2 0 0 1-1.66 0L2 17.5"/>',
    radio: '<path d="M4.9 19.1a10 10 0 0 1 0-14.2M7.8 16.2a6 6 0 0 1 0-8.4M19.1 4.9a10 10 0 0 1 0 14.2M16.2 7.8a6 6 0 0 1 0 8.4"/><circle cx="12" cy="12" r="2"/>'
  };

  // Seerr's curated studio and network artwork. VixHub only renders an entry
  // when a matching facet exists in this Jellyfin library.
  var SEERR_STUDIOS = [
    { names: ["disney", "walt disney pictures"], path: "/wdrCwmRnLFJhEoH8GSfymY85KHT.png" },
    { names: ["20th century studios", "20th century fox"], path: "/h0rjX5vjW5r8yEnUBStFarjcLT4.png" },
    { names: ["sony pictures", "sony pictures entertainment"], path: "/GagSvqWlyPdkFHMfQ3pNq6ix9P.png" },
    { names: ["warner bros pictures", "warner bros"], path: "/ky0xOc5OrhzkZ1N6KyUxacfQsCk.png" },
    { names: ["universal pictures", "universal"], path: "/8lvHyhjr8oUKOOy2dKXoALWKdp0.png" },
    { names: ["paramount pictures", "paramount"], path: "/fycMZt242LVjagMByZOLUGbCvv3.png" },
    { names: ["pixar", "pixar animation studios"], path: "/1TjvGVDMYsj6JBxOAkUHpPEwLf7.png" },
    { names: ["dreamworks", "dreamworks animation"], path: "/kP7t6RwGz2AvvTkvnI1uteEwHet.png" },
    { names: ["marvel studios"], path: "/hUzeosd33nzE5MCNsZxCGEKTXaQ.png" },
    { names: ["dc", "dc entertainment", "dc studios"], path: "/2Tc1P3Ac8M479naPp1kYT3izLS5.png" },
    { names: ["a24"], path: "/1ZXsGaFPgrgS6ZZGS37AqD5uU12.png" }
  ];

  var SEERR_NETWORKS = [
    { names: ["netflix"], path: "/wwemzKWzjKYJFfCeiB57q3r4Bcm.png" },
    { names: ["disney+", "disney plus"], path: "/gJ8VX6JSu3ciXHuC2dDGAo2lvwM.png" },
    { names: ["prime video", "amazon prime video", "amazon"], path: "/ifhbNuuVnlwYy5oXA5VIb2YR8AZ.png" },
    { names: ["apple tv+", "apple tv plus", "apple tv"], path: "/4KAy34EHvRM25Ih8wb82AuGU7zJ.png" },
    { names: ["hulu"], path: "/pqUTCleNUiTLAVlelGxUgWn1ELh.png" },
    { names: ["hbo", "max", "hbo max"], path: "/tuomPhY2UtuPTqqFnKMVHvSb724.png" },
    { names: ["discovery+", "discovery plus"], path: "/1D1bS3Dyw4ScYnFWTlBOvJXC3nb.png" },
    { names: ["abc"], path: "/ndAvF4JLsliGreX87jAc9GdjmJY.png" },
    { names: ["fox"], path: "/1DSpHrWyOORkL9N2QHX7Adt31mQ.png" },
    { names: ["cinemax"], path: "/6mSHSquNpfLgDdv6VnOOvC5Uz2h.png" },
    { names: ["amc"], path: "/pmvRmATOCaDykE6JrVoeYxlFHw3.png" },
    { names: ["showtime"], path: "/Allse9kbjiP6ExaQrnSpIhkurEi.png" },
    { names: ["starz"], path: "/8GJjw3HHsAJYwIWKIPBPfqMxlEa.png" },
    { names: ["the cw", "cw"], path: "/ge9hzeaU7nMtQ4PjkFlc68dGAJ9.png" },
    { names: ["nbc"], path: "/o3OedEP0f9mfZr33jz2BfXOUK5.png" },
    { names: ["cbs"], path: "/nm8d7P7MJNiBLdgIzUK0gkuEA4r.png" },
    { names: ["paramount+", "paramount plus"], path: "/fi83B1oztoS47xxcemFdPMhIzK.png" },
    { names: ["bbc one", "bbc"], path: "/mVn7xESaTNmjBUyUtGNvDQd3CT1.png" },
    { names: ["cartoon network"], path: "/c5OC6oVCg6QP4eqzW6XIq17CQjI.png" },
    { names: ["adult swim"], path: "/9AKyspxVzywuaMuZ1Bvilu8sXly.png" },
    { names: ["nickelodeon"], path: "/ikZXxg6GnwpzqiZbRPhJGaZapqB.png" },
    { names: ["peacock"], path: "/gIAcGTjKKr0KOHL5s4O36roJ8p7.png" }
  ];

  function lucideSvg(name) {
    return '<svg data-vixhub-icon="' + name + '" class="vixhub-lucide" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      lucideIcons[name] + '</svg>';
  }

  function replaceNavIcon(target, name) {
    if (!target || target.querySelector('[data-vixhub-icon="' + name + '"]')) return;
    var wrapper = target.querySelector(".MuiButton-startIcon");
    if (wrapper) wrapper.innerHTML = lucideSvg(name);
    else {
      var existing = target.querySelector("svg");
      if (existing) existing.outerHTML = lucideSvg(name);
    }
  }

  function enhanceNavbar() {
    state.navScheduled = false;
    if (!state.settings.EnableNavbar) return;
    var navbar = document.querySelector("header.MuiAppBar-root");
    if (!navbar) return;
    watchNavbar(navbar);

    if (isDashboardRoute()) {
      navbar.classList.remove("vixhub-navbar");
      navbar.classList.add("vixhub-dashboardbar");
      var injectedBrand = navbar.querySelector(".vixhub-mobile-brand");
      if (injectedBrand) injectedBrand.remove();
      return;
    }

    navbar.classList.remove("vixhub-dashboardbar");
    navbar.classList.add("vixhub-navbar");

    var brand = navbar.querySelector('a[href="#/"]');
    if (!brand) {
      var toolbar = navbar.querySelector(".MuiToolbar-root");
      var menuButton = toolbar && toolbar.querySelector('button[aria-label="Open Menu"]');
      if (toolbar && menuButton) {
        brand = document.createElement("a");
        brand.href = "#/";
        brand.className = "vixhub-mobile-brand";
        brand.setAttribute("aria-label", "VixHub home");
        brand.innerHTML = '<img src="/VixHub/Assets/vixhub-mark.png" alt="" aria-hidden="true">';
        menuButton.insertAdjacentElement("afterend", brand);
      }
    }
    var brandImage = brand && brand.querySelector("img");
    if (brandImage) {
      brandImage.src = "/VixHub/Assets/vixhub-mark.png";
      brandImage.alt = "";
      brandImage.setAttribute("aria-hidden", "true");
    }

    // Jellyfin 12 already renders its library navigation in the brand stack.
    // Remove any legacy VixHub nav left by an older bundle instead of adding a
    // second copy beside the native one.
    Array.prototype.forEach.call(
      document.querySelectorAll(".vixhub-primary-nav"),
      function (nav) { nav.remove(); }
    );

    replaceNavIcon(navbar.querySelector('a[href^="#/home?tab=1"]'), "heart");
    replaceNavIcon(navbar.querySelector('a[href^="#/movies"]'), "film");
    replaceNavIcon(navbar.querySelector('a[href^="#/tv"]'), "tv");
    replaceNavIcon(navbar.querySelector('a[href^="#/boxsets"]'), "layers");
    ensureLiveTvNav(navbar);
    replaceNavIcon(navbar.querySelector('button[aria-label="SyncPlay"]'), "users");
    replaceNavIcon(navbar.querySelector('button[aria-label="Cast to Device"]'), "cast");
    replaceNavIcon(navbar.querySelector('a[aria-label="Search"]'), "search");

    Array.prototype.forEach.call(
      navbar.querySelectorAll('a[href^="#/"]'),
      function (link) {
        var href = link.getAttribute("href") || "";
        var active =
          (href.indexOf("#/movies") === 0 && window.location.hash.indexOf("#/movies") === 0) ||
          (href.indexOf("#/tv") === 0 && window.location.hash.indexOf("#/tv") === 0) ||
          (href.indexOf("#/boxsets") === 0 && window.location.hash.indexOf("#/boxsets") === 0) ||
          (href.indexOf("#/livetv") === 0 && window.location.hash.indexOf("#/livetv") === 0) ||
          (href.indexOf("#/home?tab=1") === 0 && window.location.hash.indexOf("#/home?tab=1") === 0) ||
          (href === "#/" && isHomeRoute());
        if (active) link.setAttribute("aria-current", "page");
        else link.removeAttribute("aria-current");
      }
    );
  }

  function libraryHref(label, fallback) {
    var homeLink = Array.prototype.find.call(
      document.querySelectorAll("#homeTab a[href]"),
      function (link) {
        return (link.getAttribute("aria-label") || link.title || link.textContent).trim() === label;
      }
    );
    return homeLink ? homeLink.getAttribute("href") : fallback;
  }

  function ensureLiveTvNav(navbar) {
    var existing = navbar.querySelector('a[href^="#/livetv"]');
    if (!existing) {
      var reference = navbar.querySelector('a[href^="#/boxsets"]') || navbar.querySelector('a[href^="#/tv"]');
      if (!reference || !reference.parentElement) return;
      existing = reference.cloneNode(true);
      existing.href = "#/livetv";
      existing.classList.add("vixhub-live-link");
      existing.removeAttribute("aria-current");
      existing.querySelectorAll("[data-id],[data-serverid]").forEach(function (node) {
        node.removeAttribute("data-id");
        node.removeAttribute("data-serverid");
      });
      var leaves = existing.querySelectorAll("span,div");
      Array.prototype.forEach.call(leaves, function (node) {
        if (!node.children.length && node.textContent.trim()) node.textContent = "Live TV";
      });
      reference.insertAdjacentElement("afterend", existing);
    }
    existing.setAttribute("aria-label", "Live TV");
    Array.prototype.forEach.call(existing.childNodes, function (node) {
      if (node.nodeType === Node.TEXT_NODE && node.nodeValue.trim()) {
        node.nodeValue = "Live TV";
      }
    });
    replaceNavIcon(existing, "radio");
  }

  function watchNavbar(navbar) {
    if (state.navbarNode === navbar) return;
    if (state.navbarObserver) state.navbarObserver.disconnect();
    state.navbarNode = navbar;
    state.navbarObserver = new MutationObserver(function () {
      if (
        !isDashboardRoute() &&
        !navbar.classList.contains("vixhub-navbar")
      ) {
        scheduleNavbarEnhancement();
      }
    });
    state.navbarObserver.observe(navbar, {
      attributes: true,
      attributeFilter: ["class"]
    });
  }

  function scheduleNavbarEnhancement() {
    if (state.navScheduled) return;
    state.navScheduled = true;
    window.setTimeout(enhanceNavbar, 0);
  }

  function isHomeRoute() {
    var hash = window.location.hash.toLowerCase();
    return hash === "" || hash === "#/" || hash.indexOf("#/home") === 0;
  }

  function isPlaybackRoute() {
    var hash = window.location.hash.toLowerCase();
    return hash.indexOf("#/video") === 0 ||
      hash.indexOf("#/playback") === 0 ||
      hash.indexOf("#/livetv") === 0;
  }

  function nativePlaybackIsActive() {
    var nativeVideo = document.querySelector("video:not(.vixhub-hero__video)");
    if (nativeVideo && nativeVideo.getClientRects().length) return true;
    var player = document.querySelector(".videoPlayerContainer:not(.hide), .videoPlayerContainer[data-active='true']");
    return Boolean(player && player.getClientRects().length);
  }

  function isDashboardRoute() {
    return window.location.hash.toLowerCase().indexOf("#/dashboard") === 0;
  }

  function syncRoutePresentation(animate) {
    var hash = window.location.hash.toLowerCase();
    var root = document.documentElement;
    root.classList.toggle("vixhub-route-detail", hash.indexOf("#/details") === 0);
    root.classList.toggle("vixhub-route-home", isHomeRoute());
    root.classList.toggle("vixhub-route-playback", isPlaybackRoute() || nativePlaybackIsActive());
    root.classList.toggle("vixhub-route-dashboard", isDashboardRoute());
    if (!animate || isPlaybackRoute() || nativePlaybackIsActive()) return;

    if (state.routeTransitionTimer) window.clearTimeout(state.routeTransitionTimer);
    state.routeTransitionTimer = window.setTimeout(function () {
      var page = document.querySelector(".page:not(.hide)") || document.querySelector("main");
      if (!page) return;
      page.classList.remove("vixhub-page-enter");
      // Route changes are infrequent; this single layout read reliably restarts
      // the CSS animation across Jellyfin's legacy and React-rendered pages.
      void page.offsetWidth;
      page.classList.add("vixhub-page-enter");
      window.setTimeout(function () {
        page.classList.remove("vixhub-page-enter");
      }, 520);
    }, 40);
  }

  function apiToken() {
    var client = state.apiClient;
    if (!client) return "";
    if (typeof client.accessToken === "function") return client.accessToken() || "";
    return client._serverInfo && client._serverInfo.AccessToken || "";
  }

  function serverAddress() {
    var client = state.apiClient;
    if (!client) return window.location.origin;
    var address = typeof client.serverAddress === "function"
      ? client.serverAddress()
      : client._serverAddress;
    return (address || window.location.origin).replace(/\/$/, "");
  }

  function serverId() {
    return state.apiClient &&
      state.apiClient._serverInfo &&
      state.apiClient._serverInfo.Id || "";
  }

  function currentUserId() {
    var client = state.apiClient;
    return client && typeof client.getCurrentUserId === "function"
      ? client.getCurrentUserId()
      : client && client._currentUser && client._currentUser.Id;
  }

  function apiUrl(path, params) {
    var url = new URL(serverAddress() + path);
    Object.keys(params || {}).forEach(function (key) {
      var value = params[key];
      if (value !== undefined && value !== null && value !== "") {
        url.searchParams.set(key, String(value));
      }
    });
    return url.toString();
  }

  function apiJson(path, params) {
    var token = apiToken();
    return window.fetch(apiUrl(path, params), {
      cache: "no-store",
      credentials: "same-origin",
      headers: {
        Authorization: 'MediaBrowser Token="' + token + '"'
      }
    }).then(function (response) {
      if (!response.ok) throw new Error("Jellyfin request failed: " + response.status);
      return response.json();
    });
  }

  function imageUrl(item, type, maxWidth) {
    var tags = type === "Backdrop"
      ? { Backdrop: item.BackdropImageTags && item.BackdropImageTags[0] }
      : item.ImageTags;
    var tag = tags && tags[type];
    if (!tag) return "";
    return apiUrl("/Items/" + item.Id + "/Images/" + type, {
      tag: tag,
      quality: 82,
      maxWidth: maxWidth,
      api_key: apiToken()
    });
  }

  function hasBackdrop(item) {
    return item &&
      item.Id &&
      item.Name &&
      Array.isArray(item.BackdropImageTags) &&
      item.BackdropImageTags.length > 0;
  }

  function uniqueItems(items) {
    var seen = {};
    return items.filter(function (item) {
      if (!hasBackdrop(item) || seen[item.Id]) return false;
      seen[item.Id] = true;
      return true;
    });
  }

  function fetchPlayedSnapshot() {
    if (state.playedSnapshotPromise) return state.playedSnapshotPromise;
    var userId = currentUserId();
    if (!userId) return Promise.resolve({ ids: null, items: [] });

    state.playedSnapshotPromise = apiJson("/Users/" + userId + "/Items", {
      recursive: true,
      includeItemTypes: "Movie,Series",
      filters: "IsPlayed",
      sortBy: "DatePlayed",
      sortOrder: "Descending",
      limit: 10000,
      enableImages: false,
      enableTotalRecordCount: false,
      fields: "UserData"
    }).then(function (result) {
      var items = result.Items || [];
      var ids = {};
      items.forEach(function (item) {
        ids[item.Id] = true;
      });
      return { ids: ids, items: items };
    }).catch(function () {
      // If playback state cannot be verified, do not risk recommending watched
      // titles. Collections remain safe because they are not playable items.
      return { ids: null, items: [] };
    });

    return state.playedSnapshotPromise;
  }

  function isVerifiedUnplayed(item, playedSnapshot) {
    return Boolean(
      item &&
      playedSnapshot &&
      playedSnapshot.ids &&
      !playedSnapshot.ids[item.Id] &&
      !(item.UserData && item.UserData.Played)
    );
  }

  function mergeFeaturedItems(titles, collections) {
    var result = [];
    var titleIndex = 0;
    var collectionIndex = 0;
    while (result.length < 10 && (titleIndex < titles.length || collectionIndex < collections.length)) {
      var collectionSlot = result.length === 2 || result.length === 6 || result.length === 9;
      if (collectionSlot && collectionIndex < collections.length) {
        result.push(collections[collectionIndex]);
        collectionIndex += 1;
      } else if (titleIndex < titles.length) {
        result.push(titles[titleIndex]);
        titleIndex += 1;
      } else if (collectionIndex < collections.length) {
        result.push(collections[collectionIndex]);
        collectionIndex += 1;
      }
    }
    return result;
  }

  function shuffle(items) {
    var result = items.slice();
    for (var i = result.length - 1; i > 0; i -= 1) {
      var j = Math.floor(Math.random() * (i + 1));
      var temporary = result[i];
      result[i] = result[j];
      result[j] = temporary;
    }
    return result;
  }

  function cacheKey() {
    return "vixhub-recommendation-hero:v2:" + (currentUserId() || "anonymous");
  }

  function readCache() {
    try {
      var cached = JSON.parse(window.sessionStorage.getItem(cacheKey()));
      if (
        cached &&
        Array.isArray(cached.items) &&
        cached.items.length &&
        Date.now() - cached.savedAt < CACHE_TTL_MS
      ) {
        return cached.items;
      }
    } catch (error) {
      // Caching is optional.
    }
    return null;
  }

  function writeCache(items) {
    try {
      window.sessionStorage.setItem(cacheKey(), JSON.stringify({
        savedAt: Date.now(),
        items: items
      }));
    } catch (error) {
      // Caching is optional.
    }
  }

  function fetchHeroItems() {
    var userId = currentUserId();
    var fields = [
      "Overview",
      "Genres",
      "ProductionYear",
      "CommunityRating",
      "OfficialRating",
      "RunTimeTicks",
      "PrimaryImageAspectRatio",
      "ChildCount",
      "UserData"
    ].join(",");

    var discovery = apiJson("/Users/" + userId + "/Items", {
        userId: userId,
        recursive: true,
        includeItemTypes: "Movie,Series",
        filters: "IsUnplayed",
        sortBy: "CommunityRating,ProductionYear",
        sortOrder: "Descending",
        limit: 40,
        enableTotalRecordCount: false,
        fields: fields
      }).then(function (result) {
        return shuffle(result.Items || []);
      }).catch(function () {
        return [];
      });

    var collections = apiJson("/Users/" + userId + "/Items", {
        recursive: true,
        includeItemTypes: "BoxSet",
        sortBy: "SortName",
        sortOrder: "Ascending",
        limit: 60,
        enableTotalRecordCount: false,
        fields: fields
      }).then(function (result) {
        return shuffle(uniqueItems(result.Items || [])).slice(0, 3);
      }).catch(function () {
        return [];
      });

    return Promise.all([discovery, collections]).then(function (results) {
      var titles = uniqueItems(results[0]).filter(function (item) {
        return !(item.UserData && item.UserData.Played);
      });
      var items = mergeFeaturedItems(titles, results[1]);
      writeCache(items);
      return items;
    });
  }

  function element(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text) node.textContent = text;
    return node;
  }

  function createHero() {
    var hero = element("section", "vixhub-hero vixhub-hero--loading");
    hero.id = HERO_ID;
    hero.setAttribute("aria-label", "Recommended for you");
    hero.style.setProperty(
      "--vixhub-hero-height",
      Math.max(54, Math.min(78, Number(state.settings.HeroHeightVh) || 64)) + "dvh"
    );

    var backdrop = element("img", "vixhub-hero__backdrop");
    backdrop.alt = "";
    backdrop.decoding = "async";
    backdrop.fetchPriority = "high";
    var video = element("video", "vixhub-hero__video");
    video.muted = true;
    video.loop = true;
    video.playsInline = true;
    video.preload = "none";
    video.setAttribute("aria-hidden", "true");
    function revealVideoAfterFirstFrame() {
      if (video.readyState >= 3 && video.currentTime > 0.05) {
        video.classList.add("is-playing");
      }
    }
    video.addEventListener("playing", revealVideoAfterFirstFrame);
    video.addEventListener("timeupdate", revealVideoAfterFirstFrame);
    video.addEventListener("error", function () {
      video.classList.remove("is-playing");
    });
    var wash = element("div", "vixhub-hero__wash");
    var content = element("div", "vixhub-hero__content");
    var panel = element("div", "vixhub-hero__panel");
    var eyebrow = element("div", "vixhub-hero__eyebrow", "Recommended for you");
    var logo = element("img", "vixhub-hero__logo");
    logo.alt = "";
    var title = element("h1", "vixhub-hero__title");
    var facts = element("div", "vixhub-hero__facts");
    var overview = element("p", "vixhub-hero__overview");
    var actions = element("div", "vixhub-hero__actions");

    var play = element("button", "vixhub-hero__button vixhub-hero__button--primary itemAction");
    play.type = "button";
    play.dataset.action = "resume";
    play.innerHTML = '<span class="material-icons" aria-hidden="true">play_arrow</span><span>Play</span>';
    // Jellyfin resolves playback metadata from the closest native card. Keep
    // that contract without making the hero itself a card or reimplementing
    // the client's playback pipeline.
    var playContext = element("span", "vixhub-hero__play-context card");
    playContext.appendChild(play);
    play.addEventListener("click", function (event) {
      // Jellyfin attaches its resume handler to each native items container,
      // not globally. Relay through a short-lived native card so the normal
      // client playback pipeline (profiles, resume, subtitles, sessions) owns
      // playback without duplicating it in this plugin.
      var itemsContainer = document.querySelector("#homeTab .itemsContainer");
      if (!itemsContainer || !playContext.dataset.id) return;
      event.preventDefault();
      event.stopPropagation();
      var relay = element("div", "card vixhub-playback-relay");
      ["id", "serverid", "type", "mediatype"].forEach(function (name) {
        relay.dataset[name] = playContext.dataset[name] || "";
      });
      var relayButton = element("button", "itemAction");
      relayButton.type = "button";
      relayButton.dataset.action = "resume";
      relay.appendChild(relayButton);
      itemsContainer.appendChild(relay);
      relayButton.click();
      window.setTimeout(function () { relay.remove(); }, 0);
    });

    var info = element("a", "vixhub-hero__button vixhub-hero__button--secondary");
    info.innerHTML = '<span class="material-icons" aria-hidden="true">info_outline</span><span>More info</span>';

    var navigation = element("div", "vixhub-hero__navigation");
    var previous = element("button", "vixhub-hero__arrow");
    previous.type = "button";
    previous.setAttribute("aria-label", "Previous recommendation");
    previous.innerHTML = '<span class="material-icons" aria-hidden="true">chevron_left</span>';
    var dots = element("div", "vixhub-hero__dots");
    var next = element("button", "vixhub-hero__arrow");
    next.type = "button";
    next.setAttribute("aria-label", "Next recommendation");
    next.innerHTML = '<span class="material-icons" aria-hidden="true">chevron_right</span>';

    actions.appendChild(playContext);
    actions.appendChild(info);
    navigation.appendChild(previous);
    navigation.appendChild(dots);
    navigation.appendChild(next);
    panel.appendChild(eyebrow);
    panel.appendChild(logo);
    panel.appendChild(title);
    panel.appendChild(facts);
    panel.appendChild(overview);
    panel.appendChild(actions);
    content.appendChild(panel);
    hero.appendChild(backdrop);
    hero.appendChild(video);
    hero.appendChild(wash);
    hero.appendChild(content);
    hero.appendChild(navigation);

    previous.addEventListener("click", function () {
      showSlide((state.index - 1 + state.items.length) % state.items.length);
    });
    next.addEventListener("click", function () {
      showSlide((state.index + 1) % state.items.length);
    });
    hero.addEventListener("mouseenter", stopRotation);
    hero.addEventListener("mouseleave", startRotation);
    hero.addEventListener("focusin", stopRotation);
    hero.addEventListener("focusout", startRotation);
    hero.addEventListener("touchstart", function (event) {
      state.touchStartX = event.touches && event.touches[0]
        ? event.touches[0].clientX
        : null;
    }, { passive: true });
    hero.addEventListener("touchend", function (event) {
      if (state.touchStartX === null) return;
      var touch = event.changedTouches && event.changedTouches[0];
      if (!touch) return;
      var distance = touch.clientX - state.touchStartX;
      state.touchStartX = null;
      if (Math.abs(distance) < 55) return;
      showSlide(distance > 0
        ? (state.index - 1 + state.items.length) % state.items.length
        : (state.index + 1) % state.items.length);
    }, { passive: true });

    state.hero = hero;
    return hero;
  }

  function formatRuntime(ticks) {
    if (!ticks) return "";
    var minutes = Math.round(ticks / 600000000);
    var hours = Math.floor(minutes / 60);
    var remainder = minutes % 60;
    return hours ? hours + "h " + remainder + "m" : minutes + "m";
  }

  function twoDigits(value) {
    return value < 10 ? "0" + value : String(value);
  }

  function updateDots() {
    var dots = state.hero.querySelector(".vixhub-hero__dots");
    dots.textContent = "";
    var counter = element(
      "span",
      "vixhub-hero__counter",
      twoDigits(state.index + 1) + " / " + twoDigits(state.items.length)
    );
    var progress = element("span", "vixhub-hero__progress");
      var progressValue = element("span", "vixhub-hero__progress-value");
      progressValue.style.width = ((state.index + 1) / state.items.length * 100) + "%";
    progress.appendChild(progressValue);
    dots.appendChild(counter);
    dots.appendChild(progress);
  }

  function showSlide(index) {
    if (!state.hero || !state.items.length) return;
    state.index = index;
    var item = state.items[index];
    var isCollection = item.Type === "BoxSet";
    var hero = state.hero;
    var backdrop = hero.querySelector(".vixhub-hero__backdrop");
    var video = hero.querySelector(".vixhub-hero__video");
    var logo = hero.querySelector(".vixhub-hero__logo");
    var title = hero.querySelector(".vixhub-hero__title");
    var facts = hero.querySelector(".vixhub-hero__facts");
    var overview = hero.querySelector(".vixhub-hero__overview");
    var info = hero.querySelector(".vixhub-hero__button--secondary");
    var eyebrow = hero.querySelector(".vixhub-hero__eyebrow");
    var play = hero.querySelector(".vixhub-hero__button--primary");
    var playContext = hero.querySelector(".vixhub-hero__play-context");
    var backdropWidth = window.innerWidth <= 720
      ? 960
      : window.innerWidth <= 1500 ? 1440 : 1920;
    var backdropUrl = imageUrl(item, "Backdrop", backdropWidth);
    var logoUrl = imageUrl(item, "Logo", 760);

    hero.classList.add("vixhub-hero--changing");
    stopHeroVideo();
    var slideGeneration = state.videoGeneration;
    window.setTimeout(function () {
      if (slideGeneration !== state.videoGeneration) return;
      var finishBackdropTransition = function () {
        if (slideGeneration === state.videoGeneration) {
          hero.classList.remove("vixhub-hero--changing");
        }
      };
      backdrop.onload = finishBackdropTransition;
      backdrop.onerror = finishBackdropTransition;
      backdrop.src = backdropUrl;
      if (backdrop.complete && backdrop.naturalWidth) {
        window.setTimeout(finishBackdropTransition, 0);
      }
      window.setTimeout(finishBackdropTransition, 1800);
      logo.src = logoUrl;
      logo.hidden = !logoUrl;
      title.textContent = item.Name;
      title.hidden = Boolean(logoUrl);
      eyebrow.textContent = isCollection ? "Featured collection" : "Recommended for you";
      overview.textContent = item.Overview || (isCollection
        ? "Explore every title in the " + item.Name + " collection."
        : "Discover this title in your VixHub library.");
      play.hidden = isCollection;

      facts.textContent = "";
      [
        { text: item.ProductionYear },
        {
          text: item.CommunityRating ? "★ " + item.CommunityRating.toFixed(1) : "",
          className: "vixhub-hero__rating"
        },
        { text: item.OfficialRating },
        { text: isCollection && item.ChildCount ? item.ChildCount + " titles" : formatRuntime(item.RunTimeTicks) },
        { text: item.Genres && item.Genres.slice(0, 2).join(" · ") }
      ].filter(function (fact) {
        return Boolean(fact.text);
      }).forEach(function (fact) {
        facts.appendChild(element("span", fact.className || "", String(fact.text)));
      });

      hero.dataset.id = item.Id;
      hero.dataset.serverid = serverId();
      hero.dataset.type = item.Type || "";
      hero.dataset.mediatype = item.MediaType || "Video";
      playContext.dataset.id = item.Id;
      playContext.dataset.serverid = serverId();
      playContext.dataset.type = item.Type || "";
      playContext.dataset.mediatype = item.MediaType || "Video";
      info.href = "#/details?id=" + encodeURIComponent(item.Id) +
        "&serverId=" + encodeURIComponent(serverId());
      updateDots();
      hero.classList.remove("vixhub-hero--loading");

      var next = state.items[(state.index + 1) % state.items.length];
      if (next) {
        var preload = new Image();
        preload.decoding = "async";
        preload.fetchPriority = "low";
        preload.src = imageUrl(next, "Backdrop", 1600);
      }
      if (!isCollection) scheduleHeroVideo(item, video);
    }, 160);
    startRotation();
  }

  function stopHeroVideo() {
    if (state.videoTimer) window.clearTimeout(state.videoTimer);
    state.videoTimer = null;
    state.videoGeneration += 1;
    var video = state.hero && state.hero.querySelector(".vixhub-hero__video");
    if (!video) return;
    video.pause();
    video.removeAttribute("src");
    video.load();
    video.classList.remove("is-playing");
  }

  function canUseHeroVideo() {
    var connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    return (
      window.innerWidth > 720 &&
      state.settings.EnableLocalTrailerVideo &&
      !document.hidden &&
      !(connection && connection.saveData) &&
      !window.matchMedia("(prefers-reduced-motion: reduce)").matches
    );
  }

  function scheduleHeroVideo(item, video) {
    if (!video || !canUseHeroVideo()) return;
    var generation = state.videoGeneration;
    state.videoTimer = window.setTimeout(function () {
      function playTrailer(trailerId) {
        if (!trailerId || generation !== state.videoGeneration || !canUseHeroVideo()) return;
        video.src = apiUrl("/Videos/" + trailerId + "/stream", {
          static: true,
          api_key: apiToken()
        });
        video.currentTime = 0;
        video.load();
        var playPromise = video.play();
        if (playPromise && typeof playPromise.catch === "function") {
          playPromise.catch(function () {
            video.classList.remove("is-playing");
          });
        }
      }

      if (Object.prototype.hasOwnProperty.call(state.trailerIds, item.Id)) {
        playTrailer(state.trailerIds[item.Id]);
        return;
      }

      apiJson("/Items/" + item.Id + "/LocalTrailers", {}).then(function (trailers) {
        state.trailerIds[item.Id] = trailers && trailers.length
          ? trailers[0].Id
          : "";
        playTrailer(state.trailerIds[item.Id]);
      }).catch(function () {
        // The static backdrop remains the fast, universal fallback.
      });
    }, VIDEO_DELAY_MS);
  }

  function stopRotation() {
    if (state.timer) window.clearInterval(state.timer);
    state.timer = null;
  }

  function startRotation() {
    stopRotation();
    if (
      state.items.length < 2 ||
      document.hidden ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) return;
    state.timer = window.setInterval(function () {
      showSlide((state.index + 1) % state.items.length);
    }, ROTATION_MS);
  }

  function unmount(removeHomeSection) {
    stopHeroVideo();
    stopRotation();
    var existing = document.getElementById(HERO_ID);
    if (existing) existing.remove();
    state.hero = null;
    if (removeHomeSection) {
      if (state.discoveryObserver) state.discoveryObserver.disconnect();
      state.discoveryObserver = null;
      if (state.discoveryScrollHandler) window.removeEventListener("scroll", state.discoveryScrollHandler);
      state.discoveryScrollHandler = null;
      state.playedSnapshotPromise = null;
      var section = document.getElementById(HOME_SECTION_ID);
      if (section) section.remove();
      var discovery = document.getElementById(DISCOVERY_ID);
      if (discovery) discovery.remove();
    }
  }

  function mount() {
    if (!isHomeRoute() || nativePlaybackIsActive()) {
      unmount(true);
      return;
    }
    if (!state.settings.EnableHero) {
      unmount(false);
      return;
    }
    if (document.getElementById(HERO_ID)) return;

    var homeTab = document.querySelector("#homeTab.is-active");
    var sections = homeTab && homeTab.querySelector(".homeSectionsContainer");
    if (!homeTab || !sections) return;

    homeTab.insertBefore(createHero(), sections);
    fetchHeroItems().then(function (items) {
      if (!state.hero || !document.body.contains(state.hero)) return;
      if (!items.length) {
        unmount(false);
        scheduleDeferredHome();
        return;
      }
      state.items = items;
      showSlide(0);
      scheduleDeferredHome();
    }).catch(function (error) {
      console.warn("VixHub hero could not load recommendations", error);
      unmount(false);
      scheduleDeferredHome();
    });
  }

  function homeSectionCacheKey() {
    return "vixhub-home-section:v2:" + (currentUserId() || "anonymous");
  }

  function readHomeSectionCache() {
    try {
      var cached = JSON.parse(window.sessionStorage.getItem(homeSectionCacheKey()));
      if (cached && Date.now() - cached.savedAt < CACHE_TTL_MS * 2) return cached;
    } catch (error) {
      // Personalized sections work without storage.
    }
    return null;
  }

  function writeHomeSectionCache(section) {
    try {
      window.sessionStorage.setItem(homeSectionCacheKey(), JSON.stringify({
        savedAt: Date.now(),
        title: section.title,
        items: section.items
      }));
    } catch (error) {
      // Personalized sections work without storage.
    }
  }

  function fetchBecauseYouWatched() {
    var userId = currentUserId();
    var fields = "PrimaryImageAspectRatio,ImageTags,BackdropImageTags,ProductionYear,CommunityRating,OfficialRating,UserData";

    return apiJson("/Users/" + userId + "/Items", {
      recursive: true,
      includeItemTypes: "Movie,Series",
      filters: "IsUnplayed",
      sortBy: "CommunityRating,ProductionYear",
      sortOrder: "Descending",
      limit: 30,
      enableTotalRecordCount: false,
      fields: fields
    }).then(function (result) {
      return {
        title: "Top picks for you",
        items: (result.Items || []).filter(function (item) {
          return item.ImageTags && item.ImageTags.Primary && !(item.UserData && item.UserData.Played);
        }).slice(0, 12)
      };
    }).then(function (section) {
      if (section && section.items.length) writeHomeSectionCache(section);
      return section;
    }).catch(function () {
      return null;
    });
  }

  function createHomeSection(sectionData) {
    var section = element("section", "vixhub-home-section");
    section.id = HOME_SECTION_ID;
    section.setAttribute("aria-label", sectionData.title);
    var heading = element("div", "vixhub-home-section__heading");
    heading.appendChild(element("span", "vixhub-home-section__eyebrow", "Curated for you"));
    heading.appendChild(element("h2", "vixhub-home-section__title", sectionData.title));
    section.appendChild(heading);
    var rail = element("div", "vixhub-home-section__rail");
    sectionData.items.forEach(function (item) {
      var link = element("a", "vixhub-home-card");
      link.href = "#/details?id=" + encodeURIComponent(item.Id) +
        "&serverId=" + encodeURIComponent(serverId());
      link.setAttribute("aria-label", item.Name);
      var image = element("img", "vixhub-home-card__image");
      image.alt = "";
      image.loading = "lazy";
      image.decoding = "async";
      image.src = imageUrl(item, "Backdrop", 720) || imageUrl(item, "Primary", 420);
      var wash = element("span", "vixhub-home-card__wash");
      var body = element("span", "vixhub-home-card__body");
      var play = element("span", "vixhub-home-card__play material-icons", "play_arrow");
      play.setAttribute("aria-hidden", "true");
      var title = element("span", "vixhub-home-card__title", item.Name);
      var meta = element(
        "span",
        "vixhub-home-card__meta",
        [
          item.ProductionYear,
          item.CommunityRating ? "★ " + item.CommunityRating.toFixed(1) : ""
        ].filter(Boolean).join("  ·  ")
      );
      link.appendChild(image);
      link.appendChild(wash);
      body.appendChild(play);
      body.appendChild(title);
      body.appendChild(meta);
      link.appendChild(body);
      rail.appendChild(link);
    });
    section.appendChild(rail);
    return section;
  }

  function createHomeSectionSkeleton() {
    var section = element("section", "vixhub-home-section vixhub-home-section--loading");
    section.id = HOME_SECTION_ID;
    section.setAttribute("aria-label", "Loading personalized recommendations");
    section.setAttribute("aria-busy", "true");
    var heading = element("div", "vixhub-home-section__heading");
    heading.appendChild(element("span", "vixhub-home-section__skeleton-label"));
    heading.appendChild(element("span", "vixhub-home-section__skeleton-title"));
    section.appendChild(heading);
    var rail = element("div", "vixhub-home-section__rail");
    for (var index = 0; index < 5; index += 1) {
      rail.appendChild(element("span", "vixhub-home-card vixhub-home-card--skeleton"));
    }
    section.appendChild(rail);
    return section;
  }

  function discoveryCacheKey() {
    return "vixhub-discovery:v5:" + (currentUserId() || "anonymous");
  }

  function isCompleteDiscovery(data) {
    return Boolean(data && [
      "popularSeries",
      "recentSeries",
      "seriesGenres",
      "popularMovies",
      "recentMovies",
      "movieGenres",
      "topPicks",
      "studios",
      "networks",
      "livePrograms"
    ].every(function (key) {
      return Array.isArray(data[key]) && data[key].length > 0;
    }));
  }

  function readDiscoveryCache() {
    try {
      var cached = JSON.parse(window.sessionStorage.getItem(discoveryCacheKey()));
      if (
        cached &&
        Date.now() - cached.savedAt < CACHE_TTL_MS * 2 &&
        isCompleteDiscovery(cached.data)
      ) return cached.data;
    } catch (error) {
      // Discovery remains available without browser storage.
    }
    return null;
  }

  function writeDiscoveryCache(data) {
    // A transient backend or startup failure must not turn into a long-lived,
    // apparently missing homepage section on every subsequent route visit.
    if (!isCompleteDiscovery(data)) return;
    try {
      window.sessionStorage.setItem(discoveryCacheKey(), JSON.stringify({
        savedAt: Date.now(),
        data: data
      }));
    } catch (error) {
      // Discovery remains available without browser storage.
    }
  }

  function normalizeFacetName(value) {
    return String(value || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9+]+/g, " ")
      .trim();
  }

  function providerTmdbId(item) {
    var ids = item && item.ProviderIds || {};
    return String(ids.Tmdb || ids.TMDB || ids.tmdb || "");
  }

  function seerrImageUrl(path, kind) {
    if (!path) return "";
    return apiUrl("/VixHub/SeerrImage", {
      path: path,
      kind: kind || "backdrop"
    });
  }

  function loadAuthenticatedImage(image, url) {
    function load() {
      window.fetch(url, {
        cache: "force-cache",
        credentials: "same-origin",
        headers: { Authorization: 'MediaBrowser Token="' + apiToken() + '"' }
      }).then(function (response) {
        if (!response.ok) throw new Error("VixHub artwork request failed: " + response.status);
        return response.blob();
      }).then(function (blob) {
        var objectUrl = URL.createObjectURL(blob);
        image.addEventListener("load", function () { URL.revokeObjectURL(objectUrl); }, { once: true });
        image.src = objectUrl;
      }).catch(function () {
        image.classList.add("vixhub-image-unavailable");
      });
    }
    if (!("IntersectionObserver" in window)) {
      load();
      return;
    }
    if (!state.imageObserver) {
      state.imageObserver = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          state.imageObserver.unobserve(entry.target);
          var loader = entry.target.vixhubImageLoader;
          delete entry.target.vixhubImageLoader;
          if (loader) loader();
        });
      }, { rootMargin: "320px 640px" });
    }
    image.vixhubImageLoader = load;
    state.imageObserver.observe(image);
  }

  function fetchSeerr(resource, params) {
    return apiJson("/VixHub/Seerr", Object.assign({ resource: resource }, params || {}))
      .catch(function () { return null; });
  }

  function fetchSeerrPages(resource, pageCount) {
    var requests = [];
    for (var page = 1; page <= pageCount; page += 1) {
      requests.push(fetchSeerr(resource, { page: page }));
    }
    return Promise.all(requests).then(function (pages) {
      var seen = {};
      var results = [];
      pages.forEach(function (data) {
        (data && data.results || []).forEach(function (item) {
          var key = String(item.id || "");
          if (!key || seen[key]) return;
          seen[key] = true;
          results.push(item);
        });
      });
      return results;
    });
  }

  function fetchLibraryCatalog() {
    if (state.libraryCatalogPromise) return state.libraryCatalogPromise;
    state.libraryCatalogPromise = apiJson("/Users/" + currentUserId() + "/Items", {
      recursive: true,
      includeItemTypes: "Movie,Series",
      sortBy: "SortName",
      sortOrder: "Ascending",
      limit: 10000,
      enableTotalRecordCount: false,
      fields: "PrimaryImageAspectRatio,ImageTags,BackdropImageTags,ProductionYear,CommunityRating,OfficialRating,DateCreated,UserData,ProviderIds,Genres,Studios"
    }).then(function (result) {
      return (result.Items || []).filter(function (item) {
        return providerTmdbId(item) && item.ImageTags && item.ImageTags.Primary;
      });
    }).catch(function () {
      return [];
    });
    return state.libraryCatalogPromise;
  }

  function catalogByTmdb(items, mediaType) {
    var result = {};
    items.forEach(function (item) {
      var isExpectedType = mediaType === "Movie" ? item.Type === "Movie" : item.Type === "Series";
      var id = providerTmdbId(item);
      if (isExpectedType && id) result[id] = item;
    });
    return result;
  }

  function rankLibraryFromSeerr(seerrItems, catalog, mediaType) {
    var byTmdb = catalogByTmdb(catalog, mediaType);
    var seen = {};
    return seerrItems.map(function (seerrItem) {
      return byTmdb[String(seerrItem.id || "")];
    }).filter(function (item) {
      if (!item || seen[item.Id]) return false;
      seen[item.Id] = true;
      return true;
    }).slice(0, 18);
  }

  function decorateGenres(localGenres, seerrGenres) {
    var byName = {};
    (seerrGenres || []).forEach(function (genre) {
      byName[normalizeFacetName(genre.name)] = genre;
    });
    return localGenres.map(function (genre) {
      var seerrGenre = byName[normalizeFacetName(genre.Name)];
      var backdrops = seerrGenre && seerrGenre.backdrops || [];
      return Object.assign({}, genre, {
        CoverPath: backdrops[4] || backdrops[0] || ""
      });
    }).filter(function (genre) {
      return genre.CoverPath;
    });
  }

  function decorateBrandFacets(localFacets, definitions) {
    return definitions.map(function (definition) {
      var match = localFacets.find(function (facet) {
        var name = normalizeFacetName(facet.Name);
        return definition.names.some(function (candidate) {
          var normalizedCandidate = normalizeFacetName(candidate);
          return name === normalizedCandidate ||
            name.indexOf(normalizedCandidate) !== -1 ||
            normalizedCandidate.indexOf(name) !== -1;
        });
      });
      return match ? Object.assign({}, match, { LogoPath: definition.path }) : null;
    }).filter(Boolean);
  }

  function chooseRecommendationSeeds(items) {
    var result = [];
    var counts = { Movie: 0, Series: 0 };
    items.forEach(function (item) {
      if (result.length >= 6 || !providerTmdbId(item) || counts[item.Type] >= 3) return;
      counts[item.Type] += 1;
      result.push(item);
    });
    return result;
  }

  function interleaveMediaTypes(items, limit) {
    var movies = items.filter(function (item) { return item.Type === "Movie"; });
    var series = items.filter(function (item) { return item.Type === "Series"; });
    var result = [];
    var movieIndex = 0;
    var seriesIndex = 0;
    var nextType = movies.length && series.length ? "Movie" : (movies.length ? "Movie" : "Series");
    while (result.length < limit && (movieIndex < movies.length || seriesIndex < series.length)) {
      if (nextType === "Movie" && movieIndex < movies.length) {
        result.push(movies[movieIndex++]);
        nextType = "Series";
      } else if (seriesIndex < series.length) {
        result.push(series[seriesIndex++]);
        nextType = "Movie";
      } else if (movieIndex < movies.length) {
        result.push(movies[movieIndex++]);
      }
    }
    return result;
  }

  function fetchTopPicks(catalog, popularMovies, popularSeries) {
    var seedNames = [];
    var playedSnapshot = { ids: null, items: [] };
    return Promise.all([
      apiJson("/Users/" + currentUserId() + "/Items", {
        recursive: true,
        includeItemTypes: "Movie,Series",
        filters: "IsPlayed",
        sortBy: "DatePlayed",
        sortOrder: "Descending",
        limit: 200,
        enableTotalRecordCount: false,
        fields: "ProviderIds,UserData"
      }),
      fetchPlayedSnapshot()
    ]).then(function (results) {
      var result = results[0];
      playedSnapshot = results[1];
      if (!playedSnapshot.ids) return [];
      var seeds = chooseRecommendationSeeds(result.Items || []);
      seedNames = seeds.map(function (seed) { return seed.Name; }).filter(Boolean);
      return Promise.all(seeds.map(function (seed, seedIndex) {
        return Promise.all([
          fetchSeerr(
            seed.Type === "Movie" ? "movie-recommendations" : "tv-recommendations",
            { tmdbId: providerTmdbId(seed), page: 1 }
          ),
          apiJson("/Items/" + seed.Id + "/Similar", {
            userId: currentUserId(),
            limit: 30,
            fields: "PrimaryImageAspectRatio,ImageTags,ProductionYear,CommunityRating,UserData,ProviderIds",
            enableTotalRecordCount: false
          }).catch(function () { return { Items: [] }; })
        ]).then(function (sources) {
          return {
            seedIndex: seedIndex,
            mediaType: seed.Type,
            seerr: sources[0] && sources[0].results || [],
            similar: sources[1] && sources[1].Items || []
          };
        });
      }));
    }).then(function (recommendationGroups) {
      var movieMap = catalogByTmdb(catalog, "Movie");
      var seriesMap = catalogByTmdb(catalog, "Series");
      var scores = {};
      recommendationGroups.forEach(function (group) {
        group.seerr.forEach(function (result, rank) {
          var item = (group.mediaType === "Movie" ? movieMap : seriesMap)[String(result.id || "")];
          if (!isVerifiedUnplayed(item, playedSnapshot)) return;
          var entry = scores[item.Id] || { item: item, score: 0 };
          entry.score += 120 - group.seedIndex * 12 - rank;
          scores[item.Id] = entry;
        });
        group.similar.forEach(function (item, rank) {
          var catalogItem = catalog.find(function (candidate) { return candidate.Id === item.Id; });
          if (!isVerifiedUnplayed(catalogItem, playedSnapshot)) return;
          var entry = scores[catalogItem.Id] || { item: catalogItem, score: 0 };
          entry.score += 96 - group.seedIndex * 10 - rank;
          scores[catalogItem.Id] = entry;
        });
      });
      var ranked = Object.keys(scores).map(function (id) { return scores[id]; })
        .sort(function (left, right) { return right.score - left.score; })
        .map(function (entry) { return entry.item; });
      var seen = {};
      var combined = ranked.concat(interleaveMediaTypes(popularMovies.concat(popularSeries), 24))
        .filter(function (item) {
          if (!isVerifiedUnplayed(item, playedSnapshot) || seen[item.Id]) return false;
          seen[item.Id] = true;
          return true;
        });
      return {
        items: interleaveMediaTypes(combined, 16),
        personalizedCount: ranked.length,
        seedNames: seedNames
      };
    }).catch(function () {
      return {
        items: interleaveMediaTypes(popularMovies.concat(popularSeries), 16).filter(function (item) {
          return isVerifiedUnplayed(item, playedSnapshot);
        }),
        personalizedCount: 0,
        seedNames: seedNames
      };
    });
  }

  function fetchLibraryRail(itemType, sortBy, sortOrder) {
    return apiJson("/Users/" + currentUserId() + "/Items", {
      recursive: true,
      includeItemTypes: itemType,
      sortBy: sortBy,
      sortOrder: sortOrder || "Descending",
      limit: 18,
      enableTotalRecordCount: false,
      fields: "PrimaryImageAspectRatio,ImageTags,BackdropImageTags,ProductionYear,CommunityRating,OfficialRating,DateCreated,UserData,ProviderIds"
    }).then(function (result) {
      return (result.Items || []).filter(function (item) {
        return item.ImageTags && item.ImageTags.Primary;
      });
    }).catch(function () {
      return [];
    });
  }

  function fetchFacets(path, itemType) {
    return apiJson(path, {
      userId: currentUserId(),
      recursive: true,
      includeItemTypes: itemType,
      sortBy: "SortName",
      sortOrder: "Ascending",
      limit: 36,
      enableTotalRecordCount: false,
      fields: "ImageTags"
    }).then(function (result) {
      return (result.Items || []).filter(function (item) {
        return item.Id && item.Name;
      });
    }).catch(function () {
      return [];
    });
  }

  function fetchDiscovery() {
    var cached = readDiscoveryCache();
    if (cached) return Promise.resolve(cached);
    return Promise.all([
      fetchLibraryCatalog(),
      fetchSeerrPages("popular-tv", 5),
      fetchLibraryRail("Series", "DateCreated"),
      fetchFacets("/Genres", "Series"),
      fetchSeerrPages("popular-movies", 5),
      fetchLibraryRail("Movie", "DateCreated"),
      fetchFacets("/Genres", "Movie"),
      fetchFacets("/Studios", "Movie"),
      fetchFacets("/Studios", "Series"),
      fetchSeerr("tv-genres"),
      fetchSeerr("movie-genres"),
      apiJson("/VixHub/LiveTvPrograms", { limit: 18 })
        .catch(function () { return { Items: [] }; })
    ]).then(function (results) {
      var catalog = results[0];
      var popularSeries = rankLibraryFromSeerr(results[1], catalog, "Series");
      var popularMovies = rankLibraryFromSeerr(results[4], catalog, "Movie");
      var data = {
        popularSeries: popularSeries,
        recentSeries: results[2],
        seriesGenres: decorateGenres(results[3], results[9]),
        popularMovies: popularMovies,
        recentMovies: results[5],
        movieGenres: decorateGenres(results[6], results[10]),
        studios: decorateBrandFacets(results[7], SEERR_STUDIOS),
        networks: decorateBrandFacets(results[8], SEERR_NETWORKS),
        livePrograms: results[11] && results[11].Items || [],
        topPicks: []
      };
      return fetchTopPicks(catalog, popularMovies, popularSeries).then(function (topPicks) {
        data.topPicks = topPicks.items;
        data.topPicksEyebrow = topPicks.personalizedCount && topPicks.seedNames.length
          ? "Because you watched " + topPicks.seedNames.slice(0, 2).join(" and ")
          : "Popular and unwatched in your library";
        writeDiscoveryCache(data);
        return data;
      });
    });
  }

  function createDiscoveryRail(title, items) {
    if (!items || !items.length) return null;
    var section = createHomeSection({ title: title, items: items });
    section.removeAttribute("id");
    section.classList.add("vixhub-discovery-section");
    return section;
  }

  function createPosterSection(title, items, eyebrow) {
    if (!items || !items.length) return null;
    var section = element("section", "vixhub-home-section vixhub-poster-section vixhub-discovery-section");
    section.setAttribute("aria-label", title);
    var heading = element("div", "vixhub-home-section__heading");
    if (eyebrow) heading.appendChild(element("span", "vixhub-home-section__eyebrow", eyebrow));
    heading.appendChild(element("h2", "vixhub-home-section__title", title));
    section.appendChild(heading);
    var rail = element("div", "vixhub-poster-rail");
    items.forEach(function (item) {
      var link = element("a", "vixhub-poster-card");
      link.href = "#/details?id=" + encodeURIComponent(item.Id) +
        "&serverId=" + encodeURIComponent(serverId());
      link.setAttribute("aria-label", item.Name);
      link.dataset.itemtype = item.Type || "";
      link.dataset.played = item.UserData && item.UserData.Played ? "true" : "false";
      var image = element("img", "vixhub-poster-card__image");
      image.alt = "";
      image.loading = "lazy";
      image.decoding = "async";
      image.src = imageUrl(item, "Primary", 420);
      var body = element("span", "vixhub-poster-card__body");
      body.appendChild(element("span", "vixhub-poster-card__title", item.Name));
      body.appendChild(element(
        "span",
        "vixhub-poster-card__meta",
        [
          item.ProductionYear,
          item.CommunityRating ? "★ " + item.CommunityRating.toFixed(1) : ""
        ].filter(Boolean).join("  ·  ")
      ));
      link.appendChild(image);
      link.appendChild(body);
      rail.appendChild(link);
    });
    section.appendChild(rail);
    return section;
  }

  function facetHref(kind, item, mediaType) {
    var query = new URLSearchParams({
      serverId: serverId(),
      includeItemTypes: mediaType
    });
    query.set(kind === "genre" ? "genreIds" : "studioIds", item.Id);
    return "#/list?" + query.toString();
  }

  function createFacetSection(title, items, kind, mediaType) {
    if (!items || !items.length) return null;
    var section = element("section", "vixhub-home-section vixhub-facet-section");
    section.setAttribute("aria-label", title);
    var heading = element("div", "vixhub-home-section__heading");
    heading.appendChild(element("h2", "vixhub-home-section__title", title));
    section.appendChild(heading);
    var rail = element("div", "vixhub-facet-rail");
    items.slice(0, 24).forEach(function (item, index) {
      var link = element("a", "vixhub-facet-card");
      link.href = facetHref(kind, item, mediaType);
      link.setAttribute("aria-label", item.Name);
      link.style.setProperty("--vixhub-facet-index", String(index % 6));
      if (item.CoverPath || item.LogoPath) {
        var image = element(
          "img",
          item.LogoPath ? "vixhub-facet-card__image vixhub-facet-card__image--logo" : "vixhub-facet-card__image"
        );
        image.alt = "";
        image.loading = "lazy";
        image.decoding = "async";
        loadAuthenticatedImage(
          image,
          seerrImageUrl(item.LogoPath || item.CoverPath, item.LogoPath ? "logo" : "backdrop")
        );
        link.appendChild(image);
        link.appendChild(element("span", "vixhub-facet-card__shade"));
      }
      link.appendChild(element("span", "vixhub-facet-card__name", item.Name));
      link.appendChild(element("span", "vixhub-facet-card__arrow material-icons", "arrow_forward"));
      rail.appendChild(link);
    });
    section.appendChild(rail);
    return section;
  }

  function createLiveTvSection(items) {
    if (!items || !items.length) return null;
    var section = element("section", "vixhub-home-section vixhub-live-section vixhub-discovery-section");
    section.setAttribute("aria-label", "Live TV on now");
    var heading = element("div", "vixhub-home-section__heading vixhub-live-section__heading");
    heading.appendChild(element("h2", "vixhub-home-section__title", "Live TV · On now"));
    var guide = element("a", "vixhub-live-section__guide", "Open guide");
    guide.href = "#/livetv?tab=1";
    heading.appendChild(guide);
    section.appendChild(heading);
    var rail = element("div", "vixhub-home-section__rail vixhub-live-section__rail");
    items.forEach(function (item) {
      var link = element("a", "vixhub-home-card vixhub-live-card");
      link.href = "#/details?id=" + encodeURIComponent(item.Id) + "&serverId=" + encodeURIComponent(serverId());
      link.setAttribute("aria-label", (item.Name || "Live program") + " on " + (item.ChannelName || "Live TV"));
      var image = element("img", "vixhub-home-card__image");
      image.alt = "";
      image.loading = "lazy";
      image.decoding = "async";
      image.src = imageUrl(item, "Thumb", 720) || imageUrl(item, "Primary", 720) || imageUrl(item, "Backdrop", 720);
      var wash = element("span", "vixhub-home-card__wash");
      var body = element("span", "vixhub-home-card__body vixhub-live-card__body");
      body.appendChild(element("span", "vixhub-live-card__badge", "LIVE"));
      body.appendChild(element("span", "vixhub-home-card__title", item.Name || "Live TV"));
      body.appendChild(element("span", "vixhub-home-card__meta", item.ChannelName || "Live TV"));
      var start = Date.parse(item.StartDate || "");
      var end = Date.parse(item.EndDate || "");
      var progress = end > start ? Math.max(0, Math.min(1, (Date.now() - start) / (end - start))) : 0;
      var progressBar = element("span", "vixhub-live-card__progress");
      var progressValue = element("span", "vixhub-live-card__progress-value");
      progressValue.style.transform = "scaleX(" + progress + ")";
      progressBar.appendChild(progressValue);
      link.appendChild(image);
      link.appendChild(wash);
      link.appendChild(body);
      link.appendChild(progressBar);
      rail.appendChild(link);
    });
    section.appendChild(rail);
    return section;
  }

  function buildDiscovery(data) {
    var root = element("div", "vixhub-discovery");
    root.id = DISCOVERY_ID;
    [
      createPosterSection("Popular TV shows", data.popularSeries),
      createPosterSection("Recently added TV shows", data.recentSeries),
      createFacetSection("Series genres", data.seriesGenres, "genre", "Series"),
      createPosterSection("Popular movies", data.popularMovies),
      createPosterSection("Recently added movies", data.recentMovies),
      createFacetSection("Movie genres", data.movieGenres, "genre", "Movie"),
      createPosterSection("Top picks for you", data.topPicks, data.topPicksEyebrow),
      createFacetSection("Studios", data.studios, "studio", "Movie"),
      createFacetSection("Networks", data.networks, "studio", "Series"),
      createLiveTvSection(data.livePrograms)
    ].forEach(function (section) {
      if (section) root.appendChild(section);
    });
    return root;
  }

  function loadDiscoverySections(placeholder) {
    if (!placeholder || state.discoveryLoading || nativePlaybackIsActive()) return;
    state.discoveryLoading = true;
    placeholder.className = "vixhub-discovery vixhub-discovery--loading";
    placeholder.setAttribute("aria-busy", "true");
    for (var index = 0; index < 3; index += 1) {
      var loadingSection = createHomeSectionSkeleton();
      loadingSection.removeAttribute("id");
      placeholder.appendChild(loadingSection);
    }
    fetchDiscovery().then(function (data) {
      if (!isHomeRoute()) {
        placeholder.remove();
        return;
      }
      placeholder.replaceWith(buildDiscovery(data));
      var oldRecommendations = document.getElementById(HOME_SECTION_ID);
      if (oldRecommendations) oldRecommendations.remove();
      enforceHomeLayout();
    }).catch(function () {
      placeholder.remove();
      if (!state.settings.EnableDiscovery) mountHomeSections();
    }).finally(function () {
      state.discoveryLoading = false;
    });
  }

  function mountDiscoverySections() {
    if (!isHomeRoute() || !state.settings.EnableDiscovery || nativePlaybackIsActive()) return;
    if (document.getElementById(DISCOVERY_ID)) return;
    var container = document.querySelector("#homeTab.is-active .homeSectionsContainer");
    if (!container) return;
    var placeholder = element("div", "vixhub-discovery vixhub-discovery--lazy");
    placeholder.id = DISCOVERY_ID;
    placeholder.setAttribute("aria-label", "More to discover");
    container.appendChild(placeholder);
    enforceHomeLayout();
    function activateDiscovery() {
      if (state.discoveryObserver) state.discoveryObserver.disconnect();
      state.discoveryObserver = null;
      window.removeEventListener("scroll", state.discoveryScrollHandler);
      state.discoveryScrollHandler = null;
      loadDiscoverySections(placeholder);
    }
    if ("IntersectionObserver" in window) {
      state.discoveryObserver = new IntersectionObserver(function (entries) {
        if (entries.some(function (entry) { return entry.isIntersecting; })) activateDiscovery();
      }, { rootMargin: "360px 0px" });
      state.discoveryObserver.observe(placeholder);
    } else {
      state.discoveryScrollHandler = function () {
        if (window.scrollY < 80) return;
        activateDiscovery();
      };
      window.addEventListener("scroll", state.discoveryScrollHandler, { passive: true });
    }
  }

  function scheduleDeferredHome() {
    var schedule = window.requestIdleCallback || function (callback) {
      return window.setTimeout(callback, 500);
    };
    schedule(function () {
      if (!isHomeRoute() || nativePlaybackIsActive()) return;
      enforceHomeLayout();
      mountDiscoverySections();
      if (!state.settings.EnableDiscovery) mountHomeSections();
    }, { timeout: 1800 });
  }

  function sectionHeading(section) {
    var heading = section && section.querySelector("h1,h2,h3,.sectionTitle");
    return heading ? heading.textContent.trim() : "";
  }

  function ensureLiveTvBrowseCard(browseSection) {
    if (!browseSection || browseSection.querySelector(".vixhub-live-library-card")) return;
    var existingLiveTv = Array.prototype.some.call(browseSection.querySelectorAll("a,.card"), function (node) {
      return /^#\/livetv/i.test(node.getAttribute("href") || "") ||
        /^(live tv|televisi[oó]n en directo|televis[aã]o ao vivo|télévision en direct)$/i.test((node.textContent || "").trim());
    });
    if (existingLiveTv) return;
    var items = browseSection.querySelector(".itemsContainer");
    var reference = items && items.querySelector(".card");
    if (!items || !reference) return;
    var card = reference.cloneNode(true);
    card.className = "card overflowBackdropCard card-hoverable vixhub-live-library-card";
    ["data-id", "data-path", "data-prefix", "data-collectiontype"].forEach(function (attribute) {
      card.removeAttribute(attribute);
    });
    card.dataset.index = String(items.children.length);
    card.dataset.type = "LiveTv";
    card.querySelectorAll("a").forEach(function (link) {
      link.href = "#/livetv";
      link.removeAttribute("data-id");
      link.removeAttribute("data-collectiontype");
      link.setAttribute("aria-label", "Live TV");
      link.title = "Live TV";
      if (link.classList.contains("textActionButton")) link.textContent = "Live TV";
    });
    var image = card.querySelector(".cardImageContainer");
    if (image) image.removeAttribute("style");
    var icon = card.querySelector(".cardImageIcon");
    if (icon) {
      icon.className = "cardImageIcon material-icons live_tv";
      icon.textContent = "live_tv";
    }
    card.querySelectorAll("canvas,.cardOverlayContainer,.cardIndicators").forEach(function (node) {
      node.remove();
    });
    items.appendChild(card);
  }

  function enforceHomeLayout() {
    if (!state.settings.LockHomeLayout || !isHomeRoute()) return;
    var container = document.querySelector("#homeTab.is-active .homeSectionsContainer");
    if (!container) return;
    var nativeSections = Array.prototype.filter.call(container.children, function (section) {
      return section.id !== DISCOVERY_ID && section.id !== HOME_SECTION_ID;
    });
    var browse = nativeSections.find(function (section) {
      return /^(my media|browse|mis contenidos|meus conteudos|mes medias|i miei media|meine medien)$/i.test(sectionHeading(section));
    }) || nativeSections.find(function (section) {
      return Boolean(section.querySelector(".card[data-collectiontype],.card[data-isfolder='true']"));
    });
    var continueWatching = nativeSections.find(function (section) {
      return /^(continue watching|seguir viendo|continuar a ver|reprendre la lecture|continua a guardare|weiterschauen)$/i.test(sectionHeading(section));
    });
    var nextUp = nativeSections.find(function (section) {
      return /^(next up|a continuaci[oó]n|a seguir|a suivre|prossimi episodi|als nächstes)$/i.test(sectionHeading(section));
    });
    var liveTvSections = nativeSections.filter(function (section) {
      return /live\s*tv|on now|upcoming/i.test(sectionHeading(section)) || Boolean(section.querySelector(
        ".card[data-type='Program'],.card[data-channelid],a[href^='#/livetv']"
      ));
    });

    if (browse) {
      var browseHeading = browse.querySelector("h1,h2,h3,.sectionTitle");
      if (browseHeading && browseHeading.textContent.trim() !== "Browse") browseHeading.textContent = "Browse";
      browse.classList.add("vixhub-browse-section");
      if (browse.hidden) browse.hidden = false;
      ensureLiveTvBrowseCard(browse);
    }
    [continueWatching, nextUp].concat(liveTvSections).forEach(function (section) {
      if (section && section.hidden) section.hidden = false;
    });
    nativeSections.forEach(function (section) {
      if (section !== browse && section !== continueWatching && section !== nextUp && liveTvSections.indexOf(section) === -1) {
        if (!section.hidden) section.hidden = true;
        if (section.dataset.vixhubManagedHidden !== "true") section.dataset.vixhubManagedHidden = "true";
      }
    });
    var desired = [
      browse,
      continueWatching,
      nextUp,
      document.getElementById(DISCOVERY_ID),
      document.getElementById(HOME_SECTION_ID)
    ].concat(liveTvSections).filter(Boolean).filter(function (section, index, sections) {
      return sections.indexOf(section) === index;
    });
    var visible = Array.prototype.filter.call(container.children, function (section) {
      return !section.hidden;
    });
    var alreadyOrdered = visible.length === desired.length && desired.every(function (section, index) {
      return visible[index] === section;
    });
    if (!alreadyOrdered) {
      desired.forEach(function (section) {
        container.appendChild(section);
      });
    }
  }

  function lockHomePreferences() {
    var locked = state.settings.LockHomeLayout && window.location.hash.toLowerCase().indexOf("#/mypreferenceshome") === 0;
    document.documentElement.classList.toggle("vixhub-route-homeprefs-locked", locked);
    if (!locked) return;
    var page = document.querySelector(".page:not(.hide)") || document.querySelector("main");
    if (!page || page.querySelector(".vixhub-managed-layout-note")) return;
    var note = element("section", "vixhub-managed-layout-note");
    note.innerHTML = '<img src="/VixHub/Assets/vixhub-mark.png" alt=""><div><h1>Home is managed by VixHub</h1><p>The shared discovery order is optimized for every client and cannot be rearranged per user.</p><a href="#/mypreferencesdisplay">Back to display preferences</a></div>';
    page.insertBefore(note, page.firstChild);
  }

  function mountHomeSections() {
    if (!isHomeRoute() || !state.settings.EnableHomeSections || nativePlaybackIsActive()) return;
    if (document.getElementById(HOME_SECTION_ID) || state.homeSectionLoading) return;
    var container = document.querySelector("#homeTab.is-active .homeSectionsContainer");
    if (!container) return;
    state.homeSectionLoading = true;
    var skeleton = createHomeSectionSkeleton();
    container.appendChild(skeleton);
    enforceHomeLayout();
    fetchBecauseYouWatched().then(function (sectionData) {
      if (
        !sectionData ||
        !sectionData.items.length ||
        !isHomeRoute()
      ) {
        skeleton.remove();
        return;
      }
      skeleton.replaceWith(createHomeSection(sectionData));
      enforceHomeLayout();
    }).catch(function () {
      skeleton.remove();
    }).finally(function () {
      state.homeSectionLoading = false;
    });
  }

  function loadSettings() {
    return apiJson("/VixHub/Settings", {}).then(function (settings) {
      Object.keys(state.settings).forEach(function (key) {
        if (Object.prototype.hasOwnProperty.call(settings, key)) {
          state.settings[key] = settings[key];
        }
      });
    }).catch(function () {
      // Defaults keep the UI usable if the server plugin is temporarily absent.
    });
  }

  function waitForApi() {
    if (
      window.ApiClient &&
      currentApiIsReady(window.ApiClient)
    ) {
      state.apiClient = window.ApiClient;
      loadSettings().then(function () {
        scheduleNavbarEnhancement();
        lockHomePreferences();
        mount();
        if (!state.settings.EnableHero) scheduleDeferredHome();
        enforceHomeLayout();
      });
      return;
    }
    if (Date.now() - state.startedAt < API_WAIT_MS) {
      window.setTimeout(waitForApi, 250);
    }
  }

  function currentApiIsReady(client) {
    try {
      return Boolean(
        client &&
        typeof client.getCurrentUserId === "function" &&
        client.getCurrentUserId() &&
        client._serverInfo &&
        client._serverInfo.AccessToken
      );
    } catch (error) {
      return false;
    }
  }

  function recoverAfterSleep() {
    if (state.apiClient && typeof state.apiClient.ensureWebSocket === "function") {
      try {
        state.apiClient.ensureWebSocket();
      } catch (error) {
        // Jellyfin's own reconnect path remains the fallback.
      }
    }
    apiJson("/System/Info/Public", {}).then(function () {
      if (!nativePlaybackIsActive()) mount();
    }).catch(function () {
      // A later route or visibility event will retry.
    });
  }

  window.addEventListener("hashchange", function () {
    syncRoutePresentation(true);
    scheduleNavbarEnhancement();
    window.setTimeout(function () {
      lockHomePreferences();
      mount();
      enforceHomeLayout();
    }, 0);
  });
  window.addEventListener("pageshow", function (event) {
    if (event.persisted) recoverAfterSleep();
    window.setTimeout(mount, 0);
  });
  window.addEventListener("online", recoverAfterSleep);
  document.addEventListener("visibilitychange", function () {
    if (document.hidden) {
      stopRotation();
      var video = state.hero && state.hero.querySelector(".vixhub-hero__video");
      if (video) video.pause();
    }
    else {
      recoverAfterSleep();
      startRotation();
      var visibleVideo = state.hero && state.hero.querySelector(".vixhub-hero__video");
      if (visibleVideo && visibleVideo.src && !nativePlaybackIsActive()) visibleVideo.play().catch(function () {});
    }
  });

  state.observer = new MutationObserver(function () {
    scheduleNavbarEnhancement();
    syncRoutePresentation(false);
    lockHomePreferences();
    if (nativePlaybackIsActive()) {
      stopHeroVideo();
      stopRotation();
      return;
    }
    if (isHomeRoute() && !document.getElementById(HERO_ID)) mount();
    if (isHomeRoute()) enforceHomeLayout();
  });
  state.observer.observe(document.documentElement, { childList: true, subtree: true });
  syncRoutePresentation(false);
  scheduleNavbarEnhancement();
  waitForApi();
}());
