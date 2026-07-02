import { Client } from 'ssh2';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.join(__dirname, '..', 'dist');

const HOST = '147.182.160.119';
const USER = 'vogar8947';
const PASSWORD = process.env.DEPLOY_PASSWORD;
const WEB_ROOT = '/var/www/ordenya.app';

const NGINX_CONF = `server {
    listen 80;
    listen [::]:80;
    server_name ordenya.app www.ordenya.app ${HOST};
    root ${WEB_ROOT};
    index index.html;

    location / {
        try_files $uri $uri/ $uri/index.html =404;
    }

    location ~* \\.(js|css|png|jpg|jpeg|gif|svg|webp|avif|ico|woff2?)$ {
        expires 30d;
        add_header Cache-Control "public, immutable";
    }

    location = /.well-known/apple-app-site-association {
        default_type application/json;
    }
}
`;

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...walk(full));
    else files.push(full);
  }
  return files;
}

function exec(conn, cmd) {
  return new Promise((resolve, reject) => {
    conn.exec(cmd, (err, stream) => {
      if (err) return reject(err);
      let out = '';
      let errOut = '';
      stream.on('data', (d) => { out += d; });
      stream.stderr.on('data', (d) => { errOut += d; });
      stream.on('close', (code) => {
        if (code !== 0) reject(new Error(`Command failed (${code}): ${cmd}\n${errOut || out}`));
        else resolve(out);
      });
    });
  });
}

async function main() {
  if (!PASSWORD) {
    console.error('DEPLOY_PASSWORD env var is required');
    process.exit(1);
  }

  if (!fs.existsSync(DIST)) {
    console.error('dist/ not found. Run npm run build first.');
    process.exit(1);
  }

  const conn = new Client();

  await new Promise((resolve, reject) => {
    conn
      .on('ready', resolve)
      .on('error', reject)
      .connect({ host: HOST, port: 22, username: USER, password: PASSWORD, readyTimeout: 20000 });
  });

  console.log('Connected to server');

  const sftp = await new Promise((resolve, reject) => {
    conn.sftp((err, s) => (err ? reject(err) : resolve(s)));
  });

  const mkdirRemote = (remotePath) =>
    new Promise((resolve, reject) => {
      sftp.mkdir(remotePath, (err) => {
        if (err && err.code !== 4) return reject(err);
        resolve();
      });
    });

  await exec(
    conn,
    `echo '${PASSWORD.replace(/'/g, "'\\''")}' | sudo -S mkdir -p ${WEB_ROOT} && echo '${PASSWORD.replace(/'/g, "'\\''")}' | sudo -S chown -R ${USER}:${USER} ${WEB_ROOT}`,
  );

  const files = walk(DIST);
  console.log(`Uploading ${files.length} files...`);

  for (const localFile of files) {
    const rel = path.relative(DIST, localFile).split(path.sep).join('/');
    const remoteFile = `${WEB_ROOT}/${rel}`;
    const remoteDir = path.posix.dirname(remoteFile);

    await mkdirRemote(remoteDir);
    await new Promise((resolve, reject) => {
      sftp.fastPut(localFile, remoteFile, (err) => (err ? reject(err) : resolve()));
    });
  }

  console.log('Files uploaded');

  const confPath = '/tmp/ordenya.app.conf';
  await new Promise((resolve, reject) => {
    const stream = sftp.createWriteStream(confPath);
    stream.on('close', resolve);
    stream.on('error', reject);
    stream.end(NGINX_CONF);
  });

  const setupCmd = [
    `echo '${PASSWORD.replace(/'/g, "'\\''")}' | sudo -S cp ${confPath} /etc/nginx/sites-available/ordenya.app`,
    `echo '${PASSWORD.replace(/'/g, "'\\''")}' | sudo -S ln -sf /etc/nginx/sites-available/ordenya.app /etc/nginx/sites-enabled/ordenya.app`,
    `command -v nginx >/dev/null 2>&1 || (echo '${PASSWORD.replace(/'/g, "'\\''")}' | sudo -S apt-get update -qq && echo '${PASSWORD.replace(/'/g, "'\\''")}' | sudo -S DEBIAN_FRONTEND=noninteractive apt-get install -y -qq nginx)`,
    `echo '${PASSWORD.replace(/'/g, "'\\''")}' | sudo -S rm -f /etc/nginx/sites-enabled/default`,
    `echo '${PASSWORD.replace(/'/g, "'\\''")}' | sudo -S nginx -t`,
    `echo '${PASSWORD.replace(/'/g, "'\\''")}' | sudo -S systemctl enable nginx`,
    `echo '${PASSWORD.replace(/'/g, "'\\''")}' | sudo -S systemctl reload nginx`,
  ].join(' && ');

  const result = await exec(conn, setupCmd);
  console.log(result);
  console.log(`Deploy complete: http://${HOST}`);

  conn.end();
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
