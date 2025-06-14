CREATE DATABASE IF NOT EXISTS analytics;
CREATE TABLE IF NOT EXISTS analytics.website_events (
    event_time DateTime64(3), -- High-precision timestamp for event time
    website_id String, -- Identifier for the website
    session_id UUID, -- Unique session identifier
    user_ip String, -- User’s IP address
    user_agent String, -- Browser user agent
    page_url String, -- URL of the page
    referrer String, -- Referrer URL
    event_type String, -- Type of event (e.g., pageview, click)
    page_title String, -- Page title
    screen_width UInt32, -- Screen width
    screen_height UInt32, -- Screen height
    color_depth UInt8, -- Screen color depth
    device_memory UInt8, -- Device memory in GB
    hardware_concurrency UInt8, -- Number of CPU cores
    timezone String, -- User timezone
    cookie_enabled UInt8, -- Boolean as 0/1 for cookie support
    local_storage UInt8, -- Boolean as 0/1 for localStorage support
    session_storage UInt8, -- Boolean as 0/1 for sessionStorage support
    history_length UInt16, -- Browser history length
    connection_effective_type String, -- Network effective type (e.g., 4g)
    connection_downlink Float32, -- Network downlink speed
    connection_rtt UInt32, -- Network round-trip time
    touch_support UInt8, -- Boolean as 0/1 for touch support
    is_headless UInt8, -- Boolean as 0/1 for headless browser
    time_to_first_interaction Float32, -- Time to first interaction in seconds
    mouse_entropy Float32, -- Mouse movement entropy
    canvas_fingerprint String, -- Canvas fingerprint data
    clicks Array(Tuple(x UInt32, y UInt32, timestamp DateTime64(3), element_tag String, element_class String, element_id String)), -- Click events
    mouse_movements Array(Tuple(x UInt32, y UInt32, timestamp DateTime64(3))), -- Mouse movement events
    scroll_events Array(Tuple(y UInt32, percentage Float32, timestamp DateTime64(3))), -- Scroll events
    metadata Map(String, String) -- Additional flexible metadata
)
ENGINE = MergeTree
ORDER BY (event_time, website_id, session_id)
PARTITION BY toYYYYMM(event_time)
SETTINGS index_granularity = 8192;