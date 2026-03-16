const express = require('express');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 8080;
const projectDir = path.join(__dirname, 'projects');
const presentationsDir = path.join(__dirname, 'presentations');

if (!fs.existsSync(presentationsDir)) {
  fs.mkdirSync(presentationsDir, { recursive: true });
}

app.use(express.json({ limit: '50mb' }));

// --- Serve keycloak config ---
app.get('/config/keycloak.json', (req, res) => {
  res.sendFile(path.join(__dirname, 'config', 'keycloak.json'));
});

// --- Serve index.html with dynamic importmap ---
app.get('/', (req, res) => {
  const htmlPath = path.join(__dirname, 'index.html');
  let html = fs.readFileSync(htmlPath, 'utf8');
  const v = Date.now();
  const localFiles = [
    'scene.js','builder.js','infra.js','site.js','zone.js',
    'network.js','instance.js','firewall.js','networkinterface.js','ip.js',
    'service.js','connector.js','defaultitem.js','position.js',
    'positionhome.js','positionnetwork.js','positionnetworkdevice.js',
    'positioninstance.js','api-client.js',
    'datacenter.js','dcrow.js','rack.js','physicalserver.js',
    'physicalswitch.js','physicalcable.js','positiondatacenter.js',
    'positionrow.js','positionequipment.js','worldmap.js'
  ];
  const extraMappings = localFiles.map(f => `            "./${f}": "./${f}?v=${v}"`).join(',\n');
  html = html.replace(
    '"keycloak-js": "./node_modules/keycloak-js/lib/keycloak.js"',
    `"keycloak-js": "./node_modules/keycloak-js/lib/keycloak.js",\n${extraMappings}`
  );
  res.setHeader('Content-Type', 'text/html');
  res.setHeader('Cache-Control', 'no-store');
  res.send(html);
});

app.use((req, res, next) => {
  if (req.path.endsWith('.js') || req.path.endsWith('.html')) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }
  next();
});
app.use(express.static(__dirname, { etag: false, lastModified: false, maxAge: 0 }));

// ==========================================
// CONFIG ROUTES (local file storage)
// ==========================================

