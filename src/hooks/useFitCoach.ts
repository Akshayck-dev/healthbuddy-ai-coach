// src/hooks/useFitCoach.ts
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface Message {
  role: "user" | "assistant";
  content: string;
  quickReplies?: string[];
  isFinalPlan?: boolean;
  meta?: any;
}

export interface AIResponse {
  type: "ask_slot" | "final_plan" | "clarify" | "handoff" | "ask_language";
  slot_to_ask?: string | null;
  message: string;
  quick_replies?: string[];
  user_language?: "en" | "ml" | "";
  session_id?: string;
  meta?: any;
}

const LS_SESSION_KEY = "hb_session_id";
const LS_LANG_KEY = "hb_user_language";
const LS_MESSAGES_KEY = "hb_messages";

export const useFitCoach = () => {
  const [messages, setMessages] = useState<Message[]>(() => {
    try {
      const raw = localStorage.getItem(LS_MESSAGES_KEY);
      return raw ? JSON.parse(raw) : [
        {
          role: "assistant",
          content: "Welcome to HealthBuddy! I'm your AI fitness and diet coach. Let's start by choosing your language. നിങ്ങളുടെ ഭാഷ തിരഞ്ഞെടുക്കുക.",
          quickReplies: ["English", "Malayalam / മലയാളം"],
        },
      ];
    } catch {
      return [
        {
          role: "assistant",
          content: "Welcome to HealthBuddy! I'm your AI fitness and diet coach. Let's start by choosing your language. നിങ്ങളുടെ ഭാഷ തിരഞ്ഞെടുക്കുക.",
          quickReplies: ["English", "Malayalam / മലയാളം"],
        },
      ];
    }
  });

  const [sessionId, setSessionId] = useState<string>(() => localStorage.getItem(LS_SESSION_KEY) || "");
  const [userLanguage, setUserLanguage] = useState<"en" | "ml" | "">(() => (localStorage.getItem(LS_LANG_KEY) as "en" | "ml" | "") || "");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => { try { localStorage.setItem(LS_MESSAGES_KEY, JSON.stringify(messages)); } catch {} }, [messages]);
  useEffect(() => { try { if (sessionId) localStorage.setItem(LS_SESSION_KEY, sessionId); else localStorage.removeItem(LS_SESSION_KEY); } catch {} }, [sessionId]);
  useEffect(() => { try { if (userLanguage) localStorage.setItem(LS_LANG_KEY, userLanguage); else localStorage.removeItem(LS_LANG_KEY); } catch {} }, [userLanguage]);

  const sendMessage = async (userMessage: string, opts?: { generate_pdf?: boolean; short?: boolean; mode?: string }) => {
    setIsLoading(true);
    const newUserMessage: Message = { role: "user", content: userMessage };
    setMessages(prev => [...prev, newUserMessage]);

    try {
      const conversationHistory = [...messages, newUserMessage].map(m => ({ role: m.role, content: m.content }));
      const payload: any = { messages: conversationHistory, session_id: sessionId || undefined, user_language: userLanguage || undefined };
      if (opts?.generate_pdf) payload.generate_pdf = true;
      if (opts?.short) payload.short = true;
      if (opts?.mode) payload.mode = opts.mode;

      const { data, error } = await supabase.functions.invoke("fitcoach", { body: payload });
      if (error) throw error;
      const aiResponse = data as AIResponse;

      if (aiResponse.session_id) setSessionId(aiResponse.session_id);
      if (aiResponse.user_language) setUserLanguage(aiResponse.user_language);
      else {
        const lu = newUserMessage.content.trim().toLowerCase();
        if (["english", "eng", "en"].includes(lu)) setUserLanguage("en");
        if (["malayalam", "മലയാളം", "ml"].includes(lu)) setUserLanguage("ml");
      }

      // Defensive injection of quick replies for missing suggestions
      if (aiResponse.type === "ask_slot" && (!aiResponse.quick_replies || aiResponse.quick_replies.length === 0)) {
        const s = (aiResponse.slot_to_ask || "").toLowerCase();
        if (s === "activity_level") aiResponse.quick_replies = ["sedentary", "light", "moderate", "active", "very_active"];
        else if (s === "dietary_preferences" || s === "food_pref") aiResponse.quick_replies = ["vegetarian", "non-veg", "mixed", "vegan", "kerala_special"];
        else if (s === "goal") aiResponse.quick_replies = ["Weight Loss", "Weight Gain"];
        else if (s === "gender") aiResponse.quick_replies = ["male", "female", "other"];
      }

      // Prevent duplicate assistant messages in a row
      const lastAssistant = messages.slice().reverse().find(m => m.role === "assistant");
      const duplicateCheck = (aiResponse.message || "").trim();
      if (lastAssistant && lastAssistant.content && lastAssistant.content.trim() === duplicateCheck) {
        setMessages(prev => prev.map(m => {
          if (m.role === "assistant" && m.content.trim() === duplicateCheck) {
            return { ...m, quickReplies: aiResponse.quick_replies || m.quickReplies, meta: { ...(m.meta || {}), ...(aiResponse.meta || {}) }, isFinalPlan: aiResponse.type === "final_plan" ? true : m.isFinalPlan };
          }
          return m;
        }));
      } else {
        const botMessage: Message = { role: "assistant", content: aiResponse.message || "", quickReplies: aiResponse.quick_replies || [], isFinalPlan: aiResponse.type === "final_plan", meta: aiResponse.meta || {} };
        if (aiResponse.meta?.pdfUrl) botMessage.content = `${botMessage.content}\n\nYour plan PDF: ${aiResponse.meta.pdfUrl}`;
        else if (aiResponse.meta?.pdfBase64) botMessage.content = `${botMessage.content}\n\n(pdf_base64_available)`;
        setMessages(prev => [...prev, botMessage]);
      }

      if (aiResponse.type === "final_plan") {
        setMessages(prev => {
          const last = prev[prev.length - 1];
          if (!last) return prev;
          if (!last.quickReplies || last.quickReplies.length === 0) last.quickReplies = ["Download PDF", "WhatsApp", "Start over"];
          last.isFinalPlan = true;
          last.meta = { ...(last.meta || {}), ...(aiResponse.meta || {}) };
          return [...prev.slice(0, prev.length - 1), last];
        });
      }

    } catch (err) {
      console.error("Error sending message:", err);
      const errorMessage: Message = { role: "assistant", content: "Sorry, I encountered an error. Please try again.", quickReplies: ["Start over"] };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const resetChat = () => {
    const welcome: Message = { role: "assistant", content: "Welcome back! Let's start fresh. Please choose your language.", quickReplies: ["English", "Malayalam / മലയാളം"] };
    setMessages([welcome]);
    setSessionId("");
    setUserLanguage("");
    try { localStorage.removeItem(LS_MESSAGES_KEY); localStorage.removeItem(LS_SESSION_KEY); localStorage.removeItem(LS_LANG_KEY); } catch {}
  };

  return { messages, isLoading, sendMessage, resetChat, sessionId, userLanguage, setUserLanguage };
};
