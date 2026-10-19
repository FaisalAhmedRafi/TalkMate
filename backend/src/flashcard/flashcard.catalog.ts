// The Flashcards topics shown on the Flashcards home. Each topic is one deck of CARDS_PER_DECK words.
// The AI writes the words in the language being learned, so one list serves every language.
// Topic ids are URL slugs (/flashcards/people) and the keys stored in FlashcardDeck: never rename one
// that users already have a deck for.

export type FlashTopic = { id: string; title: string; emoji: string; photo: string; hint: string };

/** Every deck has this many cards. */
export const CARDS_PER_DECK = 15;

export const FLASH_TOPICS: FlashTopic[] = [
  { id: 'people', title: 'People', emoji: '🧑‍🤝‍🧑', photo: 'group of friends smiling', hint: 'kinds of people: boy, girl, man, woman, friend, teacher, neighbor' },
  { id: 'colors', title: 'Colors', emoji: '🎨', photo: 'paint palette colors', hint: 'colors and shades: red, blue, green, yellow, black, white, pink' },
  { id: 'family', title: 'Family', emoji: '👨‍👩‍👧', photo: 'happy family together', hint: 'family members: mother, father, sister, brother, grandparents, cousin' },
  { id: 'basic-actions', title: 'Basic actions', emoji: '🏃', photo: 'man running park', hint: 'common action verbs in the infinitive: to run, to eat, to sleep, to read' },
  { id: 'day-and-night', title: 'Day and night', emoji: '🌗', photo: 'sun and moon sky', hint: 'times of day and sky: morning, noon, evening, night, sun, moon, stars' },
  { id: 'drinks', title: 'Drinks', emoji: '🥤', photo: 'glass of iced drink', hint: 'drinks: water, juice, tea, coffee, milk, wine, beer, soda' },
  { id: 'food', title: 'Food', emoji: '🍽️', photo: 'healthy food table', hint: 'everyday food: bread, rice, cheese, egg, soup, fruit, vegetables, meat' },
  { id: 'animals', title: 'Animals', emoji: '🐶', photo: 'cute animals', hint: 'common animals: dog, cat, bird, horse, cow, fish, rabbit' },
  { id: 'numbers', title: 'Numbers', emoji: '🔢', photo: 'colorful number blocks', hint: 'numbers one to fifteen' },
  { id: 'clothes', title: 'Clothes', emoji: '👕', photo: 'clothes on rack', hint: 'clothing: shirt, trousers, dress, shoes, jacket, hat, socks' },
  { id: 'body', title: 'Body', emoji: '🧍', photo: 'human body yoga', hint: 'parts of the body: head, hand, eye, foot, arm, leg, mouth' },
  { id: 'weather', title: 'Weather', emoji: '⛅', photo: 'dramatic weather sky', hint: 'weather: sun, rain, snow, wind, cloud, storm, hot, cold' },
  { id: 'places', title: 'Places', emoji: '🏙️', photo: 'city street', hint: 'places in town: school, shop, park, hospital, restaurant, library' },
  { id: 'transport', title: 'Transport', emoji: '🚆', photo: 'train station platform', hint: 'transport: car, bus, train, plane, bicycle, ship, ticket' },
  { id: 'home', title: 'Home', emoji: '🏠', photo: 'cozy living room', hint: 'things at home: house, room, door, window, table, chair, bed, kitchen' },
  { id: 'feelings', title: 'Feelings', emoji: '😊', photo: 'person smiling happy', hint: 'feelings and states: happy, sad, tired, angry, hungry, afraid' },
  { id: 'jobs', title: 'Jobs', emoji: '🧑‍⚕️', photo: 'professionals at work', hint: 'jobs: doctor, teacher, driver, cook, engineer, farmer, police officer' },
  { id: 'school', title: 'School', emoji: '🎒', photo: 'classroom school desk', hint: 'school: book, pen, desk, lesson, student, homework, exam' },
];

export const findTopic = (id: string): FlashTopic | undefined => FLASH_TOPICS.find((t) => t.id === id);
