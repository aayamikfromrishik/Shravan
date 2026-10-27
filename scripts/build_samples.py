"""Writes the sample lessons (chapter 1, three modes, English, Normal) to data/samples/*.json.

Every "source_snippet" and quotation is copied from the real chapter text; the app checks
them again word for word when the samples are imported, and drops anything that does not match.
Run: python3 scripts/build_samples.py
"""
import json, os

OUT = os.path.join(os.path.dirname(__file__), '..', 'data', 'samples')
os.makedirs(OUT, exist_ok=True)


def lesson(title, main, lessons, takeaway, check, reflections, examples=None, sections=None, quotes=None, note=None):
    return {
        'title': title,
        'main_idea': main,
        'sections': sections or [],
        'key_lessons': [{'text': t, 'source_snippet': s} for t, s in lessons],
        'examples': [{'text': t, 'origin': o, 'source_snippet': s} for t, o, s in (examples or [])],
        'takeaway': takeaway,
        'quotes': [{'text': q, 'translation': None} for q in (quotes or [])],
        'quick_check': check,
        'reflection_questions': reflections,
        'coverage_note': note,
    }


def sec(heading, explanation, examples=()):
    return {'heading': heading, 'explanation': explanation, 'examples': [{'text': t, 'origin': o, 'source_snippet': s} for t, o, s in examples]}


def write(slug, part, key, ex, comp, fingerprint=None):
    data = {'slug': slug, 'fingerprint': fingerprint, 'chapterIdx': 1, 'part': part, 'level': 'normal', 'lang': 'english',
            'versions': {'key': key, 'examples': ex, 'complete': comp}}
    with open(os.path.join(OUT, f'{slug}.json'), 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=1)


# ---------------------------------------------------------------- Habits & Time
title = 'The Daily Miracle'
main = ('Time is the one resource everyone receives in exactly the same amount: twenty-four hours a day. '
        'It cannot be bought, stolen or borrowed from tomorrow, so the quality of your life depends on how you spend the hours you already have.')
