// Bundled starter decks.
//
// A brand-new marketplace looks abandoned; these ship with the app so the
// Discover tab and the public catalog always have quality content on day one.
// They're static data (no workspace owns them) — installing one clones it into
// the caller's workspace through the normal deck/card primitives, so plan
// limits, SRS and every downstream feature behave exactly as with user decks.

const D = (id, language, title, description, cards) => ({ id, language, title, description, cards });

export const STARTERS = [
  D("spanish-essentials", "Spanish", "Spanish essentials — first conversations", "The ten phrases you'll actually say in your first week: greetings, ordering, asking for help.", [
    { front: "¡Hola! ¿Cómo estás?", back: "Hi! How are you?", notes: "Informal. With strangers/elders use ¿Cómo está (usted)?" },
    { front: "Me llamo Ana, ¿y tú?", back: "My name is Ana, and you?", notes: "llamarse = to be called. Literally 'I call myself Ana'." },
    { front: "¿Puedes hablar más despacio, por favor?", back: "Can you speak more slowly, please?", notes: "despacio = slowly. Essential survival phrase." },
    { front: "No entiendo. ¿Puedes repetir?", back: "I don't understand. Can you repeat?", notes: "entender (e→ie): entiendo, entiendes…" },
    { front: "¿Cuánto cuesta esto?", back: "How much does this cost?", notes: "costar (o→ue). Also: ¿Cuánto es? at the till." },
    { front: "Quisiera un café con leche, por favor.", back: "I'd like a coffee with milk, please.", notes: "quisiera = polite 'I would like' (from querer)." },
    { front: "¿Dónde está la estación de tren?", back: "Where is the train station?", notes: "estar for location, ser for identity." },
    { front: "La cuenta, por favor.", back: "The bill, please.", notes: "In Spain you often add: cuando puedas — when you can." },
    { front: "Perdona, ¿me puedes ayudar?", back: "Excuse me, can you help me?", notes: "ayudar = to help. Formal: ¿me puede ayudar?" },
    { front: "¡Muchas gracias! Hasta luego.", back: "Thanks a lot! See you later.", notes: "Also: hasta mañana (see you tomorrow), hasta pronto." },
  ]),
  D("french-essentials", "French", "French essentials — first conversations", "Greetings, café orders and polite survival French for your first trip.", [
    { front: "Bonjour, comment allez-vous ?", back: "Hello, how are you?", notes: "Formal. With friends: Salut, ça va ?" },
    { front: "Je m'appelle Marie, et vous ?", back: "My name is Marie, and you?", notes: "s'appeler = to be called; reflexive." },
    { front: "Pouvez-vous parler plus lentement ?", back: "Can you speak more slowly?", notes: "lentement = slowly; pouvoir + infinitive." },
    { front: "Je ne comprends pas.", back: "I don't understand.", notes: "comprendre. Casual speech drops 'ne': je comprends pas." },
    { front: "C'est combien ?", back: "How much is it?", notes: "Also: Ça coûte combien ?" },
    { front: "Je voudrais un croissant, s'il vous plaît.", back: "I'd like a croissant, please.", notes: "je voudrais = polite conditional of vouloir." },
    { front: "Où est la gare, s'il vous plaît ?", back: "Where is the station, please?", notes: "où = where. Gare = train station." },
    { front: "L'addition, s'il vous plaît.", back: "The bill, please.", notes: "In cafés you can also mime signing — but say it too!" },
    { front: "Excusez-moi, pouvez-vous m'aider ?", back: "Excuse me, can you help me?", notes: "aider = to help; m' = me before a vowel." },
    { front: "Merci beaucoup ! À bientôt.", back: "Thank you very much! See you soon.", notes: "Also: à demain (see you tomorrow)." },
  ]),
  D("german-essentials", "German", "German essentials — first conversations", "The core phrases for greetings, shopping and getting unstuck in German.", [
    { front: "Hallo! Wie geht es dir?", back: "Hi! How are you?", notes: "Formal: Wie geht es Ihnen? Reply: Gut, danke!" },
    { front: "Ich heiße Max. Und du?", back: "My name is Max. And you?", notes: "heißen = to be called. Formal 'you' = Sie." },
    { front: "Können Sie bitte langsamer sprechen?", back: "Can you please speak more slowly?", notes: "langsamer = comparative of langsam (slow)." },
    { front: "Ich verstehe nicht.", back: "I don't understand.", notes: "verstehen. 'nicht' negates the verb." },
    { front: "Was kostet das?", back: "How much does that cost?", notes: "kosten. Also: Wie viel kostet das?" },
    { front: "Ich hätte gern einen Kaffee, bitte.", back: "I'd like a coffee, please.", notes: "hätte gern = polite 'would like'; einen = masc. accusative." },
    { front: "Wo ist der Bahnhof?", back: "Where is the train station?", notes: "der Bahnhof. Wo = where (location)." },
    { front: "Die Rechnung, bitte.", back: "The bill, please.", notes: "Or: Zahlen, bitte! (I'd like to pay, please)." },
    { front: "Entschuldigung, können Sie mir helfen?", back: "Excuse me, can you help me?", notes: "helfen takes the dative: mir (to me)." },
    { front: "Vielen Dank! Bis später.", back: "Thanks a lot! See you later.", notes: "Also: Bis morgen (see you tomorrow), Tschüss (bye)." },
  ]),
  D("italian-essentials", "Italian", "Italian essentials — first conversations", "Greetings, ordering and asking your way — the Italian you'll use immediately.", [
    { front: "Ciao! Come stai?", back: "Hi! How are you?", notes: "Informal. Formal: Come sta? Reply: Bene, grazie!" },
    { front: "Mi chiamo Luca, e tu?", back: "My name is Luca, and you?", notes: "chiamarsi = to be called; reflexive." },
    { front: "Puoi parlare più lentamente, per favore?", back: "Can you speak more slowly, please?", notes: "più + adverb = more …; lentamente = slowly." },
    { front: "Non capisco.", back: "I don't understand.", notes: "capire (-isc- verb): capisco, capisci…" },
    { front: "Quanto costa?", back: "How much does it cost?", notes: "costare. Plural: Quanto costano?" },
    { front: "Vorrei un cappuccino, per favore.", back: "I'd like a cappuccino, please.", notes: "vorrei = polite conditional of volere." },
    { front: "Dov'è la stazione?", back: "Where is the station?", notes: "dov'è = dove + è. Stazione = station." },
    { front: "Il conto, per favore.", back: "The bill, please.", notes: "At the bar you pay at the cassa (till) first." },
    { front: "Scusa, mi puoi aiutare?", back: "Excuse me, can you help me?", notes: "Formal: Scusi, mi può aiutare?" },
    { front: "Grazie mille! A presto.", back: "Thanks a lot! See you soon.", notes: "Also: a domani (see you tomorrow)." },
  ]),
  D("portuguese-essentials", "Portuguese", "Portuguese essentials — first conversations", "Everyday Brazilian Portuguese: greetings, café orders, directions.", [
    { front: "Oi! Tudo bem?", back: "Hi! How's it going?", notes: "Reply: Tudo bem! / Tudo ótimo. Universal opener in Brazil." },
    { front: "Meu nome é João. E você?", back: "My name is João. And you?", notes: "Also: Me chamo João." },
    { front: "Pode falar mais devagar, por favor?", back: "Can you speak more slowly, please?", notes: "devagar = slowly." },
    { front: "Não entendo.", back: "I don't understand.", notes: "entender. Past: não entendi (I didn't catch that)." },
    { front: "Quanto custa isso?", back: "How much does this cost?", notes: "custar. isso = this/that (near you)." },
    { front: "Eu queria um café, por favor.", back: "I'd like a coffee, please.", notes: "queria = polite imperfect of querer." },
    { front: "Onde fica a estação de trem?", back: "Where is the train station?", notes: "ficar is common for locations: onde fica…?" },
    { front: "A conta, por favor.", back: "The bill, please.", notes: "In Brazil service (10%) is usually included." },
    { front: "Com licença, pode me ajudar?", back: "Excuse me, can you help me?", notes: "com licença = excuse me (passing/attention)." },
    { front: "Muito obrigado! Até logo.", back: "Thanks a lot! See you soon.", notes: "Women say: obrigada. Also: até amanhã." },
  ]),
  D("japanese-essentials", "Japanese", "Japanese essentials — first conversations", "Polite, natural phrases for greetings, shopping and asking for help.", [
    { front: "こんにちは。お元気ですか？", back: "Hello. How are you?", notes: "o-genki desu ka. Reply: 元気です (genki desu)." },
    { front: "私はアンナです。よろしくお願いします。", back: "I'm Anna. Nice to meet you.", notes: "yoroshiku onegai shimasu — said when meeting someone." },
    { front: "もう少しゆっくり話してください。", back: "Please speak a little more slowly.", notes: "yukkuri = slowly; 〜てください = please do." },
    { front: "わかりません。", back: "I don't understand.", notes: "wakarimasen, from わかる (to understand)." },
    { front: "これはいくらですか？", back: "How much is this?", notes: "ikura = how much; これ = this." },
    { front: "コーヒーをひとつお願いします。", back: "One coffee, please.", notes: "〜をお願いします = please give me…; ひとつ = one (thing)." },
    { front: "駅はどこですか？", back: "Where is the station?", notes: "eki = station; どこ = where." },
    { front: "お会計をお願いします。", back: "The bill, please.", notes: "o-kaikei = the bill/check. Common in restaurants." },
    { front: "すみません、手伝ってもらえますか？", back: "Excuse me, could you help me?", notes: "tetsudau = to help; 〜てもらえますか = could you…for me?" },
    { front: "ありがとうございます。また明日！", back: "Thank you very much. See you tomorrow!", notes: "mata ashita = see you tomorrow; casual また！" },
  ]),
  D("korean-essentials", "Korean", "Korean essentials — first conversations", "Polite everyday Korean: greetings, cafés, directions and thanks.", [
    { front: "안녕하세요! 잘 지내세요?", back: "Hello! How are you?", notes: "annyeonghaseyo — the standard polite greeting." },
    { front: "저는 민수예요. 반갑습니다.", back: "I'm Minsu. Nice to meet you.", notes: "bangapseumnida = glad to meet you." },
    { front: "천천히 말해 주세요.", back: "Please speak slowly.", notes: "cheoncheonhi = slowly; 〜주세요 = please (do for me)." },
    { front: "잘 모르겠어요.", back: "I don't really understand / I'm not sure.", notes: "Softer than 몰라요; polite hedge." },
    { front: "이거 얼마예요?", back: "How much is this?", notes: "eolma = how much; 이거 = this (thing)." },
    { front: "아메리카노 한 잔 주세요.", back: "One americano, please.", notes: "han jan = one cup; 주세요 = please give me." },
    { front: "역이 어디예요?", back: "Where is the station?", notes: "yeok = station; eodi = where." },
    { front: "계산해 주세요.", back: "The bill, please.", notes: "gyesan = calculation/payment. Said at the till." },
    { front: "실례합니다, 좀 도와주시겠어요?", back: "Excuse me, could you help me?", notes: "sillyehamnida = excuse me; dowajuda = to help." },
    { front: "감사합니다! 내일 봐요.", back: "Thank you! See you tomorrow.", notes: "naeil bwayo. Casual: 내일 봐!" },
  ]),
  D("chinese-essentials", "Chinese", "Chinese essentials — first conversations", "Mandarin survival phrases with pinyin: greetings, shopping, help.", [
    { front: "你好！你好吗？", back: "Hello! How are you?", notes: "nǐ hǎo! nǐ hǎo ma? Reply: 我很好 (wǒ hěn hǎo)." },
    { front: "我叫小明，你呢？", back: "My name is Xiaoming, and you?", notes: "wǒ jiào… = I'm called…; 你呢 = and you?" },
    { front: "请说慢一点。", back: "Please speak a bit more slowly.", notes: "qǐng shuō màn yìdiǎn. 一点 = a little." },
    { front: "我听不懂。", back: "I don't understand (what I hear).", notes: "tīng bu dǒng — listening + not understand." },
    { front: "这个多少钱？", back: "How much is this?", notes: "zhège duōshao qián? 钱 = money." },
    { front: "我要一杯咖啡。", back: "I'd like a cup of coffee.", notes: "wǒ yào yì bēi kāfēi. 杯 = cup (measure word)." },
    { front: "火车站在哪里？", back: "Where is the train station?", notes: "huǒchēzhàn zài nǎlǐ? 在哪里 = where at?" },
    { front: "买单！", back: "The bill, please!", notes: "mǎidān — universal in restaurants." },
    { front: "不好意思，你能帮我吗？", back: "Excuse me, can you help me?", notes: "bù hǎoyìsi = excuse me; bāng = to help." },
    { front: "谢谢！明天见。", back: "Thank you! See you tomorrow.", notes: "xièxie! míngtiān jiàn." },
  ]),
];

/** Catalog view: everything except the card bodies. */
export function listStarters() {
  return STARTERS.map(({ cards, ...meta }) => ({ ...meta, cardCount: cards.length, starter: true }));
}

export function getStarter(id) {
  return STARTERS.find((s) => s.id === String(id || "")) || null;
}
