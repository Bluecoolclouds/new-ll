import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, Download, Image as ImageIcon, LoaderCircle, Trash2 } from 'lucide-react';
import { deletePlaygroundMedia, listPlaygroundMedia, playgroundMediaUrl } from '../lib/playground-library';
import { useWorkspaceLocale } from '../lib/workspace-locale';
import { workspaceLocale } from '../lib/workspace-copy';

export function PlaygroundLibrary({ hidden, scopeKey }: { hidden: boolean; scopeKey?: number }) {
  const { language, copy: c } = useWorkspaceLocale();
  const locale = workspaceLocale(language);
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const media = useQuery({
    queryKey: ['stratus', 'playground', 'library', scopeKey, page],
    queryFn: () => listPlaygroundMedia(page),
    enabled: Boolean(scopeKey),
    staleTime: 15_000,
    retry: false,
  });
  const remove = async (id: number) => {
    try {
      await deletePlaygroundMedia(id);
      await queryClient.invalidateQueries({ queryKey: ['stratus', 'playground', 'library'] });
    } catch {
      await media.refetch();
    }
  };

  return <section className="playground-library" aria-label={c.playgroundLibraryMode} hidden={hidden}>
    <header className="playground-library-heading">
      <div><h2>{c.playgroundLibraryTitle}</h2><p>{c.playgroundLibraryHelp}</p></div>
      {media.data && <span>{new Intl.NumberFormat(locale).format(media.data.total)}</span>}
    </header>
    {media.isLoading && <div className="playground-library-status" role="status"><LoaderCircle size={16}/>{c.loading}</div>}
    {media.isError && <div className="playground-library-status is-error" role="alert"><AlertCircle size={16}/>{media.error instanceof Error ? media.error.message : c.playgroundLibraryError}<button type="button" onClick={() => void media.refetch()}>{c.retry}</button></div>}
    {!media.isLoading && !media.isError && media.data?.items.length === 0 && <div className="playground-image-empty"><ImageIcon size={24}/><strong>{c.playgroundLibraryTitle}</strong><span>{c.playgroundLibraryEmpty}</span></div>}
    {media.data && media.data.items.length > 0 && <div className="playground-image-grid">
      {media.data.items.map((item) => <figure className="playground-image-card" key={item.id} data-testid={`card-playground-media-${item.id}`}>
        <img src={playgroundMediaUrl(item)} alt={item.prompt || item.model} loading="lazy"/>
        <figcaption>
          <span>{c.playgroundModel}: {item.model}</span>
          <p>{item.prompt}</p>
          <div className="playground-library-actions">
            <a href={playgroundMediaUrl(item)} download={`stratus-image-${item.id}`}><Download size={13}/>{c.playgroundImageDownload}</a>
            <button type="button" onClick={() => void remove(item.id)} aria-label={`${c.playgroundDeleteImage} ${item.id}`} data-testid={`button-delete-playground-media-${item.id}`}><Trash2 size={13}/>{c.playgroundDeleteImage}</button>
          </div>
          <time>{new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(item.created_at * 1000))}</time>
        </figcaption>
      </figure>)}
    </div>}
    {media.data && media.data.total > media.data.page_size && <nav className="playground-library-pagination" aria-label={c.playgroundLibraryTitle}>
      <button type="button" onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={page <= 1}>{c.previousPage}</button>
      <span>{c.page} {media.data.page} {c.of} {Math.ceil(media.data.total / media.data.page_size)}</span>
      <button type="button" onClick={() => setPage((value) => value + 1)} disabled={page * media.data.page_size >= media.data.total}>{c.nextPage}</button>
    </nav>}
  </section>;
}
