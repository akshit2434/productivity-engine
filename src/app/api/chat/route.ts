import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { streamText, stepCountIs } from 'ai';
import { createClient } from '@/lib/supabaseServer';
import { z } from 'zod';
import { calculateUrgencyScore, mapTaskData, SessionMode } from '@/lib/engine';
import { exec } from 'child_process';
import { promisify } from 'util';
import { writeFile, unlink, readFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';

export const maxDuration = 30;

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
      console.error('[Prophet API] Cleanup failed:', e);
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
    console.error("[Prophet API] Failed to parse request body:", e);
    return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400 });
  }

  const { messages, sessionId } = body;

  // Compact logging to avoid console spam
  console.log(`[Prophet API] Request: sessionId=${sessionId}, messages=${messages?.length}`);

  
  if (!messages || !Array.isArray(messages)) {
    console.error(`[Prophet API] 'messages' is missing or not an array. Actual type:`, typeof messages);
    console.error(`[Prophet API] Full Body:`, JSON.stringify(body, null, 2));
    
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
      console.log("[Prophet API] Skipping tool-role message");
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
              console.error('[Prophet API] Failed to fetch audio from URL:', fetchError);
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
                console.error('[Prophet API] Audio conversion failed:', convError);
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
  console.log(`[Prophet API] Transformed: ${finalMessages.length} messages, roles: [${finalMessages.map(m => m.role).join(', ')}]`);

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
      if (error) console.error("[Prophet API] Error saving user message:", error);
    }
  }

  const google = createGoogleGenerativeAI({
    apiKey: process.env.GEMINI_API_KEY,
  });

  try {
    const result = streamText({
      model: google('gemini-2.0-flash'),
      messages: modelMessages,
      stopWhen: stepCountIs(10),
      system: `
        You are the Prophet. You are a highly capable, non-chalant, and slightly stoic intelligence designed to manage this Productivity Engine. 
        Your personality is professional yet easy-going—think ChatGPT but with a specific focus on high-performance execution.

        ALWAYS provide a verbal response to the user, even if you are just confirming a tool action or summarizing your findings. 
        Your response should NEVER be empty.

        You help the user manage "Boats" (Projects) and overcome "Entropy" (The decay that happens when important things are neglected). 
        Everything in this system revolves around the "Syllabus"—the curated, probabilistic list of what actually matters right now.
        
        PHASE 2 CAPABILITIES:
        - Voice Mastery: You can "listen" to audio inputs if they are provided. If you receive an audio part, analyze it as if it were a direct spoken command or brain dump.
        - Syllabus Awareness: You have access to the mathematical urgency scores of all tasks. Use 'get_syllabus' to give the user precise advice on what to execute next based on their available time and energy mode.
        - Health Orchestration: When a user completes a task via you, use 'complete_task'. This not only marks it done but also rejuvenates their "Boat" (Project) by updating its health metrics.

        CORE PHILOSOPHY:
        - High-Performance Minimalism: We value speed, clarity, and visual elegance (Slate/Charcoal/Glassmorphism).
        - Entropy: Tasks that haven't been touched decay. You are here to prevent that.
        - Boats: These aren't just projects; they are vessels the user is captaining.

        OPERATIONAL GUIDELINES:
        - Always fetch data before making assumptions about the state of tasks or projects.
        - When creating tasks, infer as much as possible (duration, energy) but keep it simple unless asked otherwise.
        - If a user asks a general question (coding, research, etc.), answer it normally using your internal knowledge. Only use tools when the user's request relates to their engine, data, or productivity.
        - Be concise but thorough. Provide structured advice when relevant.
        - Always use the precise UUIDs returned by tools (like 'create_project' or 'list_tasks') when referencing specific entities.
        - PROJECT DELETION: You have the power to delete projects. This is a high-entropy event. Only do this when the user explicitly asks for it (e.g., "Delete this project"). Advise the user that this will also vanish all associated tasks.
        - If you use 'get_analytics', consider suggesting a chart if the data is trending or comparative.
      `,
      tools: {
        get_analytics: {
          description: 'Fetch productivity analytics, task distribution, or stagnation reports.',
          inputSchema: z.object({
            type: z.enum(['activity_logs', 'task_distribution', 'stagnation_report', 'all']),
            days: z.number().default(7),
          }),
          execute: async ({ type, days }: { type: 'activity_logs' | 'task_distribution' | 'stagnation_report' | 'all', days: number }) => {
            console.log(`[Prophet API] >> EXECUTE get_analytics:`, { type, days });
            const now = new Date();
            const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString();

            const data: {
              activity_logs?: unknown[];
              tasks?: unknown[];
              stagnant_tasks?: unknown[];
            } = {};

            if (type === 'activity_logs' || type === 'all') {
              const { data: logs } = await supabase
                .from('activity_logs')
                .select('*')
                .gte('completed_at', startDate);
              data.activity_logs = logs ?? [];
            }

            if (type === 'task_distribution' || type === 'all') {
              const { data: tasks } = await supabase
                .from('tasks')
                .select('id, state, energy_tag, projects(name, tier)');
              data.tasks = tasks ?? [];
            }

            if (type === 'stagnation_report' || type === 'all') {
              const { data: stagnant } = await supabase
                .from('tasks')
                .select('id, title, last_touched_at, projects(name)')
                .eq('state', 'Active')
                .order('last_touched_at', { ascending: true })
                .limit(10);
              data.stagnant_tasks = stagnant ?? [];
            }

            return data;
          },
        },
        generate_chart: {
          description: 'Suggest a chart to visualize productivity data. This will be rendered as a UI component.',
          inputSchema: z.object({
            chartType: z.enum(['bar', 'line', 'pie', 'area']),
            title: z.string(),
            data: z.array(z.record(z.string(), z.any())),
            xAxisKey: z.string().optional(),
            yAxisKey: z.string().optional(),
            dataKeys: z.array(z.string()),
          }),
          execute: async (params) => {
            console.log(`[Prophet API] >> EXECUTE generate_chart:`, JSON.stringify(params, null, 2));
            return params;
          },
        },
        list_tasks: {
          description: 'Search and filter tasks. Returns a list of tasks based on filters.',
          inputSchema: z.object({
            projectId: z.string().uuid().optional().describe('Filter by Project UUID'),
            state: z.enum(['Active', 'Waiting', 'Blocked', 'Done']).optional(),
            query: z.string().optional().describe('Search term for task title'),
            limit: z.number().default(20),
          }),
          execute: async ({ projectId, state, query, limit }) => {
            try {
              console.log(`[Prophet API] >> EXECUTE list_tasks:`, { projectId, state, query });
              let builder = supabase.from('tasks').select('*, projects(name)');
              if (projectId) builder = builder.eq('project_id', projectId);
              if (state) builder = builder.eq('state', state);
              if (query) builder = builder.ilike('title', `%${query}%`);
              const { data, error } = await builder.limit(limit).order('created_at', { ascending: false });
              if (error) {
                console.error(`[Prophet API] list_tasks error:`, error);
                return { error: error.message };
              }
              return data;
            } catch (e: unknown) {
              const error = e as Error;
              console.error(`[Prophet API] list_tasks critical error:`, error);
              return { error: error.message };
            }
          },
        },
        create_task: {
          description: 'Create a new task in the productivity engine.',
          inputSchema: z.object({
            title: z.string().describe('The title of the task'),
            projectId: z.string().uuid().describe('The EXACT UUID of the project (project_id)'),
            description: z.string().optional(),
            state: z.enum(['Active', 'Waiting', 'Blocked', 'Done']).default('Active'),
            due_date: z.string().optional().describe('ISO timestamp or YYYY-MM-DD'),
            est_duration_minutes: z.number().default(30),
            energy_tag: z.enum(['Grind', 'Creative', 'Shallow']).default('Shallow'),
          }),
          execute: async (taskData) => {
            try {
              console.log(`[Prophet API] >> EXECUTE create_task:`, taskData);
              
              // Clean up due_date to avoid Postgres errors if it's empty or invalid
              const sanitizedDueDate = taskData.due_date && taskData.due_date.trim() !== '' 
                ? new Date(taskData.due_date).toISOString() 
                : null;

              const { data, error } = await supabase.from('tasks').insert({
                title: taskData.title,
                project_id: taskData.projectId,
                description: taskData.description,
                state: taskData.state,
                due_date: sanitizedDueDate,
                est_duration_minutes: taskData.est_duration_minutes,
                energy_tag: taskData.energy_tag,
              }).select('*, projects(name)').single();
              
              if (error) {
                console.error(`[Prophet API] create_task DB error:`, error);
                return { 
                  error: error.message, 
                  details: error.details, 
                  hint: error.hint,
                  code: error.code 
                };
              }
              return data;
            } catch (e: unknown) {
              const error = e as Error;
              console.error(`[Prophet API] create_task critical error:`, error);
              return { error: error.message };
            }
          },
        },
        update_task: {
          description: 'Update an existing task.',
          inputSchema: z.object({
            id: z.string(),
            title: z.string().optional(),
            state: z.enum(['Active', 'Waiting', 'Blocked', 'Done']).optional(),
            description: z.string().optional(),
            due_date: z.string().optional(),
            energy_tag: z.enum(['Grind', 'Creative', 'Shallow']).optional(),
          }),
          execute: async ({ id, ...updates }) => {
            console.log(`[Prophet API] >> EXECUTE update_task:`, { id, updates });
            const { data, error } = await supabase.from('tasks').update(updates).eq('id', id).select().single();
            if (error) throw error;
            return data;
          },
        },
        delete_task: {
          description: 'Delete a task.',
          inputSchema: z.object({
            id: z.string(),
          }),
          execute: async ({ id }) => {
            console.log(`[Prophet API] >> EXECUTE delete_task:`, id);
            const { error } = await supabase.from('tasks').delete().eq('id', id);
            if (error) throw error;
            return { success: true };
          },
        },
        get_projects: {
          description: 'List all available projects (Boats).',
          inputSchema: z.object({}),
          execute: async () => {
            console.log(`[Prophet API] >> EXECUTE get_projects`);
            const { data, error } = await supabase.from('projects').select('*').order('tier', { ascending: true });
            if (error) throw error;
            return data;
          },
        },
        create_project: {
          description: 'Create a new project (Boat). Returns the project entity including its UUID in the "id" field.',
          inputSchema: z.object({
            name: z.string(),
            tier: z.number().min(1).max(4).default(3),
            decay_threshold_days: z.number().default(15),
            kpi_name: z.string().optional(),
            kpi_value: z.number().default(0),
          }),
          execute: async (projectData) => {
            try {
              console.log(`[Prophet API] >> EXECUTE create_project:`, projectData);
              const { data, error } = await supabase.from('projects').insert(projectData).select().single();
              if (error) {
                console.error(`[Prophet API] create_project error:`, error);
                return { error: error.message };
              }
              return data;
            } catch (e: unknown) {
              const error = e as Error;
              console.error(`[Prophet API] create_project critical error:`, error);
              return { error: error.message };
            }
          },
        },
        delete_project: {
          description: 'Delete a project (Boat) and all its associated tasks.',
          inputSchema: z.object({
            id: z.string().uuid().describe('The UUID of the project to delete'),
          }),
          execute: async ({ id }) => {
            try {
              console.log(`[Prophet API] >> EXECUTE delete_project:`, id);
              const { error } = await supabase.from('projects').delete().eq('id', id);
              if (error) {
                console.error(`[Prophet API] delete_project error:`, error);
                return { error: error.message };
              }
              return { success: true };
            } catch (e: unknown) {
              const error = e as Error;
              console.error(`[Prophet API] delete_project critical error:`, error);
              return { error: error.message };
            }
          },
        },
        add_note: {
          description: 'Add a rich text note or transcript to a task.',
          inputSchema: z.object({
            taskId: z.string(),
            content: z.string(),
            isVoiceTranscript: z.boolean().default(false),
          }),
          execute: async ({ taskId, content, isVoiceTranscript }) => {
            console.log(`[Prophet API] >> EXECUTE add_note:`, { taskId });
            const { data, error } = await supabase.from('task_notes').insert({
              task_id: taskId,
              content,
              is_voice_transcript: isVoiceTranscript
            }).select().single();
            if (error) throw error;
            return data;
          },
        },
        get_task_details: {
          description: 'Get full details of a task including notes and subtasks.',
          inputSchema: z.object({
            id: z.string(),
          }),
          execute: async ({ id }) => {
            console.log(`[Prophet API] >> EXECUTE get_task_details:`, id);
            const [taskRes, notesRes, subtasksRes] = await Promise.all([
              supabase.from('tasks').select('*, projects(name)').eq('id', id).single(),
              supabase.from('task_notes').select('*').eq('task_id', id).order('created_at', { ascending: false }),
              supabase.from('subtasks').select('*').eq('task_id', id).order('created_at', { ascending: true })
            ]);
            if (taskRes.error) throw taskRes.error;
            return {
              ...taskRes.data,
              notes: notesRes.data || [],
              subtasks: subtasksRes.data || []
            };
          },
        },
        add_subtask: {
          description: 'Add a subtask (checklist item) to a parent task.',
          inputSchema: z.object({
            taskId: z.string(),
            title: z.string(),
          }),
          execute: async ({ taskId, title }) => {
            console.log(`[Prophet API] >> EXECUTE add_subtask:`, { taskId, title });
            const { data, error } = await supabase.from('subtasks').insert({
              task_id: taskId,
              title,
              is_completed: false
            }).select().single();
            if (error) throw error;
            return data;
          },
        },
        toggle_subtask: {
          description: 'Mark a subtask as complete or incomplete.',
          inputSchema: z.object({
            id: z.string(),
            isCompleted: z.boolean(),
          }),
          execute: async ({ id, isCompleted }) => {
            console.log(`[Prophet API] >> EXECUTE toggle_subtask:`, { id, isCompleted });
            const { data, error } = await supabase.from('subtasks').update({
              is_completed: isCompleted
            }).eq('id', id).select().single();
            if (error) throw error;
            return data;
          },
        },
        get_syllabus: {
          description: 'Fetch the curated list of tasks sorted by urgency (Entropy). Use this to tell the user what to do next.',
          inputSchema: z.object({
            timeAvailableMinutes: z.number().optional().describe('Filter by max estimated duration'),
            mode: z.enum(['Deep Work', 'Low Energy', 'Creative', 'Admin']).default('Deep Work').describe('Current energy/work mode'),
            limit: z.number().default(10),
          }),
          execute: async ({ timeAvailableMinutes, mode, limit }) => {
            try {
              console.log(`[Prophet API] >> EXECUTE get_syllabus:`, { timeAvailableMinutes, mode });
              const { data, error } = await supabase
                .from('tasks')
                .select('*, projects(name, tier, decay_threshold_days)')
                .eq('state', 'Active');
              
              if (error) throw error;
              
              // Map and Score
              const sessionMode = mode as SessionMode;
              let scoredTasks = (data || []).map(t => {
                const taskObj = mapTaskData(t);
                return {
                  ...taskObj,
                  urgencyScore: calculateUrgencyScore(taskObj, sessionMode)
                };
              });

              // Filter by time if specified
              if (timeAvailableMinutes) {
                scoredTasks = scoredTasks.filter(t => t.durationMinutes <= timeAvailableMinutes);
              }

              // Sort by urgency
              scoredTasks.sort((a, b) => b.urgencyScore - a.urgencyScore);

              return scoredTasks.slice(0, limit);
            } catch (e: unknown) {
              const error = e as Error;
              console.error(`[Prophet API] get_syllabus error:`, error);
              return { error: error.message };
            }
          },
        },
        complete_task: {
          description: 'Mark a task as completed. This also rejuvenation the associated project health.',
          inputSchema: z.object({
            taskId: z.string().uuid(),
            durationMinutes: z.number().optional().describe('Actual time spent (defaults to estimated if not provided)'),
            sessionMode: z.enum(['Deep Work', 'Low Energy', 'Creative', 'Admin']).optional(),
          }),
          execute: async ({ taskId, durationMinutes, sessionMode }) => {
            try {
              console.log(`[Prophet API] >> EXECUTE complete_task:`, { taskId });
              
              // 1. Fetch task and project info
              const { data: task, error: fetchErr } = await supabase
                .from('tasks')
                .select('*, projects(*)')
                .eq('id', taskId)
                .single();
              
              if (fetchErr || !task) throw fetchErr || new Error("Task not found");

              const projectId = task.project_id;
              const finalDuration = durationMinutes || task.est_duration_minutes || 30;

              // 2. Perform updates in parallel-ish (Supabase transaction would be better but simple updates work)
              const [updateTask, updateProject, logActivity] = await Promise.all([
                // Mark task done and update its last_touched_at
                supabase.from('tasks').update({ 
                  state: 'Done', 
                  last_touched_at: new Date().toISOString() 
                }).eq('id', taskId),
                
                // Rejuvenate project
                supabase.from('projects').update({ 
                  last_touched_at: new Date().toISOString() 
                }).eq('id', projectId),
                
                // Log activity
                supabase.from('activity_logs').insert({
                  task_id: taskId,
                  project_id: projectId,
                  duration_minutes: finalDuration,
                  session_mode: sessionMode || 'Deep Work',
                  completed_at: new Date().toISOString()
                })
              ]);

              if (updateTask.error) throw updateTask.error;
              if (updateProject.error) throw updateProject.error;
              // Activity log failure is non-critical but worth noting
              if (logActivity.error) console.error("[Prophet API] Activity log error:", logActivity.error);

              return { 
                success: true, 
                taskTitle: task.title, 
                projectName: task.projects?.name,
                rejuvenated: true 
              };
            } catch (e: unknown) {
              const error = e as Error;
              console.error(`[Prophet API] complete_task error:`, error);
              return { error: error.message };
            }
          },
        },
      },
      onFinish: async ({ response }) => {
        // Save assistant response to Supabase if sessionId is provided
        if (sessionId && sessionId !== 'undefined' && sessionId !== 'null') {
          try {
            console.log(`[Prophet API] onFinish: Persisting multi-step turn data...`);
            
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

                const { error } = await supabase.from('chat_messages').insert({
                  session_id: sessionId,
                  role: msg.role,
                  content: textContent || '',
                  parts: msg.content
                });

                if (error) console.error(`[Prophet API] Persist Error (${msg.role}):`, error);
              }
            }
          } catch (error) {
            console.error("[Prophet API] Critical multi-step persistence failure:", error);
          }
        }
      }
    });

    return result.toUIMessageStreamResponse();
  } catch (error: any) {
    // Compact error logging - avoid flooding console with massive Zod validation errors
    const errorMessage = error?.message || 'Unknown error';
    const errorName = error?.name || 'Error';
    console.error(`[Prophet API] ${errorName}: ${errorMessage.substring(0, 200)}${errorMessage.length > 200 ? '...' : ''}`);
    
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

