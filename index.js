const express = require("express");
const dotenv = require("dotenv");
const path = require("path");

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.post("/api/chat", async (req, res) => {
  try {
    const messages = req.body.messages || req.body.message;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({
        error: "Messages harus berupa Array"
      });
    }

    // Ubah format messages dari gaya OpenAI (role: assistant/user, content) ke format Gemini API
    const systemInstruction = messages.find((m) => m.role === "system");
    const contents = messages
      .filter((m) => m.role !== "system")
      .map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }]
      }));

    const payload = {
      contents,
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 1000
      }
    };

    if (systemInstruction) {
      payload.systemInstruction = {
        parts: [{ text: systemInstruction.content }]
      };
    }

    const apiKey = process.env.API_KEY;
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:streamGenerateContent?alt=sse&key=${apiKey}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      }
    );

    if (!response.ok) {
      const errorData = await response.text();
      console.error("Gemini API Error:", errorData);
      return res.status(response.status).json({ error: errorData });
    }

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop();

      for (const line of lines) {
        const trimmedLine = line.trim();
        if (!trimmedLine || !trimmedLine.startsWith("data:")) continue;

        const data = trimmedLine.slice(5).trim();
        if (data === "[DONE]") continue;

        try {
          const json = JSON.parse(data);
          const content = json.candidates?.[0]?.content?.parts?.[0]?.text;
          if (content) {
            res.write(`data: ${JSON.stringify(content)}\n\n`);
          }
        } catch (error) {
          console.error("Gagal parsing streaming data:", error);
        }
      }
    }

    res.write("data: [DONE]\n\n");
    res.end();
  } catch (error) {
    console.error("Server Error:", error);
    if (!res.headerSent) {
      res.status(500).json({ error: "Terjadi kesalahan pada server" });
    } else {
      res.write(`data: ${JSON.stringify("Terjadi kesalahan pada server")}\n\n`);
      res.end();
    }
  }
});

if (process.env.NODE_ENV !== "production") {
  app.listen(PORT, () => {
    console.log(`Server berjalan di http://localhost:${PORT}`);
  });
}

module.exports = app;