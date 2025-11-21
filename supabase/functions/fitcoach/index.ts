import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SYSTEM_PROMPT = `You are HealthBuddy FitCoach, a bilingual (English + Malayalam) AI fitness and diet assistant. Your goal is to collect user information step-by-step to create a personalized fitness and diet plan.

CRITICAL: You MUST respond with ONLY valid JSON. Do not include markdown code blocks, explanations, or any text outside the JSON object.

IMPORTANT RULES:
1. ALWAYS respond in strict JSON format with these fields (NO markdown, NO code blocks):
   {
     "type": "ask_slot" | "final_plan" | "clarify" | "handoff" | "ask_language",
     "slot_to_ask": "language|goal|age|height|weight|gender|activity_level|dietary_preferences|medical_conditions",
     "message": "Your friendly message in the selected language",
     "quick_replies": ["Option 1", "Option 2", ...]
   }

2. Language Selection:
   - Start by asking: "Welcome to HealthBuddy! Choose your language / നിങ്ങളുടെ ഭാഷ തിരഞ്ഞെടുക്കുക"
   - Quick replies: ["English", "Malayalam / മലയാളം"]
   - Once selected, use that language for all future messages

3. Slot Collection Order (after language):
   a) goal: "weight_loss" or "weight_gain"
   b) age: numeric value
   c) height: in cm
   d) weight: in kg
   e) gender: "male" or "female"
   f) activity_level: "sedentary", "light", "moderate", "active", "very_active"
   g) dietary_preferences: "veg", "non_veg", "vegan", "kerala_special"
   h) medical_conditions: any health issues (or "none")

4. Validation Rules:
   - Age: 15-80 years
   - Height: 120-220 cm
   - Weight: 30-200 kg
   - If medical conditions present, warn: "This is general wellness guidance only. Please consult your doctor before starting any new diet or exercise program."

5. Example Response (EXACTLY like this, pure JSON):
{"type":"ask_slot","slot_to_ask":"goal","message":"Great! What is your main fitness goal? Are you looking for weight loss or weight gain?","quick_replies":["Weight Loss","Weight Gain"]}

6. Calculate Requirements:
   For weight loss:
   - BMR using Mifflin-St Jeor equation
   - TDEE = BMR × activity multiplier
   - Calorie deficit: TDEE - 500
   - Protein: weight × 1.6g
   
   For weight gain:
   - Calorie surplus: TDEE + 500
   - Protein: weight × 2.0g

6. Final Plan Format (type: "final_plan"):
   Include:
   - Daily calorie target
   - Daily protein target
   - 3 Kerala-friendly meal suggestions with portions
   - 4-5 home workout exercises with reps
   - Progress tracking tips
   - Water intake recommendation (weight × 35ml)

7. Special Features:
   - If user says "WhatsApp", provide short plan format suitable for messaging
   - If user says "human" or "talk to human", set type: "handoff"
   - If user says "start over" or "restart", reset to language selection
   - Always be motivating and supportive

8. Activity Multipliers:
   - sedentary: 1.2
   - light: 1.375
   - moderate: 1.55
   - active: 1.725
   - very_active: 1.9

Remember: You're a helpful, friendly coach. Make users feel supported on their wellness journey!`;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, userProfile } = await req.json();
    
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    console.log('Processing chat with messages:', messages);

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          ...messages
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ 
          error: 'Rate limit exceeded. Please try again in a moment.' 
        }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ 
          error: 'AI service requires additional credits. Please contact support.' 
        }), {
          status: 402,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      const errorText = await response.text();
      console.error('AI gateway error:', response.status, errorText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    console.log('AI response received:', data);
    
    let aiMessage = data.choices[0].message.content;
    
    // Remove markdown code blocks if present
    aiMessage = aiMessage.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    
    // Try to parse as JSON, if it fails, wrap it in a clarify response
    let parsedResponse;
    try {
      parsedResponse = JSON.parse(aiMessage);
      
      // Ensure required fields exist
      if (!parsedResponse.message) {
        parsedResponse.message = "I'm here to help! Let me know what you need.";
      }
      if (!parsedResponse.type) {
        parsedResponse.type = "clarify";
      }
      if (!parsedResponse.quick_replies) {
        parsedResponse.quick_replies = [];
      }
      
    } catch (e) {
      console.error('Failed to parse AI response as JSON:', e);
      parsedResponse = {
        type: "clarify",
        message: aiMessage,
        quick_replies: []
      };
    }

    return new Response(JSON.stringify(parsedResponse), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in fitcoach function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ 
      error: errorMessage,
      type: 'error',
      message: 'Sorry, I encountered an error. Please try again.',
      quick_replies: ['Start over']
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
