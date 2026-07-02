import { Client } from 'ssh2';

const HOST = '147.182.160.119';
const USER = 'vogar8947';
const PASSWORD = process.env.DEPLOY_PASSWORD;
const EMAIL = 'hola@ordenya.app';

function exec(conn, cmd) {
  return new Promise((resolve, reject) => {
    conn.exec(cmd, (err, stream) => {
      if (err) return reject(err);
      let out = '';
      let errOut = '';
      stream.on('data', (d) => {
        const text = d.toString();
        out += text;
        process.stdout.write(text);
      });
      stream.stderr.on('data', (d) => {
        const text = d.toString();
        errOut += text;
        process.stderr.write(text);
      });
      stream.on('close', (code) => {
        if (code !== 0) reject(new Error(`Exit ${code}: ${errOut || out}`));
        else resolve(out);
      });
    });
  });
}

async function main() {
  if (!PASSWORD) {
    console.error('DEPLOY_PASSWORD required');
    process.exit(1);
  }

  const esc = PASSWORD.replace(/'/g, "'\\''");
  const sudo = (cmd) => `echo '${esc}' | sudo -S bash -c ${JSON.stringify(cmd)}`;

  const conn = new Client();
  await new Promise((resolve, reject) => {
    conn.on('ready', resolve).on('error', reject).connect({
      host: HOST,
      port: 22,
      username: USER,
      password: PASSWORD,
      readyTimeout: 20000,
    });
  });

  console.log('=== Connected ===\n');

  await exec(conn, sudo('apt-get update -qq'));
  await exec(
    conn,
    sudo('DEBIAN_FRONTEND=noninteractive apt-get install -y -qq certbot python3-certbot-nginx'),
  );

  console.log('\n=== Running certbot ===\n');

  await exec(
    conn,
    sudo(
      `certbot --nginx -d ordenya.app -d www.ordenya.app --non-interactive --agree-tos --email ${EMAIL} --redirect --no-eff-email`,
    ),
  );

  console.log('\n=== Testing renewal ===\n');
  await exec(conn, sudo('certbot renew --dry-run'));

  console.log('\n=== Nginx status ===\n');
  await exec(conn, sudo('systemctl status nginx --no-pager -l | head -20'));

  conn.end();
  console.log('\n=== Certbot setup complete ===');
}

main().catch((err) => {
  console.error('\nFAILED:', err.message);
  process.exit(1);
});
