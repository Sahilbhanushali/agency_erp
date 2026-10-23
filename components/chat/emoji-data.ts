/**
 * The emoji the picker offers, with words to search them by.
 *
 * ponytail: a curated ~300 native emoji rather than an emoji library — no dependency,
 * a few KB, and they render with the device's own font. Flags and keycaps are left out
 * on purpose: the reactions endpoint only accepts pictographic emoji, and the same
 * picker feeds both. Add a line here to offer another one.
 *
 * Format: "<emoji> <keywords…>" — the first keyword is the accessible name.
 */
const RAW: Record<string, string[]> = {
  Smileys: [
    "😀 grinning happy smile", "😃 smiley happy joy", "😄 smile happy laugh", "😁 grin beaming teeth",
    "😆 laughing haha", "😅 sweat smile relief", "🤣 rofl rolling laughing", "😂 joy tears laughing lol",
    "🙂 slight smile", "🙃 upside down silly", "😉 wink", "😊 blush happy shy", "😇 innocent angel halo",
    "🥰 love hearts adore", "😍 heart eyes love", "🤩 star struck wow excited", "😘 kiss blow", "😗 kissing",
    "😚 kiss closed eyes", "😋 yum tasty delicious", "😛 tongue playful", "😜 wink tongue crazy", "🤪 zany crazy goofy",
    "😝 squint tongue", "🤑 money rich dollar", "🤗 hug hugging", "🤭 oops giggle hand mouth", "🤫 shush quiet secret",
    "🤔 thinking hmm wonder", "🫡 salute respect yes sir", "🤐 zipper mouth secret", "🤨 raised eyebrow suspicious",
    "😐 neutral meh", "😑 expressionless blank", "😶 no mouth speechless", "😏 smirk", "😒 unamused annoyed",
    "🙄 eye roll whatever", "😬 grimace awkward yikes", "😮‍💨 exhale relief phew", "🤥 lying pinocchio",
    "😌 relieved calm", "😔 pensive sad", "😪 sleepy tired", "🤤 drool", "😴 sleeping zzz", "😷 mask sick",
    "🤒 fever thermometer ill", "🤕 hurt bandage", "🤢 nauseated sick green", "🤮 vomit", "🥵 hot heat sweating",
    "🥶 cold freezing", "🥴 woozy dizzy", "😵 dizzy knocked out", "🤯 mind blown exploding", "🤠 cowboy",
    "🥳 party celebrate birthday", "😎 cool sunglasses", "🤓 nerd geek glasses", "🧐 monocle inspect",
    "😕 confused", "😟 worried", "🙁 frown sad", "😮 open mouth wow surprised", "😯 hushed surprised",
    "😲 astonished shocked", "😳 flushed embarrassed", "🥺 pleading puppy eyes please", "🥹 holding back tears grateful",
    "😦 frowning open mouth", "😧 anguished", "😨 fearful scared", "😰 anxious sweat", "😥 sad relieved",
    "😢 cry tear sad", "😭 sob crying loudly", "😱 scream fear shocked", "😖 confounded", "😣 persevere struggle",
    "😞 disappointed", "😓 downcast sweat", "😩 weary tired", "😫 tired exhausted", "🥱 yawn bored",
    "😤 triumph huff frustrated", "😡 angry pouting mad", "😠 angry mad", "🤬 cursing swearing", "😈 devil smiling",
    "💀 skull dead lol", "💩 poop", "🤡 clown", "👻 ghost boo", "👽 alien", "🤖 robot bot",
  ],
  People: [
    "👍 thumbs up like yes ok approve", "👎 thumbs down dislike no", "👌 ok perfect", "🤌 pinched fingers italian",
    "✌️ victory peace", "🤞 fingers crossed luck hope", "🤟 love you", "🤘 rock on", "🤙 call me shaka",
    "👈 point left", "👉 point right", "👆 point up", "👇 point down", "☝️ index up one", "✋ raised hand stop high five",
    "🖐️ hand fingers", "👋 wave hello hi bye", "🤚 raised back hand", "👏 clap applause well done bravo",
    "🙌 raised hands hooray celebrate", "🫶 heart hands love", "👐 open hands", "🤲 palms up", "🤝 handshake deal agreement",
    "🙏 pray please thanks thank you namaste", "✍️ writing", "💪 muscle strong flex power", "🫵 you point",
    "👀 eyes look see watching", "👁️ eye", "🧠 brain smart think", "🫂 hug people", "🗣️ speaking",
    "👶 baby", "🧑 person", "👨 man", "👩 woman", "🧑‍💻 technologist coder developer laptop", "🧑‍🎨 artist designer",
    "🧑‍💼 office worker manager", "🕺 dancing man", "💃 dancing woman", "🤷 shrug dunno whatever", "🤦 facepalm",
    "🙋 raising hand question", "🙅 no gesture", "🙆 ok gesture", "💁 tipping hand info",
  ],
  Hearts: [
    "❤️ red heart love", "🧡 orange heart", "💛 yellow heart", "💚 green heart", "💙 blue heart", "💜 purple heart",
    "🖤 black heart", "🤍 white heart", "🤎 brown heart", "💔 broken heart", "❤️‍🔥 heart on fire passion",
    "💕 two hearts", "💞 revolving hearts", "💓 beating heart", "💗 growing heart", "💖 sparkling heart",
    "💘 heart arrow cupid", "💝 heart gift ribbon", "💯 hundred perfect score 100", "💢 anger", "💥 boom collision",
    "💫 dizzy star", "💦 sweat drops", "💨 dash fast", "💬 speech bubble comment", "💭 thought bubble", "💤 zzz sleep",
  ],
  Work: [
    "🎉 tada party celebrate congrats", "🎊 confetti celebrate", "🥂 cheers toast", "🍾 champagne celebrate",
    "🎂 birthday cake", "🎁 gift present", "🏆 trophy win award champion", "🥇 gold medal first", "🏅 medal",
    "🎯 target goal bullseye", "🚀 rocket launch ship fast", "🔥 fire hot lit trending", "⭐ star", "🌟 glowing star",
    "✨ sparkles magic new", "⚡ lightning fast energy", "💡 idea bulb light", "📌 pin pushpin", "📍 location pin",
    "📎 paperclip attachment", "📝 memo note write", "✏️ pencil edit", "🖊️ pen", "📄 document page", "📑 tabs documents",
    "📊 bar chart stats report", "📈 chart up growth increase", "📉 chart down decrease", "🗂️ dividers folder",
    "📁 folder", "📂 open folder", "🗓️ calendar schedule", "📅 date calendar", "⏰ alarm clock deadline", "⏳ hourglass wait",
    "⌛ hourglass done time", "🕐 clock time", "📞 phone call", "📱 mobile phone", "💻 laptop computer", "🖥️ desktop computer",
    "⌨️ keyboard", "🖱️ mouse", "🖨️ printer", "📷 camera photo", "📸 camera flash", "🎥 movie camera video",
    "🎬 clapper film", "🎨 palette art design", "🖌️ paintbrush", "🖼️ framed picture", "📣 megaphone announce",
    "📢 loudspeaker announcement", "🔔 bell notification", "🔕 no bell mute", "📧 email", "✉️ envelope mail",
    "📨 incoming envelope", "📦 package box delivery", "🔗 link", "🔒 locked secure", "🔓 unlocked", "🔑 key",
    "🛠️ tools fix", "🔧 wrench fix", "⚙️ gear settings", "🧩 puzzle", "💼 briefcase work business", "💰 money bag",
    "💵 dollar cash", "💳 credit card payment", "🧾 receipt invoice bill", "🏢 office building", "☕ coffee tea break",
    "🍕 pizza", "🍔 burger", "🍟 fries", "🍩 donut", "🍪 cookie", "🍫 chocolate", "🍰 cake slice", "🍿 popcorn",
    "🍎 apple", "🍌 banana", "🍉 watermelon", "🥭 mango", "🍵 tea", "🥤 drink soda", "🍺 beer", "🍻 cheers beers",
  ],
  Nature: [
    "☀️ sun sunny", "🌤️ sun cloud", "⛅ cloudy", "🌧️ rain", "⛈️ storm thunder", "❄️ snow cold", "🌈 rainbow",
    "🌙 moon night", "🌍 earth world globe", "🌊 wave ocean", "🌸 cherry blossom flower", "🌹 rose", "🌻 sunflower",
    "🌷 tulip", "🌱 seedling grow plant", "🌿 herb leaf", "🍀 four leaf clover luck", "🌴 palm tree", "🌵 cactus",
    "🍁 maple leaf autumn", "🐶 dog puppy", "🐱 cat kitten", "🐭 mouse", "🐰 rabbit bunny", "🦊 fox", "🐻 bear",
    "🐼 panda", "🐨 koala", "🐯 tiger", "🦁 lion", "🐮 cow", "🐷 pig", "🐸 frog", "🐵 monkey", "🙈 see no evil",
    "🙉 hear no evil", "🙊 speak no evil", "🐔 chicken", "🐧 penguin", "🦄 unicorn", "🐝 bee", "🦋 butterfly",
    "🐢 turtle slow", "🐍 snake", "🐙 octopus", "🐬 dolphin", "🐳 whale", "🦖 dinosaur t-rex",
  ],
  Symbols: [
    "✅ check done complete yes", "☑️ checkbox", "✔️ check mark", "❌ cross no wrong cancel", "❎ cross button",
    "⭕ circle", "❗ exclamation important", "❓ question", "⁉️ interrobang", "‼️ double exclamation", "⚠️ warning caution",
    "🚫 prohibited no", "⛔ no entry stop", "🔴 red circle", "🟠 orange circle", "🟡 yellow circle", "🟢 green circle",
    "🔵 blue circle", "🟣 purple circle", "⚫ black circle", "⚪ white circle", "🔺 red triangle up", "🔻 red triangle down",
    "➡️ right arrow", "⬅️ left arrow", "⬆️ up arrow", "⬇️ down arrow", "🔄 repeat refresh", "🔁 loop", "➕ plus add",
    "➖ minus", "✖️ multiply", "♻️ recycle", "🆕 new", "🆗 ok button", "🆒 cool button", "🆙 up button", "🔝 top",
    "🔜 soon", "💲 dollar sign", "🚗 car", "🚕 taxi", "🚌 bus", "🚆 train", "✈️ airplane flight travel", "🏖️ beach holiday",
    "🏠 home house", "🏁 finish flag", "🚩 red flag", "🎮 game controller", "🎵 music note", "🎶 music notes",
    "🎧 headphones", "⚽ football soccer", "🏏 cricket", "🏀 basketball",
  ],
}

export interface EmojiEntry {
  emoji: string
  name: string
  keywords: string
}

export const EMOJI_CATEGORIES: { label: string; icon: string; emojis: EmojiEntry[] }[] = Object.entries(RAW).map(
  ([label, rows]) => ({
    label,
    icon: rows[0].split(" ")[0],
    emojis: rows.map((row) => {
      const [emoji, ...words] = row.split(" ")
      return { emoji, name: words[0] ?? emoji, keywords: words.join(" ") }
    }),
  }),
)

export const ALL_EMOJI: EmojiEntry[] = EMOJI_CATEGORIES.flatMap((c) => c.emojis)

/** A message that is nothing but 1–3 emoji, shown large the way messaging apps do. */
export function isEmojiOnly(text: string | null | undefined): boolean {
  if (!text) return false
  const t = text.trim()
  if (!t || t.length > 24) return false
  if (!/^(?:\p{Extended_Pictographic}|\p{Emoji_Modifier}|‍|️|\s)+$/u.test(t)) return false
  const count = [...new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(t.replace(/\s/g, ""))].length
  return count >= 1 && count <= 3
}
