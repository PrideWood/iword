import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import {
  isPronunciationManifest,
  normalizePronunciationTerm,
} from '../lib/pronunciation';

const manifestPath = path.resolve('public/audio/pronunciations/manifest.json');
const manifestDirectory = path.dirname(manifestPath);
const raw = await readFile(manifestPath, 'utf8');
const value: unknown = JSON.parse(raw);

if (!isPronunciationManifest(value)) {
  throw new Error('发音清单格式不正确，请对照 AUDIO_SETUP.md 检查。');
}

const keys = new Set<string>();
const missingFiles: string[] = [];

for (const entry of value.entries) {
  const key = [
    normalizePronunciationTerm(entry.term),
    entry.accent,
    entry.partOfSpeech ?? '',
    entry.phonetic ?? '',
  ].join('|');

  if (keys.has(key)) throw new Error(`发音清单存在重复条目：${key}`);
  keys.add(key);

  if (!/^https?:\/\//i.test(entry.src)) {
    try {
      await access(path.resolve(manifestDirectory, entry.src));
    } catch {
      missingFiles.push(entry.src);
    }
  }
}

if (missingFiles.length) {
  throw new Error(`以下音频文件不存在：\n${missingFiles.map((file) => `- ${file}`).join('\n')}`);
}

console.log(`发音资源检查通过：${value.entries.length} 个条目。`);
