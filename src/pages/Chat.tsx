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

  const handleDownloadPlan = () => {
    const lastMessage = messages[messages.length - 1];
    const blob = new Blob([lastMessage.content], { type: "text/plain" });
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
    const lastMessage = messages[messages.length - 1];
    const text = encodeURIComponent(lastMessage.content);
    window.open(`https://wa.me/?text=${text}`, "_blank");
    
    toast({
      title: "Opening WhatsApp",
      description: "Share your plan with friends",
    });
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
                    
                    {message.isFinalPlan && (
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
