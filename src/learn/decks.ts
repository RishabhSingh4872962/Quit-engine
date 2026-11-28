import { Lang } from '../habits/types';
import { remote } from '../lib/remoteConfig';
import { reportError } from '../lib/telemetry';

/**
 * "Learn instead": short rounds of exam-style questions on the pause screen. Built-in decks ship
 * with the app; the Remote Config parameter `learn_decks` (a JSON array of decks, same shape as
 * below with `{ en, hi? }` texts) adds decks or replaces a built-in one with the same id.
 * Facts must be checked before they go in: these are study questions.
 */

/** A text in both languages, or one string for both (numbers, symbols, formulas). */
type Txt = string | Record<Lang, string>;

export interface Card {
  q: Txt;
  a: Txt[]; // a[0] is the right answer; options are shuffled when shown
}

export interface Deck {
  id: string;
  title: Txt;
  exam: Txt; // who it's for, e.g. "NEET · JEE basics"
  cards: Card[] | (() => Card); // a list, or a generator (mental math)
}

export interface Question {
  q: string;
  options: string[];
  right: number; // index into options
}

export const txt = (v: Txt, lang: Lang) => (typeof v === 'string' ? v : v[lang] || v.en);

const science: Card[] = [
  { q: { en: 'Which organelle is called the powerhouse of the cell?', hi: 'कोशिका का "पावरहाउस" किसे कहते हैं?' },
    a: [{ en: 'Mitochondria', hi: 'माइटोकॉन्ड्रिया' }, { en: 'Ribosome', hi: 'राइबोसोम' }, { en: 'Golgi body', hi: 'गॉल्जी काय' }, { en: 'Nucleus', hi: 'केंद्रक' }] },
  { q: { en: 'What is the SI unit of force?', hi: 'बल का SI मात्रक क्या है?' },
    a: [{ en: 'Newton', hi: 'न्यूटन' }, { en: 'Joule', hi: 'जूल' }, { en: 'Watt', hi: 'वाट' }, { en: 'Pascal', hi: 'पास्कल' }] },
  { q: { en: 'What is the chemical symbol of sodium?', hi: 'सोडियम का रासायनिक प्रतीक क्या है?' }, a: ['Na', 'So', 'Sd', 'S'] },
  { q: { en: 'What is the pH of pure water at 25 °C?', hi: '25 °C पर शुद्ध पानी का pH कितना होता है?' }, a: ['7', '0', '14', '5'] },
  { q: { en: 'Which blood cells help blood to clot?', hi: 'खून का थक्का बनाने में कौन-सी कोशिकाएँ मदद करती हैं?' },
    a: [{ en: 'Platelets', hi: 'प्लेटलेट्स' }, { en: 'Red blood cells', hi: 'लाल रक्त कोशिकाएँ' }, { en: 'White blood cells', hi: 'श्वेत रक्त कोशिकाएँ' }, { en: 'Plasma cells', hi: 'प्लाज़्मा कोशिकाएँ' }] },
  { q: { en: 'Which gas do plants take in for photosynthesis?', hi: 'प्रकाश संश्लेषण के लिए पौधे कौन-सी गैस लेते हैं?' },
    a: [{ en: 'Carbon dioxide', hi: 'कार्बन डाइऑक्साइड' }, { en: 'Oxygen', hi: 'ऑक्सीजन' }, { en: 'Nitrogen', hi: 'नाइट्रोजन' }, { en: 'Hydrogen', hi: 'हाइड्रोजन' }] },
  { q: { en: 'What is the atomic number of carbon?', hi: 'कार्बन का परमाणु क्रमांक क्या है?' }, a: ['6', '12', '8', '14'] },
  { q: { en: 'What is the unit of electrical resistance?', hi: 'विद्युत प्रतिरोध का मात्रक क्या है?' },
    a: [{ en: 'Ohm', hi: 'ओम' }, { en: 'Ampere', hi: 'एम्पियर' }, { en: 'Volt', hi: 'वोल्ट' }, { en: 'Coulomb', hi: 'कूलॉम' }] },
  { q: { en: 'Which is the largest gland in the human body?', hi: 'मानव शरीर की सबसे बड़ी ग्रंथि कौन-सी है?' },
    a: [{ en: 'Liver', hi: 'यकृत (लिवर)' }, { en: 'Pancreas', hi: 'अग्न्याशय' }, { en: 'Thyroid', hi: 'थायरॉयड' }, { en: 'Pituitary', hi: 'पीयूष ग्रंथि' }] },
  { q: { en: 'Which vitamin does the skin make in sunlight?', hi: 'धूप में त्वचा कौन-सा विटामिन बनाती है?' },
    a: [{ en: 'Vitamin D', hi: 'विटामिन D' }, { en: 'Vitamin C', hi: 'विटामिन C' }, { en: 'Vitamin A', hi: 'विटामिन A' }, { en: 'Vitamin K', hi: 'विटामिन K' }] },
  { q: { en: 'How many chromosomes are there in a human body cell?', hi: 'मानव शरीर की एक कोशिका में कितने गुणसूत्र होते हैं?' }, a: ['46', '23', '44', '48'] },
  { q: { en: "Ohm's law: V = ?", hi: 'ओम का नियम: V = ?' }, a: ['IR', 'I/R', 'R/I', 'I²R'] },
  { q: { en: 'Which lens corrects short-sightedness (myopia)?', hi: 'निकट-दृष्टि दोष (मायोपिया) किस लेंस से ठीक होता है?' },
    a: [{ en: 'Concave', hi: 'अवतल' }, { en: 'Convex', hi: 'उत्तल' }, { en: 'Cylindrical', hi: 'बेलनाकार' }, { en: 'Bifocal', hi: 'द्विफोकसी' }] },
  { q: { en: 'What is the functional unit of the kidney?', hi: 'वृक्क (किडनी) की कार्यात्मक इकाई क्या है?' },
    a: [{ en: 'Nephron', hi: 'नेफ्रॉन' }, { en: 'Neuron', hi: 'न्यूरॉन' }, { en: 'Alveolus', hi: 'कूपिका (एल्वियोलस)' }, { en: 'Villus', hi: 'रसांकुर' }] },
  { q: { en: "Avogadro's number is about", hi: 'आवोगाद्रो संख्या लगभग कितनी है?' }, a: ['6.022 × 10²³', '3 × 10⁸', '6.626 × 10⁻³⁴', '9.8 × 10²'] },
  { q: { en: 'Which of these is a noble gas?', hi: 'इनमें से अक्रिय (नोबल) गैस कौन-सी है?' },
    a: [{ en: 'Argon', hi: 'आर्गन' }, { en: 'Nitrogen', hi: 'नाइट्रोजन' }, { en: 'Chlorine', hi: 'क्लोरीन' }, { en: 'Oxygen', hi: 'ऑक्सीजन' }] },
  { q: { en: 'The speed of light in vacuum is about', hi: 'निर्वात में प्रकाश की चाल लगभग कितनी है?' }, a: ['3 × 10⁸ m/s', '3 × 10⁶ m/s', '340 m/s', '3 × 10⁵ m/s'] },
  { q: { en: 'Which part of the brain keeps the body balanced?', hi: 'शरीर का संतुलन दिमाग का कौन-सा भाग बनाए रखता है?' },
    a: [{ en: 'Cerebellum', hi: 'अनुमस्तिष्क (सेरिबेलम)' }, { en: 'Cerebrum', hi: 'प्रमस्तिष्क (सेरिब्रम)' }, { en: 'Medulla', hi: 'मेडुला' }, { en: 'Hypothalamus', hi: 'हाइपोथैलेमस' }] },
  { q: { en: "Which gas makes up most of Earth's atmosphere?", hi: 'पृथ्वी के वायुमंडल में सबसे ज़्यादा कौन-सी गैस है?' },
    a: [{ en: 'Nitrogen', hi: 'नाइट्रोजन' }, { en: 'Oxygen', hi: 'ऑक्सीजन' }, { en: 'Argon', hi: 'आर्गन' }, { en: 'Carbon dioxide', hi: 'कार्बन डाइऑक्साइड' }] },
  { q: { en: 'What is the chemical formula of common salt?', hi: 'साधारण नमक का रासायनिक सूत्र क्या है?' }, a: ['NaCl', 'KCl', 'NaOH', 'CaCl₂'] },
  { q: { en: 'What is the SI unit of power?', hi: 'शक्ति का SI मात्रक क्या है?' },
    a: [{ en: 'Watt', hi: 'वाट' }, { en: 'Joule', hi: 'जूल' }, { en: 'Newton', hi: 'न्यूटन' }, { en: 'Volt', hi: 'वोल्ट' }] },
  { q: { en: 'Which enzyme in saliva starts digesting starch?', hi: 'लार का कौन-सा एंजाइम स्टार्च को पचाना शुरू करता है?' },
    a: [{ en: 'Salivary amylase', hi: 'लार एमाइलेज (टायलिन)' }, { en: 'Pepsin', hi: 'पेप्सिन' }, { en: 'Trypsin', hi: 'ट्रिप्सिन' }, { en: 'Lipase', hi: 'लाइपेज' }] },
  { q: { en: 'Acceleration due to gravity on Earth is about', hi: 'पृथ्वी पर गुरुत्वीय त्वरण लगभग कितना है?' }, a: ['9.8 m/s²', '1.6 m/s²', '98 m/s²', '6.67 m/s²'] },
  { q: { en: 'Which blood group is the universal donor (red cells)?', hi: 'सर्वदाता (यूनिवर्सल डोनर) रक्त समूह कौन-सा है?' },
    a: [{ en: 'O negative', hi: 'O नेगेटिव' }, { en: 'AB positive', hi: 'AB पॉज़िटिव' }, { en: 'A positive', hi: 'A पॉज़िटिव' }, { en: 'B negative', hi: 'B नेगेटिव' }] },
];