lessons = [
    ('Everyone gets the same twenty-four hours. Wealth and talent do not earn anyone an extra hour.', 'no one receives either more or less than you receive'),
    ('Time is worth more than money. You can usually earn more money, but you cannot buy one more minute.', 'you cannot buy yourself a minute more time than I have, or the cat by the fire has'),
    ('You cannot borrow from the future. The only time you can waste is the moment you are in.', 'You can only waste the passing moment. You cannot waste to-morrow; it is kept for you.'),
    ('Health, money, happiness and self-respect all have to be built out of these daily hours.', 'Out of it you have to spin health, pleasure, money, content, respect, and the evolution of your immortal soul'),
    ('Waiting for "more time" is a trap. You already have all the time there is.', 'We never shall have any more time. We have, and we have always had, all the time there is.'),
]
take = 'Stop waiting for spare time; it will never arrive. Decide how to spend the twenty-four hours you already have, starting tomorrow morning.'
check = {
    'question': 'Why does Bennett say time is more precious than money?',
    'options': ['Money can usually be earned again, but nobody can buy extra time', 'Time can be saved up and used later', 'Busy people are given more useful hours'],
    'answer_index': 0,
    'simpler_explanation': 'Money can be earned again. Time cannot. Every person gets the same 24 hours each day, and nobody can buy even one extra minute.',
}
refl = [
    'Where in your day do hours slip away without you really choosing how to spend them?',
    'What have you been postponing "until I have a little more time"?',
    'If tomorrow\'s twenty-four hours were a fixed salary, what would you spend your first free hour on?',
]
ex = [
    ('Bennett opens with a man who earns well but "fritters" his income: a new suit with an old hat, a fine necktie with baggy trousers. We often manage our time the same way.', 'book', 'New suit--old hat! Magnificent necktie--baggy trousers!'),
    ('Newspapers, he notes, print advice on living on a small sum of money, but never on living on twenty-four hours a day.', 'book', 'But I have never seen an essay, "How to live on twenty-four hours a day."'),
    ('Think of someone who says, "I\'ll start exercising when work calms down." Work rarely calms down, so the plan waits forever.', 'teacher', None),
]
quotes = ['We never shall have any more time. We have, and we have always had, all the time there is.']
write('bennett-24-hours', 'full',
      lesson(title, main, lessons[:4] + lessons[4:], take, check, refl),
      lesson(title, main, lessons, take, check, refl, examples=ex, quotes=quotes),
      lesson(title, main, lessons, take, check, refl, quotes=quotes, sections=[
          sec('The man who wastes a good income', 'Bennett starts with a familiar complaint about a man who earns enough but never seems to get anything out of his money. His home, clothes and dinners are half good and half shabby. We laugh at him, Bennett hints, while managing our time in exactly the same careless way.',
              [('The picture of the "new suit--old hat" shows spending without a plan.', 'book', 'New suit--old hat! Magnificent necktie--baggy trousers!')]),
          sec('Time is more than money', 'People write endlessly about living on a fixed income of money, but no one writes about living on a fixed income of time. Bennett says the proverb "time is money" actually understates the case: with time you can usually get money, but no amount of money buys more time.',
              [('Even a wealthy person cannot buy a minute more than anyone else, or than "the cat by the fire".', 'book', 'you cannot buy yourself a minute more time than I have, or the cat by the fire has')]),
          sec('A daily miracle, shared equally', 'Every morning your "purse" is refilled with twenty-four hours. No one can steal them, and nobody gets more or less than you. Bennett calls this a perfect democracy: genius earns no extra hour, and wasting time is never punished by having it cut off.',
              [('He puts it plainly: there is no upper class when it comes to time.', 'book', 'In the realm of time there is no aristocracy of wealth, and no aristocracy of intellect.')]),
          sec('You cannot borrow from tomorrow', 'Unlike money, time cannot be borrowed in advance and you cannot fall into debt. Tomorrow is kept safe for you; the only time you can ever waste is the present moment. That makes today the only place where change can happen.',
              [('A student who plans to "make up for it next week" is borrowing time that does not yet exist; only this week can actually be used.', 'teacher', None)]),
          sec('Everything is built from these hours', 'Health, pleasure, money, contentment and self-respect must all be spun out of the same daily twenty-four hours. If money runs short you can earn more, but if your hours do not cover what matters, your life becomes muddled. That is why using time well is urgent, not optional.'),
          sec('Stop waiting for more time', 'Most of us keep saying, "I shall alter that when I have a little more time." Bennett\'s answer is blunt: we will never have more time than we have now. Accepting this simple truth is what led him to look closely at how he spent each day.'),
      ]))

# ---------------------------------------------------------------- Mind & Calm
title = 'Thought and Character'
main = ('Your character is the sum of your thoughts. Every action grows from thoughts the way a plant grows from a seed, '
        'so by watching and changing what you think, you shape who you become and, over time, your circumstances.')
