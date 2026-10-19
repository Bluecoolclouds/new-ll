/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import { useRef, useState } from 'react'
import {
  PaperclipIcon,
  FileIcon,
  ImageIcon,
  ScreenShareIcon,
  CameraIcon,
  GlobeIcon,
  SendIcon,
  SquareIcon,
  BarChartIcon,
  BoxIcon,
  NotepadTextIcon,
  CodeSquareIcon,
  GraduationCapIcon,
  XIcon,
} from 'lucide-react'
import { nanoid } from 'nanoid'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  PromptInput,
  PromptInputButton,
  PromptInputFooter,
  PromptInputTextarea,
  PromptInputTools,
  type PromptInputMessage,
} from '@/components/ai-elements/prompt-input'
import { Suggestion, Suggestions } from '@/components/ai-elements/suggestion'
import { ModelGroupSelector } from '@/components/model-group-selector'
import type { AttachedFile, ModelOption, GroupOption } from '../types'

const MAX_FILE_SIZE_MB = 20
const MAX_IMAGE_DIMENSION = 1024
const IMAGE_QUALITY = 0.85
const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
const ACCEPTED_FILE_TYPES = [
  ...ACCEPTED_IMAGE_TYPES,
  'application/pdf',
  'text/plain',
  'text/csv',
  'application/json',
]

interface PlaygroundInputProps {
  onSubmit: (text: string, files?: AttachedFile[]) => void
  onStop?: () => void
  disabled?: boolean
  isGenerating?: boolean
  models: ModelOption[]
  modelValue: string
  onModelChange: (value: string) => void
  isModelLoading?: boolean
  groups: GroupOption[]
  groupValue: string
  onGroupChange: (value: string) => void
  webSearch?: boolean
  onWebSearchChange?: (value: boolean) => void
  webSearchContextSize?: 'low' | 'medium' | 'high'
  onWebSearchContextSizeChange?: (value: 'low' | 'medium' | 'high') => void
}

