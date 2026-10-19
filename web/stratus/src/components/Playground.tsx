import { useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'wouter';
import { AlertCircle, ArrowUp, Bot, Check, CircleDot, Image as ImageIcon, LoaderCircle, MessageSquareText, RotateCcw, Trash2, UserRound } from 'lucide-react';
import { AccountHeader } from './AccountHeader';
import { PlaygroundImages } from './PlaygroundImages';
import { request } from '../lib/api';
import { WorkspaceLocaleProvider, useWorkspaceLocale } from '../lib/workspace-locale';
import { workspaceLocale } from '../lib/workspace-copy';
import './playground.css';

type ChatRole = 'user' | 'assistant' | 'system';
type ChatMessage = { role: ChatRole; content: string };
type ChatResponse = {
  choices?: Array<{ message?: { content?: string | Array<{ type?: string; text?: string }> } }>;
  usage?: { total_tokens?: number };
};
type Turn = {
  id: number;
  role: 'user' | 'assistant';
  content: string;
  failed?: boolean;
  model?: string;
  totalTokens?: number;
};

function responseText(response: ChatResponse): string {
  const content = response.choices?.[0]?.message?.content;
  if (typeof content === 'string') return content.trim();
  if (Array.isArray(content)) return content.map((part) => part?.text ?? '').join('').trim();
  return '';
}

function PlaygroundContent({ mode }: { mode: 'chat' | 'images' }) {
  const { language, copy: c, setLanguage } = useWorkspaceLocale();
  const locale = workspaceLocale(language);
  const models = useQuery({
    queryKey: ['stratus', 'playground', 'models'],
    queryFn: () => request<string[]>('/api/user/models'),
    staleTime: 60_000,
    retry: false,
  });
  const [model, setModel] = useState('');
  const [draft, setDraft] = useState('');
  const [turns, setTurns] = useState<Turn[]>([]);
  const [sending, setSending] = useState(false);
  const [requestError, setRequestError] = useState(false);
  const sequence = useRef(0);
  const availableModels = models.data ?? [];
  const selectedModel = availableModels.includes(model) ? model : (availableModels[0] ?? '');
  const totalTokens = turns.reduce((sum, turn) => sum + (turn.totalTokens ?? 0), 0);
  const hasReportedUsage = turns.some((turn) => typeof turn.totalTokens === 'number');

  const completeRequest = async (text: string, history: ChatMessage[], userId: number) => {
    setSending(true);
    setRequestError(false);
    try {
      const response = await request<ChatResponse>('/pg/chat/completions', {
        method: 'POST',
        body: JSON.stringify({
          model: selectedModel,
          messages: [...history, { role: 'user', content: text }],
          stream: false,
        }),
      });
      const answer = responseText(response) || c.playgroundNoResponse;
      const total = response.usage?.total_tokens;
      setTurns((current) => [
        ...current.map((turn) => turn.id === userId ? { ...turn, failed: false } : turn),
        { id: ++sequence.current, role: 'assistant', content: answer, model: selectedModel, ...(typeof total === 'number' && Number.isFinite(total) ? { totalTokens: total } : {}) },
      ]);
    } catch {
      setTurns((current) => current.map((turn) => turn.id === userId ? { ...turn, failed: true } : turn));
      setRequestError(true);
    } finally {
      setSending(false);
    }
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const text = draft.trim();
    if (!text || !selectedModel || sending) return;
    const history = turns.filter((turn) => !turn.failed).map(({ role, content }) => ({ role, content }));
    const userId = ++sequence.current;
    setTurns((current) => [...current, { id: userId, role: 'user', content: text }]);
    setDraft('');
    void completeRequest(text, history, userId);
  };

  const retryTurn = (turnId: number) => {
    if (sending || !selectedModel) return;
    const index = turns.findIndex((turn) => turn.id === turnId);
    const failed = turns[index];
    if (index < 0 || !failed?.failed) return;
    const history = turns.slice(0, index).filter((turn) => !turn.failed).map(({ role, content }) => ({ role, content }));
    void completeRequest(failed.content, history, failed.id);
  };

  const handleComposerKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      event.currentTarget.form?.requestSubmit();
    }
  };

  return <div className="workspace playground">
    <div className="workspace-shell playground-shell">
      <AccountHeader active="playground" language={language} onLanguageChange={setLanguage}/>
      <header className="playground-heading">
        <div>
          <div className="playground-eyebrow"><span/><span>STRATUS / {c.playgroundEyebrow}</span><i/></div>
          <h1>{mode === 'chat' ? c.playgroundTextMode : c.playgroundImageTitle}</h1>
          <p>{mode === 'chat' ? c.playgroundIntro : c.playgroundImageIntro}</p>
        </div>
        {mode === 'chat' && turns.length > 0 && <button className="playground-clear" type="button" onClick={() => { if (!sending) { setTurns([]); setRequestError(false); } }} disabled={sending} data-testid="button-clear-conversation">
          <Trash2 size={15}/>{c.playgroundClear}
        </button>}
      </header>

      <main className="playground-main">
        <section className="playground-console" aria-label={c.playgroundTitle}>
          <nav className="playground-mode-tabs" aria-label={c.playgroundTitle}>
            <Link id="playground-chat-tab" href="/playground/chat" aria-current={mode === 'chat' ? 'page' : undefined} className={mode === 'chat' ? 'is-active' : ''} data-testid="tab-playground-chat">
              <MessageSquareText size={15}/>{c.playgroundTextMode}
            </Link>
            <Link id="playground-images-tab" href="/playground/images" aria-current={mode === 'images' ? 'page' : undefined} className={mode === 'images' ? 'is-active' : ''} data-testid="tab-playground-images">
              <ImageIcon size={15}/>{c.playgroundImagesMode}
            </Link>
          </nav>
          <div id="playground-chat-panel" className="playground-mode-panel" role="region" aria-labelledby="playground-chat-tab" hidden={mode !== 'chat'}>
          <div className="playground-toolbar">
            <label className="playground-model-field" htmlFor="playground-model">
              <span>{c.playgroundModel}</span>
              <select id="playground-model" value={selectedModel} disabled={models.isLoading || availableModels.length === 0 || sending} onChange={(event) => setModel(event.target.value)} data-testid="select-playground-model">
                {availableModels.length === 0 && <option value="">{c.playgroundChooseModel}</option>}
                {availableModels.map((modelId) => <option key={modelId} value={modelId}>{modelId}</option>)}
              </select>
            </label>
            <div className="playground-model-status">
              <span className={models.isError ? 'is-error' : ''}><CircleDot size={12}/>{models.isError ? c.playgroundModelsError : models.isLoading ? c.playgroundModelsLoading : availableModels.length ? `${new Intl.NumberFormat(locale).format(availableModels.length)} ${c.playgroundModelCount}` : c.playgroundNoModels}</span>
              {!models.isError && availableModels.length === 0 && !models.isLoading && <button type="button" onClick={() => void models.refetch()} disabled={models.isFetching} data-testid="button-refresh-models">{models.isFetching ? c.loading : c.playgroundRefreshModels}</button>}
            </div>
          </div>

          <div className="playground-billing" role="note">
            <span className="playground-billing-mark"><Check size={14}/></span>
            <p>{c.playgroundBillingNotice}</p>
          </div>

          {models.isLoading && <div className="playground-model-skeleton" role="status" aria-label={c.playgroundModelsLoading}><i/><i/><i/></div>}
          {models.isError && <div className="playground-model-error" role="alert"><AlertCircle size={17}/><span>{c.playgroundModelsError}</span><button type="button" onClick={() => void models.refetch()} disabled={models.isFetching}>{models.isFetching ? c.loading : c.retry}</button></div>}
          {!models.isLoading && !models.isError && availableModels.length === 0 && <div className="playground-no-models" role="status"><Bot size={22}/><strong>{c.playgroundNoModels}</strong></div>}

          <div className="playground-thread" aria-live="polite" aria-relevant="additions text">
            {turns.length === 0 && !models.isLoading && availableModels.length > 0 && <div className="playground-empty">
              <div className="playground-empty-glyph"><Bot size={24}/></div>
              <span className="playground-empty-index">01 / {c.playgroundReady}</span>
              <h2>{c.playgroundEmptyTitle}</h2>
              <p>{c.playgroundEmptyHelp}</p>
            </div>}
            {turns.map((turn) => <article className={`playground-turn is-${turn.role}${turn.failed ? ' is-failed' : ''}`} key={turn.id} data-testid={`message-${turn.role}-${turn.id}`}>
              <div className="playground-turn-avatar">{turn.role === 'assistant' ? <Bot size={15}/> : <UserRound size={14}/>}</div>
              <div className="playground-turn-body">
                <div className="playground-turn-meta"><strong>{turn.role === 'assistant' ? c.playgroundAssistant : c.playgroundYou}</strong><span>{turn.role === 'assistant' ? turn.model ?? selectedModel : c.playgroundPromptTag}</span></div>
                <p>{turn.content}</p>
                {turn.failed && <div className="playground-turn-error" role="alert"><span>{c.playgroundRequestError}</span><button type="button" onClick={() => retryTurn(turn.id)} disabled={sending}><RotateCcw size={13}/>{c.playgroundRetry}</button></div>}
                {turn.role === 'assistant' && typeof turn.totalTokens === 'number' && <div className="playground-turn-usage">{c.playgroundTokens}<strong>{new Intl.NumberFormat(locale).format(turn.totalTokens)}</strong></div>}
              </div>
            </article>)}
            {sending && <div className="playground-thinking" role="status"><span className="playground-thinking-mark"><LoaderCircle size={15}/></span>{c.playgroundSending}<i/><i/><i/></div>}
            {requestError && <span className="playground-error-sr" role="status">{c.playgroundRequestError}</span>}
          </div>

          <form className="playground-composer" onSubmit={submit}>
            <label htmlFor="playground-prompt">{c.playgroundPrompt}</label>
            <div className="playground-composer-box">
              <textarea id="playground-prompt" value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={handleComposerKeyDown} placeholder={c.playgroundPromptPlaceholder} rows={2} disabled={!selectedModel || sending} data-testid="input-playground-prompt"/>
              <button type="submit" aria-label={c.playgroundSend} disabled={!draft.trim() || !selectedModel || sending} data-testid="button-send-prompt"><ArrowUp size={18}/><span>{c.playgroundSend}</span></button>
            </div>
            <div className="playground-composer-foot"><span>{c.playgroundKeyboardHint}</span>{hasReportedUsage && <span className="playground-total-usage">{c.playgroundTokens}<strong>{new Intl.NumberFormat(locale).format(totalTokens)}</strong></span>}</div>
          </form>
          </div>
          <PlaygroundImages hidden={mode !== 'images'}/>
        </section>
        <aside className="playground-side-note">
          <span className="playground-side-number">01</span>
           <div><strong>{c.playgroundAccessTitle}</strong><p>{c.playgroundAccessDescription}</p></div>
          <span className="playground-side-rule"/>
           <span className="playground-side-caption">{c.playgroundPrivacyNote}</span>
        </aside>
      </main>
      <footer className="playground-footer"><span>STRATUS HUB</span><span>{c.playgroundPageMemoryNote}</span></footer>
    </div>
  </div>;
}

export function Playground({ mode = 'chat' }: { mode?: 'chat' | 'images' }) {
  return <WorkspaceLocaleProvider><PlaygroundContent mode={mode}/></WorkspaceLocaleProvider>;
}
