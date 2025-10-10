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

// 🔹 Basahin ang mga listahan
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

// 🔹 Filipino core words at affixes
const filipinoWords = [
  "ako", "ikaw", "siya", "kami", "tayo", "sila", "ay", "ng", "nang", "sa", "ang",
  "mga", "na", "ko", "mo", "si", "ni", "kay", "ito", "iyon", "doon", "dito",
  "nga", "rin", "din", "pa", "ba", "lang", "para", "habang", "wala", "meron",
  "may", "sobrang", "napaka", "pinaka", "tag", "pag", "mag", "mak", "ma", "pang",
  "at", "ngunit", "subalit", "dahil", "kung", "kapag", "sapagkat", "upang"
];

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

  return filipinoCount >= 1 && filipinoCount >= words.length * 0.4;
}

function correctHyphens(sentence) {
  const affixes = ["tag", "napaka", "pinaka", "pang", "pa", "mag", "ma", "mak"];

  return sentence.replace(/\b[\w-]+\b/g, (word) => {
    let original = word;
    let lower = word.toLowerCase();

    for (let affix of affixes) {
      if (lower.startsWith(affix)) {
        let rest = original.slice(affix.length).replace(/^-/, ""); // tanggalin existing dash

        if (!rest) return original; // solo affix, walang change

        const firstChar = rest[0];
        if ("aeiouAEIOU".includes(firstChar)) {
          return affix + "-" + rest; // patinig → may dash
        } else {
          return affix + rest; // katinig → walang dash
        }
      }
    }

    return original;
  });
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

    if (containsEnglish(pangungusap) && !isMostlyFilipino(pangungusap)) {
      return res.send("Filipino lamang ang pinapayagan.");
    }

    const unangLetra = pangungusap.trim().charAt(0);
    if (unangLetra === unangLetra.toLowerCase() && unangLetra.match(/[a-zA-Zñ]/i)) {
      const corrected = unangLetra.toUpperCase() + pangungusap.trim().slice(1);
      return res.send(`MALI: *${pangungusap.trim().split(" ")[0]}* \nTAMANG SAGOT: ${corrected}`);
    }

    pangungusap = censorBadWords(pangungusap);
    pangungusap = correctHyphens(pangungusap);

    const completion = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      temperature: 0.1,
      max_tokens: 250,
      messages: [
        {
          role: "system",
          content: `
Ikaw ay eksperto sa gramatika at ortograpiya ng wikang Filipino.

Saklaw ng pagsusuri:
1. Bahagi ng pananalita – tiyakin ang wastong gamit ng pantukoy, pangngalan, pandiwa, pang-ukol, pang-uri, pang-abay, pang-ugnay, atbp.
2. Kayarian ng pangungusap – payak, tambalan, hugnayan, o langkapan.
3. Ortograpiya – wastong baybay, paggamit ng gitling (-), at wastong kapitalisasyon.
4. Gamit ng mga salitang magkatulad:
   - ng vs nang
   - may vs mayroon
   - rin vs din
   - raw vs daw
5. **Gitling (-)** – sundin ang patakaran ng KWF:
   - Walang gitling kapag ang unlapi ay sinusundan ng katinig. (hal. napakabait, taglamig)
   - May gitling kapag ang unlapi ay sinusundan ng patinig. (hal. napaka-init, tag-init)
   - Mali kung may sobrang o kulang na gitling. (hal. napaka-bait, tag lamig)
6. Bantas at baybay – wastong gamit ng tuldok, kuwit, tandang pananong, at tandang padamdam.
7. Simuno at panaguri – tiyakin na kumpleto ang pangungusap.
8. Tamang pagkakasunod ng salita.
9. Wastong paggamit ng malalaking titik.

Format ng sagot:
Kung mali:
MALI: <lahat ng maling salita o bahagi, bawat isa ay naka-asterisk>
TAMANG SAGOT: <tamang pangungusap, walang asterisk>

Kung tama:
WALANG MALI

Lahat ng sagot ay nasa wikang Filipino lamang.
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
