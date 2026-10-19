export type PreparedPlaygroundAttachment = {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  kind: 'image' | 'document';
  sourceFile: File;
  dataUrl?: string;
  textContent?: string;
};

export type PlaygroundAttachmentIssue = {
  code: 'too-many' | 'too-large' | 'unsupported' | 'pdf-no-text' | 'read-failed' | 'text-truncated';
  fileName: string;
};

const MAX_FILES = 8;
const MAX_FILE_BYTES = 20 * 1024 * 1024;
const MAX_TEXT_CHARS = 80_000;
const MAX_IMAGE_DIMENSION = 1024;
const IMAGE_QUALITY = 0.85;
const IMAGE_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);
const IMAGE_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp']);
const TEXT_EXTENSIONS = new Set(['txt', 'md', 'csv', 'json']);

function fileExtension(file: File) {
  return file.name.split('.').pop()?.toLocaleLowerCase('en') ?? '';
}

function toDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
    reader.onerror = () => reject(new Error('Could not read image data.'));
    reader.readAsDataURL(blob);
  });
}

async function prepareImage(file: File) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_IMAGE_DIMENSION / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d', { alpha: false });
  if (!context) {
    bitmap.close();
    throw new Error('Could not process image.');
  }
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  const compressed = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Could not compress image.')), 'image/jpeg', IMAGE_QUALITY);
  });
  return toDataUrl(compressed);
}

async function extractPdfText(file: File) {
  const [{ GlobalWorkerOptions, getDocument }, worker] = await Promise.all([
    import('pdfjs-dist/legacy/build/pdf.mjs'),
    import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url'),
  ]);
  GlobalWorkerOptions.workerSrc = worker.default;
  const bytes = new Uint8Array(await file.arrayBuffer());
  const loadingTask = getDocument({ data: bytes });
  const pdf = await loadingTask.promise;
  const chunks: string[] = [];
  let charCount = 0;
  try {
    for (let pageNumber = 1; pageNumber <= pdf.numPages && charCount < MAX_TEXT_CHARS; pageNumber++) {
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();
      const pageText = content.items
        .map((item) => 'str' in item ? item.str : '')
        .filter(Boolean)
        .join(' ');
      if (pageText) {
        const remaining = MAX_TEXT_CHARS - charCount;
        const bounded = pageText.slice(0, remaining);
        chunks.push(bounded);
        charCount += bounded.length;
      }
    }
  } finally {
    await loadingTask.destroy();
  }
  return chunks.join('\n\n').trim();
}

export async function preparePlaygroundAttachments(
  files: readonly File[],
): Promise<{ attachments: PreparedPlaygroundAttachment[]; issues: PlaygroundAttachmentIssue[] }> {
  const attachments: PreparedPlaygroundAttachment[] = [];
  const issues: PlaygroundAttachmentIssue[] = [];
  let remainingTextChars = MAX_TEXT_CHARS;

  if (files.length > MAX_FILES) issues.push({ code: 'too-many', fileName: String(MAX_FILES) });

  for (const file of files.slice(0, MAX_FILES)) {
    if (file.size > MAX_FILE_BYTES) {
      issues.push({ code: 'too-large', fileName: file.name });
      continue;
    }

    const extension = fileExtension(file);
    const isImage = IMAGE_MIME_TYPES.has(file.type) || IMAGE_EXTENSIONS.has(extension);
    const isPdf = file.type === 'application/pdf' || extension === 'pdf';
    const isText = TEXT_EXTENSIONS.has(extension)
      || file.type === 'text/plain'
      || file.type === 'text/markdown'
      || file.type === 'text/csv'
      || file.type === 'application/json';

    if (!isImage && !isPdf && !isText) {
      issues.push({ code: 'unsupported', fileName: file.name });
      continue;
    }

    try {
      if (isImage) {
        attachments.push({
          id: crypto.randomUUID(),
          name: file.name,
          mimeType: file.type,
          size: file.size,
          kind: 'image',
          sourceFile: file,
          dataUrl: await prepareImage(file),
        });
        continue;
      }

      const extracted = isPdf ? await extractPdfText(file) : await file.text();
      if (isPdf && !extracted) {
        issues.push({ code: 'pdf-no-text', fileName: file.name });
        continue;
      }
      if (remainingTextChars <= 0) {
        issues.push({ code: 'text-truncated', fileName: file.name });
        continue;
      }

      const textContent = extracted.slice(0, remainingTextChars);
      remainingTextChars -= textContent.length;
      if (textContent.length < extracted.length) {
        issues.push({ code: 'text-truncated', fileName: file.name });
      }
      attachments.push({
        id: crypto.randomUUID(),
        name: file.name,
        mimeType: isPdf ? 'application/pdf' : file.type || 'text/plain',
        size: file.size,
        kind: 'document',
        sourceFile: file,
        textContent,
      });
    } catch {
      issues.push({ code: 'read-failed', fileName: file.name });
    }
  }

  return { attachments, issues };
}

export function isSupportedPlaygroundImage(file: File) {
  return IMAGE_MIME_TYPES.has(file.type) || IMAGE_EXTENSIONS.has(fileExtension(file));
}
