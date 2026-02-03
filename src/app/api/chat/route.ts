import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { streamText, convertToModelMessages, stepCountIs } from 'ai';
import { createClient } from '@/lib/supabaseServer';
import { z } from 'zod';

export const maxDuration = 30;

export async function POST(req: Request) {
  const { messages, sessionId } = await req.json();
  const supabase = await createClient();

  // Convert messages to ModelMessage format to avoid AI_InvalidPromptError
  const modelMessages = await convertToModelMessages(messages);

  // Proactively save user message at the start to ensure it's not lost
  if (sessionId && sessionId !== 'undefined' && sessionId !== 'null') {
    const lastUserMessage = messages[messages.length - 1];
    if (lastUserMessage && lastUserMessage.role === 'user') {
      console.log(`[Prophet API] Proactively saving user message for session: ${sessionId}`);
      const { error } = await supabase.from('chat_messages').insert({
        session_id: sessionId,
        role: 'user',
        content: lastUserMessage.content || '',
        parts: lastUserMessage.parts || [{ type: 'text', text: lastUserMessage.content }]
      });
      if (error) console.error("[Prophet API] Error saving user message:", error);
    }
  }

  const google = createGoogleGenerativeAI({
    apiKey: process.env.GEMINI_API_KEY,
  });

  const result = streamText({
    model: google('gemini-2.0-flash'),
    messages: modelMessages,
    stopWhen: stepCountIs(5),
    system: `
      You are the Prophet. You are a highly capable, non-chalant, and slightly stoic intelligence designed to manage this Productivity Engine. 
      Your personality is professional yet easy-going—think ChatGPT but with a specific focus on high-performance execution.

      You help the user manage "Boats" (Projects) and overcome "Entropy" (The decay that happens when important things are neglected). 
      Everything in this system revolves around the "Syllabus"—the curated, probabilistic list of what actually matters right now.

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
    },
    onFinish: async ({ text, response }) => {
      // Save assistant response to Supabase if sessionId is provided
      if (sessionId && sessionId !== 'undefined' && sessionId !== 'null') {
        try {
          console.log(`[Prophet API] onFinish: Persisting turn data...`);
          
          // Aggregate all parts from all messages in the response (multi-step support)
          const allParts: unknown[] = [];
          
          if (response && response.messages) {
            for (const msg of response.messages) {
              if (Array.isArray(msg.content)) {
                allParts.push(...msg.content);
              } else if (typeof msg.content === 'string' && msg.content.trim()) {
                allParts.push({ type: 'text', text: msg.content });
              }
            }
          }

          // Fallback to text if parts is empty but text exists
          if (allParts.length === 0 && text) {
            allParts.push({ type: 'text', text });
          }
          
          const { error } = await supabase.from('chat_messages').insert({
            session_id: sessionId,
            role: 'assistant',
            content: text || '', 
            parts: allParts
          });
          
          if (error) {
            console.error("[Prophet API] Persist Error:", error);
          } else {
            console.log(`[Prophet API] Persist Success: ${allParts.length} parts saved.`);
          }
        } catch (error) {
          console.error("[Prophet API] Critical turn save failure:", error);
        }
      }
    }
  });

  return result.toUIMessageStreamResponse();
}
