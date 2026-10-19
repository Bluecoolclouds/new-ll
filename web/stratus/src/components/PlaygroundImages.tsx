import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { AlertCircle, Check, CircleDot, Download, Image as ImageIcon, LoaderCircle, Paperclip, Sparkles, X } from 'lucide-react';
import { generatePlaygroundImage, isGptImageModel, type PlaygroundImageSettings } from '../lib/playground-api';
import { isSupportedPlaygroundImage } from '../lib/playground-files';
import { useWorkspaceLocale } from '../lib/workspace-locale';
import { workspaceLocale } from '../lib/workspace-copy';
import type { PlaygroundImageFormat, PlaygroundImageQuality, PlaygroundImageSize } from './playground-agent/PlaygroundAgentComposer';

type GeneratedImage = {
  id: number;
  src: string;
  model: string;
  prompt: string;
};

function getImageSource(item: NonNullable<import('../lib/playground-api').PlaygroundImageResponse['data']>[number], format: PlaygroundImageFormat) {
  const base64 = item.b64_json?.trim();
  if (base64) return `data:image/${format};base64,${base64}`;

  const value = item.url?.trim();
  if (!value) return null;
  if (/^data:image\/(?:png|jpeg|webp);base64,/i.test(value)) return value;

  try {
    const parsed = new URL(value, window.location.origin);
    if (parsed.protocol === 'https:' || parsed.origin === window.location.origin) return parsed.href;
  } catch {
    return null;
  }
  return null;
}

type PlaygroundImagesProps = {
  hidden: boolean;
  apiKey?: string;
  imageModels: string[];
  modelsLoading: boolean;
  modelsError: boolean;
  modelsFetching: boolean;
  modelsErrorText: string;
  onRefreshModels: () => void;
  selectedModel: string;
  onModelChange: (model: string) => void;
  quality: PlaygroundImageQuality;
  onQualityChange: (quality: PlaygroundImageQuality) => void;
  size: PlaygroundImageSize;
  onSizeChange: (size: PlaygroundImageSize) => void;
  format: PlaygroundImageFormat;
  onFormatChange: (format: PlaygroundImageFormat) => void;
};

