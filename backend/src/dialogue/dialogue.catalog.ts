// The Dialogue Mode topics shown on the Dialogue home. Each topic is one short scripted conversation.
// The AI writes the lines in the language being learned, so one list serves every language.
// Topic ids are URL slugs (/dialogue/at-a-restaurant): never rename one that is already linked or bookmarked.

export type DialogueTopic = {
  id: string;
  title: string;
  emoji: string;
  /** search text for the cover photo (a scene, not people, to match the illustrated look of the grid) */
  photo: string;
  /** who the learner talks to (shown under the avatar) */
  partner: string;
  partnerEmoji: string;
  /** prompt context: where the conversation happens */
  setting: string;
};

export const DIALOGUE_TOPICS: DialogueTopic[] = [
  { id: 'talking-about-family', title: 'Talking about family', emoji: '👨‍👩‍👧', photo: 'family photos on table', partner: 'Friend', partnerEmoji: '🧑', setting: 'two friends talking about their families: parents, siblings, children, where relatives live' },
  { id: 'meeting-new-people', title: 'Meeting new people', emoji: '🥂', photo: 'party snacks drinks table', partner: 'New acquaintance', partnerEmoji: '🧑‍🦱', setting: 'meeting someone new at a party: names, where you are from, what you do' },
  { id: 'making-friends', title: 'Making friends', emoji: '🎒', photo: 'school lockers backpack', partner: 'Classmate', partnerEmoji: '🧒', setting: 'a new student talking to a classmate in a school corridor and suggesting to hang out' },
  { id: 'formal-introductions', title: 'Formal introductions', emoji: '🤝', photo: 'business handshake office', partner: 'Business contact', partnerEmoji: '👩‍💼', setting: 'a polite, formal first meeting at work: introducing yourself, your job and company' },
  { id: 'simple-likes-and-dislikes', title: 'Simple likes and dislikes', emoji: '🎾', photo: 'tennis racket sports bag', partner: 'Friend', partnerEmoji: '🧑', setting: 'friends comparing what they like and dislike: sports, hobbies, music, free time' },
  { id: 'daily-routine', title: 'Daily routine', emoji: '☕', photo: 'coffee cup desk planner', partner: 'Roommate', partnerEmoji: '🧑‍🦰', setting: 'roommates talking about their usual day: waking up, work or school, meals, evening' },
  { id: 'house-chores', title: 'House chores', emoji: '🧽', photo: 'dishes sponge kitchen', partner: 'Housemate', partnerEmoji: '🧑‍🦰', setting: 'housemates sharing house chores: dishes, cleaning, laundry, taking out the trash' },
  { id: 'at-a-restaurant', title: 'At a restaurant', emoji: '🍽️', photo: 'restaurant table dinner', partner: 'Waiter', partnerEmoji: '🧑‍🍳', setting: 'ordering a meal at a restaurant: table, menu, drinks, main course, the bill' },
  { id: 'at-a-coffee-shop', title: 'At a coffee shop', emoji: '☕', photo: 'cappuccino coffee shop counter', partner: 'Barista', partnerEmoji: '🧑‍🍳', setting: 'ordering a drink and a snack at a coffee shop: size, milk, for here or to go, paying' },
  { id: 'ordering-food-delivery', title: 'Ordering food delivery', emoji: '🍕', photo: 'pizza delivery box', partner: 'Restaurant staff', partnerEmoji: '🧑‍🍳', setting: 'ordering food for delivery by phone: the dish, the address, how long it takes, payment' },
  { id: 'talking-about-favorite-food', title: 'Talking about favorite food', emoji: '🍣', photo: 'table full of different dishes', partner: 'Friend', partnerEmoji: '🧑', setting: 'friends talking about their favourite dishes, what they cook and what they cannot eat' },
  { id: 'shopping-for-groceries', title: 'Shopping for groceries', emoji: '🛒', photo: 'grocery cart supermarket', partner: 'Shop assistant', partnerEmoji: '🧑‍💼', setting: 'asking a supermarket worker where things are and how much they cost: fruit, bread, milk' },
  { id: 'shopping-for-clothes', title: 'Shopping for clothes', emoji: '👕', photo: 'clothes rack store', partner: 'Shop assistant', partnerEmoji: '🧑‍💼', setting: 'buying clothes in a shop: size, colour, trying on, price, paying' },
  { id: 'describing-your-outfit', title: 'Describing your outfit', emoji: '👗', photo: 'wardrobe clothes closet', partner: 'Friend', partnerEmoji: '🧑', setting: 'friends describing what they are wearing and choosing an outfit for an event' },
  { id: 'buying-a-new-book', title: 'Buying a new book', emoji: '📚', photo: 'bookshelf library books', partner: 'Bookseller', partnerEmoji: '🧑‍💼', setting: 'asking a bookseller for a book: genre, author, recommendations, price' },
  { id: 'at-a-pet-shop', title: 'At a pet shop', emoji: '🐠', photo: 'pet shop supplies shelves', partner: 'Shop assistant', partnerEmoji: '🧑‍💼', setting: 'buying a pet or pet supplies: food, toys, how to look after it' },
  { id: 'booking-a-hotel', title: 'Booking a hotel', emoji: '🏨', photo: 'hotel reception desk bell', partner: 'Receptionist', partnerEmoji: '🧑‍💼', setting: 'booking a hotel room: dates, number of guests, room type, price, breakfast' },
  { id: 'at-the-airport', title: 'At the airport', emoji: '🧳', photo: 'airport suitcase terminal', partner: 'Check-in agent', partnerEmoji: '🧑‍✈️', setting: 'checking in at the airport: ticket, luggage, seat, gate and boarding time' },
  { id: 'passport-control', title: 'Passport control', emoji: '🛂', photo: 'passport desk stamp', partner: 'Officer', partnerEmoji: '👮', setting: 'answering a border officer: reason for the visit, how long you will stay, where you will stay' },
  { id: 'asking-for-directions', title: 'Asking for directions', emoji: '🧭', photo: 'street signpost city', partner: 'Local', partnerEmoji: '🧑‍🦳', setting: 'asking a stranger how to get to a place: left, right, straight on, near, how far' },
  { id: 'traveling-for-business', title: 'Traveling for business', emoji: '💼', photo: 'briefcase laptop passport desk', partner: 'Colleague', partnerEmoji: '👨‍💼', setting: 'a colleague asking about your business trip: preparing documents, packing, flights, meetings' },
];

export const findDialogue = (id: string): DialogueTopic | undefined => DIALOGUE_TOPICS.find((t) => t.id === id);

/** Every dialogue has this many turns (the partner speaks, then the learner answers). */
export const TURNS_PER_DIALOGUE = 5;
