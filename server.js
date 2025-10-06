import express from "express";
import OpenAI from "openai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(express.json());

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Listahan ng bad words (pwede dagdagan pa)
const badWords = [
  
  // Common Filipino insults
  "tanga", "bobo", "gago", "ulol", "bwisit", "peste", "punyeta", "leche",
  "lintik", "putragis", "putik", "walanghiya", "tarantado", "hayop", "inutil",

  // Sexually explicit or vulgar terms
  "puki", "pekpek", "tite", "burat", "kantot", "jakol", "libog",
  "etits", "tamod", "bayag", "puwet", "ungas", "kupal", "pucha", "putcha",

  // English/Taglish profanity
  "fuck", "shit", "asshole", "motherfucker", "bastard", "dumbass", "slut", "whore",
  "bullshit", "crap", "dick", "cock", "fucker", "bitch",

  // Religious or offensive euphemisms
  "diyosko", "susmaryosep", "jesko", "inamomop", "anakng", "anakngtinapa",
  "anakngpating", "putang", "putangina", "ina", "ina mo", "putanginamo",

  // Variations & misspellings
  "pota", "puta", "potangina", "fck", "fak", "fucc", "sh1t", "b1tch", "tnga", "ggg", "ul0l",

  // Racist / discriminatory slurs (censored for safety)
  "n**ga", "n**ger", "ch*nk", "bumb*y", "ar*b", "ind**", "t**ga", "blacky","chingchong",
  "negra", "negro", "bakla", "tomboy", "retard", "mongol", "abo", "unggoy","bisaya","bisakol","tangalog",

  // Homophobic & body-shaming
  "bakla", "bading", "bayot", "tibo", "chaka", "panget", "pataygutom", "tabachoy","yobmot",
];



// Function: Check kung may bad words
function mayBadWords(text) {
  return badWords.some(word => text.toLowerCase().includes(word));
}

// Function: Check kung Filipino lang (basic check)
// Gumagamit ng simpleng pattern para makita kung may English
function tagalogLang(text) {
  const normalized = text.toLowerCase().replace(/[.,!?]/g, "");

  const englishWords = `
    hello|hi|hey|how|who|what|when|where|why|which|
    you|your|yours|are|is|am|was|were|be|been|being|
    the|this|that|these|those|a|an|and|but|or|if|then|
    there|here|their|they|them|he|she|it|we|us|our|
    my|me|mine|his|her|hers|its|do|does|did|done|make|
    go|went|come|say|said|see|saw|know|want|love|like|
    good|bad|morning|night|afternoon|friend|please|sorry|
    thank|thanks|welcome|ok|okay|sure|yes|no|maybe|because
  `.replace(/\s+/g, ""); // remove whitespace & newlines

  const englishPattern = new RegExp(`\\b(${englishWords})\\b`, "i");

  return !englishPattern.test(normalized);
}


// Endpoint: Suriin ang gramatika
app.post("/suriin-gramar", async (req, res) => {
  try {
    const { pangungusap } = req.body;

    if (!pangungusap || pangungusap.trim() === "") {
      return res.status(400).send("Walang laman ang pangungusap.");
    }

    // 🚫 Check kung may bad words
    if (mayBadWords(pangungusap)) {
      return res.status(400).send("Bawal gumamit ng masasamang salita.");
    }

    //  Check kung Filipino lang
    if (!tagalogLang(pangungusap)) {
      return res.status(400).send("Bawal mag-English o ibang wika, Filipino lang ang tanggap.");
    }

    // Proceed kay OpenAI kung pasado
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `
Ikaw ay isang tagasuri ng gramatika sa wikang Filipino.
Layunin mong tukuyin at itama ang LAHAT ng maling bahagi sa pangungusap.

Gamitin lamang ang format na ito:

MALI: <*lahat ng maling bahagi*>  
TAMANG SAGOT: <buong tamang pangungusap>

Mga Tagubilin:
- Kung higit sa isa ang mali, ilista lahat ng maling bahagi, pinaghiwalay ng kuwit (hal. *Ako*, *kain*, *ng*).
- Lahat ng maling bahagi ay naka-bold (*text*).
- Walang karagdagang paliwanag, JSON, o ibang teksto.
- Kung WALANG MALI, magbalik ng blangko (walang output).`
        },
        { role: "user", content: pangungusap }
      ],
      temperature: 0,
      max_tokens: 100
    });

    const tugon = completion.choices[0].message.content.trim();

    // ➤ Walang mali → walang output (204)
    if (!tugon || tugon.toLowerCase().includes("walang mali")) {
      return res.status(204).send();
    }

    // ➤ Ibalik plain text lang
    res.type("text/plain").send(tugon);

  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Server tumatakbo sa http://localhost:${PORT}`);
});
