(function () {
  // Generate or retrieve a session ID
  const getSessionId = () => {
    let sessionId = sessionStorage.getItem('tracking_session_id');
    if (!sessionId) {
      sessionId = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2);
      sessionStorage.setItem('tracking_session_id', sessionId);
    }
    return sessionId;
  };

  // Function to collect browser info
  const getBrowserInfo = () => {
    const ua = navigator.userAgent;
    let tem, 
      match = ua.match(/(opera|chrome|safari|firefox|edge|trident(?=\/))\/?\s*(\d+)/i) || [];
    if (/trident/i.test(match[1])) {
      tem = /\brv[ :]+(\d+)/g.exec(ua) || [];
      return { name: "IE", version: tem[1] || "" };
    }
    if (match[1] === "Chrome") {
      tem = ua.match(/\b(OPR|Edg)\/(\d+)/);
      if (tem) return { name: tem[1].replace("OPR", "Opera").replace("Edg", "Edge"), version: tem[2] };
    }
    match = match[2] ? [match[1], match[2]] : [navigator.appName, navigator.appVersion, "-?"];
    tem = ua.match(/version\/(\d+)/i);
    if (tem) match.splice(1, 1, tem[1]);
    return { name: match[0], version: match[1] };
  };

  // Canvas fingerprinting for bot detection
  const getCanvasFingerprint = () => {
    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      ctx.textBaseline = 'top';
      ctx.font = '14px Arial';
      ctx.fillStyle = '#f60';
      ctx.fillRect(125, 1, 62, 20);
      ctx.fillStyle = '#069';
      ctx.fillText('Hello, World!', 2, 15);
      return canvas.toDataURL();
    } catch (e) {
      return null; // Bots may fail canvas rendering
    }
  };

  // State for tracking
  let pageStartTime = Date.now();
  let clicks = [];
  let mouseMovements = [];
  let scrollEvents = [];
  let keyEvents = []; // New: Track keyboard events
  let touchEvents = []; // New: Track touch events
  let maxScrollDepth = 0;
  let lastMousePosition = null;
  let lastTrackedUrl = null;
  let lastScrollPosition = null;
  let firstInteractionTime = null; // New: Track time to first interaction
  let mouseEntropy = 0; // New: Track mouse movement randomness
  let lastKeyTime = null; // New: For typing speed

  // Calculate scroll depth
  const getScrollDepth = () => {
    const scrollY = window.scrollY || window.pageYOffset;
    const windowHeight = window.innerHeight;
    const documentHeight = Math.max(
      document.body.scrollHeight,
      document.body.offsetHeight,
      document.documentElement.clientHeight,
      document.documentElement.scrollHeight,
      document.documentElement.offsetHeight
    );
    const maxVisibleHeight = scrollY + windowHeight;
    const scrollPercentage = documentHeight > 0 ? Math.min(100, (maxVisibleHeight / documentHeight) * 100) : 0;
    return { y: scrollY, percentage: Number(scrollPercentage.toFixed(2)) };
  };

  // Calculate mouse movement entropy
  const calculateMouseEntropy = (movements) => {
    if (movements.length < 2) return 0;
    let entropy = 0;
    const distances = [];
    for (let i = 1; i < movements.length; i++) {
      const dx = movements[i].x - movements[i - 1].x;
      const dy = movements[i].y - movements[i - 1].y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      distances.push(distance);
    }
    const mean = distances.reduce((sum, d) => sum + d, 0) / distances.length;
    const variance = distances.reduce((sum, d) => sum + Math.pow(d - mean, 2), 0) / distances.length;
    return Number(Math.sqrt(variance).toFixed(2)); // Standard deviation as entropy proxy
  };

  // Collect tracking data
  const collectData = () => {
    const now = Date.now();
    const timeSpent = (now - pageStartTime) / 1000; // Seconds
    return {
      url: window.location.href,
      referrer: document.referrer,
      userAgent: navigator.userAgent,
      language: navigator.language,
      platform: navigator.platform,
      browser: getBrowserInfo(),
      pageTitle: document.title,
      screenWidth: screen.width,
      screenHeight: screen.height,
      colorDepth: screen.colorDepth,
      deviceMemory: navigator.deviceMemory || null,
      hardwareConcurrency: navigator.hardwareConcurrency || null,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      cookieEnabled: navigator.cookieEnabled,
      localStorage: typeof localStorage !== "undefined",
      sessionStorage: typeof sessionStorage !== "undefined",
      historyLength: history.length,
      plugins: Array.from(navigator.plugins || []).map(p => p.name),
      connection: navigator.connection ? {
        effectiveType: navigator.connection.effectiveType,
        downlink: navigator.connection.downlink,
        rtt: navigator.connection.rtt
      } : null,
      touchSupport: 'ontouchstart' in window || navigator.maxTouchPoints > 0,
      timestamp: new Date().toISOString(),
      sessionId: getSessionId(),
      timeSpent: timeSpent,
      clicks: clicks,
      mouseMovements: mouseMovements,
      scrollEvents: scrollEvents,
      keyEvents: keyEvents, // New
      touchEvents: touchEvents, // New
      maxScrollDepth: maxScrollDepth,
      canvasFingerprint: getCanvasFingerprint(), // New
      isHeadless: navigator.webdriver || !window.chrome || !navigator.plugins.length, // New: Headless detection
      timeToFirstInteraction: firstInteractionTime ? (firstInteractionTime - pageStartTime) / 1000 : null, // New
      mouseEntropy: calculateMouseEntropy(mouseMovements) // New
    };
  };

  // Send tracking data
  const sendTrackingData = async (data) => {
    try {
      await fetch("http://localhost:3001/api/track", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(data)
      });
    } catch (err) {
      console.error('Tracking error:', err);
    }
  };

  // Debounce and throttle utilities
  const debounce = (func, wait) => {
    let timeout;
    return (...args) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => func(...args), wait);
    };
  };

  const throttle = (func, wait) => {
    let lastTime = 0;
    return (...args) => {
      const now = Date.now();
      if (now - lastTime >= wait) {
        func(...args);
        lastTime = now;
      }
    };
  };

  // Track page view
  const trackPageView = debounce(() => {
    const data = collectData();
    if (data.url !== lastTrackedUrl) {
      lastTrackedUrl = data.url;
      sendTrackingData(data);
      // Reset tracking state
      pageStartTime = Date.now();
      clicks = [];
      mouseMovements = [];
      scrollEvents = [];
      keyEvents = []; // New
      touchEvents = []; // New
      maxScrollDepth = 0;
      lastMousePosition = null;
      lastScrollPosition = null;
      firstInteractionTime = null; // New
      mouseEntropy = 0; // New
      lastKeyTime = null; // New
    }
  }, 300);

  // Set first interaction time
  const setFirstInteraction = () => {
    if (!firstInteractionTime) {
      firstInteractionTime = Date.now();
    }
  };

  // Capture mouse clicks
  document.addEventListener('click', (event) => {
    setFirstInteraction();
    const element = event.target;
    const tagName = element.tagName.toLowerCase();
    const className = element.className || '';
    const id = element.id || '';
    clicks.push({
      x: event.clientX,
      y: event.clientY,
      timestamp: new Date().toISOString(),
      element: { tagName, className, id }
    });
  });

  // Capture mouse movements (sampled every 100ms)
  document.addEventListener('mousemove', throttle((event) => {
    setFirstInteraction();
    const now = Date.now();
    const currentPosition = { x: event.clientX, y: event.clientY };
    if (!lastMousePosition || 
        Math.abs(currentPosition.x - lastMousePosition.x) > 10 || 
        Math.abs(currentPosition.y - lastMousePosition.y) > 10) {
      mouseMovements.push({
        x: currentPosition.x,
        y: currentPosition.y,
        timestamp: new Date().toISOString()
      });
      lastMousePosition = currentPosition;
    }
  }, 100), { passive: true });

  // Capture scroll events (throttled every 500ms)
  document.addEventListener('scroll', throttle(() => {
    setFirstInteraction();
    const scrollData = getScrollDepth();
    maxScrollDepth = Math.max(maxScrollDepth, scrollData.percentage);
    if (!lastScrollPosition || 
        Math.abs(scrollData.y - lastScrollPosition.y) > 50) {
      scrollEvents.push({
        y: scrollData.y,
        percentage: scrollData.percentage,
        timestamp: new Date().toISOString()
      });
      lastScrollPosition = scrollData;
    }
  }, 500), { passive: true });

  // Capture keyboard events
  document.addEventListener('keydown', (event) => {
    setFirstInteraction();
    const now = Date.now();
    const keyTimeDelta = lastKeyTime ? (now - lastKeyTime) / 1000 : null; // Time between keypresses
    lastKeyTime = now;
    keyEvents.push({
      key: event.key,
      code: event.code,
      timestamp: new Date().toISOString(),
      timeDelta: keyTimeDelta // Time since last keypress
    });
  }, { passive: true });

  // Capture touch events
  document.addEventListener('touchstart', (event) => {
    setFirstInteraction();
    const touches = Array.from(event.touches).map(touch => ({
      x: touch.clientX,
      y: touch.clientY,
      force: touch.force || null, // Pressure, if available
      timestamp: new Date().toISOString()
    }));
    touchEvents.push(...touches);
  }, { passive: true });

  // Track initial page load
  trackPageView();

  // Handle SPA navigations
  const originalPushState = history.pushState;
  const originalReplaceState = history.replaceState;

  history.pushState = function (...args) {
    originalPushState.apply(this, args);
    trackPageView();
  };

  history.replaceState = function (...args) {
    originalReplaceState.apply(this, args);
    trackPageView();
  };

  // Handle browser back/forward
  window.addEventListener('popstate', trackPageView);

  // Track on page unload (for MPAs)
  window.addEventListener('beforeunload', () => {
    const data = collectData();
    if (data.url === lastTrackedUrl) {
      sendTrackingData(data); // Send final data for current page
    }
  });
})();