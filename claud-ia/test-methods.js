const { streamText } = require('ai');
const { openai } = require('@ai-sdk/openai');

async function main() {
  // We don't need a real API key just to check the keys of the object returned by streamText
  try {
    const result = streamText({
      model: { requestId: 'test', provider: 'test', languageModelId: 'test', doGenerate: () => {} },
      messages: [],
    });
    console.log('Methods:', Object.keys(result));
    console.log('Prototype Methods:', Object.keys(Object.getPrototypeOf(result)));
  } catch (e) {
    console.log('Error:', e.message);
  }
}
main();
