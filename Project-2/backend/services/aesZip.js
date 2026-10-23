/**
 * Minimal ZIP reader with WinZip-AES (AE-1/AE-2) support.
 * Zepp / Huami data exports are AES-encrypted zips (compression method 99),
 * which most zip libraries cannot open. This uses only node's built-in
 * `crypto` and `zlib`, so no new dependencies are needed.
 *
 *   readZip(buffer, password) -> [{ name, data: Buffer }]
 */
const crypto = require('crypto');
const zlib = require('zlib');

class ZipError extends Error {
  constructor(code, message) { super(message); this.code = code; }
}

const AES = { 1: { salt: 8, key: 16, alg: 'aes-128-ecb' }, 2: { salt: 12, key: 24, alg: 'aes-192-ecb' }, 3: { salt: 16, key: 32, alg: 'aes-256-ecb' } };

function findEocd(buf) {
  const min = Math.max(0, buf.length - 22 - 0xffff);
  for (let i = buf.length - 22; i >= min; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) return i;
  }
  throw new ZipError('NOT_ZIP', 'This does not look like a valid .zip file.');
}

// WinZip AES: CTR mode with a LITTLE-endian counter starting at 1
// (node's aes-*-ctr is big-endian, so the keystream is built manually).
function aesCtrXor(key, alg, body) {
  const blocks = Math.ceil(body.length / 16);
  const counters = Buffer.alloc(blocks * 16);
  for (let i = 0; i < blocks; i++) counters.writeUInt32LE(i + 1, i * 16);
  const c = crypto.createCipheriv(alg, key, null);
  c.setAutoPadding(false);
  const ks = Buffer.concat([c.update(counters), c.final()]);
  const out = Buffer.allocUnsafe(body.length);
  for (let i = 0; i < body.length; i++) out[i] = body[i] ^ ks[i];
  return out;
}

function decryptAes(blob, strength, password) {
  const p = AES[strength];
  if (!p) throw new ZipError('UNSUPPORTED', `Unsupported AES strength ${strength}`);
  const salt = blob.subarray(0, p.salt);
  const verify = blob.subarray(p.salt, p.salt + 2);
  const body = blob.subarray(p.salt + 2, blob.length - 10);
  const mac = blob.subarray(blob.length - 10);
  const dk = crypto.pbkdf2Sync(Buffer.from(password, 'utf8'), salt, 1000, 2 * p.key + 2, 'sha1');
  if (!dk.subarray(2 * p.key).equals(verify)) throw new ZipError('BAD_PASSWORD', 'Wrong zip password.');
  const authKey = dk.subarray(p.key, 2 * p.key);
  const calc = crypto.createHmac('sha1', authKey).update(body).digest().subarray(0, 10);
  if (!calc.equals(mac)) throw new ZipError('CORRUPT', 'Zip data failed its integrity check (file corrupted?).');
  return aesCtrXor(dk.subarray(0, p.key), p.alg, body);
}

function readZip(buf, password = '') {
  const eocd = findEocd(buf);
  const total = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  const entries = [];

  for (let n = 0; n < total; n++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new ZipError('NOT_ZIP', 'Corrupt zip directory.');
    const flags = buf.readUInt16LE(p + 8);
    let method = buf.readUInt16LE(p + 10);
    const compSize = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const localOff = buf.readUInt32LE(p + 42);
    const name = buf.toString('utf8', p + 46, p + 46 + nameLen);
    const extra = buf.subarray(p + 46 + nameLen, p + 46 + nameLen + extraLen);
    p += 46 + nameLen + extraLen + commentLen;
    if (name.endsWith('/')) continue;

    const lNameLen = buf.readUInt16LE(localOff + 26);
    const lExtraLen = buf.readUInt16LE(localOff + 28);
    const start = localOff + 30 + lNameLen + lExtraLen;
    let data = buf.subarray(start, start + compSize);

    if (flags & 1) {
      if (!password) throw new ZipError('PASSWORD_REQUIRED', 'This zip is password-protected. Enter the password from the Zepp export email.');
      if (method !== 99) throw new ZipError('UNSUPPORTED', 'Legacy ZipCrypto zips are not supported; re-export or unzip it first.');
      let strength = 3;
      for (let i = 0; i + 4 <= extra.length;) {
        const id = extra.readUInt16LE(i), sz = extra.readUInt16LE(i + 2);
        if (id === 0x9901) { strength = extra.readUInt8(i + 8); method = extra.readUInt16LE(i + 9); }
        i += 4 + sz;
      }
      data = decryptAes(data, strength, password);
    }
    if (method === 8) data = zlib.inflateRawSync(data);
    else if (method !== 0) throw new ZipError('UNSUPPORTED', `Unsupported zip compression method ${method}`);
    entries.push({ name, data });
  }
  return entries;
}

module.exports = { readZip, ZipError };
