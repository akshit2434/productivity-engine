import { GoogleGenerativeAI, SchemaType, Schema } from "@google/generative-ai";
import { NextResponse } from "next/server";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

const SYSTEM_PROMPT = `
You are the brain of "Entropy UI", a high-performance productivity engine.
Your task is to parse raw user input into a structured JSON object for task creation.

Rules:
1. Transform raw input/transcripts into a concise, action-oriented "task" title (e.g., "Call mom" instead of "I should really give my mom a call").
2. Prioritize matching "project" to the "Existing Projects" list provided.
3. If no logical match exists in "Existing Projects", you may create a new creative project name.
4. If project is not obvious and no match found, use "Inbox".
5. Default duration to "30m" if unspecified.
6. Use the "Current Context" (Time/Date) to inform duration, recurrence, or "dueDate" if relative terms are used.
7. If a specific deadline or time is mentioned (e.g. "by 5pm", "next Tuesday", "tomorrow noon"), extract it into "dueDate" as an ISO 8601 string. If no deadline is mentioned, "dueDate" should be null.
8. Map "energy" to one of: "Deep", "Normal", "Shallow".
   - Deep: High focus (Strategic, Design, Writing).
   - Normal: Standard focus (Coding, Logistics).
   - Shallow: Low focus (Admin, Quick tasks).
`;

const schema: Schema = {
  description: "Task parsing schema",
  type: SchemaType.OBJECT,
  properties: {
    task: {
      type: SchemaType.STRING,
      description: "The concise action item",
    },
    project: {
      type: SchemaType.STRING,
      description: "The inferred project name (check existing list first)",
    },
    duration: {
      type: SchemaType.STRING,
      description: "Estimated time (e.g., '15m', '1h', '4h')",
    },
    energy: {
      type: SchemaType.STRING,
      description: "Energy type (Deep, Normal, Shallow)",
    },
    recurrence: {
      type: SchemaType.NUMBER,
      description: "Number of days for interval (null if single-time)",
      nullable: true,
    },
    dueDate: {
      type: SchemaType.STRING,
      description: "ISO 8601 string for deadline (null if none)",
      nullable: true,
    },
  },
  required: ["task", "project", "duration", "energy"],
};

export async function POST(req: Request) {
  try {
    const { input, audio, mimeType, existingProjects } = await req.json();

    if (!input && !audio) {
      return NextResponse.json({ error: "Missing input or audio" }, { status: 400 });
    }

    const model = genAI.getGenerativeModel({ 
      model: "gemini-2.0-flash",
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: schema,
      },
    });
    
    const now = new Date();
    const contextPrompt = `
Current Context: ${now.toLocaleString()} (${now.toLocaleDateString('en-US', { weekday: 'long' })})
Existing Projects: ${existingProjects?.length > 0 ? existingProjects.join(", ") : "None"}
    `;

    const promptParts: any[] = [
      { text: SYSTEM_PROMPT },
      { text: contextPrompt }
    ];
    
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
    const parsedData = JSON.parse(responseText);

    return NextResponse.json(parsedData);
  } catch (error) {
    console.error("AI Parsing Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
