import express from "express";
import OpenAI from "openai";
import dotenv from "dotenv";
import fs from "fs";

dotenv.config();

const app = express();
app.use(express.json());

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Basahin ang mga listahan
const englishWords = fs.readFileSync("english_words.txt", "utf-8")
  .split("\n")
  .map(w => w.trim().toLowerCase())
  .filter(Boolean);

const badWords = fs.readFileSync("bad_words.txt", "utf-8")
  .split("\n")
  .map(w => w.trim().toLowerCase())
  .filter(Boolean);

// 🔹 Censor bad words
function censorBadWords(text) {
  let censored = text;
  badWords.forEach(word => {
    const regex = new RegExp(`\\b${word}\\b`, "gi");
    censored = censored.replace(regex, "**");
  });
  return censored;
}

// 🔹 Filipino core words at affixes (pinalawak)
const filipinoWords = [
  "ako", "ikaw", "siya", "kami", "tayo", "sila", "ay", "ng", "nang", "sa", "ang",
  "mga", "na", "ko", "mo", "si", "ni", "kay", "ito", "iyon", "doon", "dito",
  "nga", "rin", "din", "pa", "ba", "lang", "para", "habang", "wala", "meron",
  "may", "sobrang", "napaka", "pinaka", "tag", "pag", "mag", "mak", "ma", "pang"
];

// 🔹 Affixes para mas flexible
const filipinoAffixes = [
  "pag", "tag", "napaka", "pinaka", "mag", "ma", "mak", "pa", "pang", "ka"
];

// 🔹 Check kung may English words
function containsEnglish(text) {
  const words = text
    .toLowerCase()
    .replace(/[^a-zA-ZñÑ\s-]/g, "")
    .split(/\s+/)
    .filter(Boolean);
  return words.some(w => englishWords.includes(w));
}

// 🔹 Improved Filipino detection
function isMostlyFilipino(text) {
  const words = text
    .toLowerCase()
    .replace(/[^a-zA-ZñÑ\s-]/g, "")
    .split(/\s+/)
    .filter(Boolean);

  let filipinoCount = 0;

  for (const word of words) {
    if (
      filipinoWords.includes(word) ||
      filipinoAffixes.some(affix => word.startsWith(affix))
    ) {
      filipinoCount++;
    }
  }

  // ✅ At least 1 Filipino-like word + not majority English
  return filipinoCount >= 1 && filipinoCount >= words.length * 0.4;
}

// 🔹 Main endpoint
app.post("/suriin-gramar", async (req, res) => {
  try {
    let { pangungusap } = req.body;

    if (!pangungusap || pangungusap.trim() === "") {
      return res.status(400).send("Pakisulat muna ang pangungusap.");
    }

    if (badWords.some(w => pangungusap.toLowerCase().includes(w))) {
      return res.send("Bawal gumamit ng masasamang salita.");
    }

    // 🔹 Check if may halatang English (pero mas lenient)
    if (containsEnglish(pangungusap) && !isMostlyFilipino(pangungusap)) {
      return res.send("Filipino lamang ang pinapayagan.");
    }

    // 🔹 Rule: capital letter sa unang letra
    const unangLetra = pangungusap.trim().charAt(0);
    if (unangLetra === unangLetra.toLowerCase() && unangLetra.match(/[a-zA-Zñ]/i)) {
      const corrected = unangLetra.toUpperCase() + pangungusap.trim().slice(1);
      return res.send(`MALI: *${pangungusap.trim().split(" ")[0]}* \nTAMANG SAGOT: ${corrected}`);
    }

    pangungusap = censorBadWords(pangungusap);

    // 🔹 Send sa GPT for grammar + gitling check
    const completion = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      temperature: 0.1,
      max_tokens: 150,
      messages: [
        {
          role: "system",
          content: `
Ikaw ay isang eksperto sa gramatika **at ortograpiya** ng wikang Filipino.

Layunin:
Suriin ang pangungusap batay sa wastong bahagi ng pananalita (pantukoy, pangngalan, pandiwa, pang-ukol, pang-uri, pang-abay, pang-ugnay, atbp.), kayarian ng pangungusap (payak, tambalan, hugnayan, langkapan), **at wastong baybay o paggamit ng mga gitling (-)** ayon sa mga alituntunin ng Ortograpiyang Filipino ng Komisyon sa Wikang Filipino (KWF).

Gabay sa pagsusuri:
- Gamitin ang mga tuntunin ng bahagi ng pananalita at kayarian ng pangungusap upang matukoy kung tama o mali ang gramatika.
- Suriin ang wastong gamit ng pang-ukol, pang-ugnay, pang-uri, at pangngalan.
- **Suriin din ang tamang baybay at paggamit ng mga gitling (-):**
  - Walang gitling kapag ang unlapi ay sinusundan ng katinig.  (hal. *napakabait*, *taglamig*, *pinakamaganda*)
  - May gitling kapag ang unlapi ay sinusundan ng patinig.  (hal. *napaka-init*, *tag-init*, *pinaka-isa*)
  - Ituring na **MALI** ang mga salitang may maling paggamit ng gitling (hal. *napaka-bait*, *tag-lamig*).
- I-highlight lamang ang mga maling bahagi gamit ang *asterisk*.
- Ang sagot ay dapat nasa eksaktong format sa ibaba.

Format ng sagot:
Kung mali:
MALI: <lahat ng maling salita lang, bawat isa ay naka-asterisk at pinaghihiwalay ng kuwit>
TAMANG SAGOT: <tamang pangungusap, walang highlight>

Kung tama:
WALANG MALI
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
  console.log(`✅ Filipino Grammar Checker running sa http://localhost:${PORT}`);
});
