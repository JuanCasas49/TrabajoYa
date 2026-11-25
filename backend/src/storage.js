import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

export const EXT = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' };

// CLOUDINARY_URL = cloudinary://API_KEY:API_SECRET@CLOUD_NAME
function cloudinaryConfig() {
  const m = (process.env.CLOUDINARY_URL || '').match(/^cloudinary:\/\/([^:]+):([^@]+)@(.+)$/);
  return m ? { key: m[1], secret: m[2], cloud: m[3] } : null;
}

// En producción (Render) el disco es efímero: las fotos van a Cloudinary.
// Sin CLOUDINARY_URL (desarrollo local) se guardan en backend/uploads.
export async function saveImage(file) {
  const cfg = cloudinaryConfig();
  if (cfg) {
    const timestamp = Math.floor(Date.now() / 1000);
    const folder = 'trabajoya';
    const signature = crypto.createHash('sha1').update(`folder=${folder}&timestamp=${timestamp}${cfg.secret}`).digest('hex');
    const fd = new FormData();
    fd.append('file', new Blob([file.buffer], { type: file.mimetype }), 'foto');
    fd.append('api_key', cfg.key);
    fd.append('timestamp', String(timestamp));
    fd.append('folder', folder);
    fd.append('signature', signature);
    const res = await fetch(`https://api.cloudinary.com/v1_1/${cfg.cloud}/image/upload`, { method: 'POST', body: fd });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error('No se pudo subir la imagen');
    return data.secure_url;
  }
  const name = crypto.randomUUID() + (EXT[file.mimetype] || '.jpg');
  await fs.mkdir('uploads', { recursive: true });
  await fs.writeFile(path.join('uploads', name), file.buffer);
  return `/uploads/${name}`;
}
