#!/usr/bin/env node

/**
 * Test script to investigate OpenRouter API reasoning implementation
 * 
 * Usage: node test-reasoning.js YOUR_API_KEY
 */

const fs = require('fs');
const https = require('https');

if (process.argv.length < 3) {
  console.error('Usage: node test-reasoning.js YOUR_API_KEY');
  process.exit(1);
}

const API_KEY = process.argv[2];
const BASE_URL = 'https://openrouter.ai/api/v1';

// Test models known to support reasoning
const TEST_MODELS = [
  'openai/gpt-4o-2024-08-06',  // GPT-4o with reasoning
  'anthropic/claude-3.5-sonnet', // Claude 3.5 Sonnet
  'openai/gpt-4-turbo',        // GPT-4 Turbo
];

const TEST_PROMPT = "Explain why the sky appears blue during the day. Break down your reasoning step by step.";

function makeRequest(url, options, postData = null) {
  return new Promise((resolve, reject) => {
    const req = https.request(url, options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          data: data
        });
      });
    });
    
    req.on('error', reject);
    
    if (postData) {
      req.write(postData);
    }
    
    req.end();
  });
}

async function testReasoningWithModel(model) {
  console.log(`\n🧠 Testing reasoning with model: ${model}`);
  console.log('=' .repeat(60));
  
  // Test 1: Without reasoning
  console.log('\n📝 Test 1: WITHOUT reasoning parameter');
  await testCompletion(model, false);
  
  // Test 2: With reasoning enabled
  console.log('\n🧠 Test 2: WITH reasoning enabled (medium effort)');
  await testCompletion(model, true, 'medium');
  
  // Test 3: With reasoning enabled (high effort)
  console.log('\n🚀 Test 3: WITH reasoning enabled (high effort)');
  await testCompletion(model, true, 'high');
}

async function testCompletion(model, enableReasoning = false, effort = 'medium') {
  const payload = {
    model: model,
    messages: [
      {
        role: 'user',
        content: TEST_PROMPT
      }
    ],
    temperature: 0.3,
    max_tokens: 500,
    stream: false // Use non-streaming for easier analysis
  };
  
  // Add reasoning parameters if enabled
  if (enableReasoning) {
    payload.reasoning = { enabled: true, effort: effort };
    payload.include_reasoning = true;
  }
  
  console.log(`   Request payload keys: ${Object.keys(payload).join(', ')}`);
  
  try {
    const response = await makeRequest(
      `${BASE_URL}/chat/completions`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${API_KEY}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'http://localhost:3000',
          'X-Title': 'PromptBridge-Test',
        }
      },
      JSON.stringify(payload)
    );
    
    console.log(`   Status: ${response.statusCode}`);
    console.log(`   Response headers:`, Object.keys(response.headers));
    
    if (response.statusCode === 200) {
      const data = JSON.parse(response.data);
      
      // Analyze response structure
      console.log(`   Response keys: ${Object.keys(data).join(', ')}`);
      
      if (data.choices && data.choices[0]) {
        const choice = data.choices[0];
        console.log(`   Choice keys: ${Object.keys(choice).join(', ')}`);
        
        if (choice.message) {
          console.log(`   Message keys: ${Object.keys(choice.message).join(', ')}`);
          
          // Check for reasoning-related fields
          const hasReasoning = choice.message.reasoning || choice.reasoning;
          const hasThinking = choice.message.thinking || choice.thinking;
          
          console.log(`   Has reasoning field: ${!!hasReasoning}`);
          console.log(`   Has thinking field: ${!!hasThinking}`);
          
          // Show content structure
          const content = choice.message.content || '';
          console.log(`   Content length: ${content.length} chars`);
          console.log(`   Content preview: ${content.slice(0, 100)}...`);
          
          // Check for reasoning patterns in content
          const hasThinkingTags = content.includes('<thinking>') || content.includes('<reasoning>');
          const hasStepByStep = content.toLowerCase().includes('step') && content.toLowerCase().includes('reason');
          
          console.log(`   Contains thinking tags: ${hasThinkingTags}`);
          console.log(`   Contains step-by-step reasoning: ${hasStepByStep}`);
          
          if (hasReasoning) {
            console.log(`   Reasoning content: ${JSON.stringify(hasReasoning).slice(0, 200)}...`);
          }
          
          if (hasThinking) {
            console.log(`   Thinking content: ${JSON.stringify(hasThinking).slice(0, 200)}...`);
          }
        }
      }
      
      // Check usage information
      if (data.usage) {
        console.log(`   Usage: ${JSON.stringify(data.usage)}`);
      }
      
    } else {
      console.log(`   Error response: ${response.data.slice(0, 500)}`);
    }
    
  } catch (error) {
    console.error(`   Request failed: ${error.message}`);
  }
}

async function main() {
  console.log('🔍 OpenRouter Reasoning API Investigation');
  console.log('=' .repeat(60));
  console.log(`API Key: ${API_KEY.slice(0, 8)}...`);
  console.log(`Test prompt: "${TEST_PROMPT}"`);
  
  for (const model of TEST_MODELS) {
    try {
      await testReasoningWithModel(model);
      
      // Small delay between models to be nice to the API
      await new Promise(resolve => setTimeout(resolve, 1000));
      
    } catch (error) {
      console.error(`Failed to test ${model}: ${error.message}`);
    }
  }
  
  console.log('\n✅ Investigation complete!');
  console.log('\nNext steps based on results:');
  console.log('1. If reasoning fields are present in responses: implement UI to display them');
  console.log('2. If reasoning affects content structure: implement parsing logic');
  console.log('3. If no reasoning detected: check OpenRouter docs for correct parameters');
}

main().catch(console.error);