lessons = [
    ('You are, quite literally, what you think: your character is the total of your thoughts.', 'his character being the complete sum of all his thoughts'),
    ('Every action grows from a hidden seed of thought, even the ones that seem spontaneous.', 'every act of a man springs from the hidden seeds of thought'),
    ('Good character is not luck. It is the result of steady effort in right thinking.', 'is not a thing of favour or chance, but is the natural result of continued effort in right thinking'),
    ('You are the master of your thoughts, so you hold the key to every situation.', 'man holds the key to every situation'),
    ('Self-knowledge comes from patient practice: watch your thoughts, notice their effects, and change them.', 'if he will watch, control, and alter his thoughts'),
]
take = 'Watch your thoughts the way a gardener watches seeds. What you think about every day is slowly becoming who you are.'
check = {
    'question': 'According to James Allen, where does a person\'s character come from?',
    'options': ['From the total of their thoughts', 'Mostly from luck and family', 'Only from the actions others see'],
    'answer_index': 0,
    'simpler_explanation': 'Allen says thoughts are like seeds. Actions grow from them, and over time those thoughts and actions become your character. So character is built from what you think, not given by chance.',
}
refl = [
    'Which thought have you repeated so often this month that it now feels like part of you?',
    'Think of one recent action you did "without thinking". What thought might have been behind it?',
    'Which one thought would you most like to replace, and with what?',
]
ex = [
    ('Allen compares thought and action to a seed and a plant: the act is the blossom of thought, and joy or suffering are its fruit.', 'book', 'Act is the blossom of thought, and joy and suffering are its fruits'),
    ('He says truths about ourselves are found like gold and diamonds: only by digging deep.', 'book', 'Only by much searching and mining, are gold and diamonds obtained'),
    ('Someone who tells themselves "I always mess up interviews" walks in tense and often does worse. The thought came first, then the result.', 'teacher', None),
]
quotes = ['A man is literally what he thinks, his character being the complete sum of all his thoughts.']
write('allen-as-a-man-thinketh', 'full',
      lesson(title, main, lessons, take, check, refl),
      lesson(title, main, lessons, take, check, refl, examples=ex, quotes=quotes),
      lesson(title, main, lessons, take, check, refl, quotes=quotes, sections=[
          sec('"As a man thinketh"', 'Allen opens with the old saying, "As a man thinketh in his heart so is he," and takes it literally: a person is what they think. Their character is the complete sum of their thoughts, and this reaches into every part of life.'),
          sec('Thoughts are seeds', 'Just as a plant cannot exist without a seed, no action can appear without a thought behind it. This is true even of actions we call spontaneous. Action is the flower; joy and suffering are the fruit we later harvest.',
              [('The seed-and-blossom picture is Allen\'s own.', 'book', 'Act is the blossom of thought, and joy and suffering are its fruits')]),
          sec('Character is grown, not given', 'A noble character is not a gift of luck. It grows from long effort in right thinking, just as a poor character grows from repeatedly harbouring low thoughts. Cause and effect work as firmly in the mind as in the physical world.',
              [('He states that good character is "not a thing of favour or chance".', 'book', 'is not a thing of favour or chance, but is the natural result of continued effort in right thinking')]),
          sec('You are the master', 'Allen calls this the most hopeful truth of all: each of us is the master of thought and the maker of character. Even at our weakest we are still the master, only a foolish one who mismanages the "household". Reflection turns us into wise masters.',
              [('A person who reacts angrily every morning in traffic can, by noticing the thought "everyone is against me", choose a calmer one. Nothing outside changes, but the day does.', 'teacher', None)]),
          sec('Dig for self-knowledge', 'Truth about ourselves is found the way gold and diamonds are: by much searching and mining. Watch, control and change your thoughts, trace their effects on you and others, and use even small daily events as lessons. Patience and practice open the door.',
              [('Allen\'s image of mining for gold and diamonds.', 'book', 'Only by much searching and mining, are gold and diamonds obtained')]),
      ]))

# ---------------------------------------------------------------- Work, Money & Success
title = 'Laying Plans'
main = ('Sun Tzu says war is a matter of life and death, so it must be studied carefully before anything is done. '
        'Success comes from honest comparison on five basic factors and from careful calculation in advance; the side that plans more usually wins.')
