import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Send, Loader2, RotateCcw, Download, Share2 } from "lucide-react";
import Navbar from "@/components/Navbar";
import WhatsAppButton from "@/components/WhatsAppButton";
import { useToast } from "@/hooks/use-toast";
import { useFitCoach, Message } from "@/hooks/useFitCoach";

const Chat = () => {
  const { messages, isLoading, sendMessage, resetChat } = useFitCoach();
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async (messageText?: string) => {
    const textToSend = messageText || input;
    if (!textToSend.trim() || isLoading) return;

    setInput("");
    await sendMessage(textToSend);
  };

  const handleQuickReply = (reply: string) => {
    handleSend(reply);
  };

  const handleRestart = () => {
    resetChat();
    toast({
      title: "Chat Reset",
      description: "Starting a new conversation",
    });
  };

  // Improved download: supports direct PDF URLs, data:base64 PDFs, or fallback to text file
  const handleDownloadPlan = () => {
    // look for the most relevant assistant message that likely contains the PDF or final plan
    const assistantMsgs = messages.filter((m) => m.role === "assistant");
    const lastMessage = assistantMsgs[assistantMsgs.length - 1] || messages[messages.length - 1];

    if (!lastMessage) {
      toast({ title: "No plan found", description: "There is no assistant message to download." });
      return;
    }

    const content = lastMessage.content || "";

    // 1) If content contains an HTTP(s) link to a PDF -> open direct link
    const pdfUrlMatch = content.match(/https?:\/\/\S+\.pdf/);
    if (pdfUrlMatch) {
      const pdfUrl = pdfUrlMatch[0];
      window.open(pdfUrl, "_blank");
      toast({ title: "Opening PDF", description: "Opening your plan PDF" });
      return;
    }

    // 2) If content contains a data:application/pdf;base64, download it
    const dataPdfMatch = content.match(/data:application\/pdf;base64,([A-Za-z0-9+/=]+)/);
    if (dataPdfMatch) {
      const base64 = dataPdfMatch[1];
      const byteCharacters = atob(base64);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "healthbuddy-plan.pdf";
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: "Download Started", description: "Your PDF is downloading." });
      return;
    }

    // 3) If the assistant previously returned a short message with a PDF URL in another message (search back)
    for (let i = assistantMsgs.length - 1; i >= 0; i--) {
      const m = assistantMsgs[i];
      const urlMatch = (m.content || "").match(/https?:\/\/\S+/);
      if (urlMatch) {
        window.open(urlMatch[0], "_blank");
        toast({ title: "Opening link", description: "Opening the link provided by the assistant." });
        return;
      }
    }

    // 4) Fallback: download message content as text
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "healthbuddy-plan.txt";
    a.click();
    URL.revokeObjectURL(url);

    toast({
      title: "Download Started",
      description: "Your plan has been downloaded",
    });
  };

  const handleShareWhatsApp = () => {
    // share the last assistant message (or last message)
    const assistantMsgs = messages.filter((m) => m.role === "assistant");
    const lastMessage = assistantMsgs[assistantMsgs.length - 1] || messages[messages.length - 1];
    if (!lastMessage) {
      toast({ title: "Nothing to share", description: "No assistant message found to share." });
      return;
    }
    const text = encodeURIComponent(lastMessage.content || "");
    window.open(`https://wa.me/?text=${text}`, "_blank");

    toast({
      title: "Opening WhatsApp",
      description: "Share your plan with friends",
    });
  };

  // helper to decide whether action buttons should be shown for a message
  const shouldShowActionsFor = (message: Message) => {
    if (!message) return false;
    // 1) explicit final plan flag
    if (message.isFinalPlan) return true;

    const content = (message.content || "").toLowerCase();
    // 2) quick-replies hint
    if (message.quickReplies && message.quickReplies.some((q) => q.toLowerCase().includes("download"))) return true;
    // 3) contains obvious pdf/url keywords
    if (content.includes("pdf") || content.includes("your plan") || content.includes(".pdf") || content.includes("download")) return true;
    // 4) fallback: show actions for longer assistant messages (likely a plan)
    if (message.role === "assistant" && content.length > 200) return true;

    return false;
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />
      <WhatsAppButton />

      <div className="flex-1 container mx-auto px-4 py-6 max-w-4xl">
        <div className="mb-6 text-center">
          <h1 className="text-3xl font-bold text-foreground mb-2">HealthBuddy AI Coach</h1>
          <p className="text-muted-foreground">Your personalized fitness assistant</p>
        </div>

        <Card className="wellness-shadow h-[calc(100vh-300px)] flex flex-col">
          <CardContent className="flex-1 overflow-y-auto p-6 space-y-4">
            {messages.map((message, index) => (
              <div key={index} className="space-y-2 fade-up">
                <div
                  className={`flex ${
                    message.role === "user" ? "justify-end" : "justify-start"
                  }`}
                >
                  <div
                    className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                      message.role === "user"
                        ? "wellness-gradient text-primary-foreground"
                        : "bg-secondary text-secondary-foreground"
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{message.content}</p>

                    {shouldShowActionsFor(message) && (
                      <div className="mt-4 space-y-2 pt-4 border-t border-border/20">
                        <Button
                          onClick={handleDownloadPlan}
                          variant="outline"
                          size="sm"
                          className="w-full"
                        >
                          <Download className="w-4 h-4 mr-2" />
                          Download PDF
                        </Button>
                        <Button
                          onClick={handleShareWhatsApp}
                          variant="outline"
                          size="sm"
                          className="w-full"
                        >
                          <Share2 className="w-4 h-4 mr-2" />
                          Share to WhatsApp
                        </Button>
                      </div>
                    )}
                  </div>
                </div>

                {message.quickReplies && message.quickReplies.length > 0 && (
                  <div className="flex flex-wrap gap-2 justify-start">
                    {message.quickReplies.map((reply, idx) => (
                      <Button
                        key={idx}
                        onClick={() => handleQuickReply(reply)}
                        variant="outline"
                        size="sm"
                        className="rounded-full"
                      >
                        {reply}
                      </Button>
                    ))}
                  </div>
                )}
              </div>
            ))}

            {isLoading && (
              <div className="flex justify-start fade-up">
                <div className="bg-secondary text-secondary-foreground rounded-2xl px-4 py-3">
                  <Loader2 className="w-5 h-5 animate-spin" />
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </CardContent>

          <div className="p-4 border-t border-border">
            <div className="flex gap-2">
              <Button
                onClick={handleRestart}
                variant="outline"
                size="icon"
                className="shrink-0"
              >
                <RotateCcw className="w-4 h-4" />
              </Button>
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && handleSend()}
                placeholder="Type your message..."
                disabled={isLoading}
                className="flex-1"
              />
              <Button
                onClick={() => handleSend()}
                disabled={isLoading || !input.trim()}
                className="wellness-gradient shrink-0"
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default Chat;
