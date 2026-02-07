import { describe, it, expect, vi, beforeEach } from 'vitest';
import { db } from './db';
import { processOutbox, initialSync } from './sync';
import { createClient } from './supabase';

// Mock Supabase stable methods
const mockFromMethods = {
  select: vi.fn().mockResolvedValue({ data: [], error: null }),
  insert: vi.fn().mockResolvedValue({ error: null }),
  update: vi.fn(() => ({
    eq: vi.fn().mockResolvedValue({ error: null }),
  })),
  delete: vi.fn(() => ({
    eq: vi.fn().mockResolvedValue({ error: null }),
  })),
};

const mockSupabase = {
  from: vi.fn(() => mockFromMethods),
};

vi.mock('./supabase', () => ({
  createClient: vi.fn(() => mockSupabase),
}));

vi.mock('./db', () => {
  const mockTable = () => {
    const table: any = {
      add: vi.fn().mockResolvedValue(1),
      update: vi.fn().mockResolvedValue(1),
      delete: vi.fn().mockResolvedValue(undefined),
      toArray: vi.fn().mockResolvedValue([]),
      bulkPut: vi.fn().mockResolvedValue(undefined),
    };
    
    table.where = vi.fn().mockReturnValue({
      equals: vi.fn().mockReturnValue({
        first: vi.fn().mockResolvedValue(null),
      }),
    });
    
    table.orderBy = vi.fn().mockReturnValue({
      toArray: vi.fn().mockResolvedValue([]),
    });
    
    return table;
  };

  const outbox = mockTable();

  return {
    db: {
      projects: mockTable(),
      tasks: mockTable(),
      notes: mockTable(),
      activity_logs: mockTable(),
      documentation: mockTable(),
      sync_outbox: outbox,
      recordAction: async function(tableName: string, action: string, data: any) {
        await outbox.add({
          tableName,
          action,
          data,
          timestamp: Date.now()
        });
      },
    },
  };
});

describe('Database and Sync Logic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(navigator, 'onLine', {
      configurable: true,
      value: true,
      writable: true,
    });
  });

  describe('db.recordAction', () => {
    it('should add an item to the sync_outbox', async () => {
      const testData = { id: '1', title: 'Test Task' };
      await db.recordAction('tasks', 'insert', testData);
      
      expect(db.sync_outbox.add).toHaveBeenCalledWith(expect.objectContaining({
        tableName: 'tasks',
        action: 'insert',
        data: testData
      }));
    });
  });

  describe('processOutbox', () => {
    it('should not process if offline', async () => {
      Object.defineProperty(navigator, 'onLine', { value: false });
      
      await processOutbox();
      
      expect(db.sync_outbox.orderBy).not.toHaveBeenCalled();
    });

    it('should process items in the outbox when online', async () => {
      const mockOutboxItems = [
        { id: 1, tableName: 'tasks', action: 'insert', data: { id: 't1', title: 'Task 1' }, timestamp: 100 },
      ];
      
      (db.sync_outbox.orderBy as any)().toArray.mockResolvedValue(mockOutboxItems);
      
      await processOutbox();

      expect(mockSupabase.from).toHaveBeenCalledWith('tasks');
      expect(db.sync_outbox.delete).toHaveBeenCalledWith(1);
    });
  });

  describe('initialSync', () => {
    it('should fetch data from Supabase and put into local DB', async () => {
      const mockData = [{ id: 'p1', name: 'Project 1' }];
      (mockSupabase.from as any)().select.mockResolvedValue({ data: mockData, error: null });

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([{ id: 'd1', title: 'Doc 1' }]),
      });

      await initialSync();

      expect(db.projects.bulkPut).toHaveBeenCalledWith(mockData);
      expect(db.documentation.bulkPut).toHaveBeenCalled();
    });
  });
});