lessons = [
    ('Serious matters deserve serious study. Sun Tzu calls war "a road either to safety or to ruin".', 'It is a matter of life and death, a road either to safety or to ruin.'),
    ('Judge any situation by five factors: the Moral Law (unity with your people), Heaven (timing and seasons), Earth (terrain and distance), the Commander (the leader\'s qualities) and Method and discipline (organisation and money).', 'The Moral Law; (2) Heaven; (3) Earth; (4) The Commander; (5) Method and discipline.'),
    ('Compare honestly with your opponent: who has the better leader, the stronger team, the stricter discipline, the fairer rewards?', 'By means of these seven considerations I can forecast victory or defeat.'),
    ('Plans must bend to circumstances. Rules are a guide, not a cage.', 'According as circumstances are favorable, one should modify one\'s plans.'),
    ('Calculation before action decides the result: many calculations lead to victory, few to defeat.', 'Thus do many calculations lead to victory, and few calculations to defeat'),
]
take = 'Before any big move, sit down and compare your position honestly on a few key factors. The side that prepares more thoroughly usually wins.'
check = {
    'question': 'What does Sun Tzu say decides who will win, before the battle even starts?',
    'options': ['How many careful calculations each side makes beforehand', 'Which side is braver on the day', 'Which side has more soldiers, nothing else'],
    'answer_index': 0,
    'simpler_explanation': 'Sun Tzu says the winner is usually decided in planning. The general who thinks through many details before acting wins; the one who plans little loses.',
}
refl = [
    'Which important decision in your work or life right now deserves more "calculation in the temple" before you act?',
    'If you compared yourself honestly with a competitor on leadership, team, discipline and rewards, where would you be weaker?',
    'Where are you holding on to a plan even though circumstances have changed?',
]
ex = [
    ('In this edition the translator adds a story about Wellington before Waterloo: asked for his plans, he replied that they depended on what Bonaparte did first. It shows why plans must adapt.', 'book', 'Who will attack the first tomorrow -- I or Bonaparte?'),
    ('A commentator\'s note tells of a general so strict about his own rule against damaging crops that, when his horse strayed into a field, he punished himself by cutting off his hair.', 'book', 'he condemned himself to death for having allowed his horse to shy into a field of corn'),
    ('A small shop planning to open a second branch can use the five factors: team unity, the right season, the location, the manager\'s ability, and systems and cash.', 'teacher', None),
]
quotes = ['All warfare is based on deception.', 'Thus do many calculations lead to victory, and few calculations to defeat']
note_aow = 'This edition (Lionel Giles) mixes Sun Tzu\'s text with commentators\' notes in brackets; examples marked From the book may come from those notes.'
write('sun-tzu-art-of-war', 'full',
      lesson(title, main, lessons, take, check, refl, note=note_aow),
      lesson(title, main, lessons, take, check, refl, examples=ex, quotes=quotes, note=note_aow),
      lesson(title, main, lessons, take, check, refl, quotes=quotes, note=note_aow, sections=[
          sec('Why careful study matters', 'Sun Tzu begins by saying that war is of vital importance: a matter of life and death, a road to safety or to ruin. For that reason it can never be approached carelessly. The same seriousness applies to any decision with big consequences.',
              [('His opening lines set the tone.', 'book', 'It is a matter of life and death, a road either to safety or to ruin.')]),
          sec('The five constant factors', 'Every situation should be judged on five factors. The Moral Law means people are united with their leader. Heaven means timing: night and day, heat and cold, seasons. Earth means distances, danger and terrain. The Commander stands for wisdom, sincerity, benevolence, courage and strictness. Method and discipline means organisation, ranks, supply routes and control of spending.',
              [('Sun Tzu lists the five qualities of a commander.', 'book', 'The COMMANDER stands for the virtues of wisdom, sincerity, benevolence, courage and strictness.')]),
          sec('Seven questions to compare both sides', 'Turn the five factors into questions: whose ruler is in harmony with the people, whose general is more able, who has the advantages of timing and terrain, where discipline is stricter, whose army is stronger, whose people are better trained, and who rewards and punishes more consistently. With these, Sun Tzu says, he can forecast victory or defeat.',
              [('A note tells of a general who punished himself when his own horse damaged crops, to show that rules apply to leaders too.', 'book', 'he condemned himself to death for having allowed his horse to shy into a field of corn')]),
          sec('Adapt the plan', 'Good counsel should be combined with whatever helpful circumstances appear. Plans must change as conditions change; rigid rules lose to a flexible opponent.',
              [('The translator\'s story of Wellington refusing to fix his plans before knowing Bonaparte\'s.', 'book', 'Who will attack the first tomorrow -- I or Bonaparte?')]),
          sec('Deception and timing', 'Sun Tzu says all warfare is based on deception: appear weak when strong, far when near, and attack where the other side is unprepared. In everyday work the useful lesson is less about tricking people and more about not revealing every plan too early and choosing your moment well.'),
          sec('Many calculations win', 'The general who wins makes many calculations before the battle; the one who loses makes few, and with no calculation at all there is no hope. Preparation, Sun Tzu concludes, lets you foresee who is likely to win.',
              [('The chapter closes on this point.', 'book', 'Thus do many calculations lead to victory, and few calculations to defeat')]),
      ]))

