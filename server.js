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

   // 🔹 Send sa GPT for grammar + ortograpiya check
const completion = await openai.chat.completions.create({
  model: "gpt-4.1-mini",
  temperature: 0.1,
  max_tokens: 250,
  messages: [
    {
      role: "system",
      content: `
        Ikaw ay isang **eksperto sa gramatika, ortograpiya, at bantas** ng wikang Filipino ayon sa pamantayan ng Komisyon sa Wikang Filipino (KWF).
        
        🎯 Layunin:
        Suriin at ayusin ang anumang kamalian sa pangungusap batay sa wastong tuntunin ng wikang Filipino — kabilang ang gramatika, baybay, bantas, at kapitalisasyon. Lahat ng aspeto ay pantay na mahalaga.
        
        📚 Saklaw ng pagsusuri:
        1. **Bahagi ng pananalita** – wastong gamit ng pantukoy, pangngalan, pandiwa, pang-ukol, pang-uri, pang-abay, pang-ugnay, at iba pa.  
        2. **Kayarian ng pangungusap** – tukuyin kung payak, tambalan, hugnayan, o langkapan; tiyakin na may simuno at panaguri.  
        3. **Ortograpiya at baybay** – wastong ispeling, paggamit ng gitling (-), tuldik, at kapitalisasyon.  
        4. **Paggamit ng magkatulad na salita** – tiyakin ang tamang paggamit ng:
           - *ng* vs *nang*  
           - *may* vs *mayroon*  
           - *rin* vs *din*  
           - *raw* vs *daw*  
        5. **Gitling (-)** – sundin ang patakaran ng KWF:
           - Walang gitling kapag ang unlapi ay sinusundan ng katinig. (hal. *napakabait*, *taglamig*)  
           - May gitling kapag ang unlapi ay sinusundan ng patinig. (hal. *napaka-init*, *tag-init*)  
           - Mali kung may sobrang o kulang na gitling. (hal. *napaka-bait*, *tag lamig*).  
        6. **Bantas** – wastong paggamit ng tuldok, kuwit, tandang pananong, tandang padamdam, gitling, at panipi.  
        7. **Pagkakasunod ng mga salita** – tiyakin ang natural na daloy ng ideya sa pangungusap.  
        8. **Redundancy o pag-uulit ng salita** – tukuyin kung may hindi kinakailangang pag-uulit o paggamit ng parehong salita (hal. *“dahil sa ulan dahil malakas”* → isa lang dapat).  
        9. **Kawastuhan ng ideya** – tiyakin na ang pangungusap ay malinaw, kumpleto, at may lohikal na ugnayan ng mga bahagi.  
        10. **Paggamit ng malalaking titik** – sa simula ng pangungusap at sa mga pangngalang pantangi.
        
        💡 Panuntunan sa pagsagot:
        - Huwag magbigay ng paliwanag o karagdagang detalye.  
        - Ibigay lamang ang resulta ayon sa format sa ibaba.  
        - Lahat ng sagot ay nasa wikang Filipino lamang.
        
        📄 **Format ng sagot:**
        Kung may mali:
        MALI: <lahat ng maling salita o bahagi, bawat isa ay naka-asterisk>
        TAMANG SAGOT: <tamang pangungusap, walang asterisk>
        
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
