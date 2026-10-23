// Courses and their learning paths.
// A course is a path of units; every unit has three exercises that open the existing modes:
//   Exercise 1 = Word Mode (/word/<word>), Exercise 2 = Sentence Mode (/sentence/<sentence>), Exercise 3 = Dialogue Mode (/dialogue/<dialogue>).
// The ids must exist in the backend catalogs (word.catalog.ts, sentence.catalog.ts, dialogue.catalog.ts).

export type CourseGroup = "level" | "lifestyle" | "professional";
export type Unit = { title: string; word: string; sentence: string; dialogue: string };
export type Course = {
  id: string; title: string; desc: string; group: CourseGroup; emoji: string;
  /** CEFR badge, level courses only */
  badge?: string;
  /** hand-written path; courses without one get a path built from the catalogs (see pathFor) */
  units?: Unit[];
  /** dialogue topics that fit the course theme, used first when the path is built */
  dialogues?: string[];
};

const u = (title: string, word: string, sentence: string, dialogue: string): Unit => ({ title, word, sentence, dialogue });

// "Absolute beginner 1": the path from the design.
const ABSOLUTE_BEGINNER_1: Unit[] = [
  u("Simple interactions", "friend", "basic-greetings", "meeting-new-people"),
  u("Pronouns", "woman", "talking-about-yourself", "formal-introductions"),
  u("Pronouns and common nouns", "child", "introducing-others", "making-friends"),
  u("My family", "family", "talking-about-your-family", "talking-about-family"),
  u("Yes, no and more", "teacher", "being-polite", "simple-likes-and-dislikes"),
  u("Colors", "flower", "describing-physical-appearance", "describing-your-outfit"),
  u("At school", "school", "talking-about-languages", "buying-a-new-book"),
  u("Around the house", "house", "family-activities", "house-chores"),
  u("Body parts", "head", "asking-about-moods-and-feelings", "shopping-for-clothes"),
  u("Day and night", "day", "asking-and-telling-time", "daily-routine"),
];

const lvl = (id: string, title: string, desc: string, badge: string, emoji: string, units?: Unit[]): Course =>
  ({ id, title, desc, badge, emoji, units, group: "level" });
const life = (id: string, title: string, desc: string, emoji: string, dialogues?: string[]): Course =>
  ({ id, title, desc, emoji, dialogues, group: "lifestyle" });
const pro = (id: string, title: string, what: string, emoji: string, dialogues?: string[]): Course =>
  ({ id, title, desc: `Introductory course for ${what} professionals.`, emoji, dialogues, group: "professional" });