# ---------------------------------------------------------------- Communication & Relationships (free part)
title = 'Acquiring Confidence Before an Audience'
main = ('Fear of speaking in public is overcome by speaking, not by reading about it. Face audiences often, fill your mind with your subject instead of yourself, '
        'prepare well, and expect to succeed.')
lessons = [
    ('You learn to speak by speaking. Frequent practice in front of people is the cure for fear.', 'You must learn to speak by speaking.'),
    ('Even great speakers felt stage-fright; it is not a sign that you are unfit to speak.', 'Daniel Webster failed in his first appearance and had to take his seat without finishing his speech because he was nervous.'),
    ('Get absorbed in your subject. When your mind is full of your message, there is no room left for fear.', 'fill your mind with your speech-material and, like the infilling water in the glass, it will drive out your unsubstantial fears'),
    ('Have something worth saying and prepare it, including your first few sentences.', 'Have the first few sentences worked out completely'),
    ('After preparing, expect success. Your audience usually wants you to do well.', 'a hundred chances to one they want you to succeed'),
]
take = 'Prepare well, think about your message instead of yourself, and then speak as often as you can. Confidence grows from practice, not from waiting to feel ready.'
check = {
    'question': 'What is the authors\' main cure for fear of speaking?',
    'options': ['Speak before audiences as often as you can', 'Read many books about public speaking first', 'Avoid speaking until the fear goes away'],
    'answer_index': 0,
    'simpler_explanation': 'Like learning to swim, you only lose the fear by getting into the water. Speak in front of people again and again, and the fear gets smaller.',
}
refl = [
    'When did fear stop you from speaking up, at work, in a meeting or with family?',
    'What subject do you care about so much that you forget yourself when you talk about it?',
    'What is one small chance this week to speak in front of others?',
]
ex = [
    ('The authors compare it to horses near a railway: the ones that see trains every day keep grazing, while a horse that rarely sees one panics.', 'book', 'some horses feed near the track and never even pause to look up at the thundering cars'),
    ('No one learns to swim in a "wetless" bathing suit; you have to plunge in.', 'book', 'There are a great many "wetless" bathing suits worn at the seashore, but no one ever learns to swim in them.'),
    ('One way to get air out of a glass is to pour in water: fill your mind with your subject and the fear is pushed out.', 'book', 'One way to get air out of a glass is to pour in water.'),
    ('A new team leader who volunteers to give the two-minute update at every weekly meeting will be far calmer by the third month.', 'teacher', None),
]
quotes = ['You must learn to speak by speaking.', 'Do not make haste to begin--haste shows lack of control.']
note_sp = 'This is the free part: the first 7 pages of chapter 1. The lesson covers only these pages.'
write('art-of-public-speaking', 'free',
      lesson(title, main, lessons, take, check, refl, note=note_sp),
      lesson(title, main, lessons, take, check, refl, examples=ex, quotes=quotes, note=note_sp),
      lesson(title, main, lessons, take, check, refl, quotes=quotes, note=note_sp, sections=[
          sec('Face the audience often', 'Students keep asking how to overcome fear before an audience. The answer is "horse-sense": a horse gets used to trains by seeing them often, and a speaker gets used to audiences by facing them often. Reading about it is not enough; you have to plunge in.',
              [('The railway horses example.', 'book', 'some horses feed near the track and never even pause to look up at the thundering cars'),
               ('The "wetless" bathing suit nobody ever learned to swim in.', 'book', 'There are a great many "wetless" bathing suits worn at the seashore, but no one ever learns to swim in them.')]),
          sec('Fear is normal, even for great speakers', 'Do not be discouraged if you feel stage-fright. Sensitive people feel it more. Famous speakers like Daniel Webster, Gladstone and Beecher all struggled with nerves; Webster even had to sit down without finishing his first speech.',
              [('Webster\'s failed first appearance.', 'book', 'Daniel Webster failed in his first appearance and had to take his seat without finishing his speech because he was nervous.')]),
          sec('Be absorbed by your subject', 'Concentration means being distracted from less important things. If you care deeply about your subject and fill your mind with it, worries about your clothes or your image are pushed out, the way water pushes air out of a glass. Think of yourself as a messenger with a message, not as an exhibit.',
              [('If a theatre caught fire, you would shout directions without any self-consciousness, because the message matters more than you.', 'book', 'If the theater caught fire you could rush to the stage and shout directions to the audience without any self-consciousness')]),
          sec('Have something to say', 'Many speakers walk up with an empty mind, and it fills with worries like "How does my hair look?" Prepare: know your subject better than your listeners, know roughly how you will say it, and have your first few sentences worked out completely.'),
          sec('Expect success and take charge', 'After preparing, expect to succeed. Believing you will fail almost guarantees it, as when Washington Irving told a friend, "I told you I would fail, and I did." Pause, look at your audience, and remember they want you to succeed.',
              [('Irving at the dinner for Dickens.', 'book', 'There, I told you I would fail, and I did.')]),
          sec('Final hints', 'Do not rush to begin, and do not apologise. Take a deep breath, relax, and start in a quiet, conversational tone, as if speaking to one large friend. Like a cold plunge, it is much easier once you are in.'),
      ]))

