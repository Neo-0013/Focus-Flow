const https = require('https');
const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, 'public', 'audio');
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

const files = {
  'rain.mp3': 'https://raw.githubusercontent.com/jsgrrchg/MoodistMac/main/Moodist/sounds/rain/light-rain.mp3',
  'cafe.mp3': 'https://raw.githubusercontent.com/jsgrrchg/MoodistMac/main/Moodist/sounds/places/cafe.mp3',
  'space.mp3': 'https://raw.githubusercontent.com/jsgrrchg/MoodistMac/main/Moodist/sounds/nature/wind.mp3',
  'forest.mp3': 'https://raw.githubusercontent.com/jsgrrchg/MoodistMac/main/Moodist/sounds/nature/forest.mp3',
  'bell.mp3': 'https://raw.githubusercontent.com/jsgrrchg/MoodistMac/main/Moodist/sounds/alarm.mp3'
};

async function download() {
  for (const [name, url] of Object.entries(files)) {
    console.log(`Downloading ${name} from ${url}`);
    await new Promise((resolve, reject) => {
      https.get(url, (res) => {
        if (res.statusCode === 302 || res.statusCode === 301) {
          https.get(res.headers.location, (redirectRes) => {
            const file = fs.createWriteStream(path.join(dir, name));
            redirectRes.pipe(file);
            file.on('finish', () => { file.close(); resolve(); });
          }).on('error', reject);
        } else if (res.statusCode === 200) {
          const file = fs.createWriteStream(path.join(dir, name));
          res.pipe(file);
          file.on('finish', () => { file.close(); resolve(); });
        } else {
          console.error(`Failed ${name}: ${res.statusCode}`);
          resolve();
        }
      }).on('error', reject);
    });
  }
}

download().then(() => console.log('All downloads completed!')).catch(console.error);
