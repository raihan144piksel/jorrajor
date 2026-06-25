import React, { useState, useRef, useEffect } from "react";
import { Send, Bot, RefreshCw, Sparkles, MessageSquare } from "lucide-react";
import { chatWithAI, ChatMessage } from "../services/api";
import toast from "react-hot-toast";

interface AiPanelProps {
  selectedNode: string;
  messages: ChatMessage[];
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  onThresholdsChange: (newThresholds: any) => void;
}

const AiPanel: React.FC<AiPanelProps> = ({ selectedNode, messages, setMessages, onThresholdsChange }) => {
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async (textToSend: string) => {
    if (!textToSend.trim() || isLoading) return;

    const userMessage: ChatMessage = { role: "user", text: textToSend };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      // Pass the active chat history (excluding the very first model intro message)
      const historyToSend = messages.slice(1);
      const res = await chatWithAI(textToSend, selectedNode, historyToSend);
      setMessages((prev) => [...prev, { role: "model", text: res.message }]);

      // If AI updated thresholds via function calling, update the parent state!
      if (res.actionTriggered === "settings" && res.thresholds) {
        onThresholdsChange(res.thresholds);
      }
    } catch (err: any) {
      console.error(err);
      const errMsg = err.response?.data?.error || "Gagal menghubungi AI Asisten. Pastikan server aktif dan GEMINI_API_KEY sudah dikonfigurasi.";
      toast.error(errMsg);
      setMessages((prev) => [
        ...prev,
        {
          role: "model",
          text: `⚠️ **Gagal menghubungkan ke AI**: ${errMsg}`,
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSuggestClick = (suggestion: string) => {
    handleSend(suggestion);
  };

  const clearChat = () => {
    setMessages([
      {
        role: "model",
        text: "Halo! Saya adalah SEMAI AI Greenhouse Assistant. Saya memantau kondisi greenhouse Anda secara real-time. Ada yang bisa saya bantu hari ini?",
      },
    ]);
  };

  // Helper to parse simple markdown bold, lists, and newlines
  const renderMessageText = (text: string) => {
    // Escape HTML first to prevent XSS
    let html = text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

    // Replace bold formatting: **text** -> <strong>text</strong>
    html = html.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");

    // Replace bullet points: * text -> <li>text</li>
    const lines = html.split("\n");
    let inList = false;
    const listFormattedLines = lines.map((line) => {
      const trimmed = line.trim();
      if (trimmed.startsWith("* ") || trimmed.startsWith("- ")) {
        const content = trimmed.substring(2);
        if (!inList) {
          inList = true;
          return `<ul class="list-disc list-inside my-2 space-y-1"><li>${content}</li>`;
        }
        return `<li>${content}</li>`;
      } else {
        if (inList) {
          inList = false;
          return `</ul>${line}`;
        }
        return line;
      }
    });

    if (inList) {
      listFormattedLines.push("</ul>");
    }

    // Join lines and replace single newlines with <br />
    const finalHtml = listFormattedLines.join("<br />");

    return <span dangerouslySetInnerHTML={{ __html: finalHtml }} />;
  };

  const suggestions = [
    "Bagaimana kondisi greenhouse saya saat ini?",
    "Apakah suhu & kelembapan tanah sudah ideal?",
    "Berikan saran untuk merawat tanaman saya saat ini",
    "Analisis efisiensi penggunaan kipas dan pompa air",
  ];

  return (
    <div className="bg-slate-800 rounded-3xl shadow-2xl border border-slate-700/50 flex flex-col h-[600px] lg:h-[650px] overflow-hidden animate-in fade-in duration-500">
      {/* Header */}
      <div className="p-6 border-b border-slate-700/50 bg-slate-900/40 flex justify-between items-center shrink-0">
        <div className="flex items-center gap-3">
          <div className="bg-gradient-to-tr from-indigo-600 to-purple-600 p-2.5 rounded-2xl shadow-lg shadow-indigo-600/20 text-white animate-pulse">
            <Bot size={24} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              Asisten AI Greenhouse
              <Sparkles size={16} className="text-yellow-400 animate-bounce" />
            </h2>
            <p className="text-xs text-slate-400">Gemini 2.5 Flash • Kontekstual Real-Time</p>
          </div>
        </div>
        <button
          onClick={clearChat}
          className="p-2 bg-slate-950/60 hover:bg-slate-900 text-slate-400 hover:text-white rounded-xl border border-slate-700/50 transition-all text-xs flex items-center gap-2 cursor-pointer"
          title="Bersihkan Percakapan"
        >
          <RefreshCw size={14} />
          <span>Reset</span>
        </button>
      </div>

      {/* Message List */}
      <div className="flex-1 p-6 overflow-y-auto custom-scrollbar space-y-4 bg-slate-900/20 flex flex-col">
        {messages.map((msg, index) => {
          const isAI = msg.role === "model";
          return (
            <div
              key={index}
              className={`flex gap-3 max-w-[85%] ${
                isAI ? "self-start mr-auto" : "self-end ml-auto flex-row-reverse"
              }`}
            >
              {isAI && (
                <div className="w-8 h-8 rounded-full bg-indigo-600/20 text-indigo-400 flex items-center justify-center shrink-0 border border-indigo-500/20 mt-1">
                  <Bot size={16} />
                </div>
              )}
              <div
                className={`p-4 rounded-3xl text-sm leading-relaxed shadow-lg ${
                  isAI
                    ? "bg-slate-800 text-slate-200 rounded-tl-sm border border-slate-700/30"
                    : "bg-blue-600 text-white rounded-tr-sm"
                }`}
              >
                {renderMessageText(msg.text)}
              </div>
            </div>
          );
        })}
        {isLoading && (
          <div className="flex gap-3 max-w-[80%] self-start mr-auto animate-pulse">
            <div className="w-8 h-8 rounded-full bg-indigo-600/20 text-indigo-400 flex items-center justify-center shrink-0 border border-indigo-500/20">
              <Bot size={16} />
            </div>
            <div className="p-4 rounded-3xl bg-slate-800 text-slate-400 rounded-tl-sm border border-slate-700/30 flex items-center gap-2">
              <RefreshCw size={14} className="animate-spin text-indigo-400" />
              <span>AI sedang berpikir...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Suggestion Pills */}
      {messages.length === 1 && !isLoading && (
        <div className="px-6 py-3 bg-slate-900/10 border-t border-slate-700/20 shrink-0">
          <p className="text-xs text-slate-500 font-semibold mb-2 flex items-center gap-1.5 uppercase tracking-wider">
            <MessageSquare size={12} /> Saran Pertanyaan:
          </p>
          <div className="flex flex-wrap gap-2">
            {suggestions.map((suggestion, idx) => (
              <button
                key={idx}
                onClick={() => handleSuggestClick(suggestion)}
                className="text-xs bg-slate-850 hover:bg-slate-700/80 text-slate-300 hover:text-white px-3.5 py-2 rounded-full border border-slate-700/50 transition-all cursor-pointer"
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input Form */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSend(input);
        }}
        className="p-4 bg-slate-900/60 border-t border-slate-700/50 flex gap-3 items-center shrink-0"
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={isLoading}
          placeholder="Tanyakan kondisi tanaman atau otomatisasi greenhouse..."
          className="flex-1 bg-slate-950 border border-slate-700/50 rounded-2xl px-5 py-3.5 text-sm text-white placeholder-slate-500 outline-none focus:border-indigo-500 transition-all disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={!input.trim() || isLoading}
          className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 text-white p-3.5 rounded-2xl transition-all shadow-lg shadow-indigo-600/15 disabled:opacity-50 shrink-0 flex items-center justify-center cursor-pointer"
        >
          <Send size={18} />
        </button>
      </form>
    </div>
  );
};

export default AiPanel;
