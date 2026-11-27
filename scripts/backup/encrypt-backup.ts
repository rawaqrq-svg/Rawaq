import fs from 'node:fs';
import { pipeline } from 'node:stream/promises';
import crypto from 'node:crypto';

/**
 * Derives a consistent 32-byte key from any passphrase string using SHA-256
 */
export function deriveKey(passphrase: string): Buffer {
  return crypto.createHash('sha256').update(passphrase).digest();
}

/**
 * Encrypts a file using AES-256-CBC.
 * Prepends the 16-byte random IV to the beginning of the output file.
 */
export async function encryptFile(
  inputPath: string,
  outputPath: string,
  passphrase: string,
): Promise<{ ivHex: string; outputSize: number }> {
  const key = deriveKey(passphrase);
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);

  const readStream = fs.createReadStream(inputPath);
  const writeStream = fs.createWriteStream(outputPath);

  // Write IV first
  writeStream.write(iv);

  await pipeline(readStream, cipher, writeStream);

  const stats = fs.statSync(outputPath);
  return {
    ivHex: iv.toString('hex'),
    outputSize: stats.size,
  };
}

/**
 * Decrypts a file previously encrypted with encryptFile.
 */
export async function decryptFile(
  inputPath: string,
  outputPath: string,
  passphrase: string,
): Promise<void> {
  const key = deriveKey(passphrase);

  // Read first 16 bytes for IV
  const fd = fs.openSync(inputPath, 'r');
  const iv = Buffer.alloc(16);
  fs.readSync(fd, iv, 0, 16, 0);
  fs.closeSync(fd);

  const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);

  const readStream = fs.createReadStream(inputPath, { start: 16 });
  const writeStream = fs.createWriteStream(outputPath);

  await pipeline(readStream, decipher, writeStream);
}