const india: Card[] = [
  { q: { en: 'Who is called the chief architect of the Indian Constitution?', hi: 'भारतीय संविधान के मुख्य वास्तुकार किन्हें कहा जाता है?' },
    a: [{ en: 'B. R. Ambedkar', hi: 'बी. आर. आंबेडकर' }, { en: 'Jawaharlal Nehru', hi: 'जवाहरलाल नेहरू' }, { en: 'Rajendra Prasad', hi: 'राजेंद्र प्रसाद' }, { en: 'Sardar Patel', hi: 'सरदार पटेल' }] },
  { q: { en: 'When did the Constitution of India come into force?', hi: 'भारत का संविधान कब लागू हुआ?' },
    a: [{ en: '26 January 1950', hi: '26 जनवरी 1950' }, { en: '15 August 1947', hi: '15 अगस्त 1947' }, { en: '26 November 1949', hi: '26 नवंबर 1949' }, { en: '2 October 1950', hi: '2 अक्टूबर 1950' }] },
  { q: { en: 'How many Fundamental Rights does the Constitution list today?', hi: 'संविधान में आज कितने मौलिक अधिकार हैं?' },
    a: [{ en: 'Six', hi: 'छह' }, { en: 'Seven', hi: 'सात' }, { en: 'Five', hi: 'पाँच' }, { en: 'Eight', hi: 'आठ' }] },
  { q: { en: 'What is the minimum age to become President of India?', hi: 'भारत का राष्ट्रपति बनने की न्यूनतम आयु क्या है?' },
    a: [{ en: '35 years', hi: '35 वर्ष' }, { en: '25 years', hi: '25 वर्ष' }, { en: '30 years', hi: '30 वर्ष' }, { en: '40 years', hi: '40 वर्ष' }] },
  { q: { en: 'What is the term of a Rajya Sabha member?', hi: 'राज्यसभा सदस्य का कार्यकाल कितना होता है?' },
    a: [{ en: '6 years', hi: '6 वर्ष' }, { en: '5 years', hi: '5 वर्ष' }, { en: '4 years', hi: '4 वर्ष' }, { en: '3 years', hi: '3 वर्ष' }] },
  { q: { en: 'Who appoints the Chief Justice of India?', hi: 'भारत के मुख्य न्यायाधीश की नियुक्ति कौन करता है?' },
    a: [{ en: 'The President', hi: 'राष्ट्रपति' }, { en: 'The Prime Minister', hi: 'प्रधानमंत्री' }, { en: 'Parliament', hi: 'संसद' }, { en: 'The Law Minister', hi: 'क़ानून मंत्री' }] },
  { q: { en: 'Article 21 protects', hi: 'अनुच्छेद 21 किसकी रक्षा करता है?' },
    a: [{ en: 'Life and personal liberty', hi: 'प्राण और दैहिक स्वतंत्रता' }, { en: 'Freedom of religion', hi: 'धर्म की स्वतंत्रता' }, { en: 'The right to property', hi: 'संपत्ति का अधिकार' }, { en: 'Equality before law', hi: 'क़ानून के समक्ष समानता' }] },
  { q: { en: 'Which amendment gave Panchayati Raj constitutional status?', hi: 'किस संशोधन से पंचायती राज को संवैधानिक दर्जा मिला?' },
    a: [{ en: '73rd', hi: '73वाँ' }, { en: '42nd', hi: '42वाँ' }, { en: '44th', hi: '44वाँ' }, { en: '86th', hi: '86वाँ' }] },
  { q: { en: 'What is the capital of Arunachal Pradesh?', hi: 'अरुणाचल प्रदेश की राजधानी क्या है?' },
    a: [{ en: 'Itanagar', hi: 'ईटानगर' }, { en: 'Dispur', hi: 'दिसपुर' }, { en: 'Shillong', hi: 'शिलांग' }, { en: 'Aizawl', hi: 'आइज़ोल' }] },
  { q: { en: 'Which state has the longest coastline in India?', hi: 'भारत में सबसे लंबी तटरेखा किस राज्य की है?' },
    a: [{ en: 'Gujarat', hi: 'गुजरात' }, { en: 'Tamil Nadu', hi: 'तमिलनाडु' }, { en: 'Andhra Pradesh', hi: 'आंध्र प्रदेश' }, { en: 'Maharashtra', hi: 'महाराष्ट्र' }] },
  { q: { en: 'A National Emergency is declared under which Article?', hi: 'राष्ट्रीय आपातकाल किस अनुच्छेद के तहत घोषित होता है?' }, a: ['352', '356', '360', '370'] },
  { q: { en: 'Who presides over a joint sitting of Parliament?', hi: 'संसद की संयुक्त बैठक की अध्यक्षता कौन करता है?' },
    a: [{ en: 'The Speaker of the Lok Sabha', hi: 'लोकसभा अध्यक्ष' }, { en: 'The President', hi: 'राष्ट्रपति' }, { en: 'The Vice-President', hi: 'उपराष्ट्रपति' }, { en: 'The Prime Minister', hi: 'प्रधानमंत्री' }] },
  { q: { en: 'Which amendment added the Fundamental Duties?', hi: 'मौलिक कर्तव्य किस संशोधन से जोड़े गए?' },
    a: [{ en: '42nd', hi: '42वाँ' }, { en: '44th', hi: '44वाँ' }, { en: '61st', hi: '61वाँ' }, { en: '73rd', hi: '73वाँ' }] },
  { q: { en: 'The Right to Education is a Fundamental Right under Article', hi: 'शिक्षा का अधिकार किस अनुच्छेद के तहत मौलिक अधिकार है?' }, a: ['21A', '19', '32', '14'] },
  { q: { en: 'Which Article abolishes untouchability?', hi: 'अस्पृश्यता (छुआछूत) का अंत किस अनुच्छेद में है?' }, a: ['17', '14', '21', '25'] },
  { q: { en: 'Who was the first President of India?', hi: 'भारत के पहले राष्ट्रपति कौन थे?' },
    a: [{ en: 'Rajendra Prasad', hi: 'राजेंद्र प्रसाद' }, { en: 'S. Radhakrishnan', hi: 'एस. राधाकृष्णन' }, { en: 'Zakir Husain', hi: 'ज़ाकिर हुसैन' }, { en: 'V. V. Giri', hi: 'वी. वी. गिरि' }] },
  { q: { en: 'Who administers the oath of office to the President?', hi: 'राष्ट्रपति को पद की शपथ कौन दिलाता है?' },
    a: [{ en: 'The Chief Justice of India', hi: 'भारत के मुख्य न्यायाधीश' }, { en: 'The Vice-President', hi: 'उपराष्ट्रपति' }, { en: 'The Speaker of the Lok Sabha', hi: 'लोकसभा अध्यक्ष' }, { en: 'The Prime Minister', hi: 'प्रधानमंत्री' }] },
  { q: { en: 'A Money Bill can be introduced only in', hi: 'धन विधेयक केवल कहाँ पेश किया जा सकता है?' },
    a: [{ en: 'The Lok Sabha', hi: 'लोकसभा' }, { en: 'The Rajya Sabha', hi: 'राज्यसभा' }, { en: 'Either House', hi: 'किसी भी सदन में' }, { en: 'A joint sitting', hi: 'संयुक्त बैठक में' }] },
  { q: { en: 'Which is the longest river in India?', hi: 'भारत की सबसे लंबी नदी कौन-सी है?' },
    a: [{ en: 'Ganga', hi: 'गंगा' }, { en: 'Godavari', hi: 'गोदावरी' }, { en: 'Yamuna', hi: 'यमुना' }, { en: 'Narmada', hi: 'नर्मदा' }] },
  { q: { en: 'The Preamble calls India a sovereign, socialist, secular, democratic …', hi: 'प्रस्तावना भारत को संप्रभु, समाजवादी, पंथनिरपेक्ष, लोकतांत्रिक … कहती है।' },
    a: [{ en: 'Republic', hi: 'गणराज्य' }, { en: 'Union', hi: 'संघ' }, { en: 'Federation', hi: 'परिसंघ' }, { en: 'Monarchy', hi: 'राजतंत्र' }] },
  { q: { en: 'The Election Commission of India is a', hi: 'भारत का निर्वाचन आयोग किस तरह की संस्था है?' },
    a: [{ en: 'Constitutional body', hi: 'संवैधानिक संस्था' }, { en: 'Statutory body', hi: 'वैधानिक संस्था' }, { en: 'Executive body', hi: 'कार्यकारी संस्था' }, { en: 'Private body', hi: 'निजी संस्था' }] },
  { q: { en: 'What is the normal maximum term of the Lok Sabha?', hi: 'सामान्य रूप से लोकसभा का अधिकतम कार्यकाल कितना है?' },
    a: [{ en: '5 years', hi: '5 वर्ष' }, { en: '6 years', hi: '6 वर्ष' }, { en: '4 years', hi: '4 वर्ष' }, { en: '7 years', hi: '7 वर्ष' }] },
];

