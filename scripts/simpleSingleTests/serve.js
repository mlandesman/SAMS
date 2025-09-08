// Simple HTTP server to serve the HTML test
import { createServer } from 'http';
import { readFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Get the directory of the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PORT = 3030;

const server = createServer(async (req, res) => {
  try {
    // Serve the browser_test.html file
    if (req.url === '/' || req.url === '/index.html' || req.url === '/browser_test.html') {
      const content = await readFile(join(__dirname, 'browser_test.html'), 'utf8');
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(content);
      return;
    }

    // 404 for anything else
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
  } catch (err) {
    console.error(err);
    res.writeHead(500, { 'Content-Type': 'text/plain' });
    res.end('Internal Server Error');
  }
});

server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}/`);
  console.log(`Open your browser to http://localhost:${PORT}/ to view the test page`);
});
