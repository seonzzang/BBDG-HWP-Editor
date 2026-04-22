export type DroppedResourceCandidate = {
  kind: 'file' | 'url';
  source: 'file' | 'download-url' | 'uri-list' | 'plain-text';
  name?: string;
  url?: string;
  file?: File;
};

function normalizeUrl(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return null;
}

function parseDownloadUrl(value: string): { name?: string; url: string } | null {
  const trimmed = value.trim();
  const match = trimmed.match(/^([^:]+):([^:]+):(https?:\/\/.+)$/i);
  if (!match) return null;
  return {
    name: match[2]?.trim() || undefined,
    url: match[3].trim(),
  };
}

export function extractDropCandidates(dataTransfer: DataTransfer | null): DroppedResourceCandidate[] {
  if (!dataTransfer) return [];

  const candidates: DroppedResourceCandidate[] = [];
  const seenUrls = new Set<string>();

  for (const file of Array.from(dataTransfer.files ?? [])) {
    candidates.push({
      kind: 'file',
      source: 'file',
      name: file.name,
      file,
    });
  }

  const pushUrl = (
    source: DroppedResourceCandidate['source'],
    url: string | null,
    name?: string,
  ): void => {
    if (!url) return;
    if (seenUrls.has(url)) return;
    seenUrls.add(url);
    candidates.push({
      kind: 'url',
      source,
      name,
      url,
    });
  };

  const downloadUrl = dataTransfer.getData('DownloadURL');
  if (downloadUrl) {
    const parsed = parseDownloadUrl(downloadUrl);
    pushUrl('download-url', normalizeUrl(parsed?.url ?? ''), parsed?.name);
  }

  const uriList = dataTransfer.getData('text/uri-list');
  if (uriList) {
    for (const line of uriList.split(/\r?\n/)) {
      const candidate = line.trim();
      if (!candidate || candidate.startsWith('#')) continue;
      pushUrl('uri-list', normalizeUrl(candidate));
    }
  }

  const plainText = dataTransfer.getData('text/plain');
  if (plainText) {
    pushUrl('plain-text', normalizeUrl(plainText));
  }

  return candidates;
}

export function pickPrimaryDropCandidate(
  candidates: DroppedResourceCandidate[],
): DroppedResourceCandidate | null {
  if (candidates.length === 0) return null;

  const fileCandidate = candidates.find((candidate) => candidate.kind === 'file');
  if (fileCandidate) return fileCandidate;

  const downloadUrl = candidates.find((candidate) => candidate.source === 'download-url');
  if (downloadUrl) return downloadUrl;

  const uriList = candidates.find((candidate) => candidate.source === 'uri-list');
  if (uriList) return uriList;

  return candidates[0] ?? null;
}