const rnd = (min: number, max: number) => min + Math.floor(Math.random() * (max - min + 1));

/** One mental-math question; the wrong answers are close, so it needs working out. */
function mathCard(): Card {
  const kind = rnd(0, 5);
  let q: Txt;
  let ans: number;
  if (kind === 0) {
    const [a, b] = [rnd(12, 29), rnd(3, 9)];
    [q, ans] = [`${a} × ${b} = ?`, a * b];
  } else if (kind === 1) {
    const [a, b] = [rnd(27, 98), rnd(27, 98)];
    [q, ans] = [`${a} + ${b} = ?`, a + b];
  } else if (kind === 2) {
    const [a, b] = [rnd(61, 199), rnd(12, 59)];
    [q, ans] = [`${a} − ${b} = ?`, a - b];
  } else if (kind === 3) {
    const p = [5, 10, 20, 25, 50, 75][rnd(0, 5)];
    const base = 20 * rnd(2, 20);
    [q, ans] = [{ en: `${p}% of ${base} = ?`, hi: `${base} का ${p}% = ?` }, (p * base) / 100];
  } else if (kind === 4) {
    const n = rnd(11, 25);
    [q, ans] = [`${n}² = ?`, n * n];
  } else {
    const [b, c] = [rnd(3, 12), rnd(6, 25)];
    [q, ans] = [`${b * c} ÷ ${b} = ?`, c];
  }
  const near = [1, -1, 2, -2, 10, -10, 5, -5].map((d) => ans + d).filter((x) => x > 0);
  const wrong = shuffle(near).slice(0, 3);
  return { q, a: [String(ans), ...wrong.map(String)] };
}