const suggestions = [
  { icon: BarChartIcon, text: 'Analyze data', color: '#76d0eb' },
  { icon: BoxIcon, text: 'Surprise me', color: '#76d0eb' },
  { icon: NotepadTextIcon, text: 'Summarize text', color: '#ea8444' },
  { icon: CodeSquareIcon, text: 'Code', color: '#6c71ff' },
  { icon: GraduationCapIcon, text: 'Get advice', color: '#76d0eb' },
  { icon: null, text: 'More' },
]

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function PlaygroundInput({
  onSubmit,
  onStop,
  disabled,
  isGenerating,
  models,
  modelValue,
  onModelChange,
  isModelLoading = false,
  groups,
  groupValue,
  onGroupChange,
  webSearch = false,
  onWebSearchChange,
  webSearchContextSize = 'medium',
  onWebSearchContextSizeChange,
}: PlaygroundInputProps) {
  const { t } = useTranslation()
  const [text, setText] = useState('')
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([])

  const imageInputRef = useRef<HTMLInputElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)

  const isModelSelectDisabled =
    disabled || isModelLoading || models.length === 0
  const isGroupSelectDisabled = disabled || groups.length === 0

  const readFileAsDataUrl = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(file)
    })

  const compressImage = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onerror = reject
      reader.onload = () => {
        const img = new Image()
        img.onerror = reject
        img.onload = () => {
          let { width, height } = img
          if (width > MAX_IMAGE_DIMENSION || height > MAX_IMAGE_DIMENSION) {
            if (width >= height) {
              height = Math.round((height * MAX_IMAGE_DIMENSION) / width)
              width = MAX_IMAGE_DIMENSION
            } else {
              width = Math.round((width * MAX_IMAGE_DIMENSION) / height)
              height = MAX_IMAGE_DIMENSION
            }
          }
          const canvas = document.createElement('canvas')
          canvas.width = width
          canvas.height = height
          const ctx = canvas.getContext('2d')
          if (!ctx) { reject(new Error('canvas ctx unavailable')); return }
          ctx.drawImage(img, 0, 0, width, height)
          resolve(canvas.toDataURL('image/jpeg', IMAGE_QUALITY))
        }
        img.src = reader.result as string
      }
      reader.readAsDataURL(file)
    })

  const processFiles = async (files: FileList | null, allowedTypes: string[]) => {
    if (!files || files.length === 0) return

    const newFiles: AttachedFile[] = []
    for (const file of Array.from(files)) {
      if (!allowedTypes.includes(file.type)) {
        toast.error(t('Unsupported file type: {{name}}', { name: file.name }))
        continue
      }
      if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
        toast.error(t('File too large (max {{mb}}MB): {{name}}', { mb: MAX_FILE_SIZE_MB, name: file.name }))
        continue
      }
      const isImage = ACCEPTED_IMAGE_TYPES.includes(file.type)
      try {
        const dataUrl = isImage
          ? await compressImage(file)
          : await readFileAsDataUrl(file)
        newFiles.push({
          id: nanoid(),
          name: file.name,
          type: isImage ? 'image' : 'file',
          mimeType: isImage ? 'image/jpeg' : file.type,
          dataUrl,
          size: file.size,
        })
      } catch {
        toast.error(t('Failed to read file: {{name}}', { name: file.name }))
      }
    }

    if (newFiles.length > 0) {
      setAttachedFiles((prev) => [...prev, ...newFiles])
    }
  }

  const removeFile = (id: string) => {
    setAttachedFiles((prev) => prev.filter((f) => f.id !== id))
  }

  const handleSubmit = (message: PromptInputMessage) => {
    if ((!message.text?.trim() && attachedFiles.length === 0) || disabled) return
    onSubmit(message.text || '', attachedFiles.length > 0 ? attachedFiles : undefined)
    setText('')
    setAttachedFiles([])
  }

  const handleSuggestionClick = (suggestion: string) => {
    onSubmit(suggestion)
  }

  return (
    <div className='grid shrink-0 gap-4 px-1 md:pb-4'>
      <PromptInput groupClassName='rounded-xl' onSubmit={handleSubmit}>
        {attachedFiles.length > 0 && (
          <div className='flex flex-wrap gap-2 px-3 pt-3'>
            {attachedFiles.map((f) => (
              <div
                key={f.id}
                className='relative flex items-center gap-1.5 rounded-lg border bg-muted/50 px-2 py-1.5 text-xs'
              >
                {f.type === 'image' ? (
                  <img
                    src={f.dataUrl}
                    alt={f.name}
                    className='h-8 w-8 rounded object-cover'
                  />
                ) : (
                  <FileIcon size={16} className='shrink-0 text-muted-foreground' />
                )}
                <div className='min-w-0'>
                  <div className='max-w-[120px] truncate font-medium'>{f.name}</div>
                  <div className='text-muted-foreground'>{formatBytes(f.size)}</div>
                </div>
                <button
                  type='button'
                  onClick={() => removeFile(f.id)}
                  className='ml-1 rounded-full p-0.5 hover:bg-muted'
                  aria-label={t('Remove file')}
                >
                  <XIcon size={12} />
                </button>
              </div>
            ))}
          </div>
        )}

        <input
          ref={imageInputRef}
          type='file'
          accept={ACCEPTED_IMAGE_TYPES.join(',')}
          multiple
          className='hidden'
          onChange={(e) => processFiles(e.target.files, ACCEPTED_IMAGE_TYPES)}
          onClick={(e) => { (e.target as HTMLInputElement).value = '' }}
        />
        <input
          ref={fileInputRef}
          type='file'
          accept={ACCEPTED_FILE_TYPES.join(',')}
          multiple
          className='hidden'
          onChange={(e) => processFiles(e.target.files, ACCEPTED_FILE_TYPES)}
          onClick={(e) => { (e.target as HTMLInputElement).value = '' }}
        />
        <input
          ref={cameraInputRef}
          type='file'
          accept='image/*'
          capture='environment'
          className='hidden'
          onChange={(e) => processFiles(e.target.files, ACCEPTED_IMAGE_TYPES)}
          onClick={(e) => { (e.target as HTMLInputElement).value = '' }}
        />

        <PromptInputTextarea
          autoComplete='off'
          autoCorrect='off'
          autoCapitalize='off'
          spellCheck={false}
          className='px-5 md:text-base'
          disabled={disabled}
          onChange={(event) => setText(event.target.value)}
          placeholder={t('Ask anything')}
          value={text}
        />

        <PromptInputFooter className='p-2.5'>
          <PromptInputTools>
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <PromptInputButton
                    className='border font-medium'
                    disabled={disabled}
                    variant='outline'
                  />
                }
              >
                <PaperclipIcon size={16} />
                <span className='hidden sm:inline'>{t('Attach')}</span>
                <span className='sr-only sm:hidden'>{t('Attach')}</span>
              </DropdownMenuTrigger>
              <DropdownMenuContent align='start'>
                <DropdownMenuItem onClick={() => fileInputRef.current?.click()}>
                  <FileIcon className='mr-2' size={16} />
                  {t('Upload file')}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => imageInputRef.current?.click()}>
                  <ImageIcon className='mr-2' size={16} />
                  {t('Upload photo')}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => toast.info(t('Feature in development'), { description: 'take-screenshot' })}
                >
                  <ScreenShareIcon className='mr-2' size={16} />
                  {t('Take screenshot')}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => cameraInputRef.current?.click()}>
                  <CameraIcon className='mr-2' size={16} />
                  {t('Take photo')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <PromptInputButton
                    className={webSearch ? 'border font-medium bg-primary/10 text-primary border-primary/30' : 'border font-medium'}
                    disabled={disabled}
                    variant='outline'
                    title={webSearch ? t('Web search enabled ({{size}})', { size: webSearchContextSize }) : t('Enable web search')}
                  />
                }
              >
                <GlobeIcon size={16} />
                <span className='hidden sm:inline'>{t('Search')}</span>
                <span className='sr-only sm:hidden'>{t('Search')}</span>
              </DropdownMenuTrigger>
              <DropdownMenuContent align='start'>
                <DropdownMenuItem onClick={() => onWebSearchChange?.(!webSearch)}>
                  <GlobeIcon className='mr-2' size={16} />
                  {webSearch ? t('Disable web search') : t('Enable web search')}
                </DropdownMenuItem>
                {webSearch && (
                  <>
                    <DropdownMenuSeparator />
                    {(['low', 'medium', 'high'] as const).map((size) => (
                      <DropdownMenuItem
                        key={size}
                        onClick={() => onWebSearchContextSizeChange?.(size)}
                        className={webSearchContextSize === size ? 'font-medium text-primary' : ''}
                      >
                        {webSearchContextSize === size && <span className='mr-1.5'>✓</span>}
                        {webSearchContextSize !== size && <span className='mr-1.5 opacity-0'>✓</span>}
                        {t('Context: {{size}}', { size })}
                      </DropdownMenuItem>
                    ))}
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </PromptInputTools>

          <div className='flex items-center gap-1.5 md:gap-2'>
            <ModelGroupSelector
              selectedModel={modelValue}
              models={models}
              onModelChange={onModelChange}
              selectedGroup={groupValue}
              groups={groups}
              onGroupChange={onGroupChange}
              disabled={isModelSelectDisabled || isGroupSelectDisabled}
            />

            {isGenerating && onStop ? (
              <PromptInputButton
                className='text-foreground font-medium'
                onClick={onStop}
                variant='secondary'
              >
                <SquareIcon className='fill-current' size={16} />
                <span className='hidden sm:inline'>{t('Stop')}</span>
                <span className='sr-only sm:hidden'>{t('Stop')}</span>
              </PromptInputButton>
            ) : (
              <PromptInputButton
                className='text-foreground font-medium'
                disabled={disabled || (!text.trim() && attachedFiles.length === 0)}
                type='submit'
                variant='secondary'
              >
                <SendIcon size={16} />
                <span className='hidden sm:inline'>{t('Send')}</span>
                <span className='sr-only sm:hidden'>{t('Send')}</span>
              </PromptInputButton>
            )}
          </div>
        </PromptInputFooter>
      </PromptInput>

      <Suggestions>
        {suggestions.map(({ icon: Icon, text, color }) => (
          <Suggestion
            className={`text-xs font-normal sm:text-sm ${
              text === 'More' ? 'hidden sm:flex' : ''
            }`}
            key={text}
            onClick={() => handleSuggestionClick(text)}
            suggestion={text}
          >
            {Icon && <Icon size={16} style={{ color }} />}
            {text}
          </Suggestion>
        ))}
      </Suggestions>
    </div>
  )
}
