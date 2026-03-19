const https = require('https');
const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, 'public', 'audio');
const BASE = 'https://raw.githubusercontent.com/jsgrrchg/MoodistMac/main/Moodist/sounds/';

const files = {
  'keyboard.mp3': BASE + 'things/keyboard.mp3',
  'campfire.mp3': BASE + 'nature/campfire.mp3',
  'waves.mp3': BASE + 'nature/waves.mp3',
  'thunder.mp3': BASE + 'rain/thunder.mp3',
};

function get(url, dest) {
  return new Promise((resolve) => {
    https.get(url, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) { get(res.headers.location, dest).then(resolve); return; }
      if (res.statusCode !== 200) { console.error('FAIL', path.basename(dest), res.statusCode); resolve(); return; }
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
  console.log('All extra ambient tracks done!');
})();
