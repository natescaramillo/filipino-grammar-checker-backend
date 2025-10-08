import express from "express";
import OpenAI from "openai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(express.json());

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Listahan ng masasamang salita
const badWords = [
  "tanga", "bobo", "gago", "ulol", "bwisit", "peste", "punyeta",
  "putangina", "puta", "kantot", "tite", "burat", "libog",
  "fuck", "shit", "bitch", "asshole", "motherfucker"
];

// Palitan ng ** ang masasamang salita
function censorBadWords(text) {
  let censored = text;
  badWords.forEach(word => {
    const regex = new RegExp(`\\b${word}\\b`, "gi");
    censored = censored.replace(regex, "**");
  });
  return censored;
}

// Tukuyin kung Filipino ang pangungusap
function mostlyFilipino(text) {
  const filipinoWords = [
    "ako", "ikaw", "siya", "kami", "tayo", "sila", "ay", "ng", "sa", "ang",
    "mga", "na", "ko", "mo", "si", "ni", "kay", "ito", "iyon", "doon",
    "dito", "nga", "rin", "din", "pa", "ba", "lang", "nang", "para", "habang"
  ];
  let count = 0;
  filipinoWords.forEach(w => {
    if (text.toLowerCase().includes(w)) count++;
  });
  return count >= 2;
}

// Tukuyin kung may English word
function containsEnglish(text) {
  const englishPattern = /\b(the|is|are|was|were|am|you|he|she|they|we|it|this|that|what|when|where|why|how|can|will|shall|do|did|does|yes|no|of|to|from|and|or|not|on|in|for)\b/i;
  return englishPattern.test(text);
}

// Pangunahing endpoint
app.post("/suriin-gramar", async (req, res) => {
  try {
    let { pangungusap } = req.body;

    if (!pangungusap || pangungusap.trim() === "") {
      return res.status(400).send("Pakisulat muna ang pangungusap.");
    }

    if (badWords.some(w => pangungusap.toLowerCase().includes(w))) {
      return res.send("Bawal gumamit ng masasamang salita.");
    }
    
    if (containsEnglish(pangungusap) || !mostlyFilipino(pangungusap)) {
      return res.send("Filipino lamang ang pinapayagan.");
    }

    pangungusap = censorBadWords(pangungusap);

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.1,
      max_tokens: 100,
      messages: [
        {
          role: "system",
          content: `
Ikaw ay isang eksperto sa gramatika ng wikang Filipino.

Layunin:
Suriin ang pangungusap batay sa wastong bahagi ng pananalita (pantukoy, pangngalan, pandiwa, pang-ukol, pang-uri, pang-abay, pang-ugnay, atbp.) at kayarian ng pangungusap (payak, tambalan, hugnayan, langkapan).

Gabay sa pagsusuri:
- Gamitin ang mga tuntunin ng bahagi ng pananalita at kayarian ng pangungusap upang matukoy kung tama o mali ang gramatika.
- Siguraduhing may tamang pantukoy, panaguri, at simuno.
- Suriin ang wastong gamit ng pang-ukol, pang-ugnay, at pang-uri.
- Huwag ilista o banggitin ang mga bahagi o kayarian sa output. Gamitin lamang ito bilang batayan.
- I-highlight (gamitin ang asterisk) *LAMANG* ang maling bahagi ng pangungusap.
- Ang tamang sagot ay dapat plain text, walang asterisk o formatting.

Format ng sagot:
Kung mali:
MALI: <*maling bahagi lang naka-asterisk*>
TAMANG SAGOT: <tamang pangungusap, walang highlight>

Kung tama:
WALANG MALI

Lahat ng sagot ay dapat nasa wikang Filipino lamang.
`
        },
        { role: "user", content: pangungusap }
      ]
    });

    const output = completion.choices[0].message.content.trim();
    res.type("text/plain").send(output);

  } catch (err) {
    console.error("Error:", err);
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Filipino Grammar Checker running sa http://localhost:${PORT}`);
});
