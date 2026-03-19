const https = require('https');
const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, 'public', 'audio');
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

const BASE = 'https://raw.githubusercontent.com/jsgrrchg/MoodistMac/main/Moodist/sounds/';
const files = {
  'forest.mp3': BASE + 'animals/birds.mp3',
};

function get(url, dest) {
  return new Promise((resolve) => {
    https.get(url, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        get(res.headers.location, dest).then(resolve);
        return;
      }
      if (res.statusCode !== 200) { console.error('FAIL', dest, res.statusCode); resolve(); return; }
      const file = fs.createWriteStream(dest);
      res.pipe(file);
      file.on('finish', () => { file.close(); console.log('✓', path.basename(dest)); resolve(); });
    }).on('error', resolve);
  });
}

(async () => {
  for (const [name, url] of Object.entries(files)) {
    await get(url, path.join(dir, name));
  }
  console.log('Done!');
})();
