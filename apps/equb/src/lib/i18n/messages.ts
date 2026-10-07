/** Runtime messages (store, errors) — Amharic + English */
import type { Locale } from './dictionaries';

const M = {
  am: {
    signInFirst: 'መጀመሪያ ይግቡ',
    roomNotFound: 'ክፍል አልተገኘም',
    alreadyInRound: 'በዚህ ዙር ውስጥ አሉ — ዕጣን ይጠብቁ',
    pickRange: 'ከ 1 እስከ {size} ይምረጡ',
    numberTaken: 'ቁጥሩ ተይዟል',
    needBirr: '{fee} ብር ያስፈልጋል (ቀሪ {balance})። ቴሌብር ወደ ኪስ ያስገቡ።',
    joined: '#{pick} ተቀላቀሉ። ቀሪ ሂሳብ እስካለዎት ድረግ ይጫወቱ።',
    cannotFill: 'መሙላት አይቻልም',
    alreadyFull: 'አስቀድሞ ሙሉ ነው',
    filledBots: 'ቦቶች ተሰናክለዋል',
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
    needMoreHint: ' ለቀጣይ ዙር ተጨማሪ ብር ያስፈልጋል — ቴሌብር ያስገቡ።',
    needForRound: 'ለአዲስ ዙር {fee} ብር ያስፈልጋል (ቀሪ {balance})',
    newRoundOpen: 'አዲስ ዙር ክፍት ነው — ቁጥር ይምረጡና እንደገና ይጫወቱ',
    alreadyClaimed: 'ኮድ አስቀድሞ ተጠቅመዋል',
    invalidCode: 'ልክ ያልሆነ ኮድ',
    ownCode: 'የራስዎን ኮድ መጠቀም አይቻልም',
    referralOk: 'ኮድ ተመዝግቧል',
    joinFailed: 'መቀላቀል አልተሳካም',
    joinedPick: '#{pick} ተቀላቀሉ',
    pickFirst: 'መጀመሪያ ቁጥርዎን ይምረጡ (1–{size})',
    openFailed: 'ክፍል መክፈት አልተቻለም',
  },
  en: {
    signInFirst: 'Sign in first',
    roomNotFound: 'Room not found',
    alreadyInRound: 'Already in this round — wait for the draw',
    pickRange: 'Pick from 1 to {size}',
    numberTaken: 'Number already taken',
    needBirr: 'Need {fee} Birr (have {balance}). Deposit Telebirr to your wallet.',
    joined: 'Joined #{pick}. Play while you have balance.',
    cannotFill: 'Cannot fill',
    alreadyFull: 'Already full',
    filledBots: 'Bots disabled',
    alreadyDrawn: 'Already drawn — try again for a new round',
    roomNotFull: 'Room must be full',
    everyoneNeedsNumber: 'Everyone must pick a number',
    membersOnly: 'Members only',
    cryptoFailed: 'Crypto draw failed',
    drawError: 'Draw error',
    youWon:
      'You won! Received {pot} Birr (85% of pot) · #{num} · Admin fee {fee} Birr ({pct}%).{again}',
    otherWon:
      'Winning number {num} — {name} won ({pot} Birr) · Admin {fee} Birr (15%).{again}',
    playAgainHint: ' Pick a number to start a new round.',
    needMoreHint: ' Deposit more Telebirr for the next round.',
    needForRound: 'Need {fee} Birr for a new round (have {balance})',
    newRoundOpen: 'New round open — pick a number and play again',
    alreadyClaimed: 'Code already used',
    invalidCode: 'Invalid code',
    ownCode: 'Cannot use your own code',
    referralOk: 'Code saved',
    joinFailed: 'Join failed',
    joinedPick: 'Joined #{pick}',
    pickFirst: 'Pick your number first (1–{size})',
    openFailed: 'Could not open room',
  },
} as const;

export type MsgKey = keyof (typeof M)['en'];

let currentLocale: Locale = 'am';

export function setMsgLocale(locale: Locale) {
  currentLocale = locale;
}

export function msg(
  key: MsgKey,
  vars?: Record<string, string | number>,
): string {
  const table = M[currentLocale] || M.am;
  let s = String(table[key] ?? M.en[key] ?? key);
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      s = s.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
    }
  }
  return s;
}
