// The Roleplay Mode scenarios shown on the Roleplays home. Each one is a real-life situation in which the AI plays
// the other person and the learner works through three small tasks.
// The AI speaks the language being learned, so one list serves every language; the scenario and task text is the
// English text on the intro page (and prompt context).
// Scenario ids are URL slugs (/roleplay/saying-hello): never rename one that is already linked or has saved chats.

export const ROLEPLAY_CATEGORIES = ['Social', 'Transport', 'Travel', 'Food', 'Shopping'] as const;
export type RoleplayCategory = (typeof ROLEPLAY_CATEGORIES)[number];

export type RoleplayScenario = {
  id: string;
  title: string;
  /** the pill on the picture in the grid */
  category: RoleplayCategory;
  emoji: string;
  /** search text for the cover photo (also the partner's avatar in the chat) */
  photo: string;
  /** who the learner talks to: shown as the chat name and used in the prompts ("Coworker", "Barista") */
  partner: string;
  partnerEmoji: string;
  /** the situation, written to the learner ("You run into ...") */
  scenario: string;
  /** exactly three things the learner should manage to do during the chat */
  tasks: [string, string, string];
};

export const ROLEPLAY_SCENARIOS: RoleplayScenario[] = [
  // ---- Social ----
  {
    id: 'saying-hello', title: 'Saying hello', category: 'Social', emoji: '👋', photo: 'office breakroom coffee machine',
    partner: 'Coworker', partnerEmoji: '🧑‍💼',
    scenario: 'You run into a colleague in the office breakroom and want to have a quick chat.',
    tasks: ['Greet your colleague.', 'Ask your colleague how their day is going.', 'Suggest grabbing coffee together soon.'],
  },
  {
    id: 'meeting-new-people', title: 'Meeting new people', category: 'Social', emoji: '🤝', photo: 'suburban house front yard',
    partner: 'Neighbor', partnerEmoji: '🧑‍🦱',
    scenario: 'You have just moved in and meet your new neighbor outside your house.',
    tasks: ['Introduce yourself.', 'Say where you are from.', 'Ask your neighbor how long they have lived here.'],
  },
  {
    id: 'making-plans', title: 'Making plans', category: 'Social', emoji: '📅', photo: 'calendar planner desk',
    partner: 'Friend', partnerEmoji: '🧑',
    scenario: 'You and a friend want to meet up this weekend, but you still have to agree on a day, a time and an activity.',
    tasks: ['Suggest meeting this weekend.', 'Agree on a day and a time.', 'Decide what to do together.'],
  },
  {
    id: 'talking-about-family', title: 'Talking about family', category: 'Social', emoji: '👨‍👩‍👧', photo: 'family portrait living room',
    partner: 'Friend', partnerEmoji: '🧑',
    scenario: 'A friend asks about your family and you want to tell them about the people closest to you.',
    tasks: ['Say how many people are in your family.', 'Describe one family member.', 'Ask your friend about their family.'],
  },
  {
    id: 'asking-for-help', title: 'Asking for help', category: 'Social', emoji: '🙋', photo: 'carrying cardboard boxes street',
    partner: 'Passer-by', partnerEmoji: '🧑‍🦰',
    scenario: 'Your arms are full of heavy boxes and you ask a passer-by on the street for help.',
    tasks: ['Get the person\'s attention politely.', 'Explain what you need help with.', 'Thank the person.'],
  },
  {
    id: 'dividing-house-chores', title: 'Dividing house chores', category: 'Social', emoji: '🧽', photo: 'chore chart fridge kitchen',
    partner: 'Housemate', partnerEmoji: '🧑‍🦰',
    scenario: 'You and your housemate are deciding who does which chores this week.',
    tasks: ['Name two chores that need to be done.', 'Say which chores you prefer.', 'Agree on a fair split.'],
  },

  // ---- Transport ----
  {
    id: 'ordering-a-taxi', title: 'Ordering a taxi', category: 'Transport', emoji: '🚕', photo: 'yellow taxi city street',
    partner: 'Dispatcher', partnerEmoji: '🧑‍💼',
    scenario: 'You call a taxi company to order a ride.',
    tasks: ['Say where you are.', 'Say where you want to go.', 'Ask how long the taxi will take and how much it costs.'],
  },
  {
    id: 'buying-transit-tickets', title: 'Buying transit tickets', category: 'Transport', emoji: '🎫', photo: 'train station ticket machine',
    partner: 'Ticket agent', partnerEmoji: '🧑‍💼',
    scenario: 'You are at the ticket counter of a station and need to buy tickets for a trip.',
    tasks: ['Say where you want to go.', 'Ask about the price and the departure time.', 'Buy the tickets and pay.'],
  },
  {
    id: 'asking-for-directions', title: 'Asking for directions', category: 'Transport', emoji: '🧭', photo: 'tourist map city street',
    partner: 'Local', partnerEmoji: '🧑‍🦱',
    scenario: 'You are lost in a new city and ask a local how to get to the train station.',
    tasks: ['Politely ask for directions.', 'Check that you understood the route.', 'Thank the person.'],
  },
  {
    id: 'renting-a-car', title: 'Renting a car', category: 'Transport', emoji: '🚗', photo: 'car rental keys handover',
    partner: 'Rental agent', partnerEmoji: '🧑‍💼',
    scenario: 'You are at a car rental desk and want to rent a car for a few days.',
    tasks: ['Say what kind of car you need and for how long.', 'Ask about the price and the insurance.', 'Confirm the booking and the pick-up time.'],
  },

  // ---- Travel ----
  {
    id: 'booking-a-hotel', title: 'Booking a hotel', category: 'Travel', emoji: '🏨', photo: 'hotel reception bell flowers',
    partner: 'Receptionist', partnerEmoji: '🧑‍💼',
    scenario: 'You call a hotel to book a room for your trip.',
    tasks: ['Say your dates and how many people are coming.', 'Ask about the room and the price.', 'Confirm the booking.'],
  },
  {
    id: 'airport-check-in', title: 'Airport check-in', category: 'Travel', emoji: '🛫', photo: 'airport check-in suitcase',
    partner: 'Check-in agent', partnerEmoji: '🧑‍✈️',
    scenario: 'You are at the airport check-in desk with your luggage.',
    tasks: ['Give your name and your destination.', 'Check in your suitcase.', 'Ask which gate you need and when boarding starts.'],
  },
  {
    id: 'customs-control', title: 'Customs control', category: 'Travel', emoji: '🛂', photo: 'airport passport control',
    partner: 'Customs officer', partnerEmoji: '👮',
    scenario: 'You have just landed in a new country and a customs officer wants to ask you a few questions.',
    tasks: ['Say why you are visiting.', 'Tell the officer how long you will stay.', 'Say where you will be staying.'],
  },
  {
    id: 'lost-luggage-claim', title: 'Lost luggage claim', category: 'Travel', emoji: '🧳', photo: 'baggage claim suitcase',
    partner: 'Airline agent', partnerEmoji: '🧑‍💼',
    scenario: 'Your suitcase did not arrive, so you report it at the baggage service desk.',
    tasks: ['Explain that your suitcase is missing.', 'Describe your suitcase.', 'Give your contact details and ask when it will arrive.'],
  },
  {
    id: 'vacation-rental-issue', title: 'Vacation rental issue', category: 'Travel', emoji: '🏡', photo: 'vacation rental smartphone messages',
    partner: 'Host', partnerEmoji: '🧑‍🦱',
    scenario: 'Something is wrong in your vacation rental, so you message the host.',
    tasks: ['Say that there is a problem.', 'Describe the problem.', 'Ask the host to fix it.'],
  },
  {
    id: 'booking-a-tour', title: 'Booking a tour', category: 'Travel', emoji: '🗺️', photo: 'laptop travel photos passport',
    partner: 'Tour agent', partnerEmoji: '🧑‍💼',
    scenario: 'You want to book a guided tour for your trip and talk to a tour agent.',
    tasks: ['Ask which tours are available.', 'Choose a tour, a day and a time.', 'Ask about the price and where to meet.'],
  },
  {
    id: 'hosting-a-visitor', title: 'Hosting a visitor', category: 'Travel', emoji: '🎒', photo: 'airport arrivals welcome sign',
    partner: 'Visitor', partnerEmoji: '🧑‍🦰',
    scenario: 'You pick up a visitor from abroad at the airport and want them to feel welcome.',
    tasks: ['Welcome the visitor.', 'Ask about their flight.', 'Say what you plan to do together.'],
  },

  // ---- Food ----
  {
    id: 'ordering-coffee', title: 'Ordering coffee', category: 'Food', emoji: '☕', photo: 'latte art coffee shop table',
    partner: 'Barista', partnerEmoji: '🧑‍🍳',
    scenario: 'You are at a coffee shop and want to order a drink.',
    tasks: ['Order a drink.', 'Choose the size and say whether you want milk.', 'Say if it is for here or to go, then pay.'],
  },
  {
    id: 'at-the-restaurant', title: 'At the Restaurant', category: 'Food', emoji: '🍽️', photo: 'restaurant table candles dinner',
    partner: 'Waiter', partnerEmoji: '🧑‍🍳',
    scenario: 'You are having dinner at a restaurant and the waiter comes to your table.',
    tasks: ['Order a drink.', 'Order a main course.', 'Ask for the bill.'],
  },
  {
    id: 'meal-quality-issue', title: 'Meal quality issue', category: 'Food', emoji: '😕', photo: 'restaurant plate steak glass wine',
    partner: 'Waiter', partnerEmoji: '🧑‍🍳',
    scenario: 'Your meal arrives cold and you want to tell the waiter politely.',
    tasks: ['Get the waiter\'s attention.', 'Explain what is wrong with your meal.', 'Ask for a solution.'],
  },
  {
    id: 'ordering-a-cake', title: 'Ordering a cake', category: 'Food', emoji: '🎂', photo: 'bakery birthday cake display',
    partner: 'Baker', partnerEmoji: '🧑‍🍳',
    scenario: 'You visit a bakery to order a birthday cake.',
    tasks: ['Say what kind of cake you want.', 'Say how many people it is for and when you need it.', 'Ask for the price and say when you will pick it up.'],
  },

  // ---- Shopping ----
  {
    id: 'grocery-shopping', title: 'Grocery shopping', category: 'Shopping', emoji: '🛒', photo: 'grocery cart supermarket',
    partner: 'Shop assistant', partnerEmoji: '🧑‍💼',
    scenario: 'You are in a supermarket and cannot find some of the things on your list.',
    tasks: ['Ask where to find an item.', 'Ask how much something costs.', 'Ask for a bag at the checkout.'],
  },
  {
    id: 'buying-clothes', title: 'Buying clothes', category: 'Shopping', emoji: '👕', photo: 'clothing store rack shirts',
    partner: 'Shop assistant', partnerEmoji: '🧑‍💼',
    scenario: 'You are in a clothing store looking for something to wear.',
    tasks: ['Say what you are looking for.', 'Ask for a different size or color.', 'Ask for the price and buy it.'],
  },
  {
    id: 'choosing-a-gift', title: 'Choosing a gift', category: 'Shopping', emoji: '🎁', photo: 'gift shop teddy bear presents',
    partner: 'Shop assistant', partnerEmoji: '🧑‍💼',
    scenario: 'You are in a gift shop looking for a present for a friend\'s birthday.',
    tasks: ['Say who the gift is for.', 'Say what your friend likes and what your budget is.', 'Choose a gift and ask for it to be wrapped.'],
  },
];

export const findRoleplay = (id: string): RoleplayScenario | undefined => ROLEPLAY_SCENARIOS.find((s) => s.id === id);
