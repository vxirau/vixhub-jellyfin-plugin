(function () {
  "use strict";

  document.documentElement.classList.add("vixhub-theme");

  var HERO_ID = "vixhub-recommendation-hero";
  var HOME_SECTION_ID = "vixhub-because-you-watched";
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
    playedSnapshotPromise: null,
    routeTransitionTimer: null,
    settings: {
      EnableHero: true,
      EnableNavbar: true,
      EnableHomeSections: true,
      EnableLocalTrailerVideo: true,
      HeroHeightVh: 64
    }
  };

  var lucideIcons = {
    heart: '<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 0 0 0-7.78Z"/>',
    film: '<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M7 3v18M17 3v18M3 7.5h4M3 16.5h4M17 7.5h4M17 16.5h4"/>',
    tv: '<rect width="20" height="15" x="2" y="7" rx="2"/><path d="m17 2-5 5-5-5"/>',
    users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
    cast: '<path d="M2 16.1a5 5 0 0 1 5 5M2 12.05a9 9 0 0 1 9 9M2 8V5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-5"/><circle cx="2" cy="21" r="1"/>',
    search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
    layers: '<path d="m12.83 2.18 8 4a2 2 0 0 1 0 3.58l-8 4a2 2 0 0 1-1.66 0l-8-4a2 2 0 0 1 0-3.58l8-4a2 2 0 0 1 1.66 0Z"/><path d="m22 12.5-9.17 4.59a2 2 0 0 1-1.66 0L2 12.5M22 17.5l-9.17 4.59a2 2 0 0 1-1.66 0L2 17.5"/>'
  };

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

    replaceNavIcon(navbar.querySelector('a[href^="#/home?tab=1"]'), "heart");
    replaceNavIcon(navbar.querySelector('a[href^="#/movies"]'), "film");
    replaceNavIcon(navbar.querySelector('a[href^="#/tv"]'), "tv");
    replaceNavIcon(navbar.querySelector('a[href^="#/boxsets"]'), "layers");
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
          (href.indexOf("#/home?tab=1") === 0 && window.location.hash.indexOf("#/home?tab=1") === 0) ||
          (href === "#/" && isHomeRoute());
        if (active) link.setAttribute("aria-current", "page");
        else link.removeAttribute("aria-current");
      }
    );
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

  function isDashboardRoute() {
    return window.location.hash.toLowerCase().indexOf("#/dashboard") === 0;
  }

  function syncRoutePresentation(animate) {
    var hash = window.location.hash.toLowerCase();
    var root = document.documentElement;
    root.classList.toggle("vixhub-route-detail", hash.indexOf("#/details") === 0);
    root.classList.toggle("vixhub-route-home", isHomeRoute());
    root.classList.toggle("vixhub-route-playback", isPlaybackRoute());
    root.classList.toggle("vixhub-route-dashboard", isDashboardRoute());
    if (!animate || isPlaybackRoute()) return;

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

    return fetchPlayedSnapshot().then(function (playedSnapshot) {
      var cached = readCache();
      if (cached) {
        var verifiedCached = cached.filter(function (item) {
          return item.Type === "BoxSet" || isVerifiedUnplayed(item, playedSnapshot);
        });
        if (verifiedCached.length >= 6) return verifiedCached.slice(0, 10);
      }

      var recommendations = apiJson("/Movies/Recommendations", {
        userId: userId,
        itemLimit: 8,
        categoryLimit: 4,
        fields: fields
      }).then(function (groups) {
        return (groups || []).reduce(function (items, group) {
          return items.concat(group.Items || []);
        }, []);
      }).catch(function () {
        return [];
      });

      var discovery = apiJson("/Items", {
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

      return Promise.all([recommendations, discovery, collections]).then(function (results) {
        var titles = uniqueItems(results[0].concat(results[1])).filter(function (item) {
          return isVerifiedUnplayed(item, playedSnapshot);
        });
        var items = mergeFeaturedItems(titles, results[2]);
        writeCache(items);
        return items;
      });
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

    actions.appendChild(play);
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
    progressValue.style.transform = "scaleX(" + ((state.index + 1) / state.items.length) + ")";
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
      state.playedSnapshotPromise = null;
      var section = document.getElementById(HOME_SECTION_ID);
      if (section) section.remove();
    }
  }

  function mount() {
    if (!isHomeRoute()) {
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
        return;
      }
      state.items = items;
      showSlide(0);
    }).catch(function (error) {
      console.warn("VixHub hero could not load recommendations", error);
      unmount(false);
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

    return fetchPlayedSnapshot().then(function (playedSnapshot) {
      if (!playedSnapshot.ids) return null;
      var cached = readHomeSectionCache();
      if (cached) {
        cached.items = (cached.items || []).filter(function (item) {
          return isVerifiedUnplayed(item, playedSnapshot);
        });
        if (cached.items.length >= 6) return cached;
      }

      function fetchTopPicks() {
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
              return item.ImageTags &&
                item.ImageTags.Primary &&
                isVerifiedUnplayed(item, playedSnapshot);
            }).slice(0, 12)
          };
        });
      }

      var seed = playedSnapshot.items[0];
      if (!seed) return fetchTopPicks();
      return apiJson("/Items/" + seed.Id + "/Similar", {
        userId: userId,
        limit: 30,
        fields: fields
      }).then(function (similar) {
        var section = {
          title: "Because you watched " + seed.Name,
          items: (similar.Items || []).filter(function (item) {
            return item.ImageTags &&
              item.ImageTags.Primary &&
              isVerifiedUnplayed(item, playedSnapshot);
          }).slice(0, 12)
        };
        if (section.items.length) return section;
        return fetchTopPicks();
      });
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

  function mountHomeSections() {
    if (!isHomeRoute() || !state.settings.EnableHomeSections) return;
    if (document.getElementById(HOME_SECTION_ID) || state.homeSectionLoading) return;
    var container = document.querySelector("#homeTab.is-active .homeSectionsContainer");
    if (!container) return;
    state.homeSectionLoading = true;
    var skeleton = createHomeSectionSkeleton();
    container.insertBefore(skeleton, container.firstChild);
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
        mount();
        mountHomeSections();
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
      mount();
    }).catch(function () {
      // A later route or visibility event will retry.
    });
  }

  window.addEventListener("hashchange", function () {
    syncRoutePresentation(true);
    scheduleNavbarEnhancement();
    window.setTimeout(function () {
      mount();
      mountHomeSections();
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
      if (visibleVideo && visibleVideo.src) visibleVideo.play().catch(function () {});
    }
  });

  state.observer = new MutationObserver(function () {
    scheduleNavbarEnhancement();
    if (isHomeRoute() && !document.getElementById(HERO_ID)) mount();
    if (isHomeRoute() && !document.getElementById(HOME_SECTION_ID)) mountHomeSections();
  });
  state.observer.observe(document.documentElement, { childList: true, subtree: true });
  syncRoutePresentation(false);
  scheduleNavbarEnhancement();
  waitForApi();
}());
