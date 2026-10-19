import { useEffect, useId, useRef, useState, type ChangeEvent, type FormEvent, type KeyboardEvent } from 'react';
import { ArrowUp, FileText, Image as ImageIcon, Paperclip, Square, X } from 'lucide-react';
import './PlaygroundAgentComposer.css';

export type PlaygroundImageQuality = 'auto' | 'low' | 'medium' | 'high';
export type PlaygroundImageSize = 'auto' | '1024x1024' | '1536x1024' | '1024x1536';
export type PlaygroundImageFormat = 'png' | 'jpeg' | 'webp';

export type PlaygroundAgentComposerLabels = {
  promptLabel: string;
  promptPlaceholder: string;
  chatModelLabel: string;
  imageModelLabel: string;
  chooseModel: string;
  imageSettingsLabel: string;
  qualityLabel: string;
  sizeLabel: string;
  formatLabel: string;
  auto: string;
  low: string;
  medium: string;
  high: string;
  squareSize: string;
  landscapeSize: string;
  portraitSize: string;
  png: string;
  jpeg: string;
  webp: string;
  attachFiles: string;
  attachmentsLabel: string;
  removeAttachment: string;
  send: string;
  stop: string;
  loading: string;
  keyboardHint: string;
  fileCount: (count: number) => string;
};

export type PlaygroundAgentComposerProps = {
  labels: PlaygroundAgentComposerLabels;
  prompt: string;
  onPromptChange: (prompt: string) => void;
  onSubmit: (prompt: string) => void;
  onStop: () => void;
  attachments: readonly File[];
  onAttachmentsChange: (files: FileList) => void;
  chatModels: readonly string[];
  selectedChatModel: string;
  onChatModelChange: (model: string) => void;
  imageModels: readonly string[];
  selectedImageModel: string;
  onImageModelChange: (model: string) => void;
  imageQuality: PlaygroundImageQuality;
  onImageQualityChange: (quality: PlaygroundImageQuality) => void;
  imageSize: PlaygroundImageSize;
  onImageSizeChange: (size: PlaygroundImageSize) => void;
  imageFormat: PlaygroundImageFormat;
  onImageFormatChange: (format: PlaygroundImageFormat) => void;
  isLoading?: boolean;
  disabled?: boolean;
  accept?: string;
  attachmentError?: string;
  showImageSettings?: boolean;
};

function toFileList(files: readonly File[]): FileList {
  const transfer = new DataTransfer();
  files.forEach((file) => transfer.items.add(file));
  return transfer.files;
}

function isImage(file: File) {
  return file.type.startsWith('image/');
}

