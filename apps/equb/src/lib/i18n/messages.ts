/** Runtime messages (store, errors) — Amharic + English */
import type { Locale } from './dictionaries';

const M = {
  am: {
    signInFirst: 'መጀመሪያ ይግቡ',
    roomNotFound: 'ክፍል አልተገኘም',
    alreadyInRound: 'በዚህ ዙር ውስጥ አሉ — ዕጣን ይጠብቁ',
    pickRange: 'ከ 1 እስከ {size} ይምረጡ',
    numberTaken: 'ቁጥሩ ተይዟል',
    needBirr: '{fee} ብር ያስፈልጋል (ቀሪ {balance})። ብቸኛው ገደብ ገንዘብዎ ነው።',
    joined: '#{pick} ተቀላቀሉ። ቀሪ ሂሳብ እስካለዎት ድረግ ያለ ገደብ ይጫወቱ።',
    cannotFill: 'መሙላት አይቻልም',
    alreadyFull: 'አስቀድሞ ሙሉ ነው',
    filledBots: '{n} መቀመጫ በቦቶች ተሞልቷል',
    alreadyDrawn: 'አስቀድሞ ተሳልቷል — እንደገና ለመጫወት ይሞክሩ',
    roomNotFull: 'ክፍሉ ሙሉ መሆን አለበት',
    everyoneNeedsNumber: 'ሁሉም ቁጥር መምረጥ አለበት',
    membersOnly: 'ለአባላት ብቻ',
    cryptoFailed: 'የክሪፕቶ ዕጣ አልተሳካም',
    drawError: 'የዕጣ ስህተት',
    youWon:
      'አሸንፈዋል! {pot} ብር ተቀብለዋል (ከፖቱ 85%) · #{num} · አስተዳዳሪ ክፍያ {fee} ብር ({pct}%).{again}',
    otherWon:
      'አሸናፊ ቁጥር {num} — {name} አሸንፏል ({pot} ብር) · አስተዳዳሪ {fee} ብር (15%).{again}',
    playAgainHint: ' አዲስ ዙር ለመጀመር ቁጥር ይምረጡ።',
    needMoreHint: ' ለቀጣይ ዙር ተጨማሪ ብር ያስፈልጋል።',
    needForRound: 'ለአዲስ ዙር {fee} ብር ያስፈልጋል (ቀሪ {balance})',
    newRoundOpen: 'አዲስ ዙር ክፍት ነው — ቁጥር ይምረጡና እንደገና ይጫወቱ',
    alreadyClaimed: 'ኮድ አስቀድሞ ተጠቅመዋል',
    invalidCode: 'ልክ ያልሆነ ኮድ',
    ownCode: 'የራስዎን ኮድ መጠቀም አይቻልም',
    referralOk: '+100 ምናባዊ ብር',
    joinFailed: 'መቀላቀል አልተሳካም',
    joinedPick: '#{pick} ተቀላቀሉ',
    pickFirst: 'መጀመሪያ ቁጥርዎን ይምረጡ (1–{size})',
    openFailed: 'ክፍል መክፈት አልተቻለም',
  },
  en: {
    signInFirst: 'Sign in first',
    roomNotFound: 'Room not found',
    alreadyInRound: 'Already in this round — wait for draw',
    pickRange: 'Pick 1–{size}',
    numberTaken: 'Number taken',
    needBirr: 'Need {fee} Birr (balance {balance}). Only limit is your money.',
    joined: 'Joined #{pick}. Play unlimited rounds while you have balance.',
    cannotFill: 'Cannot fill',
    alreadyFull: 'Already full',
    filledBots: 'Filled {n} seats with bots',
    alreadyDrawn: 'Already drawn — tap Play again',
    roomNotFull: 'Room must be full',
    everyoneNeedsNumber: 'Everyone needs a number',
    membersOnly: 'Members only',
    cryptoFailed: 'Crypto RNG failed',
    drawError: 'Draw error',
    youWon:
      'You won {pot} Birr (85% of pot)! #{num}. Admin fee {fee} Birr ({pct}%).{again}',
    otherWon:
      'Winning number {num} — {name} wins {pot} Birr. Admin fee {fee} Birr (15%).{again}',
    playAgainHint: ' Pick a number again to start a new round.',
    needMoreHint: ' Need more Birr for next round.',
    needForRound: 'Need {fee} Birr for a new round (balance {balance})',
    newRoundOpen: 'New round open — pick a number and play again',
    alreadyClaimed: 'Already used a code',
    invalidCode: 'Invalid code',
    ownCode: 'Cannot use your own code',
    referralOk: '+100 virtual Birr',
    joinFailed: 'Join failed',
    joinedPick: 'Joined #{pick}',
    pickFirst: 'Pick your number first (1–{size})',
    openFailed: 'Could not open room',
  },
} as const;

export type MsgKey = keyof (typeof M)['am'];

function locale(): Locale {
  if (typeof window === 'undefined') return 'am';
  try {
    const s = localStorage.getItem('fast-equb-locale');
    if (s === 'en' || s === 'am') return s;
  } catch {
    /* ignore */
  }
  return 'am';
}

export function msg(key: MsgKey, vars?: Record<string, string | number>): string {
  let t: string = M[locale()][key] || M.am[key] || key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      t = t.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
    }
  }
  return t;
}
