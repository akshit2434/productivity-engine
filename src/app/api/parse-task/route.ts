import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

const SYSTEM_PROMPT = `
You are the brain of "Entropy UI", a high-performance productivity engine.
Your task is to parse raw user input into a structured JSON object for task creation.

Input: Raw text or audio transcript.
Output: JSON object with:
- task: The concise action item.
- project: The inferred project name (be creative but logical).
- duration: Estimated time (e.g., "15m", "1h", "4h").
- energy: Energy type ("Grind", "Creative", "Shallow").
  - Creative: High focus, non-linear (Design, Writing, R&D).
  - Grind: High focus, linear (Coding, Spreadsheets, Logistics).
  - Shallow: Low focus, quick (Email, Calls, Admin).
- recurrence: Number of days for interval (null if single-time).
  - "Daily" -> 1
  - "Weekly" -> 7
  - "Every 3 days" -> 3
  - "Monthly" -> 30

Rules:
1. If project is not obvious, use "Inbox".
2. Default duration to "30m" if unspecified.
3. Keep the JSON clean.
`;

export async function POST(req: Request) {
  try {
    const { input, audio, mimeType } = await req.json();

    if (!input && !audio) {
      return NextResponse.json({ error: "Missing input or audio" }, { status: 400 });
    }

    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
    
    const promptParts: any[] = [{ text: SYSTEM_PROMPT }];
    
    if (audio && mimeType) {
      promptParts.push({
        inlineData: {
          data: audio,
          mimeType: mimeType
        }
      });
      promptParts.push({ text: "Please parse the task from this audio recording." });
    } else {
      promptParts.push({ text: `User Input: "${input}"` });
    }

    const result = await model.generateContent(promptParts);

    const responseText = result.response.text();
    // Extract JSON from response (handling potential markdown formatting)
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    const parsedData = jsonMatch ? JSON.parse(jsonMatch[0]) : null;

    if (!parsedData) {
      throw new Error("Failed to parse AI response");
    }

    return NextResponse.json(parsedData);
  } catch (error) {
    console.error("AI Parsing Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
