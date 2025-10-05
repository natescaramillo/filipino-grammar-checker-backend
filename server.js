    import express from "express";
    import OpenAI from "openai";
    import dotenv from "dotenv";

    dotenv.config();

    const app = express();
    app.use(express.json());

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });

    // ✅ Gamitin itong eksaktong endpoint name
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
              content: `Ikaw ay isang tagasuri ng gramatika sa wikang Filipino.
    Sagutin lamang sa format na ito:

    MALI: <**maling bahagi**>
    TAMANG SAGOT: <buong tamang pangungusap>

    - I-highlight ang maling bahagi gamit ang **bold**.
    - Kung WALANG MALI, huwag magbalik ng kahit anong output (blangko response).`
            },
            { role: "user", content: pangungusap }
          ],
          temperature: 0,
          max_tokens: 200
        });

        const tugon = completion.choices[0].message.content.trim();

        if (!tugon) return res.status(204).send(); // walang laman → walang ibabalik

        res.type("text/plain").send(tugon);
      } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
      }
    });

    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
      console.log(`✅ Server tumatakbo sa http://localhost:${PORT}`);
    });
