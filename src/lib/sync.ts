import { db } from './db';
import { createClient } from './supabase';

export async function processOutbox() {
  if (!navigator.onLine) return;

  const outboxItems = await db.sync_outbox.orderBy('timestamp').toArray();
  if (outboxItems.length === 0) return;

  console.log(`[Sync] Processing ${outboxItems.length} items from outbox...`);
  const supabase = createClient();

  for (const item of outboxItems) {
    try {
      let error;
      if (item.action === 'insert') {
        ({ error } = await supabase.from(item.tableName).insert(item.data));
      } else if (item.action === 'update') {
        const { id, ...updateData } = item.data;
        ({ error } = await supabase.from(item.tableName).update(updateData).eq('id', id));
      } else if (item.action === 'delete') {
        ({ error } = await supabase.from(item.tableName).delete().eq('id', item.data.id));
      }

      if (!error) {
        await db.sync_outbox.delete(item.id!);
      } else {
        console.error(`[Sync] Error syncing ${item.tableName}:`, error);
        // If it's a conflict or other non-recoverable error, we might want to skip it
        // For now, we'll stop and retry later
        break;
      }
    } catch (err) {
      console.error(`[Sync] Critical error syncing ${item.tableName}:`, err);
      break;
    }
  }
}

export async function initialSync() {
  if (!navigator.onLine) return;

  console.log('[Sync] Performing initial data fetch...');
  const supabase = createClient();

  const tables = ['projects', 'tasks', 'notes', 'activity_logs'] as const;

  for (const table of tables) {
    const { data, error } = await supabase.from(table).select('*');
    if (data && !error) {
       // @ts-ignore
      await db[table].bulkPut(data);
    }
  }

  // Initial Sync for Documentation
  fetch('/api/docs').then(async (docsRes) => {
    if (docsRes.ok) {
      const docs = await docsRes.json();
      if (Array.isArray(docs)) {
        await db.documentation.bulkPut(docs);
        console.log('[Sync] Documentation indexed:', docs.length);
      }
    }
  }).catch(e => console.warn('[Sync] Failed to fetch documentation:', e));

  console.log('[Sync] Initial sync complete.');
}

// Set up listeners
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    console.log('[Sync] Back online, processing outbox...');
    processOutbox();
  });

  // Periodic check as a fallback (every 30 seconds)
  setInterval(() => {
    processOutbox();
  }, 30000);
}
