const express = require("express");
const router = express.Router();
const clickhouse = require("../clickhouse/config");
const { randomUUID } = require("crypto");
const { URL } = require("url");
const { calculateBotScore } = require("../utils/calculateBotScore");

// Track event endpoint (moved from index.js)
router.post("/track", async (req, res) => {
  const data = req.body;

  // Validate required fields
  if (!data.url || !data.userAgent || !data.timestamp) {
    return res.status(400).json({ message: "Missing required fields: url, userAgent, or timestamp" });
  }

  // Extract websiteId from page_url
  let websiteId;
  try {
    const parsedUrl = new URL(data.url);
    const hostname = parsedUrl.hostname;
    websiteId = hostname.startsWith("www.") ? hostname.slice(4) : hostname;
  } catch (err) {
    console.error("URL Parsing Error:", err.message);
    return res.status(400).json({ message: "Invalid URL format" });
  }

  const botScore = calculateBotScore(data);

  // Prepare data for insertion
  const eventTime = new Date(data.timestamp).toISOString().replace(/\.\d+Z$/, ".000");
  const sessionId = data.sessionId || randomUUID();

  // Helper function to format timestamp for DateTime64(3)
  const formatTimestamp = (ts) => {
    try {
      const date = new Date(ts);
      if (isNaN(date.getTime())) throw new Error("Invalid timestamp");
      return date.toISOString().replace(/\.\d+Z$/, ".000");
    } catch {
      return "1970-01-01 00:00:00.000"; // Fallback for invalid timestamps
    }
  };

  // Helper function to escape single quotes for ClickHouse
  const escapeString = (str) => (str || "").toString().replace(/'/g, "''");

  // Format arrays for ClickHouse
  const formatArray = (items, fields) => {
    if (!Array.isArray(items)) return "[]";
    return `[${items
      .map((item) => {
        const values = fields
          .map((field) => {
            if (field.type === "timestamp") {
              return `'${formatTimestamp(item[field.key])}'`;
            } else if (field.type === "string") {
              return `'${escapeString(item[field.key])}'`;
            } else {
              return item[field.key] || 0;
            }
          })
          .join(", ");
        return `(${values})`;
      })
      .join(", ")}]`;
  };

  // Define field mappings for arrays
  const clicksFields = [
    { key: "x", type: "number" },
    { key: "y", type: "number" },
    { key: "timestamp", type: "timestamp" },
    { key: "element_tag", type: "string" },
    { key: "element_class", type: "string" },
    { key: "element_id", type: "string" },
  ];
  const mouseMovementsFields = [
    { key: "x", type: "number" },
    { key: "y", type: "number" },
    { key: "timestamp", type: "timestamp" },
  ];
  const scrollEventsFields = [
    { key: "y", type: "number" },
    { key: "percentage", type: "number" },
    { key: "timestamp", type: "timestamp" },
  ];

  // Format metadata as ClickHouse Map
  const formatMetadata = (data) => {
    const plugins = escapeString((data.plugins || []).join(", "));
    return `{'plugins':'${plugins}'}`;
  };

  // Prepare fields
  const fields = {
    event_time: eventTime,
    website_id: websiteId,
    session_id: sessionId,
    user_ip: req.ip,
    user_agent: escapeString(data.userAgent),
    page_url: escapeString(data.url),
    referrer: escapeString(data.referrer || ""),
    event_type: "pageview",
    page_title: escapeString(data.pageTitle || ""),
    screen_width: data.screenWidth || 0,
    screen_height: data.screenHeight || 0,
    color_depth: data.colorDepth || 0,
    device_memory: data.deviceMemory || 0,
    hardware_concurrency: data.hardwareConcurrency || 0,
    timezone: escapeString(data.timezone || ""),
    cookie_enabled: data.cookieEnabled ? 1 : 0,
    local_storage: data.localStorage ? 1 : 0,
    session_storage: data.sessionStorage ? 1 : 0,
    history_length: data.historyLength || 0,
    connection_effective_type: escapeString(data.connection?.effectiveType || ""),
    connection_downlink: data.connection?.downlink || 0,
    connection_rtt: data.connection?.rtt || 0,
    touch_support: data.touchSupport ? 1 : 0,
    mouse_entropy: data.mouseEntropy || 0,
    bot_score: botScore,
    clicks: formatArray(
      (data.clicks || []).map((click) => ({
        x: click.x || 0,
        y: click.y || 0,
        timestamp: click.timestamp,
        element_tag: click.element?.tagName || "",
        element_class: click.element?.className || "",
        element_id: click.element?.id || "",
      })),
      clicksFields
    ),
    mouse_movements: formatArray(
      (data.mouseMovements || []).map((move) => ({
        x: move.x || 0,
        y: move.y || 0,
        timestamp: move.timestamp,
      })),
      mouseMovementsFields
    ),
    scroll_events: formatArray(
      (data.scrollEvents || []).map((scroll) => ({
        y: scroll.y || 0,
        percentage: scroll.percentage || 0,
        timestamp: scroll.timestamp,
      })),
      scrollEventsFields
    ),
    metadata: formatMetadata(data),
  };

  // Construct the insert query
  const insertQuery = `
    INSERT INTO analytics.website_events (
      event_time, website_id, session_id, user_ip, user_agent, page_url, referrer,
      event_type, page_title, screen_width, screen_height, color_depth, device_memory,
      hardware_concurrency, timezone, cookie_enabled, local_storage, session_storage,
      history_length, connection_effective_type, connection_downlink, connection_rtt,
      touch_support, bot_score,
      clicks, mouse_movements, scroll_events, metadata
    )
    VALUES (
      '${fields.event_time}',
      '${fields.website_id}',
      '${fields.session_id}',
      '${fields.user_ip}',
      '${fields.user_agent}',
      '${fields.page_url}',
      '${fields.referrer}',
      '${fields.event_type}',
      '${fields.page_title}',
      ${fields.screen_width},
      ${fields.screen_height},
      ${fields.color_depth},
      ${fields.device_memory},
      ${fields.hardware_concurrency},
      '${fields.timezone}',
      ${fields.cookie_enabled},
      ${fields.local_storage},
      ${fields.session_storage},
      ${fields.history_length},
      '${fields.connection_effective_type}',
      ${fields.connection_downlink},
      ${fields.connection_rtt},
      ${fields.touch_support},
      ${fields.bot_score},
      ${fields.clicks},
      ${fields.mouse_movements},
      ${fields.scroll_events},
      ${fields.metadata}
    )
  `;

  try {
    console.log("Executing insert query:", insertQuery);
    const insertResult = await clickhouse.query(insertQuery).toPromise();

    res.status(200).send();
  } catch (err) {
    console.error("ClickHouse Insert Error:", err.message);
    res.status(500).json({ message: "Server error" });
  }
});


// Example: Query events (GET /api/events)
router.get("/events", async (req, res) => {
  try {
    const query = `
      SELECT *
      FROM analytics.website_events
      ORDER BY event_time DESC
      LIMIT 100
    `;
    const result = await clickhouse.query(query).toPromise();
    res.json(result);
  } catch (err) {
    console.error("ClickHouse Query Error:", err.message);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
