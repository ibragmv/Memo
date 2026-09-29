import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, ArrowRight, BookOpen, CalendarDays, Check, ChevronDown, ChevronRight, CircleHelp, Clock3, LayoutDashboard, Menu, MoreHorizontal, Plus, RotateCcw, Search, Sparkles, Trash2, X } from 'lucide-react'
import { Card, Deck, Store, cardCount, colors, daysUntil, dueCount, id, isDue, loadStore, review, saveStore, todayCount } from './data'
import GenerateModal, { type GeneratedCard } from './GenerateModal'

type Page = 'dashboard' | 'decks' | 'study'
type Modal = { kind: 'deck'; deck?: Deck } | { kind: 'card'; card?: Card; deckId: string } | { kind: 'generate'; deckId?: string } | null
type EditorModalState = Extract<NonNullable<Modal>, { kind: 'deck' | 'card' }>
type StudySession = { ids: string[]; index: number; answered: number; correct: number; source: string } | null

const examText = (date: string) => {
  const days = daysUntil(date)
  if (days === null) return 'Без даты экзамена'
  if (days < 0) return 'Экзамен прошёл'
  if (days === 0) return 'Экзамен сегодня'
  if (days === 1) return 'Экзамен завтра'
  return `До экзамена ${days} дн.`
}
const cardsWord = (count: number) => {
  const lastTwo = count % 100
  const last = count % 10
  return lastTwo >= 11 && lastTwo <= 14 ? 'карточек' : last === 1 ? 'карточка' : last >= 2 && last <= 4 ? 'карточки' : 'карточек'
}

