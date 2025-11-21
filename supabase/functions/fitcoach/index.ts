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

// generate uuid (uses webcrypto in Deno)
function uuidv4() {
  return crypto.randomUUID?.() ?? Array.from({ length: 36 })
    .map((_, i) => "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx"[i] ?? "")
    .join("");
}

const SYSTEM_PROMPT = `You are HealthBuddy FitCoach, a bilingual (English + Malayalam) AI fitness and diet assistant. Your job: always respond with ONLY valid JSON (no markdown or additional text) respecting the app's JSON schema:

Required JSON shape:
{
 "type": "ask_slot" | "final_plan" | "clarify" | "handoff" | "ask_language",
 "slot_to_ask": string | null,
 "message": string,
 "quick_replies": string[] (may be [])
}

Follow the app rules for language selection, slot flow, validation, WhatsApp short mode, handoff, and final_plan content. Always include any language returned as \`user_language\` field when you set it.

If you must warn about medical conditions, include language-appropriate warning and set type to "clarify" if needed.

If you receive "WhatsApp" or "short" from user, respond with a compact final_plan suitable for messaging.

Be motivating and supportive.`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const messages = Array.isArray(body?.messages) ? body.messages : [];
    const incomingSessionId =
      typeof body?.session_id === "string" && body.session_id ? body.session_id : uuidv4();
    const incomingLanguage = body?.user_language || ""; // "en" | "ml" or empty
    const wantsPdf = !!body?.generate_pdf; // optional flag from client
    const wantShort =
      !!body?.short || (typeof body?.mode === "string" && body.mode.toLowerCase().includes("whatsapp"));

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({
          error: "LOVABLE_API_KEY is not configured",
          message: "AI service not configured",
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Provide system and session metadata to the model
    const fullMessages = [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "system",
        content: JSON.stringify({
          session_id: incomingSessionId,
          user_language: incomingLanguage,
          want_short: wantShort,
        }),
      },
      ...messages,
    ];

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: fullMessages,
        temperature: 0.2,
        max_output_tokens: 1400,
      }),
    });

    if (!aiResp.ok) {
      const statusText = await aiResp.text();
      console.error("AI gateway non-ok:", aiResp.status, statusText);
      if (aiResp.status === 429) {
        return new Response(
          JSON.stringify({ error: "rate_limited", message: "Rate limit exceeded. Try again shortly." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      if (aiResp.status === 402) {
        return new Response(
          JSON.stringify({ error: "payment_required", message: "AI service requires credits." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      return new Response(
        JSON.stringify({ error: "ai_error", message: "AI gateway returned an error." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const aiData = await aiResp.json().catch((e) => {
      console.error("Failed to parse AI JSON:", e);
      return null;
    });

    // Extract model content
    let aiMessageRaw = "";
    try {
      if (aiData?.choices?.[0]?.message?.content) {
        aiMessageRaw = String(aiData.choices[0].message.content);
      } else if (aiData?.output_text) {
        aiMessageRaw = String(aiData.output_text);
      } else {
        aiMessageRaw = JSON.stringify(aiData);
      }
    } catch (e) {
      aiMessageRaw = JSON.stringify(aiData);
    }

    // Clean fences and whitespace
    aiMessageRaw = aiMessageRaw.replace(/```json\s*|```/g, "").trim();

    // Try parsing to JSON
    let parsed = null;
    try {
      parsed = JSON.parse(aiMessageRaw);
    } catch (e) {
      const match = aiMessageRaw.match(/\{[\s\S]*\}/);
      if (match) {
        try {
          parsed = JSON.parse(match[0]);
        } catch (e2) {
          parsed = null;
        }
      } else {
        parsed = null;
      }
    }

    // If parsing failed, return clarify
    if (!parsed || typeof parsed !== "object") {
      const clarify = {
        type: "clarify",
        slot_to_ask: null,
        message: typeof aiMessageRaw === "string" ? aiMessageRaw : "I couldn't parse the AI response. Please try again.",
        quick_replies: [],
        session_id: incomingSessionId,
      };
      return new Response(JSON.stringify(clarify), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
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

    // --- Fixes / Enforcement: ensure ask_slot returns useful quick_replies ---
    if (safe.type === "ask_slot" && safe.slot_to_ask) {
      const slot = String(safe.slot_to_ask).toLowerCase();
      if (!safe.quick_replies || safe.quick_replies.length === 0) {
        if (slot === "activity_level") {
          safe.quick_replies = ["Sedentary", "Light", "Moderate", "Active", "Very_active"];
        } else if (slot === "goal") {
          safe.quick_replies = ["Weight Loss", "Weight Gain"];
        } else if (slot === "dietary_preferences" || slot === "food_pref") {
          safe.quick_replies = ["veg", "non_veg", "vegan", "kerala_special"];
        } else if (slot === "gender") {
          safe.quick_replies = ["male", "female", "other"];
        } else {
          // generic fallback: yes / no / start over
          safe.quick_replies = ["Yes", "No", "Start over"];
        }
      }
    }

    // Ensure final_plan contains structured message if parsed structure exists
    if (safe.type === "final_plan") {
      // If structured fields exist, build a readable message fallback
      try {
        const structuredParts: string[] = [];
        if (parsed.daily_calorie_target) structuredParts.push(`Daily Calorie Target: ${parsed.daily_calorie_target}`);
        if (parsed.daily_protein_target) structuredParts.push(`Daily Protein Target: ${parsed.daily_protein_target}`);
        if (Array.isArray(parsed.meal_suggestions)) {
          structuredParts.push("");
          structuredParts.push("Meal Suggestions:");
          parsed.meal_suggestions.forEach((m: any) => {
            structuredParts.push(`${m.meal}: ${m.description}${m.portion_control_tip ? " ("+m.portion_control_tip+")":""}`);
          });
        }
        if (Array.isArray(parsed.home_workout_exercises)) {
          structuredParts.push("");
          structuredParts.push("Workout Plan:");
          parsed.home_workout_exercises.forEach((w: any) => {
            structuredParts.push(`${w.exercise} — ${w.sets_reps}`);
          });
        }
        if (!safe.message || safe.message.length < 50) {
          // attach parsed message summary
          safe.message = (parsed.message ? String(parsed.message) + "\n\n" : "") + structuredParts.join("\n");
        }
      } catch (e) {
        // ignore
      }

      // Guarantee useful quick_replies for final_plan
      safe.quick_replies = safe.quick_replies && safe.quick_replies.length ? safe.quick_replies : ["Download PDF", "WhatsApp", "Start over"];
    }

    // Detect medical conditions and add warning if present
    if (safe.type === "final_plan" && typeof parsed.medical_conditions === "string" && parsed.medical_conditions.toLowerCase() !== "none") {
      const warn = incomingLanguage === "ml" ? "ഈ പൊതുവായ ആരോഗ്യ നിർദ്ദേശങ്ങൾ മാത്രമാണ്. മെഡിക്കൽ ഉപദേശത്തിന് ഡോക്ടറെ സമീപിക്കുക." : "This is general wellness guidance only. Please consult your doctor before starting any new diet or exercise program.";
      safe.message = `${warn}\n\n${safe.message}`;
    }

    // ---------- REPLACED PDF BLOCK (Table-based beautiful layout) ----------
    // Generate PDF and attach meta.pdfBase64/pdfUrl if requested
    const isFinal = safe.type === "final_plan";
    if (isFinal && wantsPdf) {
      try {
        const { PDFDocument, StandardFonts, rgb } = await import(PDF_LIB_URL);

        // Use your uploaded logo (local path). In deployment replace with HTTP URL if necessary.
        const logoUrl = "file:///mnt/data/4424472f-1a30-4556-9715-1f00fa5514e1.png";
        let logoBytes: Uint8Array | null = null;
        try {
          const logoResp = await fetch(logoUrl);
          if (logoResp.ok) logoBytes = new Uint8Array(await logoResp.arrayBuffer());
        } catch (e) {
          console.warn("Logo fetch failed (ok if using local path placeholder):", e);
        }

        const pdfDoc = await PDFDocument.create();
        let page = pdfDoc.addPage();
        const { width, height } = page.getSize();
        const margin = 36;
        let cursorY = height - margin;

        const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
        const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

        // Header bar
        const headerHeight = 56;
        page.drawRectangle({
          x: 0,
          y: height - headerHeight,
          width,
          height: headerHeight,
          color: rgb(0.28, 0.7, 0.35),
        });

        // Optional logo (left)
        const logoSize = 40;
        if (logoBytes) {
          try {
            let embeddedImage;
            if (logoBytes[0] === 0x89) {
              embeddedImage = await pdfDoc.embedPng(logoBytes);
            } else {
              embeddedImage = await pdfDoc.embedJpg(logoBytes);
            }
            page.drawImage(embeddedImage, {
              x: margin,
              y: height - margin - logoSize + 6,
              width: logoSize,
              height: logoSize,
            });
          } catch (e) {
            console.warn("Logo embed failed:", e);
          }
        }

        // Header text (right of logo)
        const titleX = margin + (logoBytes ? logoSize + 12 : 0);
        page.drawText("HealthBuddy", {
          x: titleX,
          y: height - margin - 8,
          size: 18,
          font: boldFont,
          color: rgb(1, 1, 1),
        });
        page.drawText("Personalized Fitness Plan", {
          x: titleX,
          y: height - margin - 26,
          size: 10,
          font,
          color: rgb(1, 1, 1),
        });

        cursorY = height - headerHeight - 18;

        // small meta row: date & session
        page.drawText(`Date: ${new Date().toLocaleDateString()}`, {
          x: margin,
          y: cursorY,
          size: 9,
          font,
          color: rgb(0.2, 0.2, 0.2),
        });
        page.drawText(`Session: ${incomingSessionId}`, {
          x: width - margin - 160,
          y: cursorY,
          size: 9,
          font,
          color: rgb(0.2, 0.2, 0.2),
        });
        cursorY -= 20;

        // Helper: draw table (simple bordered rows)
        function drawTable(x: number, startY: number, colWidths: number[], headers: string[], rows: string[][]) {
          const rowHeight = 20;
          let y = startY;
          // header background
          page.drawRectangle({
            x,
            y: y - rowHeight,
            width: colWidths.reduce((a, b) => a + b, 0),
            height: rowHeight,
            color: rgb(0.95, 0.98, 0.95),
          });

          // header text
          let hx = x + 6;
          for (let i = 0; i < headers.length; i++) {
            page.drawText(headers[i], { x: hx, y: y - 15, size: 10, font: boldFont, color: rgb(0.15, 0.15, 0.15) });
            hx += colWidths[i];
          }

          // horizontal line under header
          page.drawLine({ start: { x, y: y - rowHeight }, end: { x: x + colWidths.reduce((a, b) => a + b, 0), y: y - rowHeight }, thickness: 0.5, color: rgb(0.85, 0.85, 0.85) });

          y -= rowHeight;

          // rows
          for (const r of rows) {
            let cx = x + 6;
            for (let i = 0; i < r.length; i++) {
              page.drawText(r[i], { x: cx, y: y - 14, size: 10, font, color: rgb(0.1, 0.1, 0.1) });
              cx += colWidths[i];
            }
            // row separator
            page.drawLine({ start: { x, y: y - rowHeight }, end: { x: x + colWidths.reduce((a, b) => a + b, 0), y: y - rowHeight }, thickness: 0.35, color: rgb(0.92, 0.92, 0.92) });
            y -= rowHeight;
            // if near bottom, create new page
            if (y < margin + 80) {
              page = pdfDoc.addPage();
              y = page.getSize().height - margin;
            }
          }

          return y;
        }

        // 1) Summary table (Calories / Protein / Water)
        const summaryX = margin;
        const summaryWidth = width - margin * 2;
        const summaryCols = [summaryWidth / 3, summaryWidth / 3, summaryWidth / 3];
        const summaryHeaders = ["Calories (kcal/day)", "Protein (g/day)", "Water (ml/day)"];

        // try to parse numbers from safe.message.meta if available
        const calories = safe.meta?.calories || (typeof safe.message === "string" ? (safe.message.match(/Calories[:\s]*([\d,]+)/i)?.[1] ?? "") : "");
        const protein = safe.meta?.protein || (typeof safe.message === "string" ? (safe.message.match(/Protein[:\s]*([\d,]+)/i)?.[1] ?? "") : "");
        const water = safe.meta?.water || (typeof safe.message === "string" ? (safe.message.match(/Water[:\s]*([\d,]+)/i)?.[1] ?? "") : "");

        const summaryRows = [[String(calories), String(protein), String(water)]];
        cursorY = drawTable(summaryX, cursorY, summaryCols, summaryHeaders, summaryRows) - 18;

        // 2) Meal Plan table (3 meals)
        const mealX = margin;
        const mealWidth = width - margin * 2;
        const mealCols = [mealWidth * 0.18, mealWidth * 0.62, mealWidth * 0.2]; // Time | Items | Portions
        const mealHeaders = ["Meal", "Items", "Portion"];
        // Attempt to extract three meal lines from safe.message (very heuristic)
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

        // 3) Workout table
        const workoutX = margin;
        const workoutWidth = width - margin * 2;
        const workoutCols = [workoutWidth * 0.6, workoutWidth * 0.4]; // Exercise | Reps
        const workoutHeaders = ["Exercise", "Sets × Reps / Duration"];
        const workouts: string[][] = [];

        // Heuristically extract some exercises from the plan text
        const workoutMatches = typeof safe.message === "string" ? safe.message.match(/Workout[:\s]*([\s\S]*?)(?=\n\S|$)/i) : null;
        if (workoutMatches) {
          const wLines = workoutMatches[1].split("\n").map((l: string) => l.trim()).filter(Boolean);
          for (const wl of wLines) {
            const parts = wl.split(/[:\-–]/).map(p => p.trim());
            workouts.push([parts[0] || wl, parts[1] || "3 × 12"]);
          }
        } else {
          // fallback default routine
          workouts.push(["Push-ups", "3 × 12"]);
          workouts.push(["Bodyweight Squats", "3 × 15"]);
          workouts.push(["Plank", "3 × 30s"]);
          workouts.push(["Walking / Jogging", "20 min"]);
        }

        cursorY = drawTable(workoutX, cursorY, workoutCols, workoutHeaders, workouts) - 18;

        // 4) Tips section (simple bullets)
        const tips = safe.meta?.tips || [
          "Drink water regularly throughout the day.",
          "Aim for 7-8 hours of sleep.",
          "Track progress weekly and adjust calories as needed.",
        ];
        // Title
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

        // Footer small note
        page.drawText("Generated by HealthBuddy • General wellness guidance only", { x: margin, y: margin - 6, size: 9, font, color: rgb(0.5, 0.5, 0.5) });

        const pdfBytes = await pdfDoc.save();
        const pdfBase64Local = btoa(String.fromCharCode(...pdfBytes));
        // attach to safe.meta below
        safe.meta = { ...(safe.meta || {}), pdfBase64: pdfBase64Local };

        // Attempt to upload like before
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
        console.error("PDF (table) generation error:", err);
      }
    }
    // ---------- END REPLACED PDF BLOCK ----------

    // Return safe response and include session id so client persists it
    const out = {
      ...safe,
      session_id: incomingSessionId,
      timestamp: new Date().toISOString(),
    };

    return new Response(JSON.stringify(out), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Unhandled error in fitcoach:", err);
    return new Response(
      JSON.stringify({
        error: err instanceof Error ? err.message : String(err),
        message: "An internal error occurred. Please try again.",
        quick_replies: ["Start over"],
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
