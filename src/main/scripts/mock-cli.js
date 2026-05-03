/**
 * Mock CLI for Fluxion MVP
 * Simulates a streaming AI CLI outputting text every ~100ms.
 * Supports simulating a deadlock if "simulate_freeze" is passed in arguments.
 */

const args = process.argv.slice(2);
const prompt = args.join(' ');

// Deadlock simulation
if (prompt.includes('simulate_freeze')) {
  process.stdout.write('Simulating a frozen process... Will not exit.\n');
  // Infinite loop / keep-alive without outputting anything to trigger PROCESS_TIMEOUT
  setInterval(() => {}, 10000);
} else {
  // Normal simulation
  const lines = [
    'Initializing Mock Agent...',
    'Analyzing context...',
    'Generating code blocks...',
    '```javascript',
    'function helloWorld() {',
    '  console.log("Hello from Mock CLI!");',
    '}',
    '```',
    'Code generation complete.',
    'Verifying syntax...',
    'All checks passed.'
  ];

  let i = 0;
  
  const interval = setInterval(() => {
    if (i < lines.length) {
      process.stdout.write(lines[i] + '\n');
      i++;
    } else {
      clearInterval(interval);
      process.exit(0);
    }
  }, 100); // Output a chunk every 100ms to test throttled streaming
}
