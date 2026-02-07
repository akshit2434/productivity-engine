import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { generateText } from 'ai';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { getTools } from '@/lib/ai/tools';

export const maxDuration = 60; // Max allowed on Vercel Hobby

export async function POST(req: Request) {
  let jobId: string | undefined;
  try {
    const body = await req.json();
    jobId = body.jobId;
    const supabase = createAdminClient();

    // 1. Fetch Job
    const { data: job, error: jobErr } = await supabase
      .from('background_jobs')
      .select('*')
      .eq('id', jobId)
      .single();

    if (jobErr || !job) {
      console.error('[SUBAGENT] Job not found:', jobId, jobErr);
      return new Response(JSON.stringify({ error: 'Job not found' }), { status: 404 });
    }

    // 2. Update status to running
    await supabase.from('background_jobs').update({ 
      status: 'running', 
      started_at: new Date().toISOString() 
    }).eq('id', jobId);

    await supabase.from('job_logs').insert({
      job_id: jobId,
      message: 'Subagent initialized and running...',
      level: 'info'
    });

    const { type, payload } = job;
    const { instruction, projectId, taskId, outputInstruction } = payload;

    const google = createGoogleGenerativeAI({
      apiKey: process.env.GEMINI_API_KEY,
    });

    // 3. Execute with AI
    const result = await generateText({
      model: google('gemini-3-flash-preview'),
      tools: getTools(supabase, google),
      maxSteps: 10,
      system: `
        You are a Background Subagent for the Entropy productivity system.
        
        ROLE: Specialized ${type} assistant.
        PROJECT_ID: ${projectId || 'None'}
        TASK_ID: ${taskId || 'None'}
        
        DUTIES:
        1. Contextualize: Read relevant notes/memories/context cards BEFORE taking action.
        2. Research: Use search_web if needed to get up-to-date facts.
        3. Persist: Save your final findings to Notes or Tasks using the available tools.
        4. Instruction for Output: ${outputInstruction || 'Create a detailed note with your findings.'}
        
        Your duty is to be thorough but efficient. Always save your work to the database.
      `,
      prompt: instruction,
      onStepFinish: async ({ toolCalls, toolResults }: any) => {
        // Log progress based on tool executions
        const logs = toolResults.map((res: any) => ({
          job_id: jobId,
          message: `Completed ${res.toolName}`,
          level: 'info'
        }));

        if (logs.length > 0) {
          await supabase.from('job_logs').insert(logs);
        }
      }
    } as any);

    // 4. Final Updates
    await supabase.from('background_jobs').update({ 
      status: 'completed', 
      completed_at: new Date().toISOString(),
      result: { text: result.text }
    }).eq('id', jobId);

    await supabase.from('job_logs').insert({
      job_id: jobId,
      message: 'Background task completed successfully.',
      level: 'info'
    });

    return new Response(JSON.stringify({ success: true, text: result.text }));
  } catch (error: any) {
    console.error(`[SUBAGENT] Critical execution error:`, error);
    
    // Attempt to log error to DB if jobId is known
    try {
      if (jobId) {
        const supabase = createAdminClient();
        await supabase.from('background_jobs').update({ 
          status: 'failed', 
          error: error.message 
        }).eq('id', jobId);

        await supabase.from('job_logs').insert({
          job_id: jobId,
          message: `Error: ${error.message}`,
          level: 'error'
        });
      }
    } catch (e) {
      console.error('[SUBAGENT] Failed to log error to DB:', e);
    }

    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}
