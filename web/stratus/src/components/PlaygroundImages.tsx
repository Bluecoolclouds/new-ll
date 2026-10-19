import { useRef, useState, type FormEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertCircle, Check, CircleDot, Download, Image as ImageIcon, LoaderCircle, Sparkles } from 'lucide-react';
import { request, requestPricing, type PricingModel } from '../lib/api';
import { useWorkspaceLocale } from '../lib/workspace-locale';
import { workspaceLocale } from '../lib/workspace-copy';

type ImageGenerationResponse = {
  data?: Array<{ b64_json?: string; url?: string; revised_prompt?: string }>;
};

type GeneratedImage = {
  id: number;
  src: string;
  model: string;
  prompt: string;
};

function isGptImageModel(model: string) {
  return /(?:^|\/)gpt[-_]?image(?:[-_]|$)/i.test(model);
}

function supportsImageGeneration(model: PricingModel) {
  return (model.supported_endpoint_types ?? []).some((endpoint) => endpoint.toLowerCase() === 'image-generation');
}

function getImageSource(item: NonNullable<ImageGenerationResponse['data']>[number]) {
  const base64 = item.b64_json?.trim();
  if (base64) return `data:image/png;base64,${base64}`;

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

export function PlaygroundImages({ hidden }: { hidden: boolean }) {
  const { language, copy: c } = useWorkspaceLocale();
  const locale = workspaceLocale(language);
  const availableModels = useQuery({
    queryKey: ['stratus', 'playground', 'models'],
    queryFn: () => request<string[]>('/api/user/models'),
    staleTime: 60_000,
    retry: false,
  });
  const pricing = useQuery({
    queryKey: ['stratus', 'playground', 'pricing'],
    queryFn: () => requestPricing('/api/pricing'),
    staleTime: 5 * 60_000,
    retry: false,
  });
  const [chosenModel, setChosenModel] = useState('');
  const [prompt, setPrompt] = useState('');
  const [quality, setQuality] = useState('auto');
  const [size, setSize] = useState('auto');
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const [images, setImages] = useState<GeneratedImage[]>([]);
  const sequence = useRef(0);

  const userModels = new Set(availableModels.data ?? []);
  const imageModels = [...new Set((pricing.data?.data ?? [])
    .filter(supportsImageGeneration)
    .map((model) => model.model_name)
    .filter((model) => userModels.has(model)))]
    .sort((left, right) => Number(!isGptImageModel(left)) - Number(!isGptImageModel(right)) || left.localeCompare(right));
  const selectedModel = imageModels.includes(chosenModel)
    ? chosenModel
    : imageModels.find(isGptImageModel) ?? imageModels[0] ?? '';
  const isLoading = availableModels.isLoading || pricing.isLoading;
  const hasError = availableModels.isError || pricing.isError;
  const isBusy = generating || isLoading || hasError || !selectedModel;

  const generate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const value = prompt.trim();
    if (!value || !selectedModel || generating) return;

    setGenerating(true);
    setError('');
    try {
      const payload: Record<string, unknown> = { model: selectedModel, prompt: value, n: 1 };
      if (isGptImageModel(selectedModel)) {
        payload.quality = quality;
        payload.size = size;
      }
      const response = await request<ImageGenerationResponse>('/pg/images/generations', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      const result = (response.data ?? [])
        .map((item) => ({ item, src: getImageSource(item) }))
        .filter((entry): entry is { item: NonNullable<ImageGenerationResponse['data']>[number]; src: string } => Boolean(entry.src))
        .map(({ item, src }) => ({
          id: ++sequence.current,
          src,
          model: selectedModel,
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

  const refreshModels = () => {
    void availableModels.refetch();
    void pricing.refetch();
  };

  return <div id="playground-image-panel" className="playground-image-mode" role="region" aria-label={c.playgroundImagesMode} hidden={hidden}>
    <div className="playground-image-toolbar">
      <label className="playground-model-field" htmlFor="playground-image-model">
        <span>{c.playgroundImageModel}</span>
        <select id="playground-image-model" value={selectedModel} disabled={isLoading || imageModels.length === 0 || generating} onChange={(event) => setChosenModel(event.target.value)} data-testid="select-playground-image-model">
          {imageModels.length === 0 && <option value="">{c.playgroundChooseModel}</option>}
          {imageModels.map((model) => <option key={model} value={model}>{model}</option>)}
        </select>
      </label>
      {isGptImageModel(selectedModel) && <div className="playground-image-options">
        <label className="playground-model-field" htmlFor="playground-image-quality">
          <span>{c.playgroundImageQuality}</span>
          <select id="playground-image-quality" value={quality} disabled={generating} onChange={(event) => setQuality(event.target.value)}>
            <option value="auto">{c.playgroundImageAuto}</option>
            <option value="low">{c.playgroundImageLow}</option>
            <option value="medium">{c.playgroundImageMedium}</option>
            <option value="high">{c.playgroundImageHigh}</option>
          </select>
        </label>
        <label className="playground-model-field" htmlFor="playground-image-size">
          <span>{c.playgroundImageSize}</span>
          <select id="playground-image-size" value={size} disabled={generating} onChange={(event) => setSize(event.target.value)}>
            <option value="auto">{c.playgroundImageAuto}</option>
            <option value="1024x1024">1024 × 1024</option>
            <option value="1536x1024">1536 × 1024</option>
            <option value="1024x1536">1024 × 1536</option>
          </select>
        </label>
      </div>}
      <div className="playground-model-status">
        <span className={hasError ? 'is-error' : ''}><CircleDot size={12}/>{hasError ? c.playgroundImageModelsError : isLoading ? c.playgroundImageLoading : `${new Intl.NumberFormat(locale).format(imageModels.length)} ${c.playgroundModelCount}`}</span>
      </div>
    </div>

    <div className="playground-billing" role="note">
        <span className="playground-billing-mark"><Check size={14}/></span>
      <p>{c.playgroundBillingNotice} {c.playgroundImageBilling}</p>
    </div>

    {hasError && <div className="playground-model-error" role="alert"><AlertCircle size={17}/><span>{c.playgroundImageModelsError}</span><button type="button" onClick={refreshModels} disabled={availableModels.isFetching || pricing.isFetching}>{c.playgroundRefreshModels}</button></div>}
    {!isLoading && !hasError && imageModels.length === 0 && <div className="playground-no-models" role="status"><ImageIcon size={22}/><strong>{c.playgroundImageNoModels}</strong></div>}

    <div className="playground-image-results" aria-live="polite" aria-label={c.playgroundImageResult}>
      {images.length === 0 && !isLoading && imageModels.length > 0 && <div className="playground-image-empty"><ImageIcon size={24}/><strong>{c.playgroundImageTitle}</strong><span>{c.playgroundImageEmpty}</span></div>}
      {generating && <div className="playground-image-generating" role="status"><LoaderCircle size={16}/>{c.playgroundImageGenerating}</div>}
      {error && <div className="playground-image-error" role="alert"><AlertCircle size={16}/><div><strong>{c.playgroundImageError}</strong><p>{error}</p></div></div>}
      {images.length > 0 && <div className="playground-image-grid">
        {images.map((image) => <figure className="playground-image-card" key={image.id}>
          <img src={image.src} alt={image.prompt} loading="lazy"/>
          <figcaption><span>{image.model}</span><p>{image.prompt}</p>{image.src.startsWith('data:image/') && <a href={image.src} download={`stratus-image-${image.id}.png`}><Download size={13}/>{c.playgroundImageDownload}</a>}</figcaption>
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
