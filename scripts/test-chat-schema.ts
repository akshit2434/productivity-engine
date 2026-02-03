
/**
 * Test script for verifying message transformation logic.
 */

function mergeConsecutiveMessages(messages: any[]): any[] {
  if (messages.length <= 1) return messages;

  const merged: any[] = [];
  let currentMsg = messages[0];

  for (let i = 1; i < messages.length; i++) {
    const nextMsg = messages[i];

    if (currentMsg.role === nextMsg.role) {
      const currentParts = Array.isArray(currentMsg.content) 
        ? currentMsg.content 
        : [{ type: 'text', text: String(currentMsg.content) }];
      
      const nextParts = Array.isArray(nextMsg.content) 
        ? nextMsg.content 
        : [{ type: 'text', text: String(nextMsg.content) }];

      currentMsg = {
        ...currentMsg,
        role: currentMsg.role, // Keep role
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

const testCases = [
  {
    name: "Standard alternation",
    input: [
      { role: 'user', content: 'hello' },
      { role: 'assistant', content: 'hi' }
    ],
    expectedLength: 2
  },
  {
    name: "Consecutive user messages",
    input: [
      { role: 'user', content: 'hello' },
      { role: 'user', content: 'anyone there?' },
      { role: 'assistant', content: 'yes' }
    ],
    expectedLength: 2
  },
  {
    name: "Consecutive assistant messages",
    input: [
      { role: 'user', content: 'hello' },
      { role: 'assistant', content: 'one moment' },
      { role: 'assistant', content: 'i am back' }
    ],
    expectedLength: 2
  },
  {
    name: "Complex multi-role overlap",
    input: [
      { role: 'user', content: 'u1' },
      { role: 'user', content: 'u2' },
      { role: 'assistant', content: 'a1' },
      { role: 'assistant', content: 'a2' },
      { role: 'user', content: 'u3' }
    ],
    expectedLength: 3
  }
];

console.log("--- Running Chat Message Schema Tests ---");

testCases.forEach(tc => {
  const result = mergeConsecutiveMessages(tc.input);
  const passed = result.length === tc.expectedLength && result.every((m, i) => i === 0 || m.role !== result[i-1].role);
  
  console.log(`[${passed ? 'PASS' : 'FAIL'}] ${tc.name}`);
  if (!passed) {
    console.log("  Input length:", tc.input.length);
    console.log("  Output length:", result.length);
    console.log("  Result roles:", result.map(m => m.role));
  }
});