export function PlaygroundImages({
  hidden,
  apiKey,
  imageModels,
  modelsLoading,
  modelsError,
  modelsFetching,
  modelsErrorText,
  onRefreshModels,
  selectedModel,
  onModelChange,
  quality,
  onQualityChange,
  size,
  onSizeChange,
  format,
  onFormatChange,
}: PlaygroundImagesProps) {
  const { language, copy: c } = useWorkspaceLocale();
  const locale = workspaceLocale(language);
  const [prompt, setPrompt] = useState('');
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const [referenceError, setReferenceError] = useState('');
  const [references, setReferences] = useState<File[]>([]);
  const [referenceUrls, setReferenceUrls] = useState<string[]>([]);
  const [images, setImages] = useState<GeneratedImage[]>([]);
  const sequence = useRef(0);
  const imageFileInput = useRef<HTMLInputElement>(null);
  const isLoading = modelsLoading;
  const hasError = modelsError;
  const isBusy = generating || isLoading || hasError || !apiKey || !selectedModel;

  useEffect(() => {
    const urls = references.map((file) => URL.createObjectURL(file));
    setReferenceUrls(urls);
    return () => urls.forEach((url) => URL.revokeObjectURL(url));
  }, [references]);

  const handleReferenceFiles = (event: ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(event.currentTarget.files ?? []);
    event.currentTarget.value = '';
    if (!selected.length) return;
    const accepted: File[] = [];
    const issues: string[] = [];
    for (const file of selected) {
      if (!isSupportedPlaygroundImage(file)) issues.push(`${file.name}: ${c.playgroundFileUnsupported}`);
      else if (file.size > 20 * 1024 * 1024) issues.push(`${file.name}: ${c.playgroundFileTooLarge}`);
      else accepted.push(file);
    }
    setReferences((current) => [...current, ...accepted].slice(0, 8));
    if (accepted.length + references.length > 8) issues.push(c.playgroundTooManyFiles);
    setReferenceError(issues.join(' '));
  };

  const generate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const value = prompt.trim();
    if (!value || !selectedModel || !apiKey || generating) return;

    setGenerating(true);
    setError('');
    try {
      const settings: PlaygroundImageSettings = {
        quality: isGptImageModel(selectedModel) ? quality : 'auto',
        size: isGptImageModel(selectedModel) ? size : 'auto',
        format: isGptImageModel(selectedModel) ? format : 'png',
      };
      const response = await generatePlaygroundImage(apiKey, selectedModel, value, settings, references);
      const result = (response.data ?? [])
        .map((item) => ({ item, src: getImageSource(item, settings.format) }))
        .filter((entry): entry is { item: NonNullable<typeof response.data>[number]; src: string } => Boolean(entry.src))
        .map(({ item, src }) => ({
          id: ++sequence.current,
          src,
          model: response.model?.trim() || selectedModel,
          prompt: item.revised_prompt?.trim() || value,
        }));
      if (result.length === 0) throw new Error(c.playgroundImageNoOutput);
      setImages((current) => [...result, ...current]);
      setPrompt('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : c.playgroundImageError);
    } finally {
      setGenerating(false);
    }
  };

  const refreshModels = () => onRefreshModels();

  return <div id="playground-image-panel" className="playground-image-mode" role="region" aria-label={c.playgroundImagesMode} hidden={hidden}>
    <div className="playground-image-toolbar">
      <label className="playground-model-field" htmlFor="playground-image-model">
        <span>{c.playgroundImageModel}</span>
        <select id="playground-image-model" value={selectedModel} disabled={isLoading || imageModels.length === 0 || generating} onChange={(event) => onModelChange(event.target.value)} data-testid="select-playground-image-model">
          {imageModels.length === 0 && <option value="">{c.playgroundChooseModel}</option>}
          {imageModels.map((model) => <option key={model} value={model}>{model}</option>)}
        </select>
      </label>
      {isGptImageModel(selectedModel) && <div className="playground-image-options">
        <label className="playground-model-field" htmlFor="playground-image-quality">
          <span>{c.playgroundImageQuality}</span>
          <select id="playground-image-quality" value={quality} disabled={generating} onChange={(event) => onQualityChange(event.target.value as PlaygroundImageQuality)}>
            <option value="auto">{c.playgroundImageAuto}</option>
            <option value="low">{c.playgroundImageLow}</option>
            <option value="medium">{c.playgroundImageMedium}</option>
            <option value="high">{c.playgroundImageHigh}</option>
          </select>
        </label>
        <label className="playground-model-field" htmlFor="playground-image-size">
          <span>{c.playgroundImageSize}</span>
          <select id="playground-image-size" value={size} disabled={generating} onChange={(event) => onSizeChange(event.target.value as PlaygroundImageSize)}>
            <option value="auto">{c.playgroundImageAuto}</option>
            <option value="1024x1024">1024 × 1024</option>
            <option value="1536x1024">1536 × 1024</option>
            <option value="1024x1536">1024 × 1536</option>
          </select>
        </label>
        <label className="playground-model-field" htmlFor="playground-image-format">
          <span>{c.playgroundImageFormat}</span>
          <select id="playground-image-format" value={format} disabled={generating} onChange={(event) => onFormatChange(event.target.value as PlaygroundImageFormat)}>
            <option value="png">{c.playgroundImagePng}</option>
            <option value="jpeg">{c.playgroundImageJpeg}</option>
            <option value="webp">{c.playgroundImageWebp}</option>
          </select>
        </label>
      </div>}
      <div className="playground-model-status">
        <span className={hasError ? 'is-error' : ''}><CircleDot size={12}/>{modelsError ? modelsErrorText : hasError ? c.playgroundImageModelsError : isLoading ? c.playgroundImageLoading : `${new Intl.NumberFormat(locale).format(imageModels.length)} ${c.playgroundModelCount}`}</span>
      </div>
    </div>

    <div className="playground-billing" role="note">
        <span className="playground-billing-mark"><Check size={14}/></span>
      <p>{c.playgroundBillingNotice} {c.playgroundImageBilling}</p>
    </div>

    {hasError && <div className="playground-model-error" role="alert"><AlertCircle size={17}/><span>{modelsErrorText}</span><button type="button" onClick={refreshModels} disabled={modelsFetching}>{c.playgroundRefreshModels}</button></div>}
    {!isLoading && !hasError && imageModels.length === 0 && <div className="playground-no-models" role="status"><ImageIcon size={22}/><strong>{c.playgroundImageNoModels}</strong></div>}

    <div className="playground-image-references">
      <div className="playground-image-reference-heading">
        <div><strong>{c.playgroundImageReferences}</strong><span>{c.playgroundImageReferenceHelp}</span></div>
        <input ref={imageFileInput} type="file" accept="image/png,image/jpeg,image/gif,image/webp" multiple hidden onChange={handleReferenceFiles} data-testid="input-image-references"/>
        <button type="button" onClick={() => imageFileInput.current?.click()} disabled={isBusy || generating} data-testid="button-add-image-reference"><Paperclip size={14}/>{c.playgroundAttachFiles}</button>
      </div>
      {referenceError && <p className="playground-image-reference-error" role="alert">{referenceError}</p>}
      {references.length > 0 && <div className="playground-image-reference-list" data-testid="list-image-references">
        {references.map((file, index) => <span className="playground-image-reference-chip" key={`${file.name}-${file.size}-${index}`}>
          {referenceUrls[index] && <img src={referenceUrls[index]} alt={file.name}/>}
          <span title={file.name}>{file.name}</span>
          <button type="button" onClick={() => setReferences((current) => current.filter((_, currentIndex) => currentIndex !== index))} disabled={generating} aria-label={`${c.playgroundRemoveAttachment}: ${file.name}`} data-testid={`button-remove-image-reference-${index}`}><X size={13}/></button>
        </span>)}
      </div>}
    </div>

    <div className="playground-image-results" aria-live="polite" aria-label={c.playgroundImageResult}>
      {images.length === 0 && !isLoading && imageModels.length > 0 && <div className="playground-image-empty"><ImageIcon size={24}/><strong>{c.playgroundImageTitle}</strong><span>{c.playgroundImageEmpty}</span></div>}
      {generating && <div className="playground-image-generating" role="status"><LoaderCircle size={16}/>{c.playgroundImageGenerating}</div>}
      {error && <div className="playground-image-error" role="alert"><AlertCircle size={16}/><div><strong>{c.playgroundImageError}</strong><p>{error}</p></div></div>}
      {images.length > 0 && <div className="playground-image-grid">
        {images.map((image) => <figure className="playground-image-card" key={image.id}>
          <img src={image.src} alt={image.prompt} loading="lazy"/>
          <figcaption><span>{c.playgroundModel}: {image.model}</span><p>{image.prompt}</p>{image.src.startsWith('data:image/') && <a href={image.src} download={`stratus-image-${image.id}.${format}`}><Download size={13}/>{c.playgroundImageDownload}</a>}</figcaption>
        </figure>)}
      </div>}
    </div>

    <form className="playground-composer" onSubmit={generate}>
      <label htmlFor="playground-image-prompt">{c.playgroundImagePrompt}</label>
      <div className="playground-composer-box">
        <textarea id="playground-image-prompt" value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder={c.playgroundImagePlaceholder} rows={3} disabled={isBusy} data-testid="input-playground-image-prompt"/>
        <button type="submit" disabled={!prompt.trim() || isBusy} data-testid="button-generate-image"><Sparkles size={16}/><span>{generating ? c.playgroundImageGenerating : c.playgroundImageGenerate}</span></button>
      </div>
    </form>
  </div>;
}