export const BUILT_IN_DECKS: Deck[] = [
  { id: 'science', title: { en: 'Science', hi: 'विज्ञान' }, exam: { en: 'NEET · JEE basics', hi: 'NEET · JEE की बुनियाद' }, cards: science },
  { id: 'india', title: { en: 'India & polity', hi: 'भारत और राजव्यवस्था' }, exam: 'UPSC · SSC', cards: india },
  { id: 'math', title: { en: 'Mental math', hi: 'मानसिक गणित' }, exam: { en: 'Any exam', hi: 'हर परीक्षा' }, cards: mathCard },
];

function shuffle<T>(xs: T[]): T[] {
  const out = [...xs];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

const isTxt = (v: unknown): v is Txt =>
  typeof v === 'string' || (typeof v === 'object' && v !== null && typeof (v as { en?: unknown }).en === 'string');

const isCard = (c: unknown): c is Card => {
  const o = c as Card;
  return typeof o === 'object' && o !== null && isTxt(o.q) && Array.isArray(o.a) && o.a.length >= 2 && o.a.every(isTxt);
};

let cache: { raw: string; decks: Deck[] } | null = null;

/** Built-in decks plus valid remote ones (a remote deck with a built-in id replaces it). */
export function learnDecks(): Deck[] {
  const raw = remote.learnDecks();
  if (cache?.raw === raw) return cache.decks;
  let decks = BUILT_IN_DECKS;
  if (raw) {
    try {
      const list: unknown = JSON.parse(raw);
      const extra = (Array.isArray(list) ? list : [])
        .filter((d): d is Deck => {
          const o = d as Deck;
          return typeof o?.id === 'string' && isTxt(o.title) && isTxt(o.exam ?? '') && Array.isArray(o.cards);
        })
        .map((d) => ({ ...d, exam: d.exam ?? '', cards: (d.cards as unknown[]).filter(isCard) }))
        .filter((d) => d.cards.length >= 5);
      decks = [...BUILT_IN_DECKS.filter((b) => !extra.some((e) => e.id === b.id)), ...extra];
    } catch (e) {
      reportError(e, 'learn_decks');
    }
  }
  cache = { raw, decks };
  return decks;
}

/** n questions from a deck in the given language, answers shuffled. */
export function makeRound(deck: Deck, n: number, lang: Lang): Question[] {
  const cards = typeof deck.cards === 'function' ? Array.from({ length: n }, deck.cards) : shuffle(deck.cards).slice(0, n);
  return cards.map((c) => {
    const options = shuffle(c.a.map((a, i) => ({ text: txt(a, lang), right: i === 0 })));
    return { q: txt(c.q, lang), options: options.map((o) => o.text), right: options.findIndex((o) => o.right) };
  });
}
