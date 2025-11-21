// supabase/functions/fitcoach/index.ts
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// PDF library
const PDF_LIB_URL = "https://esm.sh/pdf-lib@1.17.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

function uuidv4() {
  return crypto.randomUUID?.() ?? Array.from({ length: 36 })
    .map((_, i) => "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx"[i] ?? "")
    .join("");
}

/**
 * SYSTEM PROMPT: instruct the model to reply with strict JSON shape.
 * The model should still follow the app slot order:
 * 1) language (handled client-side if not set)
 * 2) goal (weight_loss / weight_gain)
 * 3) current_weight_kg
 * 4) target_weight_kg
 * 5) height_cm
 * 6) wrist_cm (or 'skip')
 * 7) age
 * 8) gender
 * 9) activity_level
 * 10) food_pref
 * 11) allergies (or 'none')
 */
const SYSTEM_PROMPT = `You are HealthBuddy FitCoach, bilingual (English + Malayalam). ALWAYS respond with a single JSON object (no markdown/text outside JSON). Shape:
{
 "type":"ask_slot"|"final_plan"|"clarify"|"handoff"|"ask_language",
 "slot_to_ask": string | null,
 "message": string,
 "quick_replies": string[] // may be []
}
Follow slot order: goal, current_weight_kg, target_weight_kg, height_cm, wrist_cm, age, gender, activity_level, food_pref, allergies.
Validate numbers: age 15-80, height 120-220, weight 30-200. If invalid, ask again with validation message in user's language. When final_plan, include structured fields: daily_calorie_target, daily_protein_target, meal_suggestions (array), home_workout_exercises (array), water_ml, tips. Include user_language when set.`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const messages = Array.isArray(body?.messages) ? body.messages : [];
    const incomingSessionId =
      typeof body?.session_id === "string" && body.session_id ? body.session_id : uuidv4();
    const incomingLanguage = body?.user_language || ""; // "en"|"ml" or empty
    const wantsPdf = !!body?.generate_pdf;
    const wantShort =
      !!body?.short || (typeof body?.mode === "string" && body.mode.toLowerCase().includes("whatsapp"));

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY not set" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const fullMessages = [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "system", content: JSON.stringify({ session_id: incomingSessionId, user_language: incomingLanguage, want_short: wantShort }) },
      ...messages,
    ];

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "google/gemini-2.5-flash", messages: fullMessages, temperature: 0.2, max_output_tokens: 1400 }),
    });

    if (!aiResp.ok) {
      const text = await aiResp.text();
      console.error("AI error:", aiResp.status, text);
      if (aiResp.status === 429) return new Response(JSON.stringify({ error: "rate_limited", message: "Rate limit exceeded" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (aiResp.status === 402) return new Response(JSON.stringify({ error: "payment_required", message: "AI service needs credits" }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      return new Response(JSON.stringify({ error: "ai_gateway", message: "AI gateway error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const aiData = await aiResp.json().catch(() => null);
    let aiMessageRaw = "";
    if (aiData?.choices?.[0]?.message?.content) aiMessageRaw = String(aiData.choices[0].message.content);
    else if (aiData?.output_text) aiMessageRaw = String(aiData.output_text);
    else aiMessageRaw = JSON.stringify(aiData);

    aiMessageRaw = aiMessageRaw.replace(/```json\s*|```/g, "").trim();

    // Try to parse JSON from model response
    let parsed = null;
    try { parsed = JSON.parse(aiMessageRaw); } catch (e) {
      const match = aiMessageRaw.match(/\{[\s\S]*\}/);
      if (match) {
        try { parsed = JSON.parse(match[0]); } catch { parsed = null; }
      }
    }

    if (!parsed || typeof parsed !== "object") {
      // fallback: return clarify with the raw content
      return new Response(JSON.stringify({
        type: "clarify",
        slot_to_ask: null,
        message: typeof aiMessageRaw === "string" ? aiMessageRaw : "I couldn't parse the AI response.",
        quick_replies: [],
        session_id: incomingSessionId,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Build safe response
    const safe: any = {
      type: parsed.type || "clarify",
      slot_to_ask: parsed.slot_to_ask ?? null,
      message: parsed.message || "",
      quick_replies: Array.isArray(parsed.quick_replies) ? parsed.quick_replies : [],
      user_language: parsed.user_language || incomingLanguage || "",
      meta: parsed.meta || {},
      session_id: incomingSessionId,
    };

    // Defensive quick replies for slots if model omitted them
    if (safe.type === "ask_slot" && safe.slot_to_ask) {
      const s = String(safe.slot_to_ask).toLowerCase();
      if (!safe.quick_replies || safe.quick_replies.length === 0) {
        if (s === "goal") safe.quick_replies = ["Weight Loss", "Weight Gain"];
        else if (s === "activity_level") safe.quick_replies = ["sedentary", "light", "moderate", "active", "very_active"];
        // else if (s === "dietary_preferences" || s === "food_pref") safe.quick_replies = ["vegetarian", "non-veg", "mixed", "vegan", "kerala_special"];
          else if (slot.includes("diet")) {
  safe.quick_replies = ["Veg", "Non-Veg", "Vegan", "Kerala Special"];
}

        else if (s === "gender") safe.quick_replies = ["male", "female", "other"];
        else safe.quick_replies = ["Yes", "No", "Start over"];
      }
    }

    // Enforce validation for numeric slots if model asks for them
    // If parsed provides a `validation` field, let model handle it; here we ensure slot names are consistent
    // Ensure final_plan builds readable fallback from structured fields
    if (safe.type === "final_plan") {
      try {
        const parts: string[] = [];
        if (parsed.daily_calorie_target) parts.push(`Daily Calorie Target: ${parsed.daily_calorie_target}`);
        if (parsed.daily_protein_target) parts.push(`Daily Protein Target: ${parsed.daily_protein_target}`);
        if (parsed.water_ml) parts.push(`Water (ml/day): ${parsed.water_ml}`);
        if (Array.isArray(parsed.meal_suggestions)) {
          parts.push("");
          parts.push("Meal suggestions:");
          parsed.meal_suggestions.forEach((m: any) => {
            parts.push(`${m.meal}: ${m.description}${m.portion_control_tip ? " (" + m.portion_control_tip + ")" : ""}`);
          });
        }
        if (Array.isArray(parsed.home_workout_exercises)) {
          parts.push("");
          parts.push("Workout:");
          parsed.home_workout_exercises.forEach((w: any) => {
            parts.push(`${w.exercise} — ${w.sets_reps}`);
          });
        }
        if (!safe.message || safe.message.length < 80) safe.message = (parsed.message ? String(parsed.message) + "\n\n" : "") + parts.join("\n");
      } catch {}
      safe.quick_replies = safe.quick_replies && safe.quick_replies.length ? safe.quick_replies : ["Download PDF", "WhatsApp", "Start over"];
    }

    // Medical safety addition
    if (safe.type === "final_plan" && typeof parsed.medical_conditions === "string" && parsed.medical_conditions.toLowerCase() !== "none") {
      const warn = safe.user_language === "ml" ? "ഈ പൊതുവായ ആരോഗ്യ നിർദ്ദേശങ്ങൾ മാത്രമാണ്. ഡോക്ടറെ സമീപിക്കുക." : "This is general wellness guidance only. Please consult your doctor.";
      safe.message = `${warn}\n\n${safe.message}`;
    }

    // PDF generation (table-based) when client requested
    const isFinal = safe.type === "final_plan";
    if (isFinal && wantsPdf) {
      try {
        const { PDFDocument, StandardFonts, rgb } = await import(PDF_LIB_URL);
        const logoUrl = "file:///mnt/data/4424472f-1a30-4556-9715-1f00fa5514e1.png";
        let logoBytes: Uint8Array | null = null;
        try {
          const logoResp = await fetch(logoUrl);
          if (logoResp.ok) logoBytes = new Uint8Array(await logoResp.arrayBuffer());
        } catch {}
        const pdfDoc = await PDFDocument.create();
        let page = pdfDoc.addPage();
        const { width, height } = page.getSize();
        const margin = 36;
        let cursorY = height - margin;
        const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
        const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

        // header
        const headerHeight = 56;
        page.drawRectangle({ x: 0, y: height - headerHeight, width, height: headerHeight, color: rgb(0.24, 0.56, 0.35) });
        const logoSize = 40;
        if (logoBytes) {
          try {
            const embeddedImage = logoBytes[0] === 0x89 ? await pdfDoc.embedPng(logoBytes) : await pdfDoc.embedJpg(logoBytes);
            page.drawImage(embeddedImage, { x: margin, y: height - margin - logoSize + 6, width: logoSize, height: logoSize });
          } catch {}
        }
        const titleX = margin + (logoBytes ? logoSize + 12 : 0);
        page.drawText("HealthBuddy", { x: titleX, y: height - margin - 8, size: 18, font: boldFont, color: rgb(1, 1, 1) });
        page.drawText("Personalized Fitness Plan", { x: titleX, y: height - margin - 26, size: 10, font, color: rgb(1, 1, 1) });
        cursorY = height - headerHeight - 18;
        page.drawText(`Date: ${new Date().toLocaleDateString()}`, { x: margin, y: cursorY, size: 9, font, color: rgb(0.2, 0.2, 0.2) });
        page.drawText(`Session: ${incomingSessionId}`, { x: width - margin - 160, y: cursorY, size: 9, font, color: rgb(0.2, 0.2, 0.2) });
        cursorY -= 20;

        // helper drawTable
        function drawTable(x: number, startY: number, colWidths: number[], headers: string[], rows: string[][]) {
          const rowHeight = 20;
          let y = startY;
          page.drawRectangle({ x, y: y - rowHeight, width: colWidths.reduce((a, b) => a + b, 0), height: rowHeight, color: rgb(0.95, 0.98, 0.95) });
          let hx = x + 6;
          for (let i = 0; i < headers.length; i++) {
            page.drawText(headers[i], { x: hx, y: y - 15, size: 10, font: boldFont, color: rgb(0.15, 0.15, 0.15) });
            hx += colWidths[i];
          }
          page.drawLine({ start: { x, y: y - rowHeight }, end: { x: x + colWidths.reduce((a, b) => a + b, 0), y: y - rowHeight }, thickness: 0.5, color: rgb(0.85, 0.85, 0.85) });
          y -= rowHeight;
          for (const r of rows) {
            let cx = x + 6;
            for (let i = 0; i < r.length; i++) {
              page.drawText(r[i], { x: cx, y: y - 14, size: 10, font, color: rgb(0.1, 0.1, 0.1) });
              cx += colWidths[i];
            }
            page.drawLine({ start: { x, y: y - rowHeight }, end: { x: x + colWidths.reduce((a, b) => a + b, 0), y: y - rowHeight }, thickness: 0.35, color: rgb(0.92, 0.92, 0.92) });
            y -= rowHeight;
            if (y < margin + 80) {
              page = pdfDoc.addPage();
              y = page.getSize().height - margin;
            }
          }
          return y;
        }

        // Summary row
        const summaryX = margin;
        const summaryWidth = width - margin * 2;
        const summaryCols = [summaryWidth / 3, summaryWidth / 3, summaryWidth / 3];
        const summaryHeaders = ["Calories (kcal/day)", "Protein (g/day)", "Water (ml/day)"];
        const calories = safe.meta?.calories || (typeof safe.message === "string" ? (safe.message.match(/Calories[:\s]*([\d,]+)/i)?.[1] ?? "") : "");
        const protein = safe.meta?.protein || (typeof safe.message === "string" ? (safe.message.match(/Protein[:\s]*([\d,]+)/i)?.[1] ?? "") : "");
        const water = safe.meta?.water || (typeof safe.message === "string" ? (safe.message.match(/Water[:\s]*([\d,]+)/i)?.[1] ?? "") : "");
        const summaryRows = [[String(calories), String(protein), String(water)]];
        cursorY = drawTable(summaryX, cursorY, summaryCols, summaryHeaders, summaryRows) - 18;

        // Meal table (heuristic extraction)
        const mealX = margin;
        const mealWidth = width - margin * 2;
        const mealCols = [mealWidth * 0.18, mealWidth * 0.62, mealWidth * 0.2];
        const mealHeaders = ["Meal", "Items", "Portion"];
        const mealRows: string[][] = [];
        const mealMatches = typeof safe.message === "string" ? safe.message.match(/Breakfast[:\s]*([\s\S]*?)Lunch[:\s]*([\s\S]*?)Dinner[:\s]*([\s\S]*?)(?=\n\S|$)/i) : null;
        if (mealMatches) {
          mealRows.push(["Breakfast", mealMatches[1].trim().replace(/\n+/g, ", "), "As suggested"]);
          mealRows.push(["Lunch", mealMatches[2].trim().replace(/\n+/g, ", "), "As suggested"]);
          mealRows.push(["Dinner", mealMatches[3].trim().replace(/\n+/g, ", "), "As suggested"]);
        } else {
          const lines = (typeof safe.message === "string" ? safe.message : "").split("\n").map((l: string) => l.trim()).filter(Boolean);
          for (let i = 0; i < Math.min(3, lines.length); i++) {
            mealRows.push([`Meal ${i+1}`, lines[i], "As suggested"]);
          }
          if (mealRows.length === 0) {
            mealRows.push(["Breakfast", "Idli / Dosa / Upma", "1 serving"]);
            mealRows.push(["Lunch", "Rice + Sambar + Veg", "Moderate"]);
            mealRows.push(["Dinner", "Chapati + Veg + Salad", "Moderate"]);
          }
        }
        cursorY = drawTable(mealX, cursorY, mealCols, mealHeaders, mealRows) - 18;

        // Workout table (heuristic)
        const workoutX = margin;
        const workoutWidth = width - margin * 2;
        const workoutCols = [workoutWidth * 0.6, workoutWidth * 0.4];
        const workoutHeaders = ["Exercise", "Sets × Reps / Duration"];
        const workouts: string[][] = [];
        const workoutMatches = typeof safe.message === "string" ? safe.message.match(/Workout[:\s]*([\s\S]*?)(?=\n\S|$)/i) : null;
        if (workoutMatches) {
          const wLines = workoutMatches[1].split("\n").map((l: string) => l.trim()).filter(Boolean);
          for (const wl of wLines) {
            const parts = wl.split(/[:\-–]/).map(p => p.trim());
            workouts.push([parts[0] || wl, parts[1] || "3 × 12"]);
          }
        } else {
          workouts.push(["Push-ups", "3 × 12"]);
          workouts.push(["Bodyweight Squats", "3 × 15"]);
          workouts.push(["Plank", "3 × 30s"]);
          workouts.push(["Walking / Jogging", "20 min"]);
        }
        cursorY = drawTable(workoutX, cursorY, workoutCols, workoutHeaders, workouts) - 18;

        // Tips
        const tips = safe.meta?.tips || [
          "Drink water regularly throughout the day.",
          "Aim for 7-8 hours of sleep.",
          "Track progress weekly and adjust calories as needed.",
        ];
        page.drawText("Simple Tips", { x: margin, y: cursorY, size: 12, font: boldFont, color: rgb(0.15, 0.15, 0.15) });
        cursorY -= 18;
        for (const t of tips) {
          page.drawText("• " + t, { x: margin + 6, y: cursorY, size: 11, font, color: rgb(0.12, 0.12, 0.12) });
          cursorY -= 14;
          if (cursorY < margin + 60) {
            page = pdfDoc.addPage();
            cursorY = page.getSize().height - margin;
          }
        }

        page.drawText("Generated by HealthBuddy • General wellness guidance only", { x: margin, y: margin - 6, size: 9, font, color: rgb(0.5, 0.5, 0.5) });

        const pdfBytes = await pdfDoc.save();
        const pdfBase64Local = btoa(String.fromCharCode(...pdfBytes));
        safe.meta = { ...(safe.meta || {}), pdfBase64: pdfBase64Local };

        const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
        const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_KEY");
        if (SUPABASE_URL && SUPABASE_SERVICE_KEY) {
          const bucket = "plans";
          const filename = `${incomingSessionId}/${Date.now()}.pdf`;
          const uploadUrl = `${SUPABASE_URL.replace(/\/$/, "")}/storage/v1/object/${bucket}/${encodeURIComponent(filename)}`;
          const uploadResp = await fetch(uploadUrl, {
            method: "PUT",
            headers: {
              Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
              "Content-Type": "application/pdf",
              "x-upsert": "true",
            },
            body: new Uint8Array(pdfBytes),
          });
          if (uploadResp.ok) {
            const pdfUrlLocal = `${SUPABASE_URL.replace(/\/$/, "")}/storage/v1/object/public/${bucket}/${encodeURIComponent(filename)}`;
            safe.meta = { ...(safe.meta || {}), pdfUrl: pdfUrlLocal };
          } else {
            console.warn("Failed to upload PDF to Supabase Storage:", uploadResp.status, await uploadResp.text());
          }
        }
      } catch (err) {
        console.error("PDF generation error:", err);
      }
    }

    const out = { ...safe, session_id: incomingSessionId, timestamp: new Date().toISOString() };
    return new Response(JSON.stringify(out), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (err) {
    console.error("Unhandled error:", err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : String(err), message: "Internal error", quick_replies: ["Start over"] }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
