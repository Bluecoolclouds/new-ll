import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, ArrowUpRight, ShieldCheck } from 'lucide-react';
import { legalCopy, type LegalPageKind } from '../lib/legal-copy';
import { routePath } from '../lib/routes';
import { readWorkspaceLanguage } from '../lib/workspace-copy';
import { getLegalText } from './auth/auth-api';
import './landing/landing.css';

export function LegalPage({ page }: { page: LegalPageKind }) {
  const language = readWorkspaceLanguage();
  const copy = legalCopy[language];
  const pageCopy = copy.pages[page];
  const documentKind = page === 'privacy' ? 'privacy-policy' : page === 'offer' ? 'user-agreement' : null;
  const legalDocument = useQuery({
    queryKey: ['stratus-legal-document', documentKind],
    queryFn: () => getLegalText(documentKind!),
    enabled: documentKind !== null,
    staleTime: 60_000,
    retry: 1,
  });
  const publishedText = legalDocument.data?.trim();
  const sections = publishedText && documentKind
    ? [{ title: copy.officialTextHeading, paragraphs: [publishedText] }]
    : pageCopy.sections;

  useEffect(() => {
    const previousTitle = document.title;
    document.title = `${pageCopy.title} — Stratus Hub`;
    return () => { document.title = previousTitle; };
  }, [pageCopy.title]);

  return (
    <div className="landing min-h-[100dvh] overflow-x-clip" data-theme="light">
      <div className="mx-auto max-w-[1320px] px-5 pb-12 sm:px-8 lg:px-12">
        <header className="mt-3 flex min-h-[62px] items-center justify-between gap-4 rounded-full border land-line land-panel px-5 sm:px-7">
          <a href={routePath('/')} className="display shrink-0 text-[19px] font-extrabold tracking-[-.06em]" aria-label="Stratus home">
            stratus<span className="land-accent">/</span>hub
          </a>
          <a href={routePath('/')} className="inline-flex items-center gap-2 text-[12px] font-semibold land-muted hover:land-accent">
            <ArrowLeft size={15}/>{copy.back}
          </a>
        </header>

        <main className="mx-auto max-w-[900px] py-12 sm:py-20">
          <div className="mb-4 text-[10px] font-semibold uppercase tracking-[.14em] land-accent">{copy.eyebrow}</div>
          <h1 className="display max-w-[800px] text-[38px] font-extrabold leading-[1.02] tracking-[-.05em] sm:text-[58px]">{pageCopy.title}</h1>
          <p className="mt-5 max-w-[720px] text-[14px] leading-relaxed land-muted">{pageCopy.intro}</p>

          {page === 'contacts' && (
            <a
              href="https://t.me/wpnetwork_sup"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-full px-5 text-[12px] font-bold land-button"
            >
              {copy.telegram}<ArrowUpRight size={15}/>
            </a>
          )}

          <article className="mt-8 rounded-[26px] border land-line land-panel p-5 sm:p-8" aria-live="polite">
            {sections.map((section, index) => (
              <section key={section.title} className={index === 0 ? '' : 'mt-7 border-t land-line pt-6'}>
                <div className="flex items-start gap-3">
                  {page === 'refund' && index === 0 && <ShieldCheck className="mt-0.5 shrink-0 land-accent" size={18}/>}
                  <h2 className="text-[16px] font-bold leading-snug">{section.title}</h2>
                </div>
                <div className="mt-3 space-y-3">
                  {section.paragraphs.map((paragraph, paragraphIndex) => (
                    <p key={`${section.title}-${paragraphIndex}`} className="whitespace-pre-wrap break-words text-[13px] leading-7 land-muted">{paragraph}</p>
                  ))}
                </div>
              </section>
            ))}
          </article>

          {page !== 'contacts' && (
            <div className="mt-8 border-t land-line pt-6">
              <a href="https://t.me/wpnetwork_sup" target="_blank" rel="noopener noreferrer" className="text-[12px] font-semibold land-accent hover:underline">
                {copy.support} · @wpnetwork_sup
              </a>
            </div>
          )}
        </main>

        <footer className="flex flex-wrap items-center justify-between gap-4 border-t land-line pt-5 text-[10px] land-muted">
          <a href={routePath('/')} className="font-bold tracking-[-.04em]">stratus/hub</a>
          <span>© 2026 · Stratus Hub</span>
        </footer>
      </div>
    </div>
  );
}
