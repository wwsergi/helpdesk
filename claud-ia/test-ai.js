import { openai } from '@ai-sdk/openai';
import { streamText } from 'ai';

async function main() {
  const result = streamText({
    model: openai('gpt-4o-mini'),
    messages: [{ role: 'user', content: 'hello' }],
  });
  console.log(Object.keys(result));
}
main().catch(console.error);
