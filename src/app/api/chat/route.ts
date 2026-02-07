import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { streamText, stepCountIs, embed } from 'ai';
import { createClient } from '@/lib/supabaseServer';
import { getTools } from '@/lib/ai/tools';
import { z } from 'zod';

export const maxDuration = 30;
import { exec } from 'child_process';
import { promisify } from 'util';
import { writeFile, unlink, readFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';

const execAsync = promisify(exec);

async function convertWebmToMp3(webmBuffer: Buffer): Promise<Buffer> {
  const inputPath = join(tmpdir(), `${crypto.randomUUID()}.webm`);
  const outputPath = join(tmpdir(), `${crypto.randomUUID()}.mp3`);

  try {
    await writeFile(inputPath, webmBuffer);
    // Convert to mp3 using ffmpeg
    await execAsync(`ffmpeg -i "${inputPath}" -acodec libmp3lame -ab 128k "${outputPath}"`);
    const mp3Buffer = await readFile(outputPath);
    return mp3Buffer;
  } finally {
    // Cleanup
    try {
      await unlink(inputPath);
      await unlink(outputPath);
    } catch (e) {
      console.error('[AI API] Cleanup failed:', e);
    }
  }
}

/**
 * Merges consecutive messages of the same role into a single message.
 * This is CRITICAL for Gemini which requires strict role alternation (user, assistant, tool, assistant...).
 */
function mergeConsecutiveMessages(messages: any[]): any[] {
  if (messages.length <= 1) return messages;

  const merged: any[] = [];
  let currentMsg = messages[0];

  for (let i = 1; i < messages.length; i++) {
    const nextMsg = messages[i];

    // If roles match, merge content
    if (currentMsg.role === nextMsg.role) {
      // Normalize content to parts array for merging
      const currentParts = Array.isArray(currentMsg.content) 
        ? currentMsg.content 
        : [{ type: 'text', text: String(currentMsg.content) }];
      
      const nextParts = Array.isArray(nextMsg.content) 
        ? nextMsg.content 
        : [{ type: 'text', text: String(nextMsg.content) }];

      currentMsg = {
        ...currentMsg,
        content: [...currentParts, ...nextParts]
      };
    } else {
      merged.push(currentMsg);
      currentMsg = nextMsg;
    }
  }

  merged.push(currentMsg);
  return merged;
}

export async function POST(req: Request) {
  let body;
  try {
    body = await req.json();
  } catch (e) {
    console.error("[AI API] Failed to parse request body:", e);
    return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400 });
  }

  const { messages, sessionId } = body;

  // Compact logging to avoid console spam
  console.log(`[AI API] Request: sessionId=${sessionId}, messages=${messages?.length}`);

  
  if (!messages || !Array.isArray(messages)) {
    console.error(`[AI API] 'messages' is missing or not an array. Actual type:`, typeof messages);
    console.error(`[AI API] Full Body:`, JSON.stringify(body, null, 2));
    
    return new Response(JSON.stringify({ error: "Messages array is required" }), { status: 400 });
  }

  const supabase = await createClient();

  // Transform UI messages (with parts) to CoreMessage format (with content)
  // This is needed because useChat sends {parts} but convertToModelMessages expects {content}
  // Note: This is now async to handle fetching and converting audio
  let transformedMessages = await Promise.all(messages.map(async (msg: any) => {
    // 1. Convert role to standard roles (user, assistant, system)
    // IMPORTANT: Filter out 'tool' role messages - they are internal and should not be sent
    const role = msg.role === 'data' ? 'assistant' : msg.role;
    
    // Skip tool-role messages entirely - they cause schema errors
    if (role === 'tool') {
      console.log("[AI API] Skipping tool-role message");
      return null;
    }

    // 2. Handle string content
    if (typeof msg.content === 'string') {
      return { role, content: msg.content };
    }
    
    // 3. Handle parts-based messages (from useChat's sendMessage or parts array)
    const parts = msg.parts || (Array.isArray(msg.content) ? msg.content : null);
    
    if (parts && Array.isArray(parts)) {
      // CRITICAL: Only process text and file parts - skip tool-call, tool-result, etc.
      const validParts = parts.filter((part: any) => {
        const type = part?.type || '';
        return type === 'text' || type === 'file' || type === 'audio';
      });

      const contentArray = await Promise.all(validParts.map(async (part: any) => {
        if (part.type === 'text') {
          return { type: 'text', text: part.text || '' };
        }
        if (part.type === 'file' || part.type === 'audio') {
          let buffer: Buffer | null = null;
          let mediaType = part.mediaType || part.mimeType || 'audio/webm';

          // If it's a storage URL (starts with http), fetch it on the server
          if (part.url && part.url.startsWith('http')) {
            try {
              const response = await fetch(part.url);
              if (!response.ok) throw new Error(`Fetch failed with status ${response.status}`);
              const arrayBuffer = await response.arrayBuffer();
              buffer = Buffer.from(arrayBuffer);
            } catch (fetchError) {
              console.error('[AI API] Failed to fetch audio from URL:', fetchError);
              return { type: 'text', text: '[Error: Failed to load audio attachment]' };
            }
          } else if (part.url && part.url.startsWith('data:')) {
            // If it's a data URL, extract the base64 part
            const base64Data = part.url.split(',')[1];
            buffer = Buffer.from(base64Data, 'base64');
          } else if (part.data) {
            buffer = Buffer.from(part.data, 'base64');
          }

          if (buffer) {
            // CONVERT WEBM TO MP3: Gemini works better with MP3
            if (mediaType.includes('webm')) {
              try {
                buffer = await convertWebmToMp3(buffer);
                mediaType = 'audio/mp3';
              } catch (convError) {
                console.error('[AI API] Audio conversion failed:', convError);
              }
            }

            return {
              type: 'file',
              data: buffer.toString('base64'),
              mediaType: mediaType
            };
          }
          
          return { type: 'text', text: '[Error: No audio data found]' };
        }
        // Shouldn't reach here due to filter, but just in case
        return { type: 'text', text: '' };
      }));

      // ENSURE TEXT PART: Multimodal messages for Gemini often require a text prompt
      const hasText = contentArray.some(p => p.type === 'text' && p.text?.trim());
      if (!hasText) {
        contentArray.unshift({ type: 'text', text: 'Please analyze this audio recording.' });
      }
      
      return { role, content: contentArray };
    }
    
    // Fallback
    return { role, content: msg.content || '' };
  }));

  // Filter out null values (from skipped tool messages)
  const nonNullMessages = transformedMessages.filter((m): m is { role: string; content: unknown } => m !== null);

  // 4. Merge consecutive messages by role (Crucial for Gemini)
  let finalMessages = mergeConsecutiveMessages(nonNullMessages);

  // Gemini role alternation fix: Ensure the conversation doesn't start with assistant
  if (finalMessages.length > 0 && finalMessages[0].role === 'assistant') {
    finalMessages = finalMessages.slice(1);
  }

  // Compact logging
  console.log(`[AI API] Transformed: ${finalMessages.length} messages, roles: [${finalMessages.map(m => m.role).join(', ')}]`);

  // FINAL VALIDATION: Ensure only valid roles are present
  const validRoles = ['user', 'assistant', 'system'];
  finalMessages = finalMessages.filter(m => validRoles.includes(m.role));

  // Ensure no empty messages and content arrays only have valid parts
  finalMessages = finalMessages.map(m => {
    if (Array.isArray(m.content)) {
      // Filter content array to only include valid part types with required fields
      const validContent = m.content.filter((p: any) => {
        if (p.type === 'text') return typeof p.text === 'string';
        if (p.type === 'file') return p.data && p.mediaType;
        return false;
      });
      // If no valid parts remain, convert to simple text
      if (validContent.length === 0) {
        return { role: m.role, content: '[Message content unavailable]' };
      }
      return { role: m.role, content: validContent };
    }
    return m;
  });


  // Use transformed messages directly instead of convertToModelMessages
  // convertToModelMessages was failing on our parts format
  const modelMessages = finalMessages;

  // Proactively save user message at the start to ensure it's not lost
  if (sessionId && sessionId !== 'undefined' && sessionId !== 'null') {
    const lastUserMessage = messages[messages.length - 1];
    if (lastUserMessage && lastUserMessage.role === 'user') {

      
      let textContent = '';
      let messageParts = null;

      // Handle standard text content
      if (typeof lastUserMessage.content === 'string') {
        textContent = lastUserMessage.content;
        messageParts = lastUserMessage.parts || [{ type: 'text', text: textContent }];
      } else if (Array.isArray(lastUserMessage.content)) {
        textContent = lastUserMessage.content
          .filter((p: any) => p.type === 'text')
          .map((p: any) => p.text)
          .join('\n');
        messageParts = lastUserMessage.content;
      }
      
      // Handle parts-based messages (from sendMessage with parts)
      if (lastUserMessage.parts && !messageParts) {
        messageParts = lastUserMessage.parts;
        textContent = lastUserMessage.parts
          .filter((p: any) => p.type === 'text')
          .map((p: any) => p.text)
          .join('\n');
        
        // Check for audio message
        const hasAudio = lastUserMessage.parts.some((p: any) => 
          p.type === 'file' && p.mediaType?.startsWith('audio/')
        );
        if (hasAudio && !textContent) {
          textContent = 'Audio Message';
        }
      }

      const { error } = await supabase.from('chat_messages').insert({
        session_id: sessionId,
        role: 'user',
        content: textContent || 'Multimodal Message',
        parts: messageParts
      });
      if (error) console.error("[AI API] Error saving user message:", error);
    }
  }


  const google = createGoogleGenerativeAI({
    apiKey: process.env.GEMINI_API_KEY,
  });

  // --- Memory Retrieval (RAG) ---
  let retrievedContext = "";
  try {
    console.log(`[AI API] RAG: Starting memory retrieval...`);
    const lastUserMessage = messages.findLast((m: any) => m.role === 'user');
    
    // Extract text from content (string), content (array), or parts (Vercel AI SDK format)
    let queryText = "";
    if (typeof lastUserMessage?.content === 'string') {
      queryText = lastUserMessage.content;
    } else if (Array.isArray(lastUserMessage?.content)) {
      queryText = lastUserMessage.content.filter((p: any) => p.type === 'text').map((p: any) => p.text).join(' ');
    } else if (Array.isArray(lastUserMessage?.parts)) {
      queryText = lastUserMessage.parts.filter((p: any) => p.type === 'text').map((p: any) => p.text).join(' ');
    }

    console.log(`[AI API] RAG: Query text = "${queryText.substring(0, 100)}"`);

    if (queryText) {
      const { embedding } = await embed({
        model: google.textEmbeddingModel('gemini-embedding-001'),
        value: queryText,
        providerOptions: {
          google: {
            outputDimensionality: 768,
            taskType: 'RETRIEVAL_QUERY'
          }
        }
      });
      console.log(`[AI API] RAG: Generated embedding (length: ${embedding?.length})`);

      // 1. Vector Search for General Memories
      // Note: This requires the match_memories RPC to be defined in Supabase
      const { data: generalMemories, error: rpcError } = await supabase.rpc('match_memories', {
        query_embedding: embedding,
        match_threshold: 0.3, // Lowered from 0.5 for better recall with Gemini
        match_count: 5,
      });

      if (rpcError) {
        console.error(`[AI API] RAG: match_memories RPC error:`, rpcError);
      } else {
        console.log(`[AI API] RAG: Found ${generalMemories?.length || 0} general memories`);
      }

      // 2. Fetch all Directives
      const { data: directives, error: directivesError } = await supabase
        .from('memories')
        .select('content')
        .eq('type', 'directive');

      if (directivesError) {
        console.error(`[AI API] RAG: Directives query error:`, directivesError);
      } else {
        console.log(`[AI API] RAG: Found ${directives?.length || 0} directives`);
      }

      if (generalMemories?.length || directives?.length) {
        retrievedContext = "\n\n### RETRIEVED MEMORIES & DIRECTIVES\n";
        if (directives?.length) {
          retrievedContext += "Directives (User Preferences):\n" + directives.map((m: any) => `- ${m.content}`).join('\n') + "\n";
        }
        if (generalMemories?.length) {
          retrievedContext += "Contextual Memories:\n" + generalMemories.map((m: any) => `- ${m.content}`).join('\n') + "\n";
        }
        console.log(`[AI API] RAG: Injected ${directives?.length || 0} directives and ${generalMemories?.length || 0} general memories.`);
      } else {
        console.log(`[AI API] RAG: No matching memories or directives found.`);
      }
    } else {
      console.log(`[AI API] RAG: No query text found, skipping retrieval.`);
    }
  } catch (ragError) {
    console.error("[AI API] RAG Error:", ragError);
  }

  try {
    const result = streamText({
      model: google('gemini-3-flash-preview'),
      messages: modelMessages,
      stopWhen: stepCountIs(10),
      system: `
        You are the Assistant. You are a highly capable, non-chalant, and slightly stoic intelligence designed to manage this Productivity Engine. 
        Your personality is professional yet easy-going—think ChatGPT but with a specific focus on high-performance execution.

        ALWAYS provide a verbal response to the user, even if you are just confirming a tool action or summarizing your findings. 
        Your response should NEVER be empty.

        You help the user manage Projects and overcome "Entropy" (The decay that happens when important things are neglected). 
        Everything in this system revolves around the Dashboard—the curated, probabilistic list of what actually matters right now.
        
        PHASE 2 CAPABILITIES:
        - Voice Mastery: You can "listen" to audio inputs if they are provided. If you receive an audio part, analyze it as if it were a direct spoken command or brain dump.
        - Dashboard Awareness: You have access to the mathematical urgency scores of all tasks. Use 'get_syllabus' to give the user precise advice on what to execute next based on their available time and energy mode.
        - Health Orchestration: When a user completes a task via you, use 'complete_task'. This not only marks it done but also rejuvenates their Project by updating its health metrics.

        MEMORY & CONTEXT (PHASE 1):
        - Long-term Memory: When a user states a preference or rule, save it as a "Directive" via 'save_memory'. This will be recalled in future sessions.
        - Project Context: Each project can have a "Context Card" (markdown). Before answering deep questions about a project, use 'get_context_card'. If the user provides a major update about a project's goal, use 'update_context_card'.
        - IMPORTANT: If context is provided below in "RETRIEVED MEMORIES", you MUST use it to personalize your response. If the information isn't there, you can state you don't know yet, but NEVER say you "don't have access" to the capability itself.
        ${retrievedContext}

        WEB RESEARCH:
        - When the user asks for up-to-date info, sources, comparisons, or "look it up", use the 'search_web' tool.
        - Do NOT use inline bracket citations like [1]. The UI renders clickable source chips automatically.
        - If you need to reference sources, use brief labels like "Source 1" or "Source 2".
        - Provide concise synthesis first.

        BACKGROUND TASKS (PHASE 3):
        - When the user provides a very long message (>300 chars), a "thought dump", or requests deep research that would take time, use the 'spawn_subagent' tool.
        - Inform the user that you've started a background task and provide the Job ID. 
        - The results will appear in their dashboard/notes automatically once finished.
        - Use this for tasks that require multiple web searches, deep analysis, or structured synthesis of messy data.

        CORE PHILOSOPHY:
        - High-Performance Minimalism: We value speed, clarity, and visual elegance (Slate/Charcoal/Glassmorphism).
        - Entropy: Tasks that haven't been touched decay. You are here to prevent that.
        - Projects: These are persistent entities the user is keeping on track.

        TOOL USAGE (CRITICAL):
        - Tools are YOUR internal capabilities. The user does NOT have access to them and should NEVER be asked to "use" a tool.
        - When you need information (like listing projects), just fetch it yourself silently using tools—don't tell the user to do it.
        - UUIDs and internal IDs are for YOUR use only. Never ask the user to provide or confirm IDs.
        - Always refer to entities by their human-readable names (e.g., "Project Chimera"), not by UUIDs.
        - If a user says "delete all projects", fetch the list yourself, confirm what you found by NAME, then proceed upon user approval.

        OPERATIONAL GUIDELINES:
        - Always fetch data before making assumptions about the state of tasks or projects.
        - When creating tasks, infer as much as possible (duration, energy) but keep it simple unless asked otherwise.
        - If a user asks a general question (coding, research, etc.), answer it normally using your internal knowledge. Use 'search_web' when the user explicitly requests web research or when freshness/sources are required.
        - Be concise but thorough. Provide structured advice when relevant.
        - PROJECT DELETION: You have the power to delete projects. This is a high-entropy event. Only do this when the user explicitly asks for it. Confirm by listing project NAMES (not IDs), then proceed. Advise the user that this will also vanish all associated tasks.
        - If you use 'get_analytics', consider suggesting a chart if the data is trending or comparative.
      `,

      tools: getTools(supabase, google),
      onFinish: async ({ response }) => {
        // Save assistant response to Supabase if sessionId is provided
        if (sessionId && sessionId !== 'undefined' && sessionId !== 'null') {
          try {
            console.log(`[AI API] onFinish: Persisting multi-step turn data...`);
            
            if (response && response.messages && response.messages.length > 0) {
              // response.messages contains ALL messages from the current interaction, 
              // including assistant tool calls and tool results.
              // We only need to save the NEW ones (not the ones already in the request)
              
              // Standard approach: Save each new message individually to maintain history structure
              for (const msg of response.messages) {
                // Extract text for the 'content' column (used for search/previews)
                let textContent = '';
                if (typeof msg.content === 'string') {
                  textContent = msg.content;
                } else if (Array.isArray(msg.content)) {
                  textContent = msg.content
                    .filter((p: any) => p.type === 'text')
                    .map((p: any) => p.text)
                    .join('\n');
                  
                  // If it's a tool-call message or pure tool-result, add labels
                  if (!textContent) {
                    const hasToolCall = msg.content.some((p: any) => p.type === 'tool-call');
                    const hasToolResult = msg.content.some((p: any) => p.type === 'tool-result');
                    if (hasToolCall) textContent = '[Tool Call]';
                    else if (hasToolResult) textContent = '[Tool Result]';
                  }
                }

                // Sanitize role for DB constraint if not updated yet
                const allowedRoles = ['user', 'assistant', 'system', 'tool', 'data'];
                const dbRole = allowedRoles.includes(msg.role) ? msg.role : 'assistant';

                const { error } = await supabase.from('chat_messages').insert({
                  session_id: sessionId,
                  role: dbRole,
                  content: textContent || '',
                  parts: msg.content
                });

                if (error) console.error(`[AI API] Persist Error (${msg.role}):`, error);
              }
            }
          } catch (error) {
            console.error("[AI API] Critical multi-step persistence failure:", error);
          }
        }
      }
    });

    return result.toUIMessageStreamResponse();
  } catch (error: any) {
    // Compact error logging - avoid flooding console with massive Zod validation errors
    const errorMessage = error?.message || 'Unknown error';
    const errorName = error?.name || 'Error';
    console.error(`[AI API] ${errorName}: ${errorMessage.substring(0, 200)}${errorMessage.length > 200 ? '...' : ''}`);
    
    // Return a user-friendly error response
    return new Response(
      JSON.stringify({ 
        error: 'Failed to process chat request', 
        details: errorMessage.substring(0, 500) 
      }), 
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