app.get('/api/configs', (req, res) => {
  try {
    const files = fs.readdirSync(projectDir).filter(f => f.endsWith('.json'));
    const configs = files.map(f => ({
      id: f,
      Titre: f.replace('.json', ''),
      Json: null
    }));
    res.json(configs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/configs/:id', (req, res) => {
  const id = req.params.id;
  const filename = id.endsWith('.json') ? id : id + '.json';
  const filepath = path.join(projectDir, path.basename(filename));
  if (!fs.existsSync(filepath)) return res.status(404).json({ error: 'Not found' });
  const content = fs.readFileSync(filepath, 'utf8');
  res.json({ id, Titre: filename.replace('.json', ''), Json: content });
});

app.post('/api/configs', (req, res) => {
  const { Titre, Json } = req.body;
  if (!Titre || !Json) return res.status(400).json({ error: 'Missing Titre or Json' });

  try { JSON.parse(typeof Json === 'string' ? Json : JSON.stringify(Json)); }
  catch(e) { return res.status(400).json({ error: 'Invalid JSON' }); }

  const filename = Titre.endsWith('.json') ? Titre : Titre + '.json';
  const filepath = path.join(projectDir, path.basename(filename));
  fs.writeFileSync(filepath, typeof Json === 'string' ? Json : JSON.stringify(Json, null, 2));
  res.json({ success: true, id: filename, message: 'Saved locally' });
});

app.delete('/api/configs/:id', (req, res) => {
  const id = req.params.id;
  const filename = id.endsWith('.json') ? id : id + '.json';
  const filepath = path.join(projectDir, path.basename(filename));
  if (fs.existsSync(filepath)) fs.unlinkSync(filepath);
  res.json({ success: true, message: 'Deleted locally' });
});

// ==========================================
// PRESENTATION ROUTES
// ==========================================

app.post('/api/presentations', (req, res) => {
  const { Titre, Json } = req.body;
  if (!Json) return res.status(400).json({ error: 'Missing Json' });
  try { JSON.parse(typeof Json === 'string' ? Json : JSON.stringify(Json)); }
  catch(e) { return res.status(400).json({ error: 'Invalid JSON' }); }

  const id = uuidv4().slice(0, 8);
  const filepath = path.join(presentationsDir, id + '.json');
  const data = { id, Titre: Titre || 'Presentation', Json: typeof Json === 'string' ? Json : JSON.stringify(Json), createdAt: new Date().toISOString() };
  fs.writeFileSync(filepath, JSON.stringify(data, null, 2));
  res.json({ success: true, id, url: `/p/${id}` });
});

app.get('/p/:id', (req, res) => {
  const filepath = path.join(presentationsDir, req.params.id + '.json');
  if (!fs.existsSync(filepath)) return res.status(404).send('Presentation not found');

  let html = fs.readFileSync(path.join(__dirname, 'presentation.html'), 'utf8');
  const v = Date.now();
  const localFiles = [
    'scene.js','infra.js','site.js','zone.js',
    'network.js','instance.js','firewall.js','networkinterface.js','ip.js',
    'service.js','connector.js','defaultitem.js','position.js',
    'positionhome.js','positionnetwork.js','positionnetworkdevice.js',
    'positioninstance.js',
    'datacenter.js','dcrow.js','rack.js','physicalserver.js',
    'physicalswitch.js','physicalcable.js','positiondatacenter.js',
    'positionrow.js','positionequipment.js','worldmap.js'
  ];
  const extraMappings = localFiles.map(f => `            "./${f}": "/${f}?v=${v}"`).join(',\n');
  html = html.replace(
    '"three-mesh-ui": "/node_modules/three-mesh-ui/build/three-mesh-ui.module.min.js"',
    `"three-mesh-ui": "/node_modules/three-mesh-ui/build/three-mesh-ui.module.min.js",\n${extraMappings}`
  );
  res.setHeader('Content-Type', 'text/html');
  res.setHeader('Cache-Control', 'no-store');
  res.send(html);
});

app.get('/api/presentations/:id', (req, res) => {
  const filepath = path.join(presentationsDir, req.params.id + '.json');
  if (!fs.existsSync(filepath)) return res.status(404).json({ error: 'Not found' });
  const data = JSON.parse(fs.readFileSync(filepath, 'utf8'));
  res.json(data);
});

// ==========================================
// LEGACY COMPAT (old ?action= format)
// ==========================================

app.get('/api', (req, res) => {
  const action = req.query.action;
  if (action === 'list') {
    try {
      const files = fs.readdirSync(projectDir).filter(f => f.endsWith('.json'));
      res.json({ files });
    } catch (err) {
      res.status(500).json({ error: 'Failed to list files' });
    }
    return;
  }
  if (action === 'load') {
    const filename = req.query.file;
    if (!filename || path.basename(filename) !== filename) return res.status(400).json({ error: 'Invalid filename' });
    const filepath = path.join(projectDir, filename);
    if (!fs.existsSync(filepath)) return res.status(404).json({ error: 'File not found' });
    res.setHeader('Content-Type', 'application/json');
    res.sendFile(filepath);
    return;
  }
  res.status(400).json({ error: 'Invalid action' });
});

app.post('/api', (req, res) => {
  if (req.query.action !== 'save') return res.status(400).json({ error: 'Invalid action' });
  const { file: filename, content } = req.body || {};
  if (!filename || !content) return res.status(400).json({ error: 'Missing filename or content' });
  if (path.basename(filename) !== filename || !filename.endsWith('.json')) return res.status(403).json({ error: 'Invalid filename' });
  try {
    const parsed = typeof content === 'string' ? content : JSON.stringify(content, null, 2);
    JSON.parse(parsed);
    fs.writeFileSync(path.join(projectDir, filename), typeof content === 'string' ? content : JSON.stringify(content, null, 2));
    res.json({ success: true });
  } catch (err) {
    if (err instanceof SyntaxError) return res.status(400).json({ error: 'Invalid JSON content' });
    res.status(500).json({ error: 'Failed to save file' });
  }
});

app.listen(PORT, () => {
  console.log(`3dit Editor running at http://localhost:${PORT}`);
});