export const COURSES: Course[] = [
  lvl("absolute-beginner-1", "Absolute beginner 1", "Start your language learning journey here.", "A1.1", "🌱", ABSOLUTE_BEGINNER_1),
  lvl("absolute-beginner-2", "Absolute beginner 2", "A course to finish learning the basics.", "A1.2", "🌿"),
  lvl("beginner-1", "Beginner 1", "A course to expand your basic language skills.", "A2.1", "🎧"),
  lvl("beginner-2", "Beginner 2", "The last step of your beginner's journey.", "A2.2", "🏡"),
  lvl("intermediate-1", "Intermediate 1", "A course for intermediate students.", "B1.1", "🎨"),
  lvl("intermediate-2", "Intermediate 2", "Develop your intermediate skills further.", "B1.2", "🧭"),
  lvl("upper-intermediate-1", "Upper intermediate 1", "Master intermediate level.", "B2.1", "💻"),
  lvl("upper-intermediate-2", "Upper intermediate 2", "The final step before reaching the advanced level.", "B2.2", "🎪"),
  lvl("advanced-1", "Advanced 1", "A course for advanced students.", "C1.1", "🚀"),
  lvl("advanced-2", "Advanced 2", "Master the highest level of the language.", "C1.2", "🚴"),
  lvl("proficient-1", "Proficient 1", "Solidify your advanced knowledge.", "C2.1", "🌉"),
  lvl("proficient-2", "Proficient 2", "Final steps towards fluency.", "C2.2", "🥽"),

  life("travel", "Travel", "A course to master travel communication.", "✈️", ["at-the-airport", "passport-control", "booking-a-hotel", "asking-for-directions", "traveling-for-business"]),
  life("social-life", "Social life", "A course to master social connection.", "🥂", ["meeting-new-people", "making-friends", "simple-likes-and-dislikes"]),
  life("dating", "Dating", "A course to master dating conversations.", "💘", ["meeting-new-people", "talking-about-favorite-food", "at-a-restaurant", "describing-your-outfit"]),
  life("moving-abroad", "Moving abroad", "A course to master communication for life abroad.", "📦", ["asking-for-directions", "shopping-for-groceries", "booking-a-hotel", "house-chores"]),
  life("shopping", "Shopping", "A course to master shopping communication.", "🛍️", ["shopping-for-clothes", "shopping-for-groceries", "buying-a-new-book", "at-a-pet-shop"]),
  life("fitness", "Fitness", "A course to master everyday fitness communication.", "🏋️", ["daily-routine", "talking-about-favorite-food", "simple-likes-and-dislikes"]),
  life("food-and-dining", "Food and dining", "A course to master dining communication.", "🍽️", ["at-a-restaurant", "at-a-coffee-shop", "ordering-food-delivery", "talking-about-favorite-food", "shopping-for-groceries"]),
  life("work-and-careers", "Work and careers", "A course to master workplace communication.", "💼", ["formal-introductions", "traveling-for-business", "meeting-new-people"]),
  life("family-life", "Family life", "A course to master family life conversations.", "👨‍👩‍👧", ["talking-about-family", "house-chores", "daily-routine"]),
  life("small-talks", "Small talks", "A course to master small talk communication.", "☕", ["meeting-new-people", "making-friends", "at-a-coffee-shop"]),

  pro("business", "Business", "business", "📈", ["formal-introductions", "traveling-for-business"]),
  pro("medicine", "Medicine", "medical", "🩺", ["formal-introductions"]),
  pro("engineering", "Engineering", "engineering", "🏗️", ["formal-introductions", "traveling-for-business"]),
  pro("tech", "Tech", "tech", "🖥️", ["formal-introductions", "meeting-new-people"]),
  pro("hospitality", "Hospitality", "hospitality", "🛎️", ["booking-a-hotel", "at-a-restaurant", "at-a-coffee-shop"]),
  pro("law", "Law", "legal", "⚖️", ["formal-introductions"]),
  pro("retail", "Retail", "retail", "🛒", ["shopping-for-clothes", "shopping-for-groceries", "buying-a-new-book"]),
  pro("customer-support", "Customer support", "customer support", "🎧", ["formal-introductions", "ordering-food-delivery"]),
  pro("logistics", "Logistics", "logistics", "🚢", ["at-the-airport", "passport-control", "asking-for-directions"]),
  pro("sales", "Sales", "sales", "🤝", ["formal-introductions", "shopping-for-clothes"]),
];

export const COURSE_GROUPS: { id: CourseGroup; title: string }[] = [
  { id: "level", title: "Level courses" },
  { id: "lifestyle", title: "Lifestyle courses" },
  { id: "professional", title: "Professional courses" },
];

export const DEFAULT_COURSE = "absolute-beginner-1";
const COURSE_KEY = "talkmate-course";

export const courseById = (id: string): Course => COURSES.find((c) => c.id === id) ?? COURSES[0];

export function loadCourseId(): string {
  try { const id = localStorage.getItem(COURSE_KEY); return id && COURSES.some((c) => c.id === id) ? id : DEFAULT_COURSE; }
  catch { return DEFAULT_COURSE; }
}
export const saveCourseId = (id: string) => { try { localStorage.setItem(COURSE_KEY, id); } catch {} };

