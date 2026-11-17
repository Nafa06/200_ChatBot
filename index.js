const express = require('express');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
const port = 3000;

app.use(express.json());
app.use(express.static('public'));

app.get('/', (req, res) => {
    res.redirect('/index.html');
});

app.post("/api/chat", async (req, res) => {;
    try {
        const messages = req.body.messages;
        
        if (!messages || !Array.isArray(messages)) {
            return res.status(400).json({
                error: "Messages harus berupa array"
            });
        }

        const contents = messages.map((msg) => ({
            role: msg.role === "assistant" ? "model" : "user",
            parts: [{ text: String(msg.content || "") }]
        }));

        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.API_KEY}`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    contents,
                    generationConfig: {
                        temperature: 0.7,
                        maxOutputTokens: 1000
                    }
                })
            }
        );

        if (!response.ok) {
            const errorData = await response.json();
            
            console.error("Google AI Studio Error:", errorData);
            
            return res.status(response.status).json({
                error: errorData
            });
        }

        const data = await response.json();
        const text = data?.candidates?.[0]?.content?.parts
            ?.map((part) => part.text)
            .join("") || "";

        return res.json({
            reply: text
        });
    } catch (err) {
        res.send(err);
    }
});

app.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}`);
});