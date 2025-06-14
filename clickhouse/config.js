require('dotenv').config();
const { ClickHouse } = require('clickhouse');

const clickhouse = new ClickHouse({
  url: process.env.CLICKHOUSE_HOST || 'http://localhost',
  port: parseInt(process.env.CLICKHOUSE_PORT || '8123', 10),
  debug: false,
  basicAuth: {
    username: process.env.CLICKHOUSE_USER || 'default',
    password: process.env.CLICKHOUSE_PASSWORD || '',
  },
  isUseGzip: false,
  format: 'json',
  config: {
    session_timeout: 60,
    output_format_json_quote_64bit_integers: 0,
    enable_http_compression: 0,
  },
});

module.exports = clickhouse;
