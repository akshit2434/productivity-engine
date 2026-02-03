import { createClient } from '@/lib/supabaseServer';
import { NextResponse } from 'next/server';
// No external uuid import needed, using built-in crypto.randomUUID()

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as Blob;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const supabase = await createClient();
    const bucketName = 'voice-chat';

    const fileName = `${crypto.randomUUID()}.webm`;
    const filePath = `${fileName}`;

    // 1. Upload file directly
    // We remove the listBuckets check as it often requires service_role permissions.
    // The upload will fail if the bucket is missing or RLS is improperly configured.
    const { data, error: uploadError } = await supabase.storage
      .from(bucketName)
      .upload(filePath, file, {
        contentType: file.type || 'audio/webm',
        cacheControl: '3600',
        upsert: false
      });

    if (uploadError) {
      console.error('[Upload API] Upload error details:', JSON.stringify(uploadError, null, 2));
      return NextResponse.json({ 
        error: `Upload failed: ${uploadError.message}. Make sure the '${bucketName}' bucket exists and allows public uploads.` 
      }, { status: 500 });
    }

    // 3. Get Public URL
    const { data: { publicUrl } } = supabase.storage
      .from(bucketName)
      .getPublicUrl(filePath);

    return NextResponse.json({ url: publicUrl });
  } catch (error) {
    console.error('[Upload API] Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
