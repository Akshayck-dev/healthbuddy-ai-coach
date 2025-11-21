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
          content:
            "Welcome to HealthBuddy! I'm your AI fitness and diet coach. Let's start by choosing your language. നിങ്ങളുടെ ഭാഷ തിരഞ്ഞെടുക്കുക.",
          quickReplies: ["English", "Malayalam / മലയാളം"],
        },
      ];
    } catch {
      return [
        {
          role: "assistant",
          content:
            "Welcome to HealthBuddy! I'm your AI fitness and diet coach. Let's start by choosing your language. നിങ്ങളുടെ ഭാഷ തിരഞ്ഞെടുക്കുക.",
          quickReplies: ["English", "Malayalam / മലയാളം"],
        },
      ];
    }
  });

  const [sessionId, setSessionId] = useState<string>(() => {
    return localStorage.getItem(LS_SESSION_KEY) || "";
  });
  const [userLanguage, setUserLanguage] = useState<"en" | "ml" | "">(() => {
    return (localStorage.getItem(LS_LANG_KEY) as "en" | "ml" | "") || "";
  });

  const [isLoading, setIsLoading] = useState(false);

  // persist messages/session/lang to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(LS_MESSAGES_KEY, JSON.stringify(messages));
    } catch {}
  }, [messages]);

  useEffect(() => {
    try {
      if (sessionId) localStorage.setItem(LS_SESSION_KEY, sessionId);
      else localStorage.removeItem(LS_SESSION_KEY);
    } catch {}
  }, [sessionId]);

  useEffect(() => {
    try {
      if (userLanguage) localStorage.setItem(LS_LANG_KEY, userLanguage);
      else localStorage.removeItem(LS_LANG_KEY);
    } catch {}
  }, [userLanguage]);

  // normalize quick reply tokens to internal values
  const normalizeQuickReplyToValue = (reply: string) => {
    const r = reply.trim().toLowerCase();
    if (["english", "english 🇬🇧", "eng", "en"].includes(r)) return "English";
    if (["malayalam", "മലയാളം", "malayalam / മലയാളം", "ml"].includes(r)) return "Malayalam";
    // handle standard tokens
    return reply;
  };

  const sendMessage = async (
    userMessage: string,
    opts?: { generate_pdf?: boolean; short?: boolean; mode?: string }
  ) => {
    setIsLoading(true);

    const newUserMessage: Message = {
      role: "user",
      content: userMessage,
    };

    setMessages((prev) => [...prev, newUserMessage]);

    try {
      // Build conversation array in model-friendly shape
      const conversationHistory = [...messages, newUserMessage].map((msg) => ({
        role: msg.role,
        content: msg.content,
      }));

      const payload: any = {
        messages: conversationHistory,
        session_id: sessionId || undefined,
        user_language: userLanguage || undefined,
      };

      if (opts?.generate_pdf) payload.generate_pdf = true;
      if (opts?.short) payload.short = true;
      if (opts?.mode) payload.mode = opts.mode;

      const { data, error } = await supabase.functions.invoke("fitcoach", {
        body: payload,
      });

      if (error) {
        throw error;
      }

      const aiResponse = data as AIResponse;

      // update session id if returned
      if (aiResponse.session_id) {
        setSessionId(aiResponse.session_id);
      }

      // update language if AI set it
      if (aiResponse.user_language) {
        setUserLanguage(aiResponse.user_language);
      } else {
        // heuristics: if the user selected a language quick reply, update it
        const lastUser = newUserMessage.content.trim().toLowerCase();
        if (["english", "eng", "en"].includes(lastUser)) setUserLanguage("en");
        if (["malayalam", "മലയാളം", "ml"].includes(lastUser)) setUserLanguage("ml");
      }

      // If backend included pdf meta or pdfUrl, attach to message content & meta
      const botMessage: Message = {
        role: "assistant",
        content: aiResponse.message || "",
        quickReplies: aiResponse.quick_replies || [],
        isFinalPlan: aiResponse.type === "final_plan",
        meta: aiResponse.meta || {},
      };

      // If meta contains pdfUrl, append a short hint so Chat shows download button reliably
      if (aiResponse.meta?.pdfUrl) {
        botMessage.content = `${botMessage.content}\n\nYour plan PDF: ${aiResponse.meta.pdfUrl}`;
      } else if (aiResponse.meta?.pdfBase64) {
        // include a small data url hint (Chat download will detect data:application/pdf;base64)
        botMessage.content = `${botMessage.content}\n\n(pdf_base64_available)`;
      }

      setMessages((prev) => [...prev, botMessage]);

      // If backend set ask_slot with quick_replies, frontend will show buttons (hook passes quickReplies)
      // If backend returned final_plan with structured fields, we already appended them to message in backend.
    } catch (err) {
      console.error("Error sending message:", err);

      const errorMessage: Message = {
        role: "assistant",
        content: "Sorry, I encountered an error. Please try again.",
        quickReplies: ["Start over"],
      };

      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const resetChat = () => {
    const welcome = {
      role: "assistant",
      content: "Welcome back! Let's start fresh. Please choose your language.",
      quickReplies: ["English", "Malayalam / മലയാളം"],
    } as Message;

    setMessages([welcome]);
    setSessionId("");
    setUserLanguage("");
    try {
      localStorage.removeItem(LS_MESSAGES_KEY);
      localStorage.removeItem(LS_SESSION_KEY);
      localStorage.removeItem(LS_LANG_KEY);
    } catch {}
  };

  return {
    messages,
    isLoading,
    sendMessage,
    resetChat,
    sessionId,
    userLanguage,
    setUserLanguage,
  };
};