# ---------------------------------------------------------------- Spiritual library
title = 'Songs of Kabir: Poems I–XV'
main = ('In these poems Kabir says the Divine is not found in temples, mosques, rituals or caste, but within each person and in this life. '
        'He invites the seeker to look inward with love, here and now, rather than waiting for death or outer ceremonies.')
lessons = [
    ('The Divine is close, "beside thee", and not limited to any place of worship or ritual.', 'I am neither in temple nor in mosque: I am neither in Kaaba nor in Kailash'),
    ('Caste and religion do not decide who is a true seeker; people of every background have found God.', 'It is needless to ask of a saint the caste to which he belongs'),
    ('Seek and understand while you are alive; Kabir doubts that what is not found in life will be found after death.', 'hope for Him whilst you live, know whilst you live, understand whilst you live'),
    ('What we search for outside is already within us, like the musk the deer seeks in the grass.', 'The musk is in the deer, but it seeks it not within itself: it wanders in quest of grass.'),
    ('Love, not argument or display, is the heart of the path.', 'he understands who loves'),
]
take = 'Kabir\'s invitation is to stop searching only outside, in places and ceremonies, and to look within, with love, today.'
check = {
    'question': 'Where does Kabir say the Divine is to be found?',
    'options': ['Within the seeker, here and now', 'Only in a particular temple or mosque', 'Only after death'],
    'answer_index': 0,
    'simpler_explanation': 'Kabir says God is not limited to temples, mosques or rituals. The Divine is close, within each person, and can be found in this life.',
}
refl = [
    'Where do you usually look for peace or meaning: in places, in people, or within yourself?',
    'Kabir says the musk is in the deer but it searches the grass. What are you searching for outside that might already be within you?',
    'What would it mean for you to "seek while you live", today rather than someday?',
]
ex = [
    ('Kabir lists the barber, the washerwoman and the carpenter among those who sought God, to show that caste does not matter.', 'book', 'The barber has sought God, the washerwoman, and the carpenter'),
    ('He compares the soul and the Divine to a river and its waves: named differently, but the same water.', 'book', 'The river and its waves are one'),
    ('He describes giving up one attachment only to find another remains: passion, then anger, then greed, then pride.', 'book', 'So, when I give up passion, I see that anger remains'),
]
note_k = 'Translated by Rabindranath Tagore (1915). The lesson explains what the poems say and how they are commonly understood; readers of different traditions may read them differently.'
quotes = ['O servant, where dost thou seek Me? Lo! I am beside thee.', 'The musk is in the deer, but it seeks it not within itself: it wanders in quest of grass.']
write('songs-of-kabir', 'full',
      lesson(title, main, lessons, take, check, refl, note=note_k),
      lesson(title, main, lessons, take, check, refl, examples=ex, quotes=quotes, note=note_k),
      lesson(title, main, lessons, take, check, refl, quotes=quotes, note=note_k, sections=[
          sec('"Lo! I am beside thee" (Poem I)', 'The first poem speaks in the voice of the Divine: you need not search far, for I am right beside you. Not in temple or mosque, not in Kaaba or Kailash, not in rituals, yoga or renunciation. A true seeker meets the Divine in a moment.',
              [('The opening lines.', 'book', 'O servant, where dost thou seek Me? Lo! I am beside thee.')]),
          sec('Beyond caste and creed (Poem II)', 'Kabir says it is foolish to ask a saint\'s caste. People of every occupation and both Hindus and Muslims have reached the same goal, where no mark of difference remains.',
              [('He names ordinary working people as seekers.', 'book', 'The barber has sought God, the washerwoman, and the carpenter')]),
          sec('Seek while you live (Poem III)', 'Kabir urges the seeker to hope, know and understand in this life, because "in life deliverance abides". If the bonds are not broken while living, he asks, what hope is there in death? It is the spirit of the quest that helps.',
              [('Kabir\'s call to the living.', 'book', 'hope for Him whilst you live, know whilst you live, understand whilst you live')]),
          sec('The garden within (Poems IV, VI, VIII)', 'Several poems turn the search inward: the garden of flowers is in your own body; the moon and sun shine within; within this "earthen vessel" are groves, oceans and stars, and the Creator. The deer seeks musk in the grass, never realising it carries the scent itself.',
              [('The musk deer.', 'book', 'The musk is in the deer, but it seeks it not within itself: it wanders in quest of grass.')]),
          sec('Letting go is gradual (Poem V)', 'Kabir is honest about how hard renunciation is: drop one attachment and another appears, from passion to anger to greed to pride. "The true path is rarely found." This is a humane picture of spiritual effort, not a demand for instant perfection.',
              [('His list of attachments that remain.', 'book', 'So, when I give up passion, I see that anger remains')]),
          sec('One reality, and the way of love (Poems VII, IX–XV)', 'Kabir describes the creature and the Divine as "ever distinct, yet ever united", like a river and its waves. Words cannot fully describe this. What opens the way is love: "he understands who loves".',
              [('The river and its waves.', 'book', 'The river and its waves are one')]),
      ]))

