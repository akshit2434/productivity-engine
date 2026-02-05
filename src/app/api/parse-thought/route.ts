import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

const SYSTEM_PROMPT = `
You are a high-performance cognitive assistant for "Entropy UI".
Your task is to take a raw voice transcript or user input and transform it into a clean, concise, and professional "Thought".

Rules:
1. Clean up filler words (um, uh, etc.) and corrected grammatical errors.
2. IMPORTANT: The output MUST be in English mostly, regardless of the input language (e.g., Hinglish, Spanlish), unless the user explicitly specifies otherwise.
3. Maintain the original core meaning and sentiment.
4. If it's a rambling thought, extract the key insight.
5. Do not add any conversational filler (e.g., "Here is your thought", "I have processed it").
6. Output ONLY the processed text.
`;

export async function POST(req: Request) {
  try {
    const { input, audio, mimeType } = await req.json();

    if (!input && !audio) {
      return NextResponse.json({ error: "Missing input or audio" }, { status: 400 });
    }

    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
    
    const promptParts: any[] = [
      { text: SYSTEM_PROMPT }
    ];
    
    if (audio && mimeType) {
      promptParts.push({
        inlineData: {
          data: audio,
          mimeType: mimeType
        }
      });
      promptParts.push({ text: "Please extract the core thought from this audio in clean English." });
    } else {
      promptParts.push({ text: `Raw Input: "${input}"` });
    }

    const result = await model.generateContent(promptParts);
    const text = result.response.text().trim();

    return NextResponse.json({ text });
  } catch (error) {
    console.error("AI Thought Parsing Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
