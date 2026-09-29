import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, Check, FileText, LoaderCircle, Sparkles, UploadCloud, X } from 'lucide-react'
import type { Deck } from './data'

export type GeneratedCard = { question: string; answer: string; selected: boolean }
const extensions = ['pdf', 'docx', 'pptx', 'txt', 'md', 'png', 'jpg', 'jpeg', 'webp']
const maxFileSize = 12 * 1024 * 1024
const maxTotalSize = 20 * 1024 * 1024

export default function GenerateModal({ decks, initialDeckId, onClose, onSave }: { decks: Deck[]; initialDeckId?: string; onClose: () => void; onSave: (cards: GeneratedCard[], deckId: string | null, newTitle: string) => void }) {
  const [files, setFiles] = useState<File[]>([])
  const [count, setCount] = useState(10)
  const [target, setTarget] = useState(initialDeckId || 'new')
  const [newTitle, setNewTitle] = useState('')
  const [drafts, setDrafts] = useState<GeneratedCard[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { const handler = (event: KeyboardEvent) => { if (event.key === 'Escape' && !busy) onClose() }; document.addEventListener('keydown', handler); return () => document.removeEventListener('keydown', handler) }, [busy, onClose])

  function addFiles(incoming: FileList | File[]) {
    const merged = [...files, ...Array.from(incoming)]
    if (merged.length > 5) { setError('Можно загрузить не больше 5 файлов.'); return }
    if (merged.some(file => !extensions.includes(file.name.split('.').pop()?.toLowerCase() || ''))) { setError('Поддерживаются PDF, DOCX, PPTX, TXT, MD, PNG, JPG и WEBP.'); return }
    if (merged.some(file => file.size > maxFileSize) || merged.reduce((sum, file) => sum + file.size, 0) > maxTotalSize) { setError('Размер одного файла — до 12 МБ, всех вместе — до 20 МБ.'); return }
    setFiles(merged); setError('')
  }

  async function generate() {
    if (!files.length) { setError('Добавьте файл или изображение лекции.'); return }
    const body = new FormData()
    files.forEach(file => body.append('files', file))
    body.append('count', String(count))
    setBusy(true); setError('')
    try {
      const response = await fetch('/api/generate', { method: 'POST', body })
      const result: unknown = await response.json()
      if (!result || typeof result !== 'object') throw new Error('Сервер вернул неверный ответ.')
      if (!response.ok) throw new Error('error' in result && typeof result.error === 'string' ? result.error : 'Не удалось создать карточки.')
      if (!('cards' in result) || !Array.isArray(result.cards)) throw new Error('Не удалось прочитать созданные карточки.')
      const cards = result.cards.filter((card: unknown): card is { question: string; answer: string } => Boolean(card && typeof card === 'object' && 'question' in card && 'answer' in card && typeof card.question === 'string' && typeof card.answer === 'string')).map((card: { question: string; answer: string }) => ({ ...card, selected: true }))
      if (!cards.length) throw new Error('Не получилось создать карточки. Попробуйте другой материал.')
      setDrafts(cards)
      if (!initialDeckId && !newTitle) setNewTitle(files[0].name.replace(/\.[^.]+$/, '').slice(0, 60))
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Не удалось обработать лекцию.') }
    finally { setBusy(false) }
  }

  function updateDraft(index: number, key: 'question' | 'answer' | 'selected', value: string | boolean) {
    setDrafts(current => current?.map((draft, position) => position === index ? { ...draft, [key]: value } : draft) || null)
  }
  const selected = drafts?.filter(draft => draft.selected && draft.question.trim() && draft.answer.trim()) || []

  return <div className="modal-overlay" onMouseDown={event => { if (event.target === event.currentTarget && !busy) onClose() }}><div className="modal generate-modal" role="dialog" aria-modal="true" aria-labelledby="generate-title"><div className="modal-head"><div><span className="eyebrow">ПОМОЩНИК В ПОДГОТОВКЕ</span><h2 id="generate-title">Карточки из лекции <Sparkles size={20}/></h2></div><button className="icon-button" onClick={onClose} disabled={busy} aria-label="Закрыть"><X size={21}/></button></div>
    {!drafts ? <><p className="generate-intro">Загрузи конспект, презентацию или фото страниц. ИИ выделит главные мысли и предложит вопросы для самопроверки.</p><input ref={inputRef} className="visually-hidden" type="file" multiple accept=".pdf,.docx,.pptx,.txt,.md,.png,.jpg,.jpeg,.webp" onChange={event => { if (event.target.files) addFiles(event.target.files); event.target.value = '' }}/><button type="button" className="upload-zone" onClick={() => inputRef.current?.click()} onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); addFiles(event.dataTransfer.files) }}><span className="upload-icon"><UploadCloud size={27}/></span><strong>Выбрать файлы или перетащить сюда</strong><small>PDF, DOCX, PPTX, TXT, MD или изображения · до 5 файлов</small></button>{files.length > 0 && <div className="uploaded-files">{files.map((file, index) => <div className="uploaded-file" key={`${file.name}-${index}`}><FileText size={18}/><span>{file.name}</span><small>{(file.size / 1024 / 1024).toFixed(1)} МБ</small><button onClick={() => setFiles(files.filter((_, position) => position !== index))} aria-label={`Убрать ${file.name}`}><X size={16}/></button></div>)}</div>}<div className="generate-settings"><label htmlFor="card-count">Сколько карточек предложить?</label><select id="card-count" value={count} onChange={event => setCount(Number(event.target.value))}><option value="6">6 карточек</option><option value="10">10 карточек</option><option value="16">16 карточек</option></select></div><p className="generate-privacy">Материалы передаются в Google Gemini для анализа. Проверь ответы перед сохранением.</p>{error && <p className="generate-error" role="alert">{error}</p>}<div className="modal-actions"><button className="button button-outline" type="button" onClick={onClose}>Отмена</button><button className="button button-dark" type="button" disabled={busy || !files.length} onClick={generate}>{busy ? <><LoaderCircle size={16} className="spin"/> Анализируем...</> : <>Создать карточки <ArrowRight size={16}/></>}</button></div></> : <><div className="generated-step"><button className="back-link" onClick={() => { setDrafts(null); setError('') }}><ArrowLeft size={16}/> Изменить файлы</button><span>{selected.length} из {drafts.length} выбрано</span></div><p className="generate-intro">Проверь формулировки и убери лишнее. Карточки сохранятся только после твоего подтверждения.</p><div className="generated-list">{drafts.map((draft, index) => <div className={`generated-item ${draft.selected ? '' : 'unselected'}`} key={index}><label className="generated-check"><input type="checkbox" checked={draft.selected} onChange={event => updateDraft(index, 'selected', event.target.checked)}/><span><Check size={13}/></span> Карточка {index + 1}</label><label>Вопрос<textarea value={draft.question} onChange={event => updateDraft(index, 'question', event.target.value)} rows={2}/></label><label>Ответ<textarea value={draft.answer} onChange={event => updateDraft(index, 'answer', event.target.value)} rows={3}/></label></div>)}</div><div className="generate-target"><label htmlFor="target-deck">Куда сохранить?</label><select id="target-deck" value={target} onChange={event => setTarget(event.target.value)}><option value="new">В новый предмет</option>{decks.map(deck => <option key={deck.id} value={deck.id}>{deck.title}</option>)}</select>{target === 'new' && <input value={newTitle} onChange={event => setNewTitle(event.target.value)} placeholder="Название нового предмета" maxLength={60} aria-label="Название нового предмета"/>}</div>{error && <p className="generate-error" role="alert">{error}</p>}<div className="modal-actions"><button className="button button-outline" onClick={onClose}>Отмена</button><button className="button button-dark" disabled={!selected.length || (target === 'new' && !newTitle.trim())} onClick={() => onSave(selected, target === 'new' ? null : target, newTitle.trim())}>Сохранить {selected.length} {selected.length === 1 ? 'карточку' : 'карточек'} <ArrowRight size={16}/></button></div></>}
  </div></div>
}
