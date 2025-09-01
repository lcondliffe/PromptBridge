#!/usr/bin/env node

/**
 * GPT-5 Comprehensive Diagnostic Script
 * 
 * This script diagnoses GPT-5 availability and streaming issues with OpenRouter
 */

const https = require('https');

const API_KEY = process.env.OPENROUTER_API_KEY || 'your-api-key-here';
const BASE_URL = 'openrouter.ai';

if (!API_KEY || API_KEY === 'your-api-key-here') {
  console.error('❌ Please set OPENROUTER_API_KEY environment variable');
  process.exit(1);
}

// 1. Check API Key and Account Info
function checkAccount() {
  return new Promise((resolve) => {
    console.log('🔍 Step 1: Checking API key and account...');
    
    const options = {
      hostname: BASE_URL,
      port: 443,
      path: '/api/v1/auth/key',
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode === 200) {
          try {
            const info = JSON.parse(data);
            console.log('✅ API Key valid');
            console.log(`   - Usage: $${info.data?.usage || 0}`);
            console.log(`   - Limit: $${info.data?.limit || 'N/A'}`);
            console.log(`   - Label: ${info.data?.label || 'N/A'}`);
            resolve(true);
          } catch (e) {
            console.log('⚠️  API Key valid but response parsing failed:', data);
            resolve(true);
          }
        } else {
          console.log(`❌ API Key invalid: ${res.statusCode} ${data}`);
          resolve(false);
        }
      });
    });

    req.on('error', (err) => {
      console.log('❌ Account check failed:', err.message);
      resolve(false);
    });

    req.end();
  });
}

// 2. Check Available Models
function checkModels() {
  return new Promise((resolve) => {
    console.log('\n🔍 Step 2: Checking available models...');
    
    const options = {
      hostname: BASE_URL,
      port: 443,
      path: '/api/v1/models',
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode === 200) {
          try {
            const response = JSON.parse(data);
            const models = response.data || [];
            
            // Look for GPT-5 models
            const gpt5Models = models.filter(m => m.id.includes('gpt-5') || m.id.includes('gpt5'));
            
            console.log(`✅ Found ${models.length} total models`);
            
            if (gpt5Models.length > 0) {
              console.log(`✅ GPT-5 models available:`);
              gpt5Models.forEach(m => {
                console.log(`   - ${m.id} (${m.name || 'No name'})`);
                console.log(`     Context: ${m.context_length || 'Unknown'}, Pricing: $${m.pricing?.prompt || 'N/A'}/$${m.pricing?.completion || 'N/A'}`);
              });
              resolve(gpt5Models);
            } else {
              console.log('❌ No GPT-5 models found in your plan');
              console.log('   Available models with "openai":');
              const openaiModels = models.filter(m => m.id.includes('openai')).slice(0, 5);
              openaiModels.forEach(m => console.log(`   - ${m.id}`));
              resolve([]);
            }
          } catch (e) {
            console.log('❌ Failed to parse models response:', data.slice(0, 200));
            resolve([]);
          }
        } else {
          console.log(`❌ Models check failed: ${res.statusCode}`);
          resolve([]);
        }
      });
    });

    req.on('error', (err) => {
      console.log('❌ Models check failed:', err.message);
      resolve([]);
    });

    req.end();
  });
}

// 3. Test Non-Streaming Request First
function testNonStreaming(model) {
  return new Promise((resolve) => {
    console.log(`\n🔍 Step 3: Testing non-streaming request with ${model}...`);
    
    const postData = JSON.stringify({
      model,
      messages: [
        { role: 'system', content: 'You are a helpful assistant.' },
        { role: 'user', content: 'Say "Hello, this is a test response" and nothing else.' }
      ],
      temperature: 0,
      max_tokens: 20,
      stream: false // Non-streaming first
    });

    const options = {
      hostname: BASE_URL,
      port: 443,
      path: '/api/v1/chat/completions',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
        'HTTP-Referer': 'http://localhost:3000',
        'X-Title': 'PromptBridge-Diagnostic'
      }
    };

    const req = https.request(options, (res) => {
      console.log(`   Status: ${res.statusCode}`);
      console.log(`   Headers:`, {
        'content-type': res.headers['content-type'],
        'openrouter-model': res.headers['openrouter-model'],
        'openrouter-provider': res.headers['openrouter-provider'],
        'x-ratelimit-requests-remaining': res.headers['x-ratelimit-requests-remaining']
      });

      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode === 200) {
          try {
            const response = JSON.parse(data);
            const content = response.choices?.[0]?.message?.content || '';
            if (content.trim()) {
              console.log(`✅ Non-streaming works! Response: "${content.trim()}"`);
              resolve(true);
            } else {
              console.log('❌ Non-streaming returned empty content');
              console.log('   Full response:', JSON.stringify(response, null, 2));
              resolve(false);
            }
          } catch (e) {
            console.log('❌ Failed to parse non-streaming response:', data.slice(0, 300));
            resolve(false);
          }
        } else {
          console.log(`❌ Non-streaming failed: ${res.statusCode}`);
          console.log('   Response:', data.slice(0, 300));
          resolve(false);
        }
      });
    });

    req.on('error', (err) => {
      console.log('❌ Non-streaming request failed:', err.message);
      resolve(false);
    });

    req.setTimeout(10000, () => {
      console.log('❌ Non-streaming request timed out');
      req.destroy();
      resolve(false);
    });

    req.write(postData);
    req.end();
  });
}

