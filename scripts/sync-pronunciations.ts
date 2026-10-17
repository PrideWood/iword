import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import COS from 'cos-nodejs-sdk-v5';
import { config as loadEnv } from 'dotenv';
import { tts } from 'tencentcloud-sdk-nodejs-tts';
import {
  isPronunciationManifest,
  normalizePronunciationTerm,
  type PronunciationEntry,
  type PronunciationManifest,
} from '../lib/pronunciation';
import { makeSeed } from '../lib/seed';
import type { Word } from '../lib/types';

loadEnv({ path: path.resolve('.env.local'), quiet: true });
loadEnv({ path: path.resolve('.env'), quiet: true });

const args = new Set(process.argv.slice(2));
const dryRun = args.has('--dry-run');
const force = args.has('--force');
const sourceArg = [...args].find((arg) => arg.startsWith('--source='))?.split('=')[1];
const limitArg = [...args].find((arg) => arg.startsWith('--limit='))?.split('=')[1];
const limit = limitArg ? Number.parseInt(limitArg, 10) : undefined;
const source = sourceArg ?? process.env.PRONUNCIATION_WORD_SOURCE?.trim() ?? 'seed';

if (args.has('--help')) {
  console.log(`用法：npm run audio:sync -- [选项]

  --dry-run          只列出缺失单词，不调用 TTS 或上传
  --source=seed      使用内置演示词表
  --source=database  使用 DATABASE_URL 中的词表
  --limit=3          本次最多处理 3 个缺失单词
  --force            即使对象已存在也重新生成（会消耗 TTS 额度）`);
  process.exit(0);
}

if (!['seed', 'database'].includes(source)) {
  throw new Error('--source 只能是 seed 或 database。');
}

if (limit !== undefined && (!Number.isInteger(limit) || limit < 1)) {
  throw new Error('--limit 必须是大于 0 的整数。');
}

const localManifestPath = path.resolve('public/audio/pronunciations/manifest.json');
const localManifestDirectory = path.dirname(localManifestPath);
const accent = 'en-US' as const;

function requiredEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`缺少环境变量 ${name}，请填写 .env.local。`);
  return value;
}

function fileNameForTerm(term: string) {
  const normalized = normalizePronunciationTerm(term);
  if (/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(normalized)) return `${normalized}.mp3`;

  const slug = normalized
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'word';
  const hash = createHash('sha256').update(normalized).digest('hex').slice(0, 10);
  return `${slug}-${hash}.mp3`;
}

function entryKey(entry: Pick<PronunciationEntry, 'term' | 'accent' | 'partOfSpeech' | 'phonetic'>) {
  return [
    normalizePronunciationTerm(entry.term),
    entry.accent,
    entry.partOfSpeech?.normalize('NFKC').trim().toLocaleLowerCase('en-US') ?? '',
    entry.phonetic?.normalize('NFKC').trim().toLocaleLowerCase('en-US') ?? '',
  ].join('|');
}

async function readLocalManifest(): Promise<PronunciationManifest> {
  try {
    const parsed: unknown = JSON.parse(await readFile(localManifestPath, 'utf8'));
    if (!isPronunciationManifest(parsed)) throw new Error('清单结构不正确');
    return parsed;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    return { schemaVersion: 1, entries: [] };
  }
}

async function loadWords(): Promise<Word[]> {
  if (source === 'seed') return makeSeed(process.env.DEV_USER_ID || 'local-preview-teacher').words;
  if (!process.env.DATABASE_URL) throw new Error('使用 database 词表时必须配置 DATABASE_URL。');

  const [{ getWorkspace }, { closeDatabase }] = await Promise.all([
    import('../lib/workspace'),
    import('../db'),
  ]);
  try {
    return (await getWorkspace(process.env.DEV_USER_ID || 'local-preview-teacher')).words;
  } finally {
    await closeDatabase();
  }
}

function isNotFound(error: unknown) {
  if (!error || typeof error !== 'object') return false;
  const candidate = error as { statusCode?: number; code?: string };
  return candidate.statusCode === 404 || candidate.code === 'NoSuchKey' || candidate.code === 'NotFound';
}

async function main() {
  const [words, localManifest] = await Promise.all([loadWords(), readLocalManifest()]);
  const uniqueWords = [...new Map(words.map((word) => [normalizePronunciationTerm(word.english), word])).values()]
    .filter((word) => normalizePronunciationTerm(word.english));

  if (dryRun) {
    const knownTerms = new Set(
      localManifest.entries
        .filter((entry) => entry.accent === accent)
        .map((entry) => normalizePronunciationTerm(entry.term)),
    );
    const missing = uniqueWords.filter((word) => force || !knownTerms.has(normalizePronunciationTerm(word.english)));
    console.log(`词表来源：${source}；共 ${uniqueWords.length} 个唯一单词；本地清单已有 ${knownTerms.size} 个。`);
    console.log(`计划生成：${missing.length} 个${limit ? `（本次最多 ${limit} 个）` : ''}。`);
    for (const word of missing.slice(0, limit)) console.log(`- ${word.english}`);
    return;
  }

  const secretId = requiredEnv('TENCENTCLOUD_SECRET_ID');
  const secretKey = requiredEnv('TENCENTCLOUD_SECRET_KEY');
  const bucket = requiredEnv('TENCENT_COS_BUCKET');
  const region = process.env.TENCENT_COS_REGION?.trim() || 'ap-chongqing';
  const prefix = (process.env.TENCENT_COS_PREFIX?.trim() || 'pronunciations/v1').replace(/^\/+|\/+$/g, '');
  const manifestKey = `${prefix}/manifest.json`;
  const writeLocal = process.env.PRONUNCIATION_WRITE_LOCAL !== 'false';
  const voiceType = Number.parseInt(process.env.TENCENT_TTS_VOICE_TYPE || '403006', 10);
  const sampleRate = Number.parseInt(process.env.TENCENT_TTS_SAMPLE_RATE || '24000', 10);
  const speed = Number.parseFloat(process.env.TENCENT_TTS_SPEED || '0');

  const cos = new COS({ SecretId: secretId, SecretKey: secretKey });
  const TtsClient = tts.v20190823.Client;
  const ttsClient = new TtsClient({
    credential: { secretId, secretKey },
    region: process.env.TENCENT_TTS_REGION?.trim() || '',
    profile: { httpProfile: { endpoint: 'tts.tencentcloudapi.com' } },
  });

  let manifest = localManifest;
  try {
    const remote = await cos.getObject({ Bucket: bucket, Region: region, Key: manifestKey });
    const parsed: unknown = JSON.parse(remote.Body.toString('utf8'));
    if (!isPronunciationManifest(parsed)) throw new Error('COS 上的 manifest.json 结构不正确。');
    manifest = parsed;
  } catch (error) {
    if (!isNotFound(error)) throw error;
    console.log('COS 上尚无 manifest.json，将以本地清单为起点。');
  }

  const entries = new Map(manifest.entries.map((entry) => [entryKey(entry), entry]));
  const termEntries = new Map<string, PronunciationEntry>();
  for (const entry of manifest.entries) {
    if (entry.accent === accent) termEntries.set(normalizePronunciationTerm(entry.term), entry);
  }

  const pending = uniqueWords.filter((word) => force || !termEntries.has(normalizePronunciationTerm(word.english)));
  const selected = pending.slice(0, limit);

  console.log(`词表来源：${source}；共 ${uniqueWords.length} 个唯一单词；待同步 ${pending.length} 个。`);
  if (!selected.length) {
    console.log('没有缺失发音，manifest.json 无需更新。');
    return;
  }

  await mkdir(path.join(localManifestDirectory, accent), { recursive: true });

  for (const [index, word] of selected.entries()) {
    const normalized = normalizePronunciationTerm(word.english);
    const fileName = fileNameForTerm(normalized);
    const relativeSrc = `${accent}/${fileName}`;
    const objectKey = `${prefix}/${relativeSrc}`;
    let audio: Buffer | undefined;
    let reused = false;

    if (!force) {
      try {
        await cos.headObject({ Bucket: bucket, Region: region, Key: objectKey });
        reused = true;
        if (writeLocal) {
          const remote = await cos.getObject({ Bucket: bucket, Region: region, Key: objectKey });
          audio = remote.Body;
        }
      } catch (error) {
        if (!isNotFound(error)) throw error;
      }
    }

    if (!reused) {
      console.log(`[${index + 1}/${selected.length}] 生成 ${word.english}…`);
      const response = await ttsClient.TextToVoice({
        Text: word.english,
        SessionId: randomUUID(),
        VoiceType: voiceType,
        PrimaryLanguage: 2,
        SampleRate: sampleRate,
        Codec: 'mp3',
        Speed: speed,
        Volume: 0,
      });
      if (!response.Audio) throw new Error(`腾讯云未返回 ${word.english} 的音频数据。`);
      audio = Buffer.from(response.Audio, 'base64');
      await cos.putObject({
        Bucket: bucket,
        Region: region,
        Key: objectKey,
        Body: audio,
        ContentType: 'audio/mpeg',
        CacheControl: 'public, max-age=31536000, immutable',
      });
    } else {
      console.log(`[${index + 1}/${selected.length}] 复用 COS 中已有的 ${word.english}。`);
    }

    if (writeLocal && audio) {
      await writeFile(path.join(localManifestDirectory, relativeSrc), audio);
    }

    const entry: PronunciationEntry = {
      term: word.english,
      accent,
      src: relativeSrc,
      partOfSpeech: word.pos,
      phonetic: word.phonetic,
      isDefault: true,
      source: `tencent-cloud-tts:YunMia:${voiceType}`,
      license: 'Tencent Cloud TTS service terms',
    };
    entries.set(entryKey(entry), entry);
    termEntries.set(normalized, entry);
  }

  const nextManifest: PronunciationManifest = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    entries: [...entries.values()].sort((left, right) =>
      normalizePronunciationTerm(left.term).localeCompare(normalizePronunciationTerm(right.term), 'en-US'),
    ),
  };
  const body = `${JSON.stringify(nextManifest, null, 2)}\n`;

  if (writeLocal) {
    const temporaryPath = `${localManifestPath}.tmp`;
    await writeFile(temporaryPath, body, 'utf8');
    await rename(temporaryPath, localManifestPath);
  }

  await cos.putObject({
    Bucket: bucket,
    Region: region,
    Key: manifestKey,
    Body: Buffer.from(body),
    ContentType: 'application/json; charset=utf-8',
    CacheControl: 'public, max-age=300',
  });

  console.log(`同步完成：新增 ${selected.length} 个发音，清单共 ${nextManifest.entries.length} 条。`);
  console.log(`COS 清单：${manifestKey}`);
}

await main();
