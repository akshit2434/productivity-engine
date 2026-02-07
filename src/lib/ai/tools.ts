import { z } from 'zod';
import { embed } from 'ai';
import { SupabaseClient } from '@supabase/supabase-js';
import { searchWeb } from '@/lib/webSearch';
import { calculateUrgencyScore, mapTaskData, SessionMode } from '@/lib/engine';
import { createAdminClient } from '@/lib/supabaseAdmin';

export interface SubagentTask {
  type: 'research' | 'analysis' | 'thought_dump';
  instruction: string;
  projectId?: string;
  taskId?: string;
  outputInstruction?: string;
}

export function getTools(supabase: SupabaseClient, google: any) {
  return {
    get_analytics: {
      description: 'Fetch productivity analytics, task distribution, or stagnation reports.',
      inputSchema: z.object({
        type: z.enum(['activity_logs', 'task_distribution', 'stagnation_report', 'all']),
        days: z.number().default(7),
      }),
      execute: async ({ type, days }: { type: 'activity_logs' | 'task_distribution' | 'stagnation_report' | 'all', days: number }) => {
        console.log(`[AI TOOLS] >> EXECUTE get_analytics:`, { type, days });
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
      execute: async (params: any) => {
        console.log(`[AI TOOLS] >> EXECUTE generate_chart:`, JSON.stringify(params, null, 2));
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
      execute: async ({ projectId, state, query, limit }: any) => {
        try {
          console.log(`[AI TOOLS] >> EXECUTE list_tasks:`, { projectId, state, query });
          let builder = supabase.from('tasks').select('*, projects(name)');
          if (projectId) builder = builder.eq('project_id', projectId);
          if (state) builder = builder.eq('state', state);
          if (query) builder = builder.ilike('title', `%${query}%`);
          const { data, error } = await builder.limit(limit).order('created_at', { ascending: false });
          if (error) {
            console.error(`[AI TOOLS] list_tasks error:`, error);
            return { error: error.message };
          }
          return data;
        } catch (e: unknown) {
          const error = e as Error;
          console.error(`[AI TOOLS] list_tasks critical error:`, error);
          return { error: error.message };
        }
      },
    },
    create_task: {
      description: 'Create a new task in Entropy.',
      inputSchema: z.object({
        title: z.string().describe('The title of the task'),
        projectId: z.string().uuid().describe('The EXACT UUID of the project (project_id)'),
        description: z.string().optional(),
        state: z.enum(['Active', 'Waiting', 'Blocked', 'Done']).default('Active'),
        due_date: z.string().optional().describe('ISO timestamp or YYYY-MM-DD'),
        est_duration_minutes: z.number().default(30),
        energy_tag: z.enum(['Grind', 'Creative', 'Shallow']).default('Shallow'),
      }),
      execute: async (taskData: any) => {
        try {
          console.log(`[AI TOOLS] >> EXECUTE create_task:`, taskData);
          
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
            console.error(`[AI TOOLS] create_task DB error:`, error);
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
          console.error(`[AI TOOLS] create_task critical error:`, error);
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
      execute: async ({ id, ...updates }: any) => {
        console.log(`[AI TOOLS] >> EXECUTE update_task:`, { id, updates });
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
      execute: async ({ id }: any) => {
        console.log(`[AI TOOLS] >> EXECUTE delete_task:`, id);
        // First delete associated activity logs to prevent orphaned analytics
        await supabase.from('activity_logs').delete().eq('task_id', id);
        const { error } = await supabase.from('tasks').delete().eq('id', id);
        if (error) throw error;
        return { success: true };
      },
    },
    get_projects: {
      description: 'List all available projects.',
      inputSchema: z.object({}),
      execute: async () => {
        console.log(`[AI TOOLS] >> EXECUTE get_projects`);
        const { data, error } = await supabase.from('projects').select('*').order('tier', { ascending: true });
        if (error) throw error;
        return data;
      },
    },
    create_project: {
      description: 'Create a new project. Returns the project entity including its UUID in the "id" field.',
      inputSchema: z.object({
        name: z.string(),
        tier: z.number().min(1).max(4).default(3),
        decay_threshold_days: z.number().default(15),
        kpi_name: z.string().optional(),
        kpi_value: z.number().default(0),
      }),
      execute: async (projectData: any) => {
        try {
          console.log(`[AI TOOLS] >> EXECUTE create_project:`, projectData);
          const { data, error } = await supabase.from('projects').insert(projectData).select().single();
          if (error) {
            console.error(`[AI TOOLS] create_project error:`, error);
            return { error: error.message };
          }
          return data;
        } catch (e: unknown) {
          const error = e as Error;
          console.error(`[AI TOOLS] create_project critical error:`, error);
          return { error: error.message };
        }
      },
    },
    delete_project: {
      description: 'Delete a project and all its associated tasks.',
      inputSchema: z.object({
        id: z.string().uuid().describe('The UUID of the project to delete'),
      }),
      execute: async ({ id }: any) => {
        try {
          console.log(`[AI TOOLS] >> EXECUTE delete_project:`, id);
          const { error } = await supabase.from('projects').delete().eq('id', id);
          if (error) {
            console.error(`[AI TOOLS] delete_project error:`, error);
            return { error: error.message };
          }
          return { success: true };
        } catch (e: unknown) {
          const error = e as Error;
          console.error(`[AI TOOLS] delete_project critical error:`, error);
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
      execute: async ({ taskId, content, isVoiceTranscript }: any) => {
        console.log(`[AI TOOLS] >> EXECUTE add_note:`, { taskId });
        const { data, error } = await supabase.from('task_notes').insert({
          task_id: taskId,
          content,
          is_voice_transcript: isVoiceTranscript
        }).select().single();
        if (error) throw error;
        return data;
      },
    },
    create_note: {
      description: 'Create a standalone note in the knowledge base.',
      inputSchema: z.object({
        title: z.string(),
        content: z.string(),
        projectId: z.string().uuid().optional(),
        taskId: z.string().uuid().optional(),
      }),
      execute: async ({ title, content, projectId, taskId }: any) => {
        console.log(`[AI TOOLS] >> EXECUTE create_note:`, { title });
        const { data, error } = await supabase.from('notes').insert({
          title,
          content,
          project_id: projectId,
          task_id: taskId
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
      execute: async ({ id }: any) => {
        console.log(`[AI TOOLS] >> EXECUTE get_task_details:`, id);
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
      execute: async ({ taskId, title }: any) => {
        console.log(`[AI TOOLS] >> EXECUTE add_subtask:`, { taskId, title });
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
      execute: async ({ id, isCompleted }: any) => {
        console.log(`[AI TOOLS] >> EXECUTE toggle_subtask:`, { id, isCompleted });
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
      execute: async ({ timeAvailableMinutes, mode, limit }: any) => {
        try {
          console.log(`[AI TOOLS] >> EXECUTE get_syllabus:`, { timeAvailableMinutes, mode });
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
          console.error(`[AI TOOLS] get_syllabus error:`, error);
          return { error: error.message };
        }
      },
    },
    search_web: {
      description: 'Search the live web for up-to-date information and sources.',
      inputSchema: z.object({
        query: z.string().describe('The search query to run'),
        maxResults: z.number().min(3).max(10).default(6),
        includeDomains: z.array(z.string()).optional(),
        excludeDomains: z.array(z.string()).optional(),
        recencyDays: z.number().optional().describe('Limit results to the last N days'),
        language: z.string().optional().describe('Two-letter language code, e.g., en')
      }),
      execute: async (params: any) => {
        try {
          console.log('[AI TOOLS] >> EXECUTE search_web:', params);
          const results = await searchWeb(params);
          return results;
        } catch (e: any) {
          console.error('[AI TOOLS] search_web error:', e);
          return { error: e.message || 'search_web failed' };
        }
      }
    },
    spawn_subagents: {
      description: 'Spawn one or more background subagents to handle complex, parallel tasks like multi-topic research or analysis.',
      inputSchema: z.object({
        subagents: z.array(z.object({
          type: z.enum(['research', 'analysis', 'thought_dump']),
          instruction: z.string().describe('Detailed instructions for this subagent.'),
          projectId: z.string().uuid().optional().describe('Link the result to a specific project'),
          taskId: z.string().uuid().optional().describe('Link the result to a specific task'),
          outputInstruction: z.string().optional().describe('How the subagent should store its findings (e.g., "Create a new note titled X")'),
        })).min(2).describe('At least 2 subagents are required for parallel execution. For a single task, use inline tools instead.')
      }),
      execute: async ({ subagents }: any) => {
        try {
          console.log(`[AI TOOLS] >> EXECUTE spawn_subagents:`, { count: subagents.length });
          const adminSupabase = createAdminClient();
          const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
          
          await Promise.all(subagents.map(async (sa: SubagentTask) => {
            const { data: job, error: jobErr } = await adminSupabase.from('background_jobs').insert({
              type: sa.type,
              status: 'pending',
              payload: { 
                instruction: sa.instruction, 
                projectId: sa.projectId, 
                taskId: sa.taskId,
                outputInstruction: sa.outputInstruction 
              }
            }).select().single();

            if (jobErr) throw jobErr;

            // Fire and forget execution trigger
            fetch(`${baseUrl}/api/subagent/execute`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ jobId: job.id })
            }).catch(e => console.error('[AI TOOLS] Failed to trigger subagent execution:', e));
          }));

          return { 
            success: true,
            message: `Successfully spawned ${subagents.length} subagents in the background. The user will be notified in the UI as progress is made.` 
          };
        } catch (e: any) {
          console.error(`[AI TOOLS] spawn_subagents error:`, e);
          return { error: e.message };
        }
      }
    },
    complete_task: {
      description: 'Mark a task as completed. This also rejuvenation the associated project health.',
      inputSchema: z.object({
        taskId: z.string().uuid(),
        durationMinutes: z.number().optional().describe('Actual time spent (defaults to estimated if not provided)'),
        sessionMode: z.enum(['Deep Work', 'Low Energy', 'Creative', 'Admin']).optional(),
      }),
      execute: async ({ taskId, durationMinutes, sessionMode }: any) => {
        try {
          console.log(`[AI TOOLS] >> EXECUTE complete_task:`, { taskId });
          
          const { data: task, error: fetchErr } = await supabase
            .from('tasks')
            .select('*, projects(*)')
            .eq('id', taskId)
            .single();
          
          if (fetchErr || !task) throw fetchErr || new Error("Task not found");

          const projectId = task.project_id;
          const finalDuration = durationMinutes || task.est_duration_minutes || 30;

          const [updateTask, updateProject, logActivity] = await Promise.all([
            supabase.from('tasks').update({ 
               state: 'Done', 
               last_touched_at: new Date().toISOString() 
            }).eq('id', taskId),
            
            supabase.from('projects').update({ 
              last_touched_at: new Date().toISOString() 
            }).eq('id', projectId),
            
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

          return { 
            success: true, 
            taskTitle: task.title, 
            projectName: task.projects?.name,
            rejuvenated: true 
          };
        } catch (e: unknown) {
          const error = e as Error;
          console.error(`[AI TOOLS] complete_task error:`, error);
          return { error: error.message };
        }
      },
    },
    save_memory: {
      description: 'Save a core preference, fact, or instruction for long-term recall. Deduplicates automatically.',
      inputSchema: z.object({
        content: z.string().describe('The fact or preference to remember'),
        type: z.enum(['general', 'directive']).default('general').describe('Directives are rules/preferences, general are just facts'),
      }),
      execute: async ({ content, type }: any) => {
        try {
          console.log(`[AI TOOLS] >> EXECUTE save_memory:`, { type });
          
          const { embedding } = await embed({
            model: google.textEmbeddingModel('gemini-embedding-001'),
            value: content,
            providerOptions: {
              google: {
                outputDimensionality: 768,
                taskType: 'RETRIEVAL_DOCUMENT'
              }
            }
          });

          const { error } = await supabase.from('memories').insert({
            content,
            type,
            embedding,
            source: 'ai_assistant'
          });

          if (error) {
            if (error.code === '23505') return { success: true, message: "Memory already exists." };
            throw error;
          }
          return { success: true, message: "Memory saved." };
        } catch (e: any) {
          console.error(`[AI TOOLS] save_memory error:`, e);
          return { error: e.message };
        }
      },
    },
    get_context_card: {
      description: 'Fetch the context card (strategy guide) for a specific project.',
      inputSchema: z.object({
        projectId: z.string().uuid(),
      }),
      execute: async ({ projectId }: any) => {
        console.log(`[AI TOOLS] >> EXECUTE get_context_card:`, projectId);
        const { data, error } = await supabase.from('context_cards').select('*').eq('project_id', projectId).single();
        if (error && error.code !== 'PGRST116') throw error;
        return data || { content: "No context card found for this project." };
      },
    },
    update_context_card: {
      description: 'Update the strategic context card for a project.',
      inputSchema: z.object({
        projectId: z.string().uuid(),
        content: z.string().describe('Markdown content for the strategy/context'),
      }),
      execute: async ({ projectId, content }: any) => {
        console.log(`[AI TOOLS] >> EXECUTE update_context_card:`, projectId);
        const { data, error } = await supabase.from('context_cards').upsert({
          project_id: projectId,
          content,
          updated_at: new Date().toISOString()
        }).select().single();
        if (error) throw error;
        return data;
      },
    }
  };
}