export function PlaygroundAgentComposer({
  labels,
  prompt,
  onPromptChange,
  onSubmit,
  onStop,
  attachments,
  onAttachmentsChange,
  chatModels,
  selectedChatModel,
  onChatModelChange,
  imageModels,
  selectedImageModel,
  onImageModelChange,
  imageQuality,
  onImageQualityChange,
  imageSize,
  onImageSizeChange,
  imageFormat,
  onImageFormatChange,
  isLoading = false,
  disabled = false,
  accept = '.png,.jpg,.jpeg,.gif,.webp,.pdf,.txt,.md,.csv,.json',
  attachmentError = '',
  showImageSettings = true,
}: PlaygroundAgentComposerProps) {
  const fileInputId = useId();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const [imagePreviews, setImagePreviews] = useState<Map<File, string>>(new Map());
  const unavailable = disabled || isLoading;

  useEffect(() => {
    const previews = new Map<File, string>();
    attachments.filter(isImage).forEach((file) => previews.set(file, URL.createObjectURL(file)));
    setImagePreviews(previews);
    return () => previews.forEach((url) => URL.revokeObjectURL(url));
  }, [attachments]);

  const reportFiles = (incoming: FileList | null) => {
    if (!incoming?.length) return;
    const merged = [...attachments];
    Array.from(incoming).forEach((file) => {
      if (!merged.some((existing) => existing.name === file.name && existing.size === file.size && existing.lastModified === file.lastModified)) {
        merged.push(file);
      }
    });
    onAttachmentsChange(toFileList(merged));
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    reportFiles(event.currentTarget.files);
    event.currentTarget.value = '';
  };

  const removeFile = (index: number) => {
    onAttachmentsChange(toFileList(attachments.filter((_, fileIndex) => fileIndex !== index)));
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const value = prompt.trim();
    if ((!value && attachments.length === 0) || unavailable) return;
    onSubmit(value);
  };

  const handlePromptKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      event.currentTarget.form?.requestSubmit();
    }
  };

  return (
    <section className="stratus-agent" aria-label={labels.promptLabel} data-testid="playground-agent-composer">
      <div className="stratus-agent__model-row">
        <label className="stratus-agent__model-field" htmlFor="agent-chat-model">
          <span className="stratus-agent__field-icon" aria-hidden="true"><span className="stratus-agent__chat-mark" /></span>
          <span>{labels.chatModelLabel}</span>
          <select
            id="agent-chat-model"
            value={selectedChatModel}
            onChange={(event) => onChatModelChange(event.target.value)}
            disabled={unavailable || chatModels.length === 0}
            data-testid="select-agent-chat-model"
          >
            {chatModels.length === 0 && <option value="">{labels.chooseModel}</option>}
            {chatModels.map((model) => <option value={model} key={model}>{model}</option>)}
          </select>
        </label>
        <span className="stratus-agent__model-divider" aria-hidden="true" />
        <label className="stratus-agent__model-field" htmlFor="agent-image-model">
          <span className="stratus-agent__field-icon" aria-hidden="true"><ImageIcon size={14} /></span>
          <span>{labels.imageModelLabel}</span>
          <select
            id="agent-image-model"
            value={selectedImageModel}
            onChange={(event) => onImageModelChange(event.target.value)}
            disabled={unavailable || imageModels.length === 0}
            data-testid="select-agent-image-model"
          >
            {imageModels.length === 0 && <option value="">{labels.chooseModel}</option>}
            {imageModels.map((model) => <option value={model} key={model}>{model}</option>)}
          </select>
        </label>
      </div>

      {showImageSettings && <div className="stratus-agent__settings" aria-label={labels.imageSettingsLabel}>
        <span className="stratus-agent__settings-title">{labels.imageSettingsLabel}</span>
        <label className="stratus-agent__setting" htmlFor="agent-image-quality">
          <span>{labels.qualityLabel}</span>
          <select id="agent-image-quality" value={imageQuality} onChange={(event) => onImageQualityChange(event.target.value as PlaygroundImageQuality)} disabled={unavailable} data-testid="select-agent-image-quality">
            <option value="auto">{labels.auto}</option>
            <option value="low">{labels.low}</option>
            <option value="medium">{labels.medium}</option>
            <option value="high">{labels.high}</option>
          </select>
        </label>
        <label className="stratus-agent__setting" htmlFor="agent-image-size">
          <span>{labels.sizeLabel}</span>
          <select id="agent-image-size" value={imageSize} onChange={(event) => onImageSizeChange(event.target.value as PlaygroundImageSize)} disabled={unavailable} data-testid="select-agent-image-size">
            <option value="auto">{labels.auto}</option>
            <option value="1024x1024">1024 × 1024 · {labels.squareSize}</option>
            <option value="1536x1024">1536 × 1024 · {labels.landscapeSize}</option>
            <option value="1024x1536">1024 × 1536 · {labels.portraitSize}</option>
          </select>
        </label>
        <label className="stratus-agent__setting" htmlFor="agent-image-format">
          <span>{labels.formatLabel}</span>
          <select id="agent-image-format" value={imageFormat} onChange={(event) => onImageFormatChange(event.target.value as PlaygroundImageFormat)} disabled={unavailable} data-testid="select-agent-image-format">
            <option value="png">{labels.png}</option>
            <option value="jpeg">{labels.jpeg}</option>
            <option value="webp">{labels.webp}</option>
          </select>
        </label>
      </div>}

      <form className={`stratus-agent__form${dragActive ? ' is-drag-active' : ''}`} onSubmit={submit}
        onDragEnter={(event) => { event.preventDefault(); if (!unavailable) setDragActive(true); }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragActive(false); }}
        onDrop={(event) => { event.preventDefault(); setDragActive(false); if (!unavailable) reportFiles(event.dataTransfer.files); }}
      >
        <label className="stratus-agent__prompt-label" htmlFor="agent-prompt">{labels.promptLabel}</label>
        <div className="stratus-agent__entry">
          <textarea
            id="agent-prompt"
            value={prompt}
            onChange={(event) => onPromptChange(event.target.value)}
              onKeyDown={handlePromptKeyDown}
            placeholder={labels.promptPlaceholder}
            rows={3}
            disabled={unavailable}
            data-testid="input-agent-prompt"
          />
          <div className="stratus-agent__actions">
            <input
              ref={fileInputRef}
              id={fileInputId}
              className="stratus-agent__file-input"
              type="file"
              accept={accept}
              multiple
              onChange={handleFileChange}
              disabled={unavailable}
              aria-label={labels.attachFiles}
              data-testid="input-agent-attachments"
            />
            <label className="stratus-agent__attach" htmlFor={fileInputId} aria-label={labels.attachFiles} title={labels.attachFiles} data-testid="button-agent-attach">
              <Paperclip size={16} aria-hidden="true" /><span>{labels.attachFiles}</span>
            </label>
            {isLoading ? (
              <button className="stratus-agent__send is-stop" type="button" onClick={onStop} aria-label={labels.stop} data-testid="button-agent-stop">
                <Square size={13} fill="currentColor" aria-hidden="true" /><span>{labels.stop}</span>
              </button>
            ) : (
              <button className="stratus-agent__send" type="submit" disabled={(!prompt.trim() && attachments.length === 0) || unavailable} aria-label={labels.send} data-testid="button-agent-send">
                <ArrowUp size={17} aria-hidden="true" /><span>{labels.send}</span>
              </button>
            )}
          </div>
        </div>
        {attachments.length > 0 && (
          <div className="stratus-agent__attachments" aria-label={labels.attachmentsLabel} data-testid="list-agent-attachments">
            {attachments.map((file, index) => (
              <span className="stratus-agent__file-chip" key={`${file.name}-${file.size}-${file.lastModified}-${index}`} data-testid={`chip-agent-attachment-${index}`}>
                <span className="stratus-agent__file-icon" aria-hidden="true">{isImage(file) ? <ImageIcon size={13} /> : <FileText size={13} />}</span>
              {isImage(file) && imagePreviews.get(file) && <img className="stratus-agent__preview" src={imagePreviews.get(file)} alt={file.name} />}
                <span className="stratus-agent__file-name" title={file.name}>{file.name}</span>
                <button type="button" onClick={() => removeFile(index)} disabled={unavailable} aria-label={`${labels.removeAttachment}: ${file.name}`} data-testid={`button-agent-remove-attachment-${index}`}>
                  <X size={13} aria-hidden="true" />
                </button>
              </span>
            ))}
          </div>
        )}
        {attachmentError && <p className="stratus-agent__error" role="alert" data-testid="text-agent-attachment-error">{attachmentError}</p>}
        <div className="stratus-agent__footer">
          <span className="stratus-agent__attachment-count" data-testid="text-agent-attachment-count">
            {attachments.length ? labels.fileCount(attachments.length) : labels.keyboardHint}
          </span>
          {isLoading && <span className="stratus-agent__loading" role="status" aria-live="polite" data-testid="status-agent-loading"><i />{labels.loading}</span>}
        </div>
      </form>
    </section>
  );
}
