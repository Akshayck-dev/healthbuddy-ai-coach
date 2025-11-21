// src/components/Chat.tsx
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
  const { messages, isLoading, sendMessage, resetChat, setUserLanguage } = useFitCoach();
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const handleSend = async (messageText?: string) => {
    const txt = messageText ?? input;
    if (!txt.trim() || isLoading) return;
    setInput("");
    await sendMessage(txt);
  };

  const handleQuickReply = (reply: string) => {
    const r = reply.trim();
    const low = r.toLowerCase();
    if (low.includes("english")) { setUserLanguage("en"); return handleSend("English"); }
    if (low.includes("malayalam") || low.includes("മലയാളം")) { setUserLanguage("ml"); return handleSend("Malayalam"); }
    handleSend(reply);
  };

  const handleRestart = () => { resetChat(); toast({ title: "Chat Reset", description: "Starting new conversation" }); };

  const downloadBase64Pdf = (base64: string, filename = "plan.pdf") => {
    try {
      const byteCharacters = atob(base64);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) byteNumbers[i] = byteCharacters.charCodeAt(i);
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: "application/pdf" });
      const a = document.createElement("a"), url = URL.createObjectURL(blob); a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url);
    } catch (e) { console.error(e); toast({ title: "Download failed" }); }
  };

  const handleDownloadPlan = () => {
    const assistantMsgs = messages.filter(m => m.role === "assistant");
    const lastMessage = assistantMsgs[assistantMsgs.length - 1] || messages[messages.length - 1];
    if (!lastMessage) { toast({ title: "No plan found", description: "No assistant message to download" }); return; }
    if (lastMessage.meta?.pdfUrl) { window.open(lastMessage.meta.pdfUrl, "_blank"); toast({ title: "Opening PDF" }); return; }
    const pdfUrlMatch = (lastMessage.content || "").match(/https?:\/\/\S+\.pdf/);
    if (pdfUrlMatch) { window.open(pdfUrlMatch[0], "_blank"); toast({ title: "Opening PDF" }); return; }
    const dataPdf = (lastMessage.content || "").match(/data:application\/pdf;base64,([A-Za-z0-9+/=]+)/);
    if (dataPdf) { downloadBase64Pdf(dataPdf[1], "healthbuddy-plan.pdf"); toast({ title: "Download Started" }); return; }
    if (lastMessage.meta?.pdfBase64) { downloadBase64Pdf(lastMessage.meta.pdfBase64, "healthbuddy-plan.pdf"); toast({ title: "Download Started" }); return; }
    const blob = new Blob([lastMessage.content || ""], { type: "text/plain" });
    const a = document.createElement("a"), url = URL.createObjectURL(blob); a.href = url; a.download = "healthbuddy-plan.txt"; a.click(); URL.revokeObjectURL(url);
    toast({ title: "Downloaded" });
  };

  const handleShareWhatsApp = () => {
    const assistantMsgs = messages.filter(m => m.role === "assistant");
    const lastMessage = assistantMsgs[assistantMsgs.length - 1] || messages[messages.length - 1];
    if (!lastMessage) { toast({ title: "Nothing to share" }); return; }
    window.open(`https://wa.me/?text=${encodeURIComponent(lastMessage.content || "")}`, "_blank");
    toast({ title: "Opening WhatsApp" });
  };

  const shouldShowActionsFor = (message: Message) => {
    if (!message) return false;
    if (message.isFinalPlan) return true;
    const content = (message.content || "").toLowerCase();
    if (message.quickReplies && message.quickReplies.some(q => q.toLowerCase().includes("download"))) return true;
    if (message.meta && (message.meta.pdfUrl || message.meta.pdfBase64)) return true;
    if (message.role === "assistant" && content.length > 240) return true;
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
            {messages.map((message, idx) => (
              <div key={idx} className="space-y-2 fade-up">
                <div className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[80%] rounded-2xl px-4 py-3 ${message.role === "user" ? "wellness-gradient text-primary-foreground" : "bg-secondary text-secondary-foreground"}`}>
                    <p className="whitespace-pre-wrap">{message.content}</p>
                    {shouldShowActionsFor(message) && (
                      <div className="mt-4 space-y-2 pt-4 border-t border-border/20">
                        <Button onClick={handleDownloadPlan} variant="outline" size="sm" className="w-full"><Download className="w-4 h-4 mr-2" />Download PDF</Button>
                        <Button onClick={handleShareWhatsApp} variant="outline" size="sm" className="w-full"><Share2 className="w-4 h-4 mr-2" />Share to WhatsApp</Button>
                      </div>
                    )}
                  </div>
                </div>

                {message.quickReplies && message.quickReplies.length > 0 && (
                  <div className="flex flex-wrap gap-2 justify-start">
                    {message.quickReplies.map((reply, i) => (
                      <Button key={i} onClick={() => handleQuickReply(reply)} variant="outline" size="sm" className="rounded-full">{reply}</Button>
                    ))}
                  </div>
                )}
              </div>
            ))}

            {isLoading && (
              <div className="flex justify-start fade-up">
                <div className="bg-secondary text-secondary-foreground rounded-2xl px-4 py-3"><Loader2 className="w-5 h-5 animate-spin" /></div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </CardContent>

          <div className="p-4 border-t border-border">
            <div className="flex gap-2">
              <Button onClick={handleRestart} variant="outline" size="icon" className="shrink-0"><RotateCcw className="w-4 h-4" /></Button>
              <Input value={input} onChange={(e) => setInput(e.target.value)} onKeyPress={(e) => e.key === "Enter" && handleSend()} placeholder="Type your message..." disabled={isLoading} className="flex-1" />
              <Button onClick={() => handleSend()} disabled={isLoading || !input.trim()} className="wellness-gradient shrink-0"><Send className="w-4 h-4" /></Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default Chat;
