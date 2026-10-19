// The Word Mode curriculum: 10 units x 12 words = 120 lessons (the stars in the UI).
// Each entry is an English *concept*. The AI turns it into the word in the language being learned
// (with its article, for languages that have one), so one list serves every language.
// Word ids are URL slugs (/word/friend) and the keys stored in WordProgress: never rename one that
// users have progress on.

export type WordItem = { id: string; english: string; emoji: string; photo: string };
export type WordUnit = { number: number; title: string; words: WordItem[] };

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
/** photo = the search words for the stock photo; defaults to the English word (without a leading "to") */
const w = (english: string, emoji: string, photo?: string): WordItem => ({
  id: slug(english), english, emoji, photo: photo ?? english.replace(/^to /, ''),
});

export const WORD_UNITS: WordUnit[] = [
  { number: 1, title: 'People and family', words: [
    w('friend', '🧑‍🤝‍🧑', 'friends together'), w('family', '👨‍👩‍👧', 'family together'), w('mother', '👩', 'mother and child'),
    w('father', '👨', 'father and child'), w('brother', '👦', 'brothers'), w('sister', '👧', 'sisters'),
    w('child', '🧒'), w('man', '🧔', 'man portrait'), w('woman', '👩‍🦰', 'woman portrait'),
    w('baby', '👶'), w('neighbor', '🏘️', 'neighbors talking'), w('teacher', '🧑‍🏫', 'teacher classroom') ] },
  { number: 2, title: 'Food and drink', words: [
    w('water', '💧', 'glass of water'), w('bread', '🍞'), w('milk', '🥛'), w('coffee', '☕', 'cup of coffee'),
    w('apple', '🍎'), w('rice', '🍚', 'bowl of rice'), w('meat', '🥩', 'steak'), w('fish', '🐟', 'fresh fish'),
    w('egg', '🥚', 'eggs'), w('cheese', '🧀'), w('soup', '🍲', 'bowl of soup'), w('tea', '🍵', 'cup of tea') ] },
  { number: 3, title: 'Home', words: [
    w('house', '🏠'), w('room', '🛋️', 'living room'), w('door', '🚪', 'wooden door'), w('window', '🪟'),
    w('table', '🍽️', 'dining table'), w('chair', '🪑'), w('bed', '🛏️'), w('kitchen', '🍳'),
    w('key', '🔑', 'keys'), w('garden', '🌷'), w('roof', '🏚️'), w('lamp', '💡') ] },
  { number: 4, title: 'Everyday actions', words: [
    w('to eat', '🍽️', 'eating a meal'), w('to drink', '🥤', 'drinking water'), w('to sleep', '😴', 'sleeping'),
    w('to walk', '🚶', 'walking'), w('to read', '📖', 'reading a book'), w('to write', '✍️', 'writing'),
    w('to laugh', '😂', 'friends laughing'), w('to speak', '🗣️', 'people talking'), w('to listen', '👂', 'listening to music'),
    w('to work', '💼', 'working on laptop'), w('to play', '🎮', 'children playing'), w('to cook', '👩‍🍳', 'cooking') ] },
  { number: 5, title: 'Places and travel', words: [
    w('city', '🏙️', 'city skyline'), w('street', '🛣️'), w('school', '🏫'), w('shop', '🛍️'),
    w('train station', '🚉'), w('train', '🚆'), w('car', '🚗'), w('bus', '🚌'),
    w('airport', '✈️'), w('hotel', '🏨'), w('park', '🌳', 'city park'), w('bridge', '🌉') ] },
  { number: 6, title: 'Time', words: [
    w('day', '🌞', 'sunny day'), w('night', '🌙', 'night sky'), w('morning', '🌅', 'morning sunrise'),
    w('evening', '🌆', 'evening sunset'), w('week', '📅', 'calendar'), w('month', '🗓️', 'calendar page'),
    w('year', '🎆', 'new year'), w('today', '📍', 'calendar today'), w('tomorrow', '⏭️', 'sunrise'),
    w('yesterday', '⏮️', 'old clock'), w('hour', '⏰', 'clock'), w('minute', '⏱️', 'stopwatch') ] },
  { number: 7, title: 'Body and health', words: [
    w('head', '🙂'), w('hand', '✋'), w('eye', '👁️', 'eye close up'), w('heart', '❤️'),
    w('foot', '🦶'), w('mouth', '👄'), w('nose', '👃'), w('ear', '👂'),
    w('doctor', '🧑‍⚕️'), w('medicine', '💊', 'medicine pills'), w('hospital', '🏥'), w('tooth', '🦷', 'teeth smile') ] },
  { number: 8, title: 'Nature and weather', words: [
    w('sun', '☀️'), w('rain', '🌧️'), w('snow', '❄️'), w('wind', '💨'),
    w('tree', '🌲'), w('flower', '🌸'), w('river', '🏞️'), w('sea', '🌊'),
    w('mountain', '⛰️'), w('moon', '🌕'), w('cloud', '☁️', 'clouds'), w('fire', '🔥') ] },
  { number: 9, title: 'Feelings and descriptions', words: [
    w('happy', '😀', 'happy person'), w('sad', '😢', 'sad person'), w('big', '🐘', 'elephant'), w('small', '🐜', 'ant'),
    w('hot', '🥵', 'hot summer'), w('cold', '🥶', 'cold winter'), w('new', '🆕', 'new'), w('old', '👴', 'old house'),
    w('beautiful', '🌺', 'beautiful landscape'), w('fast', '🐆', 'fast car'), w('tired', '🥱', 'tired person'), w('hungry', '🤤', 'hungry') ] },
  { number: 10, title: 'Everyday things', words: [
    w('money', '💰'), w('phone', '📱', 'smartphone'), w('book', '📚'), w('computer', '💻', 'laptop'),
    w('job', '🧑‍💼', 'office work'), w('office', '🏢'), w('pen', '🖊️'), w('bag', '👜'),
    w('clothes', '👕'), w('shoes', '👟'), w('gift', '🎁'), w('music', '🎵') ] },
];

export const WORDS_PER_UNIT = 12;
export const TOTAL_WORDS = WORD_UNITS.reduce((n, u) => n + u.words.length, 0);

export function findWord(id: string): { unit: WordUnit; word: WordItem } | null {
  for (const unit of WORD_UNITS) {
    const word = unit.words.find((x) => x.id === id);
    if (word) return { unit, word };
  }
  return null;
}
