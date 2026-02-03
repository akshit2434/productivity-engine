import { createClient } from '@/lib/supabaseServer';
import { NextResponse } from 'next/server';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { id: sessionId } = await params;

    if (!sessionId || sessionId === 'undefined' || sessionId === 'null') {
      return NextResponse.json([]);
    }

    const { data, error } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error("Supabase Error (GET Messages):", error);
      return NextResponse.json({ error: error.message, code: error.code }, { status: 500 });
    }

    return NextResponse.json(data || []);
  } catch (err: any) {
    console.error("Fatal Error (GET Messages):", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