// ---- ids that exist in the backend catalogs ----
const WORDS = ["friend", "family", "mother", "father", "brother", "sister", "child", "man", "woman", "baby", "neighbor", "teacher", "water", "bread", "milk", "coffee", "apple", "rice", "meat", "fish", "egg", "cheese", "soup", "tea", "house", "room", "door", "window", "table", "chair", "bed", "kitchen", "key", "garden", "roof", "lamp", "to-eat", "to-drink", "to-sleep", "to-walk", "to-read", "to-write", "to-laugh", "to-speak", "to-listen", "to-work", "to-play", "to-cook", "city", "street", "school", "shop", "train-station", "train", "car", "bus", "airport", "hotel", "park", "bridge", "day", "night", "morning", "evening", "week", "month", "year", "today", "tomorrow", "yesterday", "hour", "minute", "head", "hand", "eye", "heart", "foot", "mouth", "nose", "ear", "doctor", "medicine", "hospital", "tooth", "sun", "rain", "snow", "wind", "tree", "flower", "river", "sea", "mountain", "moon", "cloud", "fire", "happy", "sad", "big", "small", "hot", "cold", "new", "old", "beautiful", "fast", "tired", "hungry", "money", "phone", "book", "computer", "job", "office", "pen", "bag", "clothes", "shoes", "gift", "music"];
const SENTENCES = ["basic-greetings", "talking-about-yourself", "introducing-others", "being-polite", "formal-greetings-and-farewells", "discussing-personal-backgrounds", "asking-for-basic-information", "expressing-likes-and-dislikes", "exchanging-contact-information", "talking-about-languages", "asking-for-language-help", "discussing-language-progress", "navigating-language-barriers", "apologizing-and-making-amends", "finding-lost-items", "describing-physical-appearance", "discussing-personalities", "asking-about-moods-and-feelings", "making-new-friends", "socializing-with-friends", "arranging-to-meet-up", "keeping-a-conversation-going", "active-listening-and-reacting", "talking-about-the-weekend", "talking-about-your-family", "family-activities", "talking-about-pets", "asking-and-telling-time", "scheduling-appointments", "talking-about-upcoming-events"];
const DIALOGUES = ["talking-about-family", "meeting-new-people", "making-friends", "formal-introductions", "simple-likes-and-dislikes", "daily-routine", "house-chores", "at-a-restaurant", "at-a-coffee-shop", "ordering-food-delivery", "talking-about-favorite-food", "shopping-for-groceries", "shopping-for-clothes", "describing-your-outfit", "buying-a-new-book", "at-a-pet-shop", "booking-a-hotel", "at-the-airport", "passport-control", "asking-for-directions", "traveling-for-business"];

export const titleize = (id: string) => { const t = id.replace(/-/g, " "); return t.charAt(0).toUpperCase() + t.slice(1); };

const UNITS_PER_COURSE = 10;

/** The units of a course. Courses without a hand-written path get one built from the existing Word, Sentence and Dialogue content. */
export function pathFor(course: Course): Unit[] {
  if (course.units) return course.units;
  const k = Math.max(0, COURSES.findIndex((c) => c.id === course.id));
  const hinted = course.dialogues ?? [];
  const dialogues = hinted.length ? [...hinted, ...DIALOGUES.filter((d) => !hinted.includes(d))] : [...DIALOGUES.slice((k * 7) % DIALOGUES.length), ...DIALOGUES.slice(0, (k * 7) % DIALOGUES.length)];
  return Array.from({ length: UNITS_PER_COURSE }, (_, i) => {
    const sentence = SENTENCES[(k * UNITS_PER_COURSE + i) % SENTENCES.length];
    const dialogue = dialogues[i % dialogues.length];
    return { title: titleize(hinted.length ? dialogue : sentence), word: WORDS[(k * 12 + i * 11) % WORDS.length], sentence, dialogue };
  });
}
