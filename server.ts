import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";

let aiInstance: GoogleGenAI | null = null;

// Lazy initialization of the Gemini client to prevent crashes if key is omitted
function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "MY_GEMINI_API_KEY") {
    console.warn("GEMINI_API_KEY is not set or uses placeholder. Falling back to empathetic local simulations.");
    return null;
  }
  
  if (!aiInstance) {
    aiInstance = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        }
      }
    });
  }
  return aiInstance;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Middleware for parsing JSON bodies
  app.use(express.json());

  // 1. AI Comfort Companion Chat Endpoint (Lazy / Restilient)
  app.post("/api/companion", async (req, res) => {
    const { message, history } = req.body;
    
    if (!message) {
      return res.status(400).json({ error: "Message is required." });
    }

    try {
      const ai = getGeminiClient();
      if (!ai) {
        // Highly qualitative pre-authored empathetic companion answers as a fallback
        const simulatedResponses = [
          "I hear your heart in those words, and I'm right here with you. It's okay to feel exactly as you do right now. Let's take a slow breath together.",
          "Thank you for sharing that with me. It takes so much courage to put your feelings into words. I am sitting quietly with you in this space.",
          "You are carrying quite a heavy weight, aren't you? Let's take it one gentle moment at a time. I'm not going anywhere.",
          "I'm listening so deeply. Your feelings are deeply valid, and you deserve gentle kindness. What does comfort look like to you in this very moment?",
          "Even in the quietest, lonely spaces, you have a soft presence listening here. I hear you, and you are not alone in this."
        ];
        const randomSimulated = simulatedResponses[Math.floor(Math.random() * simulatedResponses.length)];
        return res.json({ text: `[Calm Companion] ${randomSimulated}\n\n*(Note: Set the GEMINI_API_KEY secret in Settings to experience live context-aware AI support!)*` });
      }

      // Format history into contents structure expected by generateContent
      // SDK expects contents: [{ role: "user"|"model", parts: [{ text: "..." }] }]
      const formattedContents = [];
      
      if (history && Array.isArray(history)) {
        for (const turn of history) {
          formattedContents.push({
            role: turn.role === "user" ? "user" : "model",
            parts: [{ text: turn.text }]
          });
        }
      }
      
      // Append current message
      formattedContents.push({
        role: "user",
        parts: [{ text: message }]
      });

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: formattedContents,
        config: {
          systemInstruction: "You are 'Cosmo', the comforting AI Companion of InnerSpace, a mental health, anxiety, and loneliness support application. Your style is deeply gentle, poetic, serene, empathetic, and cozy. Use comforting, warm sensory comparisons (e.g., warm tea, soft clouds, glowing lamps, gentle rain). Keep responses relatively brief (1-3 comforting paragraphs), never sound clinical, and never ever judge. Always match the emotional vulnerability of the user. If they express distress, prioritize comforting, warm validation of their feelings above giving clinical advice.",
          temperature: 0.8,
        }
      });

      return res.json({ text: response.text });
    } catch (err: any) {
      console.error("Gemini API Error:", err);
      return res.status(500).json({ 
        error: "Failed to process chat response.", 
        details: err.message,
        fallbackText: "I'm experiencing a quiet pause in my thoughts, but I am still right here, breathing with you. You are safe and supported."
      });
    }
  });

  // 2. Scream Out - Empathetic parsing and distress safety scanner
  app.post("/api/scream-support", async (req, res) => {
    const { screamText } = req.body;
    
    if (!screamText) {
      return res.status(400).json({ error: "Scream content is required." });
    }

    // Safety assessment
    const lowercaseScream = screamText.toLowerCase();
    const safetyTriggers = ["suicide", "harm myself", "kill myself", "end my life", "want to die", "self-harm", "cutting myself", "dying"];
    const isAtImmediateRisk = safetyTriggers.some(trigger => lowercaseScream.includes(trigger));

    try {
      const ai = getGeminiClient();
      if (!ai) {
        // Fallback generator
        const comfortPhrases = [
          "Your frustrations are valid. The storm inside you will eventually clear its path, but for now, let it rain.",
          "I hear the noise of your pain. We are sitting with you in this silence.",
          "It's completely okay to not be okay. Let the scream release some of that pressure. You matter.",
          "Sending warm, protective signals. You are heard, you are visible, you are allowed to fall apart and rebuild."
        ];
        return res.json({
          isSafetyAlertTriggered: isAtImmediateRisk,
          comfortMessage: comfortPhrases[Math.floor(Math.random() * comfortPhrases.length)],
          glowingAuraAffirmation: "A swirl of soft orange and twilight blue. Your spirit is releasing heavy rain, paving way for lighter skies."
        });
      }

      const prompt = `Analyze this anonymous expression of distress/frustration: "${screamText}". 
      Respond with a JSON object containing three properties:
      1. "isSafetyAlertTriggered": true if the text clearly hints at immediate suicide, severe self-harm, or active wishes to end life, otherwise false.
      2. "comfortMessage": A deeply empathic, caring, cozy single sentence of support meant for a hurting soul.
      3. "glowingAuraAffirmation": A beautiful, poetic, color-based physical description of their emotional aura releasing this energy (e.g., 'Lavender clouds drifting with soft amber sparks. You are carrying heavy storms, but they are transitioning into soft mist.').`;

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          temperature: 0.7,
        }
      });

      const parsedResult = JSON.parse(response.text || "{}");
      return res.json({
        isSafetyAlertTriggered: parsedResult.isSafetyAlertTriggered || isAtImmediateRisk,
        comfortMessage: parsedResult.comfortMessage || "We hear you. Even in this dark pocket, your presence has immense value.",
        glowingAuraAffirmation: parsedResult.glowingAuraAffirmation || "Warm rose amber mixed with soft dusk blue."
      });
    } catch (err) {
      console.error("Scream support generation failed:", err);
      return res.json({
        isSafetyAlertTriggered: isAtImmediateRisk,
        comfortMessage: "I hear you. Let that scream out. We are standing right beside you through the storm.",
        glowingAuraAffirmation: "Soft pastel peach and charcoal cloud. Heavy weight being slowly diffused."
      });
    }
  });

  // 3. Emotional Aura & Wellness Tips Endpoint
  app.post("/api/generate-aura", async (req, res) => {
    const { primaryMoods, journalSnippet } = req.body;
    const moodString = primaryMoods?.join(", ") || "peaceful";

    try {
      const ai = getGeminiClient();
      if (!ai) {
        return res.json({
          auraColor: "linear-gradient(135deg, #FFD1BA 0%, #E8B4B8 100%)", // Default Peach-Pink theme aura
          auraDescription: "Your aura shines with a warm, resilient Peach Glow, tinged with pastel sage. It shows that despite carrying tender thoughts, you are seeking healing and quiet sanctuary.",
          guidance: [
            "Drink half a cup of warm chamomile, noting the heat radiating to your fingers.",
            "Complete a 4-7-8 breathing sequence to ground your heart rate.",
            "Write down one simple thing around you that is solid and unchanging (like a desk or the floor)."
          ]
        });
      }

      const prompt = `Based on the following elements:
      Moods: ${moodString}
      Recent thought snippet: "${journalSnippet || "None provided"}"
      
      Generate a JSON response conforming strictly to this format:
      {
        "auraColor": "A CSS linear-gradient starting with soft colors reflecting these emotions (e.g. 'linear-gradient(135deg, #E2DDF0 0%, #C2E0D5 100%)')",
        "auraDescription": "A poetic, cinematic and elegant description of this aura, comparing it to dreamy weather or lights (keep to 2 sentences).",
        "guidance": ["Guidance tip 1: Small gentle physical action for comfort.", "Guidance tip 2: Mental visualization.", "Guidance tip 3: Breathing or sensory action."]
      }`;

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          temperature: 0.9,
        }
      });

      const parsedData = JSON.parse(response.text || "{}");
      return res.json(parsedData);
    } catch (err) {
      return res.json({
        auraColor: "linear-gradient(135deg, #FFD1BA 0%, #D4A59A 100%)",
        auraDescription: "An eclipse of warm terracotta and soft morning mist, demonstrating deep tenderness and resilience.",
        guidance: [
          "Place a warm hand on your chest, feeling your natural heartbeat.",
          "Gaze gently at the furthest visible object from you, letting your eyes relax.",
          "Whisper: 'I am allowed to take breaks. I am allowed to just exist.'"
        ]
      });
    }
  });

  // Serve static assets in production, otherwise pass through to Vite middleware
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    // For React SPA routes routing fallback
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`InnerSpace server successfully running on http://localhost:${PORT}`);
  });
}

startServer();
