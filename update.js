/* eslint-disable no-console */
import sharp from 'sharp';
import { encode } from 'blurhash';
import fs from 'node:fs';

const IMAGES_PATH = 'src/assets/images.json';
const THUMBNAILS_PATH = 'public/thumbnail';
const THUMBNAIL_WIDTH = 600;

async function genHash(src) {
  const imgSharp = sharp(src);
  const stem = src.split('/').at(-1);
  const { width, height } = await imgSharp.metadata();

  const thumbnailWidth = Math.min(THUMBNAIL_WIDTH, width);
  const thumbnail = imgSharp.resize(thumbnailWidth);

  const { info, data } = await thumbnail.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const hash = encode(Uint8ClampedArray.from(data), info.width, info.height, 4, 4);

  await thumbnail.toFormat(stem.split('.').at(-1)).toFile(`${THUMBNAILS_PATH}/${stem}`);

  return {
    hash,
    size: {
      height,
      width,
    },
  };
}

async function update() {
  const images = JSON.parse(fs.readFileSync(IMAGES_PATH).toString());
  let hasUpdate = false;
  await Promise.all(images.filter((i) => !fs.existsSync(`${THUMBNAILS_PATH}/${i.src}`)).map(async (image, index) => {
    hasUpdate ||= true;
    console.info(`Handling the ${index + 1} image...`);
    const { hash, size: { width, height } } = await genHash(`public/${image.src}`);
    Object.assign(image, {
      blurHash: {
        encoded: hash,
        size: [width, height],
      },
      updateAt: new Date().toLocaleString(),
    });
  }));
  console.info('Done.');

  if (hasUpdate) {
    console.info('Updating `images.json`...');
    fs.writeFileSync(IMAGES_PATH, JSON.stringify(images), 'utf8');
    console.info('Done.');
  }

  return hasUpdate;
}

(async () => {
  if (!fs.existsSync(THUMBNAILS_PATH)) {
    fs.mkdirSync(THUMBNAILS_PATH);
  }
  const hasUpdate = await update();
  // once updated, exit with code 1 to break the committing process
  if (hasUpdate) {
    console.info('Image info updates! Please commit the changes to `images.json` and the thumbnails.');
    process.exit(1);
  }
})();
