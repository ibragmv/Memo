export type Deck = { id: string; title: string; description: string; examDate: string; color: string; createdAt: number }
export type Card = { id: string; deckId: string; question: string; answer: string; dueAt: number; interval: number; repetitions: number; lastResult?: 'again' | 'hard' | 'good'; createdAt: number }
export type StudyEvent = { cardId: string; at: number; result: 'again' | 'hard' | 'good' }
export type Store = { decks: Deck[]; cards: Card[]; history: StudyEvent[] }

const STORAGE_KEY = 'memo-study-v1'
export const colors = ['coral', 'lavender', 'mint', 'butter']
export const id = () => crypto.randomUUID()
export const dayStart = (time = Date.now()) => { const d = new Date(time); d.setHours(0, 0, 0, 0); return d.getTime() }
export const isDue = (card: Card) => card.dueAt <= Date.now()
export const cardCount = (store: Store, deckId: string) => store.cards.filter(card => card.deckId === deckId).length
export const dueCount = (store: Store, deckId?: string) => store.cards.filter(card => (!deckId || card.deckId === deckId) && isDue(card)).length
export const todayCount = (store: Store) => store.history.filter(event => event.at >= dayStart()).length
export const daysUntil = (date: string) => date ? Math.ceil((new Date(`${date}T00:00:00`).getTime() - dayStart()) / 86400000) : null

export function review(card: Card, result: StudyEvent['result']): Card {
  // Small, predictable intervals are enough for an MVP; no claim of optimal scheduling.
  const interval = result === 'again' ? 0 : result === 'hard' ? Math.max(1, Math.round(card.interval * 1.5)) : card.interval === 0 ? 1 : Math.max(2, Math.round(card.interval * 2.5))
  const dueAt = result === 'again' ? Date.now() + 10 * 60_000 : dayStart() + interval * 86400000
  return { ...card, interval, dueAt, repetitions: card.repetitions + 1, lastResult: result }
}

export function loadStore(): Store {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const value: unknown = JSON.parse(raw)
      if (value && typeof value === 'object' && 'decks' in value && 'cards' in value && 'history' in value) {
        const store = value as Store
        if (Array.isArray(store.decks) && Array.isArray(store.cards) && Array.isArray(store.history)) return store
      }
    }
  } catch { /* Begin with sample content if local storage cannot be read. */ }
  const now = Date.now()
  const decks: Deck[] = [
    { id: 'demo-biology', title: 'Биология', description: 'Клетка и генетика', examDate: '', color: 'coral', createdAt: now },
    { id: 'demo-history', title: 'История', description: 'Ключевые даты и события', examDate: '', color: 'lavender', createdAt: now - 1 },
    { id: 'demo-math', title: 'Математика', description: 'Базовые формулы', examDate: '', color: 'mint', createdAt: now - 2 },
  ]
  const examples: [string, string, string][] = [
    ['demo-biology', 'Что такое митоз?', 'Деление клетки, при котором образуются две генетически одинаковые дочерние клетки.'],
    ['demo-biology', 'Какую функцию выполняют митохондрии?', 'Производят большую часть АТФ в клетке в процессе клеточного дыхания.'],
    ['demo-biology', 'Что такое генотип?', 'Совокупность генов организма.'],
    ['demo-history', 'В каком году началась Первая мировая война?', 'В 1914 году.'],
    ['demo-history', 'Что такое промышленная революция?', 'Переход от ручного труда к машинному производству.'],
    ['demo-math', 'Как звучит теорема Пифагора?', 'В прямоугольном треугольнике квадрат гипотенузы равен сумме квадратов катетов: a² + b² = c².'],
    ['demo-math', 'Чему равна производная x²?', '2x.'],
  ]
  return { decks, cards: examples.map(([deckId, question, answer], index) => ({ id: `demo-card-${index}`, deckId, question, answer, dueAt: now, interval: 0, repetitions: 0, createdAt: now - index })), history: [] }
}

export function saveStore(store: Store) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(store)) } catch { /* The UI stays usable for this session. */ }
}
