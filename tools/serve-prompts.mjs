// Serves the .md prompts in the folder given as argv[2] on 127.0.0.1:47813 with CORS,
// so the UIB builder tab can fetch a prompt when the Windows clipboard is locked.
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { join, basename } from 'node:path';
const DIR = process.argv[2];
createServer((req, res) => {
  const h = {
    'Access-Control-Allow-Origin': 'https://uib.vitasya.cloud',
    'Access-Control-Allow-Private-Network': 'true',
    'Access-Control-Allow-Methods': 'GET',
    'Access-Control-Allow-Headers': '*',
  };
  if (req.method === 'OPTIONS') { res.writeHead(204, h); return res.end(); }
  try {
    const name = basename(decodeURIComponent(new URL(req.url, 'http://x').pathname));
    if (!name.endsWith('.md')) throw new Error('md only');
    const body = readFileSync(join(DIR, name));
    res.writeHead(200, { ...h, 'Content-Type': 'text/plain; charset=utf-8' }); res.end(body);
  } catch (e) { res.writeHead(404, h); res.end(String(e)); }
}).listen(47813, '127.0.0.1', () => console.log('serving', DIR));
