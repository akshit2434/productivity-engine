import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const audioFile = formData.get("audio") as File;
    const taskTitle = formData.get("taskTitle") as string;
    const currentContent = formData.get("currentContent") as string;

    if (!audioFile) {
      return NextResponse.json({ error: "No audio file provided" }, { status: 400 });
    }

    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    // 1. Transcribe the audio first
    const arrayBuffer = await audioFile.arrayBuffer();
    const base64Audio = Buffer.from(arrayBuffer).toString("base64");

    const transcriptionResult = await model.generateContent([
      {
        inlineData: {
          mimeType: "audio/wave",
          data: base64Audio,
        },
      },
      { text: "Transcribe this audio. If it contains commands or notes for a task, just provide the raw transcription. Clean up filler words like 'um', 'uh'. Focus on accuracy. Language: English." },
    ]);

    const transcript = transcriptionResult.response.text().trim();

    if (!transcript) {
      return NextResponse.json({ error: "Could not transcribe audio" }, { status: 400 });
    }

    // 2. Process with Context (The "Agentic" part)
    const agentPrompt = `
      You are an AI note-taking agent for "Entropy UI".
      Your goal is to update a task's Markdown note based on a user's voice transcript and current context.

      CONTEXT:
      - Task Title: "${taskTitle}"
      - Current Markdown Note: "${currentContent || "Empty"}"
      - User Voice Transcript: "${transcript}"

      INTENT ANALYSIS:
      1. If the transcript contains a COMMAND (e.g., "shorten this", "make it formal", "rewrite to be clearer"), apply it to the note.
      2. If it contains NEW INFORMATION, intelligently integrate/append it into the note.
      3. If the user is just rambling, extract the core value and update the note.

      CRITICAL RULES:
      - Return ONLY valid Markdown.
      - ALWAYS use relevant emojis (✨, ✅, 📝, 🚀, etc.) to make the note visually engaging and organized.
      - NEVER include conversational filler (e.g., "OK", "Sure", "I updated the note").
      - NEVER explain what you did.
      - Use professional, high-performance formatting (headings, lists, bold, checkable lists).
      - If the user provides a checklist verbally, format it as a Markdown task list (- [ ]).
      - If the transcript is nonsense or empty, return the current note unchanged.

      Return the FULL updated Markdown content.
    `;

    const processingResult = await model.generateContent(agentPrompt);
    const updatedMarkdown = processingResult.response.text().trim();

    return NextResponse.json({ 
      transcript,
      updatedMarkdown,
      actionTaken: "The AI agent analyzed your request and updated the note with context."
    });
  } catch (error) {
    console.error("Agentic Audio Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
