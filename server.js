import express from "express";
import OpenAI from "openai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(express.json());

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

app.post("/check-grammar", async (req, res) => {
  try {
    const { sentence } = req.body;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You are a Filipino grammar checker. Identify grammar errors in a sentence, highlight them, explain the mistake, and suggest corrections. Respond in JSON with fields: errors[], explanations[], corrected_sentence."
        },
        {
          role: "user",
          content: sentence
        }
      ]
    });

    const reply = completion.choices[0].message.content;
    res.json(JSON.parse(reply));

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

app.listen(process.env.PORT, () => {
  console.log(`✅ Server running on http://localhost:${process.env.PORT}`);
});
