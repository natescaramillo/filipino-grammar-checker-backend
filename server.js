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
  "may", "sobrang", "napaka", "pinaka", "tag", "pag", "mag", "mak", "ma", "pang",
  "at", "ngunit", "subalit", "dahil", "kung", "kapag", "sapagkat", "upang"
];

// 🔹 Affixes para mas flexible
const filipinoAffixes = [
  "pag", "tag", "napaka", "pinaka", "mag", "ma", "mak", "pa", "pang", "ka"
];

function containsEnglish(text) {
  const words = text
    .toLowerCase()
    .replace(/[^a-zñ\s-]/g, "") // remove non-letters
    .split(/\s+/)
    .filter(Boolean);

  // exclude Filipino connectors like "at", "sa", "ang" etc.
  const filipinoCommonWords = ["at", "ng", "nang", "sa", "ang", "mga", "ay", "ko", "mo", "si", "ni", "kay"];

  return words.some(
    w => englishWords.includes(w) && !filipinoCommonWords.includes(w)
  );
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
// 🔹 Detect nonsense o paulit-ulit na pattern
function isNonsenseOrRepetitive(text) {
  const lower = text.toLowerCase().replace(/[^\w\sñ]/g, "");
  const words = lower.split(/\s+/).filter(Boolean);

  // Paulit-ulit na eksaktong parirala (hal. "tagumpay at sipag tagumpay at sipag")
  const phraseRepeat = /(\b[\wñ\s]+\b)\1/i;
  if (phraseRepeat.test(lower)) return true;

  // Paulit-ulit na parehong salita o parirala
  const repeatedPattern = /(ang|si|ng|ay|ako|ikaw|ko|mga)\s+\1/i;
  if (repeatedPattern.test(lower)) return true;

  // Sobrang dami ng inuulit na salita
  const uniqueWords = new Set(words);
  if (uniqueWords.size < words.length * 0.5) return true;

  // Kulang sa simuno o panaguri
  if (words.length < 3) return true;

  return false;
}


// 🔹 Main endpoint
app.post("/suriin-gramar", async (req, res) => {
  try {
    let { pangungusap } = req.body;

    if (!pangungusap || pangungusap.trim() === "") {
      return res.status(400).send("Pakisulat muna ang pangungusap.");
    }

    if (badWords.some(w => pangungusap.toLowerCase().includes(w))) {
      return res.send("Bawal gumamit ng masasamang salita o salitang balbal.");
    }

    // 🔹 Check if may halatang English (pero mas lenient)
    const hasEnglish = containsEnglish(pangungusap);
const mostlyFilipino = isMostlyFilipino(pangungusap);

if (hasEnglish && !mostlyFilipino) {
  return res.send("Filipino lamang ang pinapayagan.");
}

        // 🔹 Check nonsense or repetitive
    if (isNonsenseOrRepetitive(pangungusap)) {
      return res.send("Hindi maayos ang pangungusap mo.");
    }

    // 🔹 Rule: capital letter sa unang letra
    const unangLetra = pangungusap.trim().charAt(0);
    if (unangLetra === unangLetra.toLowerCase() && unangLetra.match(/[a-zA-Zñ]/i)) {
      const corrected = unangLetra.toUpperCase() + pangungusap.trim().slice(1);
      return res.send(`MALI: *${pangungusap.trim().split(" ")[0]}* \nTAMANG SAGOT: ${corrected}`);
    }

    pangungusap = censorBadWords(pangungusap);

    // 🔹 Send sa GPT for grammar + ortograpiya check
    const completion = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      temperature: 0.1,
      max_tokens: 250,
      messages: [
        {
          role: "system",
          content: `
Ikaw ay isang eksperto sa gramatika **at ortograpiya** ng wikang Filipino.

Layunin:
Suriin ang pangungusap batay sa lahat ng tuntunin sa **gramatika, ortograpiya, at bantas** ng wikang Filipino ayon sa Komisyon sa Wikang Filipino (KWF). 
Kasama ring suriin kung *makatwiran at may saysay* ang pangungusap — dapat may malinaw na simuno at panaguri, may lohikal na pagkakasunod, at hindi paulit-ulit o walang ugnayan ang mga salita.

Saklaw ng pagsusuri:
1. **Bahagi ng pananalita** – tiyakin ang wastong gamit ng pantukoy, pangngalan, pandiwa, pang-ukol, pang-uri, pang-abay, pang-ugnay, atbp.
2. **Kayarian ng pangungusap** – payak, tambalan, hugnayan, o langkapan.
3. **Ortograpiya** – wastong baybay, paggamit ng gitling (-), at wastong kapitalisasyon.
4. **Gamit ng mga salitang magkatulad**:
   - *ng* vs *nang* (hal. “Tumakbo **nang** mabilis.”)
   - *may* vs *mayroon* (hal. “**Mayroon** siyang pera.”)
   - *rin* vs *din* (batay sa tunog)
   - *raw* vs *daw* (batay sa tunog)
5. **Gitling (-)** ayon sa KWF:
   - Walang gitling kapag ang unlapi ay sinusundan ng katinig.  (hal. *napakabait*, *taglamig*, *pinakamaganda*)
   - May gitling kapag ang unlapi ay sinusundan ng patinig.  (hal. *napaka-init*, *tag-init*, *pinaka-isa*)
   - Mali ang may maling gitling (hal. *napaka-bait*, *tag-lamig*).
6. **Bantas at baybay** – wastong gamit ng tuldok, kuwit, tandang pananong, at tandang padamdam.
7. **Simuno at panaguri** – tiyakin na kumpleto ang pangungusap.
8. **Tamang pagkakasunod ng mga salita** – ayusin kung may baluktot o di-natural na pagkakasunod.
9. **Wastong paggamit ng malalaking titik** sa simula ng pangungusap at sa pangngalang pantangi.
10. **Lohika at saysay ng pangungusap** – kung ang pangungusap ay walang malinaw na kahulugan, paulit-ulit, o walang koneksyon ang mga salita.
11. Kung may mali, ibalik lamang ang format sa ibaba.
12. Huwag magbigay ng anumang paliwanag o detalye.

Format ng sagot:
Kung mali:
MALI: <lahat ng maling salita o bahagi, bawat isa ay naka-asterisk>
TAMANG SAGOT: <tamang pangungusap, walang asterisk>

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
  console.log(`✅ Filipino Grammar Checker running sa http://localhost:${PORT}`);
});