export default function App() {
  const [store, setStore] = useState<Store>(loadStore)
  const [page, setPage] = useState<Page>('dashboard')
  const [selectedDeck, setSelectedDeck] = useState<string | null>(null)
  const [modal, setModal] = useState<Modal>(null)
  const [session, setSession] = useState<StudySession>(null)
  const [flipped, setFlipped] = useState(false)
  const [search, setSearch] = useState('')
  const [mobileMenu, setMobileMenu] = useState(false)
  const [notice, setNotice] = useState('')

  useEffect(() => saveStore(store), [store])
  useEffect(() => { if (notice) { const timer = setTimeout(() => setNotice(''), 3500); return () => clearTimeout(timer) } }, [notice])

  const due = dueCount(store)
  const studied = todayCount(store)
  const nearest = store.decks.filter(deck => deck.examDate && (daysUntil(deck.examDate) ?? -1) >= 0).sort((a, b) => a.examDate.localeCompare(b.examDate))[0]
  const activeDeck = store.decks.find(deck => deck.id === selectedDeck)
  const filteredDecks = store.decks.filter(deck => `${deck.title} ${deck.description}`.toLocaleLowerCase('ru').includes(search.toLocaleLowerCase('ru')))
  const currentCard = session?.ids[session.index] ? store.cards.find(card => card.id === session.ids[session.index]) : undefined
  const sessionDone = !!session && session.index >= session.ids.length
  const progress = session && session.ids.length ? Math.round(session.index / session.ids.length * 100) : 0

  const greeting = useMemo(() => {
    const hour = new Date().getHours()
    return hour < 6 ? 'Доброй ночи' : hour < 12 ? 'Доброе утро' : hour < 18 ? 'Добрый день' : 'Добрый вечер'
  }, [])

  function navigate(next: Page, deckId: string | null = null) {
    setPage(next); setSelectedDeck(deckId); setSession(null); setMobileMenu(false); setSearch('')
  }
  function startStudy(deckId?: string, onlyDue = true) {
    const cards = store.cards.filter(card => (!deckId || card.deckId === deckId) && (!onlyDue || isDue(card)))
    if (!cards.length) { setNotice(onlyDue ? 'Сейчас нет карточек для повторения' : 'Добавьте первую карточку, чтобы начать'); return }
    setSession({ ids: cards.map(card => card.id).sort(() => Math.random() - 0.5), index: 0, answered: 0, correct: 0, source: deckId || 'all' })
    setFlipped(false); setPage('study'); setMobileMenu(false)
  }
  function rate(result: 'again' | 'hard' | 'good') {
    if (!session || !currentCard) return
    const now = Date.now()
    setStore(prev => ({ ...prev, cards: prev.cards.map(card => card.id === currentCard.id ? review(card, result) : card), history: [...prev.history, { cardId: currentCard.id, at: now, result }] }))
    setSession({ ...session, index: session.index + 1, answered: session.answered + 1, correct: session.correct + (result === 'good' ? 1 : 0) })
    setFlipped(false)
  }
  function saveDeck(values: { title: string; description: string; examDate: string; color: string }, existing?: Deck) {
    setStore(prev => ({ ...prev, decks: existing ? prev.decks.map(deck => deck.id === existing.id ? { ...deck, ...values } : deck) : [{ id: id(), ...values, createdAt: Date.now() }, ...prev.decks] }))
    setModal(null); setNotice(existing ? 'Предмет обновлён' : 'Предмет создан')
  }
  function saveCard(values: { question: string; answer: string }, deckId: string, existing?: Card) {
    setStore(prev => ({ ...prev, cards: existing ? prev.cards.map(card => card.id === existing.id ? { ...card, ...values } : card) : [{ id: id(), deckId, ...values, dueAt: Date.now(), interval: 0, repetitions: 0, createdAt: Date.now() }, ...prev.cards] }))
    setModal(null); setNotice(existing ? 'Карточка обновлена' : 'Карточка добавлена')
  }
  function saveGeneratedCards(drafts: GeneratedCard[], deckId: string | null, newTitle: string) {
    const destination = deckId || id()
    const now = Date.now()
    const cards = drafts.map((draft, index) => ({ id: id(), deckId: destination, question: draft.question.trim(), answer: draft.answer.trim(), dueAt: now, interval: 0, repetitions: 0, createdAt: now - index }))
    setStore(prev => ({ ...prev, decks: deckId ? prev.decks : [{ id: destination, title: newTitle, description: 'Карточки из лекции', examDate: '', color: 'lavender', createdAt: now }, ...prev.decks], cards: [...cards, ...prev.cards] }))
    setModal(null); setSelectedDeck(destination); setPage('decks'); setNotice(`Сохранено ${cards.length} карточек`)
  }
  function deleteDeck(deck: Deck) {
    if (!window.confirm(`Удалить «${deck.title}» и все карточки этого предмета?`)) return
    setStore(prev => ({ ...prev, decks: prev.decks.filter(item => item.id !== deck.id), cards: prev.cards.filter(card => card.deckId !== deck.id) }))
    setSelectedDeck(null); setModal(null); setNotice('Предмет удалён')
  }
  function deleteCard(card: Card) {
    if (!window.confirm('Удалить эту карточку?')) return
    setStore(prev => ({ ...prev, cards: prev.cards.filter(item => item.id !== card.id) }))
    setNotice('Карточка удалена')
  }

  return <div className="app-shell">
    <aside className={`sidebar ${mobileMenu ? 'sidebar-open' : ''}`}>
      <button className="brand" onClick={() => navigate('dashboard')} aria-label="Memo — главная"><span className="brand-mark">m<span>.</span></span><span>memo<span className="brand-dot">.</span></span></button>
      <div className="sidebar-main">
        <span className="nav-caption">РАБОЧЕЕ ПРОСТРАНСТВО</span>
        <button className={`nav-item ${page === 'dashboard' ? 'active' : ''}`} onClick={() => navigate('dashboard')}><LayoutDashboard size={18}/><span>Обзор</span></button>
        <button className={`nav-item ${page === 'decks' ? 'active' : ''}`} onClick={() => navigate('decks')}><BookOpen size={18}/><span>Мои предметы</span><span className="nav-number">{store.decks.length}</span></button>
        <button className={`nav-item ${page === 'study' ? 'active' : ''}`} onClick={() => { if (session) setPage('study'); else startStudy() }}><RotateCcw size={18}/><span>Повторение</span>{due > 0 && <span className="due-badge">{due}</span>}</button>
        <div className="nav-divider" />
        <div className="nav-heading"><span>ПРЕДМЕТЫ</span><button onClick={() => setModal({ kind: 'deck' })} aria-label="Добавить предмет"><Plus size={17}/></button></div>
        {store.decks.slice(0, 6).map(deck => <button key={deck.id} className={`deck-nav ${selectedDeck === deck.id && page === 'decks' ? 'selected' : ''}`} onClick={() => navigate('decks', deck.id)}><span className={`tiny-dot ${deck.color}`}/><span>{deck.title}</span></button>)}
        {!store.decks.length && <p className="nav-empty">Здесь появятся ваши предметы</p>}
      </div>
      <div className="sidebar-bottom"><div className="tip-icon"><Sparkles size={18}/></div><p><strong>Маленький шаг каждый день</strong><br/>10 минут повторения лучше, чем всё в последний вечер.</p></div>
      <div className="sidebar-footer"><span className="avatar">С</span><div><strong>Студент</strong><small>Личное пространство</small></div><MoreHorizontal size={19}/></div>
    </aside>
    {mobileMenu && <button className="mobile-overlay" aria-label="Закрыть меню" onClick={() => setMobileMenu(false)}/>}
    <main className="main-area">
      <header className="topbar"><button className="mobile-menu" onClick={() => setMobileMenu(true)} aria-label="Открыть меню"><Menu size={22}/></button><div className="breadcrumb">Моё пространство <ChevronRight size={14}/> <strong>{page === 'dashboard' ? 'Обзор' : page === 'study' ? 'Повторение' : activeDeck?.title || 'Мои предметы'}</strong></div><div className="topbar-right"><span className="today-label"><CalendarDays size={16}/>{new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long' }).format(new Date())}</span><span className="top-avatar">С</span></div></header>
      <div className="content">
        {page === 'dashboard' && <>
          <div className="page-heading"><div><span className="eyebrow">ТВОЯ УЧЁБА, В ТВОЁМ ТЕМПЕ</span><h1>{greeting}<span className="wave"> ✳</span></h1><p>Выбери, с чего начать сегодня. Даже одна карточка — уже прогресс.</p></div><div className="heading-actions"><button className="button button-ai" onClick={() => setModal({ kind: 'generate' })}><Sparkles size={17}/> Из лекции</button><button className="button button-outline desktop-button" onClick={() => setModal({ kind: 'deck' })}><Plus size={17}/> Новый предмет</button></div></div>
          <section className="hero-card"><div className="hero-copy"><span className="hero-kicker"><span/> СЕГОДНЯШНИЙ ФОКУС</span><h2>{due ? <>Пора освежить<br/>знания в памяти</> : <>Отличный день<br/>для нового знания</>}</h2><p>{due ? `У тебя ${due} ${cardsWord(due)} ${due === 1 ? 'ждёт' : 'ждут'} повторения. Начни с малого — остальное пойдёт легче.` : 'Все карточки повторены. Можешь изучить новый материал или создать предмет.'}</p><button className="button button-dark" onClick={() => due ? startStudy() : navigate('decks')}>{due ? 'Начать повторение' : 'Открыть предметы'} <ArrowRight size={18}/></button></div><div className="hero-art" aria-hidden="true"><div className="art-orbit orbit-one"/><div className="art-orbit orbit-two"/><div className="art-card art-back">ПОМНИ</div><div className="art-card art-front"><span>ВОПРОС 01 / 07</span><b>Что ты уже<br/>знаешь?</b><div className="art-line"/><div className="art-line short"/></div><span className="art-star star-one">✳</span><span className="art-star star-two">✦</span></div></section>
          <section className="stats-grid" aria-label="Статистика"><div className="stat-card"><span className="stat-icon peach"><RotateCcw size={20}/></span><div><span className="stat-label">Ждут повторения</span><strong>{due}</strong><small>карточек на сегодня</small></div></div><div className="stat-card"><span className="stat-icon lilac"><Check size={20}/></span><div><span className="stat-label">Сегодня изучено</span><strong>{studied}</strong><small>ответов за день</small></div></div><div className="stat-card"><span className="stat-icon green"><CalendarDays size={20}/></span><div><span className="stat-label">Ближайший экзамен</span><strong className="stat-date">{nearest ? new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short' }).format(new Date(`${nearest.examDate}T00:00:00`)) : '—'}</strong><small>{nearest ? nearest.title : 'добавь дату в предмет'}</small></div></div></section>
          <div className="section-title"><div><h3>Твои предметы</h3><p>Всё, что изучаешь, в одном месте</p></div><button className="text-button" onClick={() => navigate('decks')}>Все предметы <ArrowRight size={16}/></button></div>
          <div className="deck-grid">{store.decks.slice(0, 3).map(deck => <DeckTile key={deck.id} deck={deck} cards={cardCount(store, deck.id)} due={dueCount(store, deck.id)} onClick={() => navigate('decks', deck.id)}/>)}<button className="add-deck-tile" onClick={() => setModal({ kind: 'deck' })}><span><Plus size={22}/></span><strong>Новый предмет</strong><small>Собери всё для подготовки</small></button></div>
          <div className="bottom-note"><span><CircleHelp size={18}/></span><p><strong>Как это работает?</strong> Создай предмет, добавь вопросы и ответы, а затем проверь себя. Сложные карточки вернутся раньше.</p></div>
        </>}
        {page === 'decks' && !activeDeck && <><div className="page-heading compact"><div><span className="eyebrow">ПОРЯДОК В ПОДГОТОВКЕ</span><h1>Мои предметы<span className="title-period">.</span></h1><p>Собери карточки по курсам, темам или экзаменам.</p></div><button className="button button-dark" onClick={() => setModal({ kind: 'deck' })}><Plus size={17}/> Новый предмет</button></div><div className="search-row"><Search size={18}/><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Найти предмет..." aria-label="Найти предмет"/></div><div className="deck-grid all-decks">{filteredDecks.map(deck => <DeckTile key={deck.id} deck={deck} cards={cardCount(store, deck.id)} due={dueCount(store, deck.id)} onClick={() => setSelectedDeck(deck.id)}/>)}<button className="add-deck-tile" onClick={() => setModal({ kind: 'deck' })}><span><Plus size={22}/></span><strong>Новый предмет</strong><small>Начни с первой карточки</small></button></div>{!filteredDecks.length && search && <p className="empty-search">Ничего не нашлось. Попробуй другой запрос.</p>}</>}
        {page === 'decks' && activeDeck && <><button className="back-link" onClick={() => setSelectedDeck(null)}><ArrowLeft size={17}/> Все предметы</button><div className="deck-header"><div className={`deck-header-icon ${activeDeck.color}`}><BookOpen size={28}/></div><div className="deck-header-copy"><span className="eyebrow">ПРЕДМЕТ</span><h1>{activeDeck.title}</h1><p>{activeDeck.description || 'Карточки для подготовки к экзамену'}</p></div><div className="deck-header-actions"><button className="button button-ai" onClick={() => setModal({ kind: 'generate', deckId: activeDeck.id })}><Sparkles size={16}/> Из лекции</button><button className="button button-outline" onClick={() => setModal({ kind: 'deck', deck: activeDeck })}>Настроить</button><button className="button button-dark" onClick={() => setModal({ kind: 'card', deckId: activeDeck.id })}><Plus size={17}/> Карточка</button></div></div><div className="deck-meta"><span><BookOpen size={16}/>{cardCount(store, activeDeck.id)} {cardsWord(cardCount(store, activeDeck.id))}</span><span><RotateCcw size={16}/>{dueCount(store, activeDeck.id)} к повторению</span><span><CalendarDays size={16}/>{examText(activeDeck.examDate)}</span></div><div className="study-banner"><div><span className="banner-kicker">ГОТОВ К САМОПРОВЕРКЕ?</span><h3>Вспомни ответ до того, как перевернёшь карточку.</h3><p>Так материал запоминается лучше.</p></div><div className="banner-actions"><button className="button button-dark" onClick={() => startStudy(activeDeck.id, dueCount(store, activeDeck.id) > 0)}>Учить карточки <ArrowRight size={17}/></button></div></div><div className="section-title card-list-heading"><div><h3>Карточки <span className="subtle-count">{cardCount(store, activeDeck.id)}</span></h3><p>Вопросы, которые стоит запомнить</p></div><button className="text-button" onClick={() => setModal({ kind: 'card', deckId: activeDeck.id })}><Plus size={16}/> Добавить</button></div><div className="cards-list">{store.cards.filter(card => card.deckId === activeDeck.id).map((card, index) => <div className="list-card" key={card.id}><span className="card-index">{String(index + 1).padStart(2, '0')}</span><div className="list-card-body"><strong>{card.question}</strong><p>{card.answer}</p></div><span className={`card-status ${isDue(card) ? 'status-due' : ''}`}>{isDue(card) ? 'Повторить' : 'Изучено'}</span><button className="icon-button" onClick={() => setModal({ kind: 'card', deckId: activeDeck.id, card })} aria-label={`Изменить карточку ${card.question}`}><MoreHorizontal size={20}/></button></div>)}{cardCount(store, activeDeck.id) === 0 && <div className="empty-cards"><BookOpen size={28}/><h3>Пока нет карточек</h3><p>Добавь вопрос и ответ, чтобы начать готовиться.</p><button className="button button-dark" onClick={() => setModal({ kind: 'card', deckId: activeDeck.id })}><Plus size={17}/> Первая карточка</button></div>}</div><button className="danger-link" onClick={() => deleteDeck(activeDeck)}><Trash2 size={16}/> Удалить предмет</button></>}
        {page === 'study' && <><div className="study-page-heading"><div><span className="eyebrow">ТРЕНИРОВКА ПАМЯТИ</span><h1>Повторение<span className="title-period">.</span></h1><p>Сначала попробуй ответить сам, потом открой ответ.</p></div>{session && <button className="button button-outline" onClick={() => { setSession(null); setFlipped(false) }}>Завершить сессию <X size={16}/></button>}</div>{!session ? <div className="study-start"><div className="study-start-art"><div className="study-stack stack-three"/><div className="study-stack stack-two"/><div className="study-stack stack-one"><RotateCcw size={40}/></div></div><h2>{due ? `${due} ${cardsWord(due)} ${due === 1 ? 'ждёт' : 'ждут'} тебя` : 'На сегодня всё повторено'}</h2><p>{due ? 'Пара минут сейчас поможет уверенно вспомнить материал на экзамене.' : 'Можешь пройти все карточки ещё раз или добавить новые вопросы.'}</p><div className="study-start-actions"><button className="button button-dark" onClick={() => startStudy(undefined, due > 0)}>{due ? 'Повторить сегодня' : 'Пройти все карточки'} <ArrowRight size={17}/></button><button className="button button-outline" onClick={() => navigate('decks')}>К предметам</button></div></div> : sessionDone ? <div className="study-start summary"><span className="summary-icon"><Check size={36}/></span><span className="eyebrow">СЕССИЯ ЗАВЕРШЕНА</span><h2>Хорошая работа!</h2><p>Ты прошёл {session.answered} {session.answered % 10 === 1 && session.answered % 100 !== 11 ? 'карточку' : cardsWord(session.answered)}. Уверенно ответил на {session.correct}.</p><div className="summary-stats"><div><strong>{session.answered}</strong><span>просмотрено</span></div><div><strong>{session.correct}</strong><span>знаю ответ</span></div></div><button className="button button-dark" onClick={() => { setSession(null); setPage('dashboard') }}>На главную <ArrowRight size={17}/></button></div> : currentCard ? <div className="study-workspace"><div className="session-top"><span>{session.index + 1} из {session.ids.length}</span><span>{store.decks.find(deck => deck.id === currentCard.deckId)?.title}</span></div><div className="progress-track"><span style={{ width: `${progress}%` }}/></div><button className={`flashcard ${flipped ? 'flipped' : ''}`} onClick={() => setFlipped(!flipped)} aria-label={flipped ? 'Показать вопрос' : 'Показать ответ'}><span className="flashcard-top">{flipped ? 'ОТВЕТ' : 'ВОПРОС'} <span>MEMO / {String(session.index + 1).padStart(2, '0')}</span></span><strong>{flipped ? currentCard.answer : currentCard.question}</strong><span className="flashcard-bottom">{flipped ? 'Нажми, чтобы вернуться к вопросу' : 'Подумай и нажми, чтобы увидеть ответ'} <RotateCcw size={17}/></span></button>{flipped ? <div className="rating-area"><p>Как тебе этот вопрос?</p><div className="rating-buttons"><button className="rating again" onClick={() => rate('again')}><RotateCcw size={18}/><strong>Не вспомнил</strong><small>через 10 минут</small></button><button className="rating hard" onClick={() => rate('hard')}><Clock3 size={18}/><strong>Было трудно</strong><small>через 1+ день</small></button><button className="rating good" onClick={() => rate('good')}><Check size={18}/><strong>Знаю ответ</strong><small>позже</small></button></div></div> : <button className="button button-dark reveal-button" onClick={() => setFlipped(true)}>Показать ответ <ChevronDown size={18}/></button>}</div> : null}</>}
      </div>
    </main>
    {modal?.kind === 'generate' && <GenerateModal decks={store.decks} initialDeckId={modal.deckId} onClose={() => setModal(null)} onSave={saveGeneratedCards}/>}
    {modal && modal.kind !== 'generate' && <EditorModal modal={modal} onClose={() => setModal(null)} onSaveDeck={saveDeck} onSaveCard={saveCard} onDeleteCard={deleteCard} onDeleteDeck={deleteDeck}/ >}
    {notice && <div className="toast" role="status"><Check size={17}/>{notice}</div>}
  </div>
}

function DeckTile({ deck, cards, due, onClick }: { deck: Deck; cards: number; due: number; onClick: () => void }) {
  return <button className="deck-tile" onClick={onClick}><div className={`deck-tile-icon ${deck.color}`}><BookOpen size={25}/></div><div className="deck-tile-arrow"><ArrowRight size={18}/></div><h4>{deck.title}</h4><p>{deck.description || 'Подготовка к экзамену'}</p><div className="deck-tile-footer"><span>{cards} {cardsWord(cards)}</span><span className="footer-sep"/><span>{due ? `${due} повторить` : 'Всё изучено'}</span></div></button>
}

function EditorModal({ modal, onClose, onSaveDeck, onSaveCard, onDeleteCard, onDeleteDeck }: { modal: EditorModalState; onClose: () => void; onSaveDeck: (values: { title: string; description: string; examDate: string; color: string }, deck?: Deck) => void; onSaveCard: (values: { question: string; answer: string }, deckId: string, card?: Card) => void; onDeleteCard: (card: Card) => void; onDeleteDeck: (deck: Deck) => void }) {
  const [title, setTitle] = useState(modal.kind === 'deck' ? modal.deck?.title || '' : '')
  const [description, setDescription] = useState(modal.kind === 'deck' ? modal.deck?.description || '' : '')
  const [examDate, setExamDate] = useState(modal.kind === 'deck' ? modal.deck?.examDate || '' : '')
  const [color, setColor] = useState(modal.kind === 'deck' ? modal.deck?.color || 'coral' : 'coral')
  const [question, setQuestion] = useState(modal.kind === 'card' ? modal.card?.question || '' : '')
  const [answer, setAnswer] = useState(modal.kind === 'card' ? modal.card?.answer || '' : '')
  useEffect(() => { const handler = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }; document.addEventListener('keydown', handler); return () => document.removeEventListener('keydown', handler) }, [onClose])
  function submit(event: React.FormEvent) {
    event.preventDefault()
    if (modal.kind === 'deck') { if (!title.trim()) return; onSaveDeck({ title: title.trim(), description: description.trim(), examDate, color }, modal.deck) }
    else { if (!question.trim() || !answer.trim()) return; onSaveCard({ question: question.trim(), answer: answer.trim() }, modal.deckId, modal.card) }
  }
  return <div className="modal-overlay" onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}><div className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div className="modal-head"><div><span className="eyebrow">{modal.kind === 'deck' ? 'ОРГАНИЗАЦИЯ' : 'УЧЕБНЫЙ МАТЕРИАЛ'}</span><h2 id="modal-title">{modal.kind === 'deck' ? modal.deck ? 'Настроить предмет' : 'Новый предмет' : modal.card ? 'Изменить карточку' : 'Новая карточка'}</h2></div><button className="icon-button" onClick={onClose} aria-label="Закрыть"><X size={21}/></button></div><form onSubmit={submit}>{modal.kind === 'deck' ? <><label>Название предмета<input autoFocus value={title} onChange={e => setTitle(e.target.value)} placeholder="Например, история России" maxLength={60} required/></label><label>Описание <span className="optional">необязательно</span><input value={description} onChange={e => setDescription(e.target.value)} placeholder="Какие темы изучаешь?" maxLength={120}/></label><label>Дата экзамена <span className="optional">необязательно</span><input type="date" value={examDate} onChange={e => setExamDate(e.target.value)}/></label><div className="color-field"><span>Цвет предмета</span><div className="color-options">{colors.map(option => <button key={option} type="button" className={`color-choice ${option} ${color === option ? 'chosen' : ''}`} onClick={() => setColor(option)} aria-label={`Выбрать цвет ${option}`} aria-pressed={color === option}>{color === option && <Check size={16}/>}</button>)}</div></div></> : <><label>Вопрос<textarea autoFocus value={question} onChange={e => setQuestion(e.target.value)} placeholder="Что нужно вспомнить?" rows={3} maxLength={500} required/></label><label>Ответ<textarea value={answer} onChange={e => setAnswer(e.target.value)} placeholder="Напиши короткий и понятный ответ" rows={5} maxLength={2000} required/></label><p className="form-hint"><Sparkles size={16}/> Одна карточка — одна мысль. Так её проще вспомнить.</p></>}<div className="modal-actions">{modal.kind === 'card' && modal.card && <button type="button" className="delete-button" onClick={() => { onDeleteCard(modal.card!); onClose() }}><Trash2 size={16}/> Удалить</button>}{modal.kind === 'deck' && modal.deck && <button type="button" className="delete-button" onClick={() => onDeleteDeck(modal.deck!)}><Trash2 size={16}/> Удалить</button>}<button type="button" className="button button-outline" onClick={onClose}>Отмена</button><button className="button button-dark" type="submit">Сохранить <ArrowRight size={16}/></button></div></form></div></div>
}
