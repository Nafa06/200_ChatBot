const chatForm = document.getElementById("chat-form");
const userInput = document.getElementById("user-input");
const chatBox = document.getElementById("chat-box");
const sendBtn = document.getElementById("send-btn");
const sendText = sendBtn.querySelector(".send-text");

const statusDot = document.getElementById("status-dot");
const statusText = document.getElementById("status-text");
const themeBtn = document.getElementById("theme-btn");
const themeIcon = document.getElementById("theme-icon");
const themeLabel = document.getElementById("theme-label");
const newChatBtn = document.getElementById("new-chat-btn");
const quickPrompts = document.getElementById("quick-prompts");
const scrollBottomBtn = document.getElementById("scroll-bottom-btn");

let messages = [];

// ================= 1. PENGATURAN TEMA =================
const themes = [
    { id: "light", icon: "☀️", label: "Light" },
    { id: "dark", icon: "🌙", label: "Dark" },
    { id: "cyber", icon: "⚡", label: "Cyber" },
    { id: "matcha", icon: "🍵", label: "Matcha" }
];

let currentThemeIndex = 0;
const savedTheme = localStorage.getItem("chatbot-theme");
if (savedTheme) {
    const foundIndex = themes.findIndex((t) => t.id === savedTheme);
    if (foundIndex !== -1) currentThemeIndex = foundIndex;
}
applyTheme(themes[currentThemeIndex]);

function applyTheme(themeObj) {
    document.documentElement.setAttribute("data-theme", themeObj.id);
    themeIcon.textContent = themeObj.icon;
    themeLabel.textContent = themeObj.label;
    localStorage.setItem("chatbot-theme", themeObj.id);
}

themeBtn.addEventListener("click", () => {
    currentThemeIndex = (currentThemeIndex + 1) % themes.length;
    applyTheme(themes[currentThemeIndex]);
});

// ================= 2. STATUS MENGETIK & HELPER =================
function setBotStatus(isTyping) {
    if (isTyping) {
        statusDot.classList.add("typing");
        statusText.textContent = "Sedang mengetik...";
        userInput.disabled = true;
        sendBtn.disabled = true;
        sendText.textContent = "...";
    } else {
        statusDot.classList.remove("typing");
        statusText.textContent = "Online • Siap membantu";
        userInput.disabled = false;
        sendBtn.disabled = false;
        sendText.textContent = "Kirim";
        userInput.focus();
    }
}

function getTimeString() {
    return new Date().toLocaleTimeString("id-ID", {
        hour: "2-digit",
        minute: "2-digit"
    });
}

function scrollToBottom() {
    chatBox.scrollTop = chatBox.scrollHeight;
}

// Munculkan tombol scroll ke bawah jika user scroll ke atas
chatBox.addEventListener("scroll", () => {
    const isNearBottom = chatBox.scrollHeight - chatBox.scrollTop - chatBox.clientHeight < 120;
    scrollBottomBtn.classList.toggle("hidden", isNearBottom);
});

scrollBottomBtn.addEventListener("click", scrollToBottom);

// ================= 3. TAMBAH BUBBLE PESAN =================
function addMessage(text, sender, isTypingPlaceholder = false) {
    const message = document.createElement("div");
    message.classList.add("message", sender);

    const wrapper = document.createElement("div");
    wrapper.classList.add("message-wrapper");

    const content = document.createElement("div");
    content.classList.add("message-content");

    if (isTypingPlaceholder) {
        content.innerHTML = `<div class="typing-dots"><span></span><span></span><span></span></div>`;
    } else {
        content.textContent = text;
    }

    const meta = document.createElement("div");
    meta.classList.add("message-meta");

    const timeSpan = document.createElement("span");
    timeSpan.classList.add("timestamp");
    timeSpan.textContent = getTimeString();
    meta.appendChild(timeSpan);

    if (sender === "bot") {
        const copyBtn = document.createElement("button");
        copyBtn.type = "button";
        copyBtn.classList.add("copy-btn");
        copyBtn.textContent = "Salin";
        copyBtn.addEventListener("click", () => {
            navigator.clipboard.writeText(content.textContent);
            copyBtn.textContent = "Tersalin ✓";
            setTimeout(() => {
                copyBtn.textContent = "Salin";
            }, 1800);
        });
        meta.appendChild(copyBtn);
    }

    wrapper.appendChild(content);
    wrapper.appendChild(meta);
    message.appendChild(wrapper);
    chatBox.appendChild(message);

    scrollToBottom();
    return content;
}

// ================= 4. CHAT BARU (RESET) =================
newChatBtn.addEventListener("click", () => {
    messages = [];
    chatBox.innerHTML = "";
    addMessage("Obrolan baru dimulai. Ada yang bisa saya bantu?", "bot");
    quickPrompts.classList.remove("hidden");
    userInput.value = "";
    userInput.style.height = "auto";
    setBotStatus(false);
});

// ================= 5. QUICK PROMPTS & AUTO-RESIZE INPUT =================
quickPrompts.addEventListener("click", (e) => {
    if (e.target.classList.contains("prompt-chip")) {
        // Hapus emoji di awal teks chip
        const promptText = e.target.textContent.replace(/^[^\w\s]+\s*/, "").trim();
        userInput.value = promptText;
        chatForm.dispatchEvent(new Event("submit"));
    }
});

userInput.addEventListener("input", () => {
    userInput.style.height = "auto";
    userInput.style.height = `${Math.min(userInput.scrollHeight, 110)}px`;
});

userInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        chatForm.dispatchEvent(new Event("submit"));
    }
});

// ================= 6. KIRIM PESAN & STREAMING SSE =================
chatForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const message = userInput.value.trim();
    if (!message) return;

    // Sembunyikan saran prompt setelah percakapan dimulai
    quickPrompts.classList.add("hidden");

    // Tampilkan & simpan pesan user
    addMessage(message, "user");
    messages.push({ role: "user", content: message });

    // Reset input
    userInput.value = "";
    userInput.style.height = "auto";

    // Aktifkan status mengetik & tampilkan animasi 3 titik
    setBotStatus(true);
    const botContent = addMessage("", "bot", true);
    let botResponse = "";

    try {
        const response = await fetch("/api/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ messages })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || "Terjadi kesalahan");
        }

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
                    const token = JSON.parse(data);
                    botResponse += token;
                    botContent.textContent = botResponse;
                    scrollToBottom();
                } catch (error) {
                    console.error("Gagal membaca token:", error);
                }
            }
        }

        // Jika stream selesai tapi respons kosong
        if (!botResponse.trim()) {
            botContent.textContent = "Maaf, tidak ada respons yang diterima dari model.";
        } else {
            messages.push({ role: "assistant", content: botResponse });
        }

    } catch (error) {
        console.error(error);
        botContent.textContent = "Maaf, terjadi kesalahan: " + error.message;
    } finally {
        setBotStatus(false);
    }
});