// 4. Test Streaming with Raw Data Inspection
function testStreaming(model) {
  return new Promise((resolve) => {
    console.log(`\n🔍 Step 4: Testing streaming with raw data inspection...`);
    
    const postData = JSON.stringify({
      model,
      messages: [
        { role: 'system', content: 'You are a helpful assistant.' },
        { role: 'user', content: 'Count from 1 to 5, each number on a new line.' }
      ],
      temperature: 0,
      max_tokens: 50,
      stream: true
    });

    const options = {
      hostname: BASE_URL,
      port: 443,
      path: '/api/v1/chat/completions',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
        'Accept': 'text/event-stream',
        'HTTP-Referer': 'http://localhost:3000',
        'X-Title': 'PromptBridge-Diagnostic'
      }
    };

    const req = https.request(options, (res) => {
      console.log(`   Status: ${res.statusCode}`);
      console.log(`   Headers:`, {
        'content-type': res.headers['content-type'],
        'openrouter-model': res.headers['openrouter-model'],
        'openrouter-provider': res.headers['openrouter-provider'],
        'transfer-encoding': res.headers['transfer-encoding']
      });

      let chunkCount = 0;
      let totalBytes = 0;
      let buffer = '';
      let hasContent = false;

      res.on('data', (chunk) => {
        chunkCount++;
        totalBytes += chunk.length;
        const chunkStr = chunk.toString();
        buffer += chunkStr;
        
        console.log(`   📦 Chunk ${chunkCount}: ${chunk.length} bytes`);
        console.log(`      Raw: ${JSON.stringify(chunkStr.slice(0, 100))}${chunkStr.length > 100 ? '...' : ''}`);
        
        // Process SSE lines
        const lines = buffer.split(/\r?\n/);
        buffer = lines.pop() || '';
        
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          
          console.log(`      Line: ${trimmed}`);
          
          if (trimmed.startsWith('data:')) {
            const dataStr = trimmed.slice('data:'.length).trim();
            if (dataStr === '[DONE]') {
              console.log(`      ✅ Found [DONE] marker`);
            } else if (dataStr) {
              try {
                const payload = JSON.parse(dataStr);
                const content = payload?.choices?.[0]?.delta?.content || '';
                if (content) {
                  hasContent = true;
                  console.log(`      🎯 Content token: "${content}"`);
                }
                if (payload.error) {
                  console.log(`      ❌ Error in payload:`, payload.error);
                }
              } catch (e) {
                console.log(`      ⚠️  Unparseable data: ${dataStr.slice(0, 50)}`);
              }
            }
          }
        }
      });

      res.on('end', () => {
        console.log(`   📊 Stream ended: ${chunkCount} chunks, ${totalBytes} bytes total`);
        if (hasContent) {
          console.log(`   ✅ Streaming works! Received content tokens.`);
          resolve(true);
        } else {
          console.log(`   ❌ Streaming failed: No content received despite ${chunkCount} chunks`);
          resolve(false);
        }
      });

      res.on('error', (err) => {
        console.log(`   ❌ Streaming error:`, err.message);
        resolve(false);
      });
    });

    req.on('error', (err) => {
      console.log('❌ Streaming request failed:', err.message);
      resolve(false);
    });

    req.setTimeout(15000, () => {
      console.log('❌ Streaming request timed out');
      req.destroy();
      resolve(false);
    });

    req.write(postData);
    req.end();
  });
}

// Main diagnostic routine
async function runDiagnostics() {
  console.log('🚨 GPT-5 Streaming Diagnostic Report');
  console.log('=' .repeat(50));
  
  // Step 1: Check account
  const accountOk = await checkAccount();
  if (!accountOk) {
    console.log('\n❌ Stopping: API key invalid');
    return;
  }
  
  // Step 2: Check available models
  const gpt5Models = await checkModels();
  if (gpt5Models.length === 0) {
    console.log('\n❌ Stopping: No GPT-5 models available');
    console.log('\n💡 Possible solutions:');
    console.log('   - GPT-5 might not be publicly available yet');
    console.log('   - Your OpenRouter plan might not include GPT-5');
    console.log('   - Try "openai/gpt-4o" or "openai/gpt-4" instead');
    return;
  }
  
  const targetModel = gpt5Models[0].id;
  console.log(`\n🎯 Testing with model: ${targetModel}`);
  
  // Step 3: Test non-streaming
  const nonStreamingOk = await testNonStreaming(targetModel);
  if (!nonStreamingOk) {
    console.log('\n❌ Non-streaming failed - likely model unavailable');
    return;
  }
  
  // Step 4: Test streaming
  const streamingOk = await testStreaming(targetModel);
  
  // Final recommendations
  console.log('\n' + '='.repeat(50));
  console.log('📋 DIAGNOSTIC SUMMARY');
  console.log('='.repeat(50));
  
  if (streamingOk) {
    console.log('✅ All tests passed! GPT-5 streaming should work in your app.');
  } else {
    console.log('❌ Streaming test failed despite non-streaming working.');
    console.log('\n💡 This suggests:');
    console.log('   - The model supports non-streaming but has streaming issues');
    console.log('   - OpenRouter may have streaming disabled for this model');
    console.log('   - Network/proxy issues with Server-Sent Events');
    
    console.log('\n🔧 Recommendations:');
    console.log('   1. Use non-streaming as fallback in your app');
    console.log('   2. Try different GPT-5 model variants if available');
    console.log('   3. Contact OpenRouter support about streaming issues');
    console.log('   4. Consider using GPT-4o instead (more stable)');
  }
}

runDiagnostics().catch(console.error);
