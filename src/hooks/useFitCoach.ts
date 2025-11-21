import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface Message {
  role: "user" | "assistant";
  content: string;
  quickReplies?: string[];
  isFinalPlan?: boolean;
}

export interface AIResponse {
  type: "ask_slot" | "final_plan" | "clarify" | "handoff" | "ask_language";
  slot_to_ask?: string;
  message: string;
  quick_replies?: string[];
}

export const useFitCoach = () => {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: "Welcome to HealthBuddy! I'm your AI fitness and diet coach. Let's start by choosing your language. നിങ്ങളുടെ ഭാഷ തിരഞ്ഞെടുക്കുക.",
      quickReplies: ["English", "Malayalam / മലയാളം"],
    },
  ]);
  const [isLoading, setIsLoading] = useState(false);

  const sendMessage = async (userMessage: string) => {
    setIsLoading(true);
    
    const newUserMessage: Message = {
      role: "user",
      content: userMessage,
    };

    setMessages((prev) => [...prev, newUserMessage]);

    try {
      const conversationHistory = [...messages, newUserMessage].map((msg) => ({
        role: msg.role,
        content: msg.content,
      }));

      const { data, error } = await supabase.functions.invoke('fitcoach', {
        body: { 
          messages: conversationHistory 
        }
      });

      if (error) {
        throw error;
      }

      const aiResponse = data as AIResponse;
      
      const botMessage: Message = {
        role: "assistant",
        content: aiResponse.message,
        quickReplies: aiResponse.quick_replies || [],
        isFinalPlan: aiResponse.type === "final_plan",
      };

      setMessages((prev) => [...prev, botMessage]);
    } catch (error) {
      console.error('Error sending message:', error);
      
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
    setMessages([
      {
        role: "assistant",
        content: "Welcome back! Let's start fresh. Please choose your language.",
        quickReplies: ["English", "Malayalam / മലയാളം"],
      },
    ]);
  };

  return {
    messages,
    isLoading,
    sendMessage,
    resetChat,
  };
};
