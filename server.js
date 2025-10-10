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

// 🔹 Load lists
const englishWords = fs.readFileSync("english_words.txt", "utf-8")
  .split("\n")
  .map(w => w.trim().toLowerCase())
  .filter(Boolean);

const badWords = fs.readFileSync("bad_words.txt", "utf-8")
  .split("\n")
  .map(w => w.trim().toLowerCase())
  .filter(Boolean);

// 🔹 Filipino core words and affixes
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

// 🔹 Basic word filters
function censorBadWords(text) {
  let censored = text;
  badWords.forEach(word => {
    const regex = new RegExp(`\\b${word}\\b`, "gi");
    censored = censored.replace(regex, "**");
  });
  return censored;
}

function containsEnglish(text) {
  const words = text
    .toLowerCase()
    .replace(/[^a-zA-ZñÑ\s-]/g, "")
    .split(/\s+/)
    .filter(Boolean);
  return words.some(w => englishWords.includes(w));
}

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

// 🔹 Main endpoint
app.post("/suriin-gramar", async (req, res) => {
  try {
    let { pangungusap } = req.body;

    if (!pangungusap || pangungusap.trim() === "") {
      return res.status(400).send("Pakisulat muna ang pangungusap.");
    }

    // Normalize text
    pangungusap = pangungusap
      .replace(/\s+/g, " ") // remove double spaces
      .replace(/([a-z])([A-Z])/g, "$1 $2") // spacing between letters if needed
      .replace(/-+/g, "-") // normalize multiple hyphens
      .trim();

    // Censor bad words
    pangungusap = censorBadWords(pangungusap);

    // Reject English sentences unless mostly Filipino
    if (containsEnglish(pangungusap) && !isMostlyFilipino(pangungusap)) {
      return res.send("Filipino lamang ang pinapayagan.");
    }

    // Check for repeated words (e.g. “mali mali”)
    const repeatMatch = pangungusap.match(/\b(\w+)\s+\1\b/i);
    if (repeatMatch) {
      return res.send(
        `MALI: *${repeatMatch[1]} ${repeatMatch[1]}*\nTAMANG SAGOT: alisin ang pag-uulit ng salita.`
      );
    }

    // Capitalization rule
    const unangLetra = pangungusap.charAt(0);
    if (unangLetra === unangLetra.toLowerCase() && unangLetra.match(/[a-zA-Zñ]/i)) {
      const corrected = unangLetra.toUpperCase() + pangungusap.slice(1);
      return res.send(
        `MALI: *${pangungusap.trim().split(" ")[0]}*\nTAMANG SAGOT: ${corrected}`
      );
    }

    // 🔹 Grammar + orthography check via GPT
    const completion = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      temperature: 0.1,
      max_tokens: 250,
      messages: [
        {
          role: "system",
          content: `
Ikaw ay isang eksperto sa gramatika at ortograpiya ng wikang Filipino.

Layunin: Suriin ang pangungusap batay sa lahat ng tuntunin sa gramatika, ortograpiya, at bantas ayon sa KWF.

Saklaw ng pagsusuri:
1. Bahagi ng pananalita (pantukoy, pangngalan, pandiwa, pang-ukol, pang-uri, pang-abay, pang-ugnay, atbp)
2. Kayarian ng pangungusap (payak, tambalan, hugnayan, langkapan)
3. Ortograpiya (baybay, gitling, kapitalisasyon)
4. Gamit ng mga salitang magkatulad (ng/nang, may/mayroon, rin/din, raw/daw)
5. Paggamit ng Gitling (-) ayon sa KWF:
   - Walang gitling kapag ang unlapi ay sinusundan ng katinig.  
     ✅ napakabait, taglamig, pinakamaganda
   - May gitling kapag ang unlapi ay sinusundan ng patinig.  
     ✅ napaka-init, tag-init, pinaka-isa
   - Mali kapag may gitling kahit katinig ang kasunod.  
     ❌ napaka-bait, pag-pili, pag-laro
   - Mali rin kung walang gitling kahit patinig ang kasunod.  
     ❌ napakainit, taginit, pinakaisa
6. Bantas, baybay, at wastong gamit ng mga salita.
7. Simuno at panaguri – tiyakin na kumpleto ang pangungusap.
8. Wastong pagkakasunod ng mga salita.
9. Malalaking titik sa simula ng pangungusap at pangngalang pantangi.

Format ng sagot:
Kung mali:
MALI: <lahat ng maling bahagi, bawat isa ay naka-asterisk>
TAMANG SAGOT: <tamang pangungusap>

Kung tama:
WALANG MALI

Lahat ng sagot ay nasa wikang Filipino.
`
        },
        {
          role: "assistant",
          content: "Tandaan: Palaging gamitin ang eksaktong format — MALI o WALANG MALI lamang."
        },
        { role: "user", content: pangungusap }
      ]
    });

    const output = completion.choices[0].message.content.trim();
    res.type("text/plain").send(output);
  } catch (err) {
    console.error("❌ Error:", err);
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Filipino Grammar Checker running sa http://localhost:${PORT}`);
});
