// The Debate Mode topics shown on the Debates home. Each one is a statement the learner argues for or against.
// The AI writes everything in the language being learned, so one list serves every language; the statement is
// only prompt context and the English text on the intro page.
// Topic ids are URL slugs (/debate/fast-food): never rename one that is already linked or bookmarked.

export type DebateTopic = {
  id: string;
  title: string;
  /** the claim, shown on the intro page ("Argue for" agrees with it, "Argue against" disagrees) */
  statement: string;
  emoji: string;
  /** search text for the cover photo (a scene, not people, to match the illustrated look of the grid) */
  photo: string;
};

export const DEBATE_TOPICS: DebateTopic[] = [
  { id: 'streaming-services', title: 'Streaming services', statement: 'Streaming services have made entertainment better than traditional television.', emoji: '📺', photo: 'living room television streaming' },
  { id: 'impact-of-social-media', title: 'Impact of social media', statement: 'Social media does more harm than good.', emoji: '📱', photo: 'smartphone social media dinner table' },
  { id: 'ai-in-education', title: 'AI in education', statement: 'Students should be allowed to use AI tools for their schoolwork.', emoji: '🤖', photo: 'student laptop books desk' },
  { id: 'money-and-happiness', title: 'Money and happiness', statement: 'Money can buy happiness.', emoji: '💰', photo: 'gold coins scale' },
  { id: 'fast-food', title: 'Fast food', statement: 'Fast food does more harm than good to society.', emoji: '🍔', photo: 'burger fries fast food' },
  { id: 'working-from-home', title: 'Working from home', statement: 'Working from home is better than working in an office.', emoji: '🏠', photo: 'laptop home office coffee' },
  { id: 'video-game-violence', title: 'Video game violence', statement: 'Violent video games make people more aggressive.', emoji: '🎮', photo: 'game controller gaming room' },
  { id: 'online-friendships', title: 'Online friendships', statement: 'Online friendships can be as meaningful as face-to-face friendships.', emoji: '🎧', photo: 'headset video call friends' },
  { id: 'influencer-culture', title: 'Influencer culture', statement: 'Influencer culture has a negative effect on young people.', emoji: '🤳', photo: 'camera tripod ring light' },
  { id: 'necessity-of-education', title: 'Necessity of education', statement: 'A formal education is necessary to be successful in life.', emoji: '🎓', photo: 'graduation certificates wall' },
  { id: 'cancel-culture', title: 'Cancel culture', statement: 'Cancel culture is an effective way to hold people accountable.', emoji: '🚫', photo: 'red cross sign wall' },
  { id: 'screen-time-for-children', title: 'Screen time for children', statement: 'Young children should have strict limits on screen time.', emoji: '🧒', photo: 'child tablet living room floor' },
  { id: 'hard-work-vs-luck', title: 'Hard work vs. luck', statement: 'Hard work matters more than luck when it comes to success.', emoji: '🍀', photo: 'fork in the road mountain path' },
  { id: 'childrens-privacy', title: "Children's privacy", statement: "Parents should be allowed to read their children's private messages.", emoji: '🔒', photo: 'teenager smartphone sofa' },
  { id: 'money-vs-passion', title: 'Money vs. passion', statement: 'It is better to choose a well-paid job than a job you are passionate about.', emoji: '🎨', photo: 'painting easel autumn tree' },
  { id: 'city-vs-countryside-living', title: 'City vs. countryside living', statement: 'Living in the city is better than living in the countryside.', emoji: '🌆', photo: 'city skyline countryside house' },
  { id: 'banning-homework', title: 'Banning homework', statement: 'Homework should be banned in schools.', emoji: '🎒', photo: 'schoolboy running backpack' },
  { id: 'eating-meat', title: 'Eating meat', statement: 'Eating meat is wrong and people should stop doing it.', emoji: '🥩', photo: 'steak salad plate' },
  { id: 'school-uniforms-enforcement', title: 'School uniforms enforcement', statement: 'Schools should make all students wear a uniform.', emoji: '👔', photo: 'school uniform students' },
  { id: 'four-day-workweek', title: 'Four-day workweek', statement: 'A four-day workweek should become the standard.', emoji: '📅', photo: 'office team desks bright' },
  { id: 'living-with-parents', title: 'Living with parents', statement: "Young adults should move out of their parents' home as soon as they can.", emoji: '📦', photo: 'moving box front door' },
  { id: 'comedy-and-limits', title: 'Comedy and limits', statement: 'Comedians should be free to joke about any subject.', emoji: '🎤', photo: 'stand up comedy stage spotlight' },
  { id: 'wedding-celebrations', title: 'Wedding celebrations', statement: 'Weddings should be small and simple, not big and expensive.', emoji: '💒', photo: 'wedding ceremony guests' },
  { id: 'fast-fashion', title: 'Fast fashion', statement: 'Fast fashion should be banned.', emoji: '👗', photo: 'clothes pile coats rack' },
];

export const findDebate = (id: string): DebateTopic | undefined => DEBATE_TOPICS.find((t) => t.id === id);

export const DEBATE_SIDES = ['for', 'against'] as const;
export type DebateSide = (typeof DEBATE_SIDES)[number];

/** The AI debates the learner, so it always takes the other side. */
export const opposite = (side: DebateSide): DebateSide => (side === 'for' ? 'against' : 'for');

/** The AI teacher the learner debates with (name and avatar are shown in the chat header). */
export const TEACHER = { name: 'Kai', emoji: '🧑‍🏫' };
