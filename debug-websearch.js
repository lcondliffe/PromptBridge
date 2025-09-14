// Quick debug script to check which models support web search
// Run with: node debug-websearch.js

const BASE_URL = 'https://openrouter.ai/api/v1';

async function checkModels() {
  try {
    const apiKey = process.env.OPENROUTER_API_KEY || 'your-api-key-here';
    
    const res = await fetch(`${BASE_URL}/models`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'X-API-Key': apiKey,
        'Content-Type': 'application/json',
      },
    });
    
    if (!res.ok) {
      console.error('Failed to fetch models:', res.status, res.statusText);
      return;
    }
    
    const data = await res.json();
    const models = data.data || [];
    
    console.log(`Found ${models.length} total models`);
    
    // Filter models that support web search
    const webSearchModels = models.filter(model => {
      return model.pricing?.web_search && model.pricing.web_search !== '0';
    });
    
    console.log(`\n🌐 Models with web search support (${webSearchModels.length}):`);
    webSearchModels.slice(0, 10).forEach(model => {
      console.log(`- ${model.id}: ${model.name} (web_search: ${model.pricing?.web_search})`);
    });
    
    if (webSearchModels.length > 10) {
      console.log(`... and ${webSearchModels.length - 10} more`);
    }
    
    // Check some popular models specifically
    const popularModels = [
      'openai/gpt-4o',
      'openai/gpt-4o-mini', 
      'anthropic/claude-3.5-sonnet',
      'google/gemini-pro',
      'meta-llama/llama-3.1-405b-instruct',
      'perplexity/llama-3.1-sonar-large-128k-online'
    ];
    
    console.log('\n📊 Popular models web search support:');
    popularModels.forEach(modelId => {
      const model = models.find(m => m.id === modelId);
      if (model) {
        const hasWebSearch = Boolean(model.pricing?.web_search && model.pricing.web_search !== '0');
        console.log(`- ${modelId}: ${hasWebSearch ? '✅' : '❌'} ${hasWebSearch ? `(${model.pricing?.web_search})` : ''}`);
      } else {
        console.log(`- ${modelId}: Not found`);
      }
    });
    
  } catch (error) {
    console.error('Error:', error);
  }
}

checkModels();