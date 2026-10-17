export const PRONUNCIATION_ACCENTS = ['en-US', 'en-GB'] as const;

export type PronunciationAccent = (typeof PRONUNCIATION_ACCENTS)[number];

export type PronunciationEntry = {
  term: string;
  accent: PronunciationAccent;
  src: string;
  partOfSpeech?: string;
  phonetic?: string;
  isDefault?: boolean;
  source?: string;
  license?: string;
};

export type PronunciationManifest = {
  schemaVersion: 1;
  generatedAt?: string;
  entries: PronunciationEntry[];
};

export type PronunciationRequest = {
  text: string;
  accent: PronunciationAccent;
  partOfSpeech?: string;
  phonetic?: string;
};

export function normalizePronunciationTerm(value: string) {
  return value
    .normalize('NFKC')
    .trim()
    .toLocaleLowerCase('en-US')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/\s+/g, ' ');
}

function normalizeMetadata(value?: string) {
  return value?.normalize('NFKC').trim().toLocaleLowerCase('en-US').replace(/\s+/g, ' ') ?? '';
}

export function findPronunciation(
  manifest: PronunciationManifest,
  request: PronunciationRequest,
) {
  const candidates = manifest.entries.filter(
    (entry) =>
      entry.accent === request.accent &&
      normalizePronunciationTerm(entry.term) === normalizePronunciationTerm(request.text),
  );

  if (candidates.length < 2) return candidates[0];

  const requestedPartOfSpeech = normalizeMetadata(request.partOfSpeech);
  const requestedPhonetic = normalizeMetadata(request.phonetic);

  return [...candidates].sort((left, right) => {
    const score = (entry: PronunciationEntry) =>
      Number(Boolean(entry.isDefault)) +
      Number(Boolean(requestedPartOfSpeech) && normalizeMetadata(entry.partOfSpeech) === requestedPartOfSpeech) * 4 +
      Number(Boolean(requestedPhonetic) && normalizeMetadata(entry.phonetic) === requestedPhonetic) * 8;

    return score(right) - score(left);
  })[0];
}

export function isPronunciationManifest(value: unknown): value is PronunciationManifest {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<PronunciationManifest>;
  if (candidate.schemaVersion !== 1 || !Array.isArray(candidate.entries)) return false;

  return candidate.entries.every((entry) => {
    if (!entry || typeof entry !== 'object') return false;
    const item = entry as Partial<PronunciationEntry>;
    return (
      typeof item.term === 'string' &&
      PRONUNCIATION_ACCENTS.includes(item.accent as PronunciationAccent) &&
      typeof item.src === 'string'
    );
  });
}
