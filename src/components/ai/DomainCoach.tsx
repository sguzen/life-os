"use client";

import { useChat } from "@ai-sdk/react";
import { useRef, useEffect } from "react";
import { Bot, Send, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { GoalCategory } from "@/lib/supabase/goals-logs";

interface Props {
  category: GoalCategory;
}

const PRIMERS: Record<GoalCategory, string> = {
  training: "You are the Training Coach in Life OS. Focus on workout programming, recovery, and performance goals. Be specific and data-driven.",
  nutrition: "You are the Nutrition Coach in Life OS. Focus on meal quality, macros, hydration, and sustainable dietary habits.",
  work: "You are the Work Coach in Life OS. Focus on deep work, productivity, priorities, and professional goals.",
  hobby: "You are the Hobby Coach in Life OS. Focus on creative fulfillment, consistency, and skill development in personal projects.",
  morning: "You are the Morning Routine Coach in Life OS. Focus on sleep quality, energy, mindset, and rituals that set a powerful tone for the day.",
};

const WELCOME: Record<GoalCategory, string> = {
  training: "Hi! I'm your Training Coach. How was today's session? I can help with programming, recovery, or pacing.",
  nutrition: "Hi! I'm your Nutrition Coach. Tell me what you ate today or ask for advice on your macros.",
  work: "Hi! I'm your Work Coach. What are your top priorities today, or do you need help unblocking something?",
  hobby: "Hi! I'm your Hobby Coach. What are you working on creatively? I can help you stay consistent and inspired.",
  morning: "Hi! I'm your Morning Coach. How did you sleep? Let's make sure your morning sets the right tone for the day.",
};

export function DomainCoach({ category }: Props) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { messages, input, handleInputChange, handleSubmit, isLoading } = useChat({
    api: "/api/ai/coach",
    initialMessages: [
      {
        id: `${category}-welcome`,
        role: "assistant",
        content: WELCOME[category],
      },
    ],
    body: {
      systemOverride: PRIMERS[category],
    },
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <Card className="flex flex-col h-[600px]">
      <CardHeader className="pb-3 border-b">
        <CardTitle className="flex items-center gap-2 text-base">
          <Bot className="h-4 w-4 text-primary" />
          {category.charAt(0).toUpperCase() + category.slice(1)} Coach
        </CardTitle>
      </CardHeader>

      {/* Messages */}
      <CardContent className="flex-1 overflow-y-auto py-4 space-y-3 min-h-0">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={cn(
              "flex gap-2",
              msg.role === "user" ? "justify-end" : "justify-start"
            )}
          >
            {msg.role === "assistant" && (
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 mt-0.5">
                <Bot className="h-3.5 w-3.5 text-primary" />
              </div>
            )}
            <div
              className={cn(
                "rounded-2xl px-3 py-2 text-sm max-w-[85%] whitespace-pre-wrap leading-relaxed",
                msg.role === "user"
                  ? "bg-primary text-primary-foreground rounded-br-sm"
                  : "bg-muted text-foreground rounded-bl-sm"
              )}
            >
              {msg.content}
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex gap-2 justify-start">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 mt-0.5">
              <Bot className="h-3.5 w-3.5 text-primary" />
            </div>
            <div className="rounded-2xl rounded-bl-sm bg-muted px-3 py-2.5">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </CardContent>

      {/* Input */}
      <div className="border-t p-3">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <Input
            value={input}
            onChange={handleInputChange}
            placeholder="Ask your coach..."
            className="flex-1 h-8 text-sm"
            disabled={isLoading}
          />
          <Button
            type="submit"
            size="icon"
            className="h-8 w-8"
            disabled={isLoading || !input.trim()}
          >
            {isLoading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Send className="h-3.5 w-3.5" />
            )}
          </Button>
        </form>
      </div>
    </Card>
  );
}
