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

// 🔹 Word Lists
const englishWords = fs.readFileSync("english_words.txt", "utf-8")
  .split("\n").map(w => w.trim().toLowerCase()).filter(Boolean);

const badWords = fs.readFileSync("bad_words.txt", "utf-8")
  .split("\n").map(w => w.trim().toLowerCase()).filter(Boolean);

// 🔹 Filipino Core Words & Affixes
const filipinoWords = [
  "ako","ikaw","siya","kami","tayo","sila","ay","ng","nang","sa","ang","mga","na",
  "ko","mo","si","ni","kay","ito","iyan","iyon","doon","dito","nga","rin","din",
  "pa","ba","lang","para","habang","wala","meron","may","sobrang","napaka","pinaka",
  "tag","pag","mag","mak","ma","pang","at","ngunit","subalit","dahil","kung","kapag",
  "sapagkat","upang","kasi","pero","kahit","lalo","maging","gayundin","maliban","o",
  "kung kaya","habang","kahit"
];

const filipinoAffixes = [
  "pag","tag","napaka","pinaka","mag","ma","mak","pa","pang","ka","ika","ipin","pin"
];

// 🔹 Helper functions
function censorBadWords(text) {
  let censored = text;
  badWords.forEach(word => {
    const regex = new RegExp(`\\b${word}\\b`, "gi");
    censored = censored.replace(regex, "**");
  });
  return censored;
}

function containsEnglish(text) {
  const words = text.toLowerCase().replace(/[^a-zA-ZñÑ\s-]/g, "").split(/\s+/);
  return words.some(w => englishWords.includes(w));
}

function isMostlyFilipino(text) {
  const words = text.toLowerCase().replace(/[^a-zA-ZñÑ\s-]/g, "").split(/\s+/);
  let filipinoCount = 0;
  for (const word of words) {
    if (filipinoWords.includes(word) || filipinoAffixes.some(a => word.startsWith(a))) filipinoCount++;
  }
  return filipinoCount >= 1 && filipinoCount >= words.length * 0.4;
}

// 🔹 Main Route
app.post("/suriin-gramar", async (req, res) => {
  try {
    let { pangungusap } = req.body;
    if (!pangungusap || pangungusap.trim() === "")
      return res.status(400).send("Pakisulat muna ang pangungusap.");

    pangungusap = pangungusap
      .replace(/\s+/g, " ")
      .replace(/([a-z])([A-Z])/g, "$1 $2")
      .replace(/-+/g, "-")
      .trim();

    pangungusap = censorBadWords(pangungusap);

    if (containsEnglish(pangungusap) && !isMostlyFilipino(pangungusap))
      return res.send("Filipino lamang ang pinapayagan.");

    const repeatMatch = pangungusap.match(/\b(\w+)\s+\1\b/i);
    if (repeatMatch)
      return res.send(`MALI: *${repeatMatch[1]} ${repeatMatch[1]}*\nTAMANG SAGOT: Alisin ang pag-uulit ng salita.`);

    const firstChar = pangungusap.charAt(0);
    if (firstChar === firstChar.toLowerCase() && firstChar.match(/[a-zA-Zñ]/i)) {
      const corrected = firstChar.toUpperCase() + pangungusap.slice(1);
      return res.send(`MALI: *${pangungusap.trim().split(" ")[0]}*\nTAMANG SAGOT: ${corrected}`);
    }

    // 🔹 GPT Filipino Grammar Logic
    const completion = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      temperature: 0.1,
      max_tokens: 400,
      messages: [
        {
          role: "system",
          content: `
Ikaw ay isang eksperto sa gramatika at ortograpiya ng wikang Filipino. Suriin ang pangungusap ayon sa lahat ng tuntunin ng KWF.

⚙️ Mga aspeto ng pagsusuri:
1️⃣ **Bahagi ng Pananalita**  
   - Tamang gamit ng pangngalan, panghalip, pandiwa, pang-uri, pang-abay, pang-ugnay, pang-ukol, pantukoy, at pantig.
2️⃣ **Kayarian ng Pangungusap**  
   - Dapat may simuno at panaguri at may buong diwa.
3️⃣ **Ortograpiya at Baybay**  
   - Wastong baybay ng mga salita at paggamit ng mga hiniram na salita.
4️⃣ **Gitling (-)** ayon sa KWF:  
   ✅ Walang gitling kung katinig ang kasunod (*napakabait, taglamig, pagkakaibigan*).  
   ✅ May gitling kung patinig ang kasunod (*napaka-init, tag-init, pinaka-isa*).  
   ❌ Mali kung may gitling kahit katinig (*napaka-bait, pag-pili, pag-laro*).  
   ❌ Mali kung walang gitling kahit patinig (*napakainit, taginit, pinakaisa*).  
   ❌ Mali kung pinaghiwalay (*pag laro* → *paglaro*).
5️⃣ **Gamit ng "ng" at "nang"**  
   - "ng" → pantukoy sa bagay o pangngalan (*Kumuha ng tubig.*)  
   - "nang" → sa paraan, dahilan, o oras (*Tumakbo nang mabilis.*)
6️⃣ **May / Mayroon**  
   - "may" → kapag sinusundan ng pangngalan o pandiwa (*May aso ako.*)  
   - "mayroon" → kapag sinusundan ng panghalip (*Mayroon akong aso.*)
7️⃣ **Rin / Din**  
   - "rin" → kasunod ay patinig o malapatinig (*ako rin, ikaw rin*)  
   - "din" → kasunod ay katinig (*siya din, bata din*)
8️⃣ **Raw / Daw**  
   - "raw" → kasunod ay patinig (*sabi raw, umalis raw*)  
   - "daw" → kasunod ay katinig (*sabi daw, punta daw*)
9️⃣ **Bantas at Kapitalisasyon**  
   - Malaking titik sa simula ng pangungusap.  
   - Tuldok sa dulo ng pangungusap.  
   - Tamang bantas para sa tanong o padamdam.
🔟 **Pagkakasunod ng mga salita**  
   - Dapat natural at malinaw ang daloy ng diwa.

💬 Format ng sagot:
Kung may mali:  
MALI: *<maling bahagi>*  
TAMANG SAGOT: <tamang pangungusap>  

Kung tama:  
WALANG MALI
`
        },
        {
          role: "assistant",
          content: "Tandaan: Sagutin lamang ng 'MALI:' o 'WALANG MALI'. Walang paliwanag."
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