# ---------------------------------------------------------------- Business & Creative Practice (author's own book)
title = 'I Learned to See Buildings Differently'
main = ('Saptarshi Kapri explains how his path from chemistry to architecture, and the hard early years of Karukrit Designs, taught him that architecture is about people experiencing buildings. '
        'He learned that good design is not enough: many building problems begin quietly in unclear decisions, so important choices should be resolved before construction whenever reasonably possible.')
lessons = [
    ('Architecture is not only about buildings; it is about people experiencing buildings.', 'It was about people experiencing buildings.'),
    ('Clients need more than a beautiful drawing. They are trusting years of savings to a result they cannot yet see.', 'They were being asked to place years of savings behind a promise whose result they could not yet see.'),
    ('Making every available project count builds credibility and, above all, pattern recognition.', 'But the most valuable thing we accumulated was not square footage. It was pattern recognition.'),
    ('Good design can still become a difficult project if people understand it differently, so check what each conversation communicated.', 'A thoughtful design can still become a difficult project if the people involved understand it differently.'),
    ('Problems often begin quietly in sentences like "We can decide that later." Ask what needs deciding now so it is not improvised later.', 'What needs to be decided now so that we do not have to improvise it later?'),
]
take = 'Before construction starts, resolve every important decision you reasonably can. Quiet early conversations save loud problems on site.'
check = {
    'question': 'According to the author, where do many building problems really begin?',
    'options': ['In unclear decisions and assumptions made before work starts', 'Only in poor workmanship on site', 'In choosing an unusual design style'],
    'answer_index': 0,
    'simpler_explanation': 'The author noticed that problems often start with small things like "We can decide that later" or an unclear scope. These seem harmless at first, but they cause trouble on site later.',
}
refl = [
    'In your own home or project, which decision have you been putting off with "we can decide that later"?',
    'Who is involved in your project, and might any of them understand the plan differently from you?',
    'What would help you feel confident trusting a professional with years of your savings?',
]
ex = [
    ('After his co-founder joined a family business and COVID arrived, the studio focused on making each smaller project count instead of waiting for one large project.', 'book', 'Instead of waiting for one large project that would suddenly establish our credibility, we began concentrating on making each available project count.'),
    ('Studying Industrial Design made him ask what happens after an object has been admired: how it is made, used, cleaned and repaired.', 'book', 'I began asking what happens after an object has been admired.'),
    ('He lists everyday sentences that hide unanswered questions.', 'book', '“We have known him for years.”'),
    ('A family that delays choosing its kitchen layout may find, once walls are up, that the plumbing points are in the wrong place.', 'teacher', None),
]
quotes = ['A drawing could become a room.', 'It was about people experiencing buildings.']
fp_hundred = '9f605bdbf4a3a38484324ddcb623fecd2512b352ae27dfebb9a35eb75e39afe8'
write('100-decisions-before-the-first-brick', 'full',
      lesson(title, main, lessons, take, check, refl),
      lesson(title, main, lessons, take, check, refl, examples=ex, quotes=quotes),
      lesson(title, main, lessons, take, check, refl, quotes=quotes, sections=[
          sec('From chemistry to architecture', 'The author began as a Chemistry Honours student in Kolkata, drawn to sketching, painting and making things. Architecture became the bridge between that creative instinct and building something real. What fascinated him was how a line on a drawing could decide where someone walks every morning.',
              [('His realisation about drawings.', 'book', 'A drawing could become a room.')]),
          sec('Starting before feeling ready', 'Karukrit Designs began in 2018 with ambition but few landmark projects. Clients liked the ideas yet hesitated to trust a young practice with large projects. Over time he understood why: they were risking years of savings on a result they could not yet see.',
              [('His explanation of client hesitation.', 'book', 'They were being asked to place years of savings behind a promise whose result they could not yet see.')]),
          sec('Rebuilding and pattern recognition', 'When his co-founder left and COVID arrived, survival became the priority. Instead of waiting for one big break, the studio made each smaller project count. The most valuable thing gained was pattern recognition: every project showed how office decisions played out on site.',
              [('He names what mattered most.', 'book', 'But the most valuable thing we accumulated was not square footage. It was pattern recognition.')]),
          sec('Looking past the photograph', 'A master\'s degree in Industrial Design shifted his attention to materials, manufacturing, usability and ageing. He began judging homes by the experience that continues after the photograph, not by one impressive wall.',
              [('The question he began asking.', 'book', 'I began asking what happens after an object has been admired.')]),
          sec('When good design is not enough', 'A thoughtful design can still go wrong if people understand it differently. He learned to check what conversations had actually communicated: an idea may need a drawing, a technical point may need plain language, an approval may need a written record.'),
          sec('The problems that begin quietly', 'He noticed recurring gaps: construction starting before the design was resolved, budgets left unspoken, familiar contractors appointed without a clear scope. Sentences like "We can decide that later" felt harmless. The question that stayed with him: what needs to be decided now so it is not improvised later?',
              [('One of the sentences he learned to question.', 'book', '“We have known him for years.”')]),
          sec('The house before the house', 'Families want to see walls rising, but quiet drawing reviews and budget meetings are part of building too. Every important decision that can reasonably be resolved before execution deserves that chance. This belief is why the book was written.'),
      ]), fingerprint=fp_hundred)

print('samples written to', os.path.abspath(OUT))
