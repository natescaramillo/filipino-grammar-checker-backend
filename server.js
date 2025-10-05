import express from "express";
import OpenAI from "openai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(express.json());

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// ✅ Endpoint: Suriin ang gramatika
app.post("/suriin-gramar", async (req, res) => {
  try {
    const { pangungusap } = req.body;

    if (!pangungusap || pangungusap.trim() === "") {
      return res.status(400).send("Walang laman ang pangungusap.");
    }

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

📋 Mga Tagubilin:
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
    console.error("❌ Error:", error);
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Server tumatakbo sa http://localhost:${PORT}`);
});
import express from "express";
import OpenAI from "openai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(express.json());

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// ✅ Endpoint: Suriin ang gramatika
app.post("/suriin-gramar", async (req, res) => {
  try {
    const { pangungusap } = req.body;

    if (!pangungusap || pangungusap.trim() === "") {
      return res.status(400).send("Walang laman ang pangungusap.");
    }

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

📋 Mga Tagubilin:
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
    console.error("❌ Error:", error);
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Server tumatakbo sa http://localhost:${PORT}`);
});
