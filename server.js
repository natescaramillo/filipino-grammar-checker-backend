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

// 🔹 Bad word checker (accurate)
function containsBadWord(text) {
  const lower = text.toLowerCase();
  return badWords.some(bad => {
    const safeWord = bad.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); // escape regex chars
    const regex = new RegExp(`\\b${safeWord}\\b`, "i");
    return regex.test(lower);
  });
}

// 🔹 Censor bad words
function censorBadWords(text) {
  let censored = text;
  badWords.forEach(word => {
    const safeWord = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`\\b${safeWord}\\b`, "gi");
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

// 🔹 Word lists per affix (vowel → may dash, consonant → walang dash)
const affixExamples = {
  tag: {
    vowel: ["tag-init","tag-ulan","tag-aliw","tag-abot","tag-ibig","tag-alis","tag-angat","tag-apat","tag-isa","tag-ahon"],
    consonant: ["taglamig","tagtuyot","tagumpay","tagapangalaga","tagapamahala","tagapag-aral","tagapagturo","tagapaghatid","tagapangulo","tagapagsalita"]
  },
  napaka: {
    vowel: ["napaka-init","napaka-aliw","napaka-espesyal","napaka-inaasahan","napaka-abot","napaka-alaala","napaka-akas","napaka-abot-kamay"],
    consonant: ["napakatahimik","napakabait","napakadakila","napakabilis","napakalakas","napakaganda","napakalinaw","napakatalino"]
  },
  pinaka: {
    vowel: ["pinaka-isa","pinaka-espesyal","pinaka-abot","pinaka-aliw","pinaka-alala","pinaka-aani","pinaka-alis","pinaka-ahon","pinaka-apat"],
    consonant: ["pinakamaganda","pinakadakila","pinakamasaya","pinakamatatag","pinakalakas","pinakalinaw","pinakatalino","pinakatalino","pinakamabilis"]
  },
  pang: {
    vowel: ["pang-itaas","pang-ibaba","pang-aliw","pang-abot","pang-umaga","pang-alis","pang-angat","pang-aasa","pang-anim"],
    consonant: ["pangwakas","pangarap","pangkat","pangulo","pang-ukol","pang-edukasyon","pangyayari","panginoon","panghuli","pangulo"]
  },
  pa: {
    vowel: ["pa-ahon","pa-ilalim","pa-abot","pa-akyat","pa-alis","pa-ibig","pa-amin"],
    consonant: ["paalam","pamasko","paminsan","pamahalaan","paminsang","panalo","pakaliwa","pamangkin","papasok","patinig"]
  },
  mag: {
    vowel: ["mag-ayos","mag-ingat","mag-abot","mag-aral","mag-alala","mag-ani","mag-alis","mag-abang","mag-ahon","mag-apoy"],
    consonant: ["maganda","magluto","maglakad","magturo","magtanim","maglaro","maghugas","maglaba","mag-isa","magtrabaho"]
  },
  ma: {
    vowel: ["ma-aral","ma-abot","ma-alis","ma-ahon","ma-aliw","ma-alala","ma-ani","ma-abang","ma-apoy","ma-alis"],
    consonant: ["maayos","makata","maaliwalas","magaling","malakas","matalino","maingat","mabait","masaya","matibay"]
  },
  pag: {
    vowel: [
      "pag-alis","pag-ibig","pag-akyat","pag-asa","pag-aral","pag-aani","pag-amin","pag-angat","pag-ayos",
      "pag-aalaga","pag-aaway","pag-aari","pag-aasawa","pag-aalay","pag-aayos","pag-aalaga","pag-aalaga",
      "pag-aangkin","pag-aalaga","pag-aantabay","pag-aalaga","pag-aalala","pag-aalaga","pag-aalaga","pag-aalaga",
      "pag-ukit","pag-ulan","pag-uunawa","pag-uusap","pag-uunlad","pag-uunahan","pag-uunay","pag-uugali",
      "pag-uunlad","pag-ibig","pag-iling","pag-ikot","pag-ubo","pag-ubo","pag-isa","pag-iingat","pag-iisip",
      "pag-ikot","pag-uwi","pag-ubo","pag-utos","pag-ukit","pag-ulan","pag-unlad","pag-usad","pag-uusap","pag-uunlad"
    ],
    consonant: [
      "pagtulog","paglinis","pagluto","pagturo","pagtawa","paghinga","pagdiriwang","paggalang","pagbasa","pagkain",
      "pagkanta","paglakad","pagsulat","paglaba","pagsamba","pagputol","pagtanim","pagsigaw","pagdalo","pagbenta",
      "pagkita","paglalaro","pagyaman","pagbili","pagkuha","pagbasa","pagdulot","pagpili","paglinang","paglaban",
      "pagtanggap","pagtatag","pag-imbak","pagsasanay","paghahanap","pagpupuri","paghuhugas","pagkilos","paghihintay",
      "pagsisikap","pagtitipid","pagtatayo","pagtitinda","pagpupulong","paglipad","pagtatagpo","pagkamangha",
      "paglayo","paglapit","paglabas","pagpasok","pagsira","pagbangon","pagtatagumpay","paglalakbay","pagtatapos",
      "pagluluto","paghahanda","paghahanapbuhay","pagsasaka","pagmamahal","pagmamasid","pagsasalita","pag-aalaga",
      "pagtatanggol","pagsasanay","pag-aaral","pagsasabuhay","pagkakaloob","pagtatasa","pagpapatupad","paggalang",
      "pagsisikap","pagsasaka","pagsamba","paghihirap","pagtagumpay"
    ]
  },
};

// 🔹 Updated correctHyphens function
function correctHyphens(sentence) {
  const words = sentence.split(/\s+/);

  return words
    .map((word, index) => {
      const original = word;
      const lowerWord = word.toLowerCase();

      for (let affix in affixExamples) {
        if (lowerWord.startsWith(affix)) {
          const suffix = original.substring(affix.length);
          const firstLetterSuffix = suffix.charAt(0);
          const isVowel = /^[aeiou]/i.test(firstLetterSuffix);
          const hasHyphen = original.includes("-");
          const isCapital = /^[A-ZÁÉÍÓÚÑ]/.test(original.charAt(0));

          // Preserve first letter capitalization
          const affixProper = isCapital
            ? affix.charAt(0).toUpperCase() + affix.slice(1)
            : affix;

          if (isVowel && !hasHyphen) {
            return `${affixProper}-${suffix}`;
          }

          if (!isVowel && hasHyphen) {
            return `${affixProper}${suffix.replace("-", "")}`;
          }

          // If hyphen is already correct, just preserve capitalization
          return affixProper + suffix;
        }
      }

      return word; // hindi affix
    })
    .join(" ");
}

app.post("/suriin-gramar", async (req, res) => {
  try {
    let { pangungusap } = req.body;

    if (!pangungusap || pangungusap.trim() === "") {
      return res.status(400).send("Pakisulat muna ang pangungusap.");
    }

    // 🔹 Bad words
    if (containsBadWord(pangungusap)) {
      return res.send("Bawal gumamit ng masasamang salita.");
    }

    // 🔹 English detection
    if (containsEnglish(pangungusap) && !isMostlyFilipino(pangungusap)) {
      return res.send("Filipino lamang ang pinapayagan.");
    }

    // 🔹 Capitalization check
    let cleaned = pangungusap.trim().replace(/^[\u200B-\u200D\uFEFF]/g, "");
    const unangSalita = cleaned.split(/\s+/)[0].replace(/[.,!?;:]+$/, "");
    const unangLetra = unangSalita.charAt(0);

    if (/^[a-zñ]/.test(unangLetra)) {
      cleaned = unangLetra.toUpperCase() + cleaned.slice(1);
    }

    pangungusap = cleaned;
    pangungusap = censorBadWords(pangungusap);
    pangungusap = correctHyphens(pangungusap);

    // 🔹 GPT-based grammar correction
    const completion = await openai.chat.completions.create({
      model: "gpt-4.1",
      temperature: 0.1,
      max_tokens: 250,
      messages: [
        {
          role: "system",
          content: `
Ikaw ay eksperto sa gramatika at ortograpiya ng wikang Filipino...
          `
        },
        { role: "user", content: pangungusap }
      ]
    });

    const output = completion.choices[0].message.content.trim();
    let finalOutput = output.startsWith("TAMA") ? output : `TAMA: ${output}`;
    res.type("text/plain").send(finalOutput);

  } catch (err) {
    console.error("Error:", err);
    res.status(500).json({ error: err.message });
  }
});


// ✅ ADD THIS AT THE VERY END
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
