require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const clickhouse = require('./clickhouse/config');
const path = require('path');
const fs = require('fs');

const analyticsRoutes = require('./routes/analytics');

const app = express();
const port = process.env.PORT || 3000;


app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }
  next();
});

app.use(bodyParser.json());

app.use(express.static(path.join(__dirname, 'public'), {
  maxAge: '7d',
  setHeaders: (res, path) => {
    if (path.endsWith('.js')) {
      res.setHeader("Content-Type", "application/javascript");
    }
  }
}));

// API Endpoint
app.use('/api', analyticsRoutes);


async function ensureSchema() {
  const schemaPath = path.join(__dirname, 'clickhouse', 'schema.sql');
  const schema = fs.readFileSync(schemaPath, 'utf8');
  // Split by semicolon to handle multiple statements if needed
  const statements = schema
    .split(';')
    .map(s => s.trim())
    .filter(Boolean);

  for (const stmt of statements) {
    try {
      await clickhouse.query(stmt).toPromise();
    } catch (err) {
      console.error('Schema creation error:', err.message);
    }
  }
}

ensureSchema().then(() => {
  app.listen(port, () => {
    console.log(`Tracking server running on port ${port}`);
  });
});
