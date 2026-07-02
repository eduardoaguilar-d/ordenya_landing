import { Client } from 'ssh2';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const NGINX_CONF = fs.readFileSync(path.join(__dirname, 'nginx-ordenya.conf'), 'utf8');

const HOST = '147.182.160.119';
const USER = 'vogar8947';
const PASSWORD = process.env.DEPLOY_PASSWORD;

function exec(conn, cmd) {
  return new Promise((resolve, reject) => {
    conn.exec(cmd, (err, stream) => {
      if (err) return reject(err);
      let out = '';
      let errOut = '';
      stream.on('data', (d) => { out += d; });
      stream.stderr.on('data', (d) => { errOut += d; });
      stream.on('close', (code) => {
        if (code !== 0) reject(new Error(errOut || out));
        else resolve(out);
      });
    });
  });
}

const conn = new Client();
conn.on('ready', async () => {
  const sftp = await new Promise((resolve, reject) => conn.sftp((e, s) => (e ? reject(e) : resolve(s))));
  await new Promise((resolve, reject) => {
    const ws = sftp.createWriteStream('/tmp/ordenya.app.conf');
    ws.on('close', resolve);
    ws.on('error', reject);
    ws.end(NGINX_CONF);
  });

  const esc = PASSWORD.replace(/'/g, "'\\''");
  const cmd = [
    `echo '${esc}' | sudo -S cp /tmp/ordenya.app.conf /etc/nginx/sites-available/ordenya.app`,
    `echo '${esc}' | sudo -S ln -sf /etc/nginx/sites-available/ordenya.app /etc/nginx/sites-enabled/ordenya.app`,
    `echo '${esc}' | sudo -S nginx -t`,
    `echo '${esc}' | sudo -S systemctl reload nginx`,
  ].join(' && ');

  const out = await exec(conn, cmd);
  console.log(out);
  console.log('Nginx reloaded OK');
  conn.end();
}).connect({ host: HOST, username: USER, password: PASSWORD });
