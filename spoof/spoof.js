(() => {
    const spoofedProfile = {
      userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
      appVersion: "5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
      platform: "MacIntel",
      language: "fr-FR",
      languages: ["fr-FR", "fr"],
      hardwareConcurrency: 4,
      deviceMemory: 8,
      screen: { width: 1440, height: 900 },
      timeZone: "Europe/Paris",
      timeZoneOffset: -120
    };
  
    const spoofedUAData = {
      brands: [
        { brand: "Chromium", version: "119" },
        { brand: "NotABrand", version: "99" }
      ],
      mobile: false,
      platform: "macOS",
      architecture: "x86",
      bitness: "64",
      model: "",
      uaFullVersion: "119.0.0.0"
    };
  
    const override = (object, prop, value) => {
      try {
        Object.defineProperty(object, prop, {
          get: () => value,
          configurable: true
        });
      } catch (err) {
        console.warn(`[GhostShell] Could not override ${prop}:`, err);
      }
    };
  
    // === Core navigator overrides ===
    override(navigator, 'userAgent', spoofedProfile.userAgent);
    override(navigator, 'appVersion', spoofedProfile.appVersion);
    override(navigator, 'platform', spoofedProfile.platform);
    override(navigator, 'language', spoofedProfile.language);
    override(navigator, 'languages', spoofedProfile.languages);
    override(navigator, 'hardwareConcurrency', spoofedProfile.hardwareConcurrency);
    override(navigator, 'deviceMemory', spoofedProfile.deviceMemory);
    override(screen, 'width', spoofedProfile.screen.width);
    override(screen, 'height', spoofedProfile.screen.height);
  
    if ('userAgentData' in navigator) {
      const originalUAData = navigator.userAgentData;
      Object.defineProperty(navigator, 'userAgentData', {
        get: () => ({
          ...originalUAData,
          brands: spoofedUAData.brands,
          mobile: spoofedUAData.mobile,
          platform: spoofedUAData.platform,
          getHighEntropyValues: async (hints) => {
            const result = {};
            for (const hint of hints) {
              switch (hint) {
                case 'architecture': result.architecture = spoofedUAData.architecture; break;
                case 'bitness': result.bitness = spoofedUAData.bitness; break;
                case 'model': result.model = spoofedUAData.model; break;
                case 'platform': result.platform = spoofedUAData.platform; break;
                case 'uaFullVersion': result.uaFullVersion = spoofedUAData.uaFullVersion; break;
                default: result[hint] = '';
              }
            }
            return result;
          }
        }),
        configurable: true
      });
    }
  
    // === Timezone spoofing ===
    Intl.DateTimeFormat.prototype.resolvedOptions = function () {
      return { timeZone: spoofedProfile.timeZone };
    };
    Date.prototype.getTimezoneOffset = () => spoofedProfile.timeZoneOffset;
    const originalToString = Date.prototype.toString;
    Date.prototype.toString = function () {
      return originalToString.call(this)
        .replace(/\(.*\)/, `(Central European Summer Time)`)
        .replace(/GMT[+-]\d{4}/, 'GMT+0200');
    };
  
    // === Canvas spoofing ===
    const addNoise = (canvas, ctx) => {
      const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
      for (let i = 0; i < data.data.length; i += 4) {
        data.data[i] += Math.floor(Math.random() * 3) - 1;
        data.data[i + 1] += Math.floor(Math.random() * 3) - 1;
        data.data[i + 2] += Math.floor(Math.random() * 3) - 1;
      }
      ctx.putImageData(data, 0, 0);
    };
  
    const originalGetContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type, ...args) {
      const ctx = originalGetContext.call(this, type, ...args);
      if (type === '2d') {
        const origToDataURL = this.toDataURL;
        this.toDataURL = (...params) => {
          addNoise(this, ctx);
          return origToDataURL.apply(this, params);
        };
        const origGetImageData = ctx.getImageData;
        ctx.getImageData = function (...params) {
          addNoise(this.canvas, ctx);
          return origGetImageData.apply(this, params);
        };
      }
      return ctx;
    };
  
    // === WebGL spoofing ===
    const spoofedWebGLParams = {
      VENDOR: "GhostShell Inc.",
      RENDERER: "GhostGPU 9000",
      VERSION: "WebGL 2.0 (FakeGL)",
      SHADING_LANGUAGE_VERSION: "WebGL GLSL ES 3.00 (Ghost)"
    };
  
    const patchWebGL = (ctx) => {
      const orig = ctx.getParameter;
      ctx.getParameter = function (p) {
        switch (p) {
          case ctx.VENDOR: return spoofedWebGLParams.VENDOR;
          case ctx.RENDERER: return spoofedWebGLParams.RENDERER;
          case ctx.VERSION: return spoofedWebGLParams.VERSION;
          case ctx.SHADING_LANGUAGE_VERSION: return spoofedWebGLParams.SHADING_LANGUAGE_VERSION;
          default: return orig.call(this, p);
        }
      };
      ctx.getShaderPrecisionFormat = () => ({ rangeMin: 999, rangeMax: 999, precision: 999 });
      ctx.getSupportedExtensions = () => ['WEBGL_lose_context'];
    };
  
    const origGLCtx = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type, ...args) {
      const ctx = origGLCtx.call(this, type, ...args);
      if (['webgl', 'webgl2'].includes(type) && ctx) patchWebGL(ctx);
      return ctx;
    };
  
    // === AudioContext spoofing ===
    const patchAudio = (ACtx) => {
      const orig = ACtx.prototype.createAnalyser;
      ACtx.prototype.createAnalyser = function () {
        const analyser = orig.call(this);
        const float = analyser.getFloatFrequencyData;
        const byte = analyser.getByteFrequencyData;
  
        analyser.getFloatFrequencyData = function (arr) {
          float.call(this, arr);
          for (let i = 0; i < arr.length; i++) arr[i] += (Math.random() * 0.1 - 0.05);
        };
        analyser.getByteFrequencyData = function (arr) {
          byte.call(this, arr);
          for (let i = 0; i < arr.length; i++) arr[i] += Math.floor(Math.random() * 3) - 1;
        };
        return analyser;
      };
    };
  
    if (window.AudioContext) patchAudio(window.AudioContext);
    if (window.webkitAudioContext) patchAudio(window.webkitAudioContext);
  
    // === Storage spoofing ===
    if (navigator.storage && navigator.storage.estimate) {
      navigator.storage.estimate = async () => ({
        quota: 256 * 1024 * 1024 * 1024,
        usage: 128 * 1024 * 1024 * 1024
      });
    }
  
    // === Battery spoofing ===
    if (navigator.getBattery) {
      navigator.getBattery = () => Promise.resolve({
        charging: false,
        chargingTime: Infinity,
        dischargingTime: 3600,
        level: 0.75,
        onchargingchange: null,
        onchargingtimechange: null,
        ondischargingtimechange: null,
        onlevelchange: null
      });
    }
  
    // === RAM memory spoof (performance.memory)
    if ('performance' in window && 'memory' in performance) {
      override(performance, 'memory', {
        jsHeapSizeLimit: 2190000000,
        totalJSHeapSize: 50000000,
        usedJSHeapSize: 35000000
      });
    }
  
    // === Plugin + Mime spoof
    override(navigator, 'plugins', []);
    override(navigator, 'mimeTypes', []);
  
    // === Media devices spoof
    if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
      navigator.mediaDevices.enumerateDevices = async () => [];
    }
  
    // === Fake "resistance" props for fingerprint detectors
    navigator.ghostshellResistance = {
      privacy: true,
      mode: "stealth",
      security: "locked",
      shadow: "🛡️ GhostShell"
    };
  
    console.log('[GhostShell] FULL spoof mode enabled.');
  })();
  