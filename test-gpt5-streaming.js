#!/usr/bin/env node

/**
 * GPT-5 Streaming Test Script
 * 
 * This script helps diagnose intermittent streaming failures with GPT-5 via OpenRouter.
 * Run it to test multiple consecutive requests and identify patterns.
 * 
 * Usage:
 *   OPENROUTER_API_KEY=your_key_here node test-gpt5-streaming.js
 * 
 * Or add your key directly in the script (not recommended for production).
 */

import https from 'https';

const API_KEY = process.env.OPENROUTER_API_KEY || 'your-api-key-here';
const BASE_URL = 'openrouter.ai';
const MODEL = 'openai/gpt-5';
const NUM_TESTS = 10;
const TIMEOUT_MS = 20000; // 20 seconds

if (!API_KEY || API_KEY === 'your-api-key-here') {
  console.error('❌ Please set OPENROUTER_API_KEY environment variable');
  process.exit(1);
}

function makeStreamingRequest(testNumber) {
  return new Promise((resolve) => {
    const startTime = Date.now();
    let firstTokenTime = null;
    let tokenCount = 0;
    let fullResponse = '';
    let lastActivity = Date.now();
    
    const postData = JSON.stringify({
      model: MODEL,
      messages: [
        { role: 'system', content: 'You are a helpful assistant.' },
        { role: 'user', content: `Test ${testNumber}: Please write a short explanation about streaming APIs. Keep it under 100 words.` }
      ],
      temperature: 0.7,
      max_tokens: 200,
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
        'X-Title': 'PromptBridge-Test'
      }
    };

    const req = https.request(options, (res) => {
      console.log(`🔄 Test ${testNumber}: Status ${res.statusCode}, Headers:`, {
        'content-type': res.headers['content-type'],
        'openrouter-model': res.headers['openrouter-model'],
        'openrouter-provider': res.headers['openrouter-provider'],
        'x-request-id': res.headers['x-request-id']
      });

      let buffer = '';
      let timeoutHandle = setTimeout(() => {
        console.log(`⏰ Test ${testNumber}: TIMEOUT after ${TIMEOUT_MS}ms - stalled stream`);
        req.destroy();
        resolve({
          success: false,
          error: 'Timeout - stream stalled',
          duration: Date.now() - startTime,
          firstTokenTime: firstTokenTime ? firstTokenTime - startTime : null,
          tokenCount,
          stallDuration: Date.now() - lastActivity
        });
      }, TIMEOUT_MS);

      res.on('data', (chunk) => {
        lastActivity = Date.now();
        clearTimeout(timeoutHandle);
        timeoutHandle = setTimeout(() => {
          console.log(`⏰ Test ${testNumber}: Stream stalled for ${TIMEOUT_MS}ms`);
          req.destroy();
          resolve({
            success: false,
            error: 'Stream stalled mid-response',
            duration: Date.now() - startTime,
            firstTokenTime: firstTokenTime ? firstTokenTime - startTime : null,
            tokenCount,
            stallDuration: TIMEOUT_MS,
            partialResponse: fullResponse
          });
        }, TIMEOUT_MS);

        buffer += chunk.toString();
        
        const lines = buffer.split(/\r?\n/);
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith('data:')) continue;
          
          const dataStr = trimmed.slice('data:'.length).trim();
          if (dataStr === '[DONE]') {
            clearTimeout(timeoutHandle);
            console.log(`✅ Test ${testNumber}: Completed successfully`);
            resolve({
              success: true,
              duration: Date.now() - startTime,
              firstTokenTime: firstTokenTime ? firstTokenTime - startTime : null,
              tokenCount,
              fullResponse: fullResponse.slice(0, 200) + (fullResponse.length > 200 ? '...' : '')
            });
            return;
          }

          try {
            const payload = JSON.parse(dataStr);
            
            if (payload.error) {
              clearTimeout(timeoutHandle);
              console.log(`❌ Test ${testNumber}: API error:`, payload.error);
              resolve({
                success: false,
                error: `API error: ${payload.error.message || payload.error.code}`,
                duration: Date.now() - startTime,
                firstTokenTime: firstTokenTime ? firstTokenTime - startTime : null,
                tokenCount
              });
              return;
            }
            
            const delta = payload?.choices?.[0]?.delta;
            const content = delta?.content || '';
            
            if (content) {
              if (!firstTokenTime) {
                firstTokenTime = Date.now();
                console.log(`🎯 Test ${testNumber}: First token after ${firstTokenTime - startTime}ms`);
              }
              tokenCount++;
              fullResponse += content;
            }
            } catch {
              console.log(`⚠️ Test ${testNumber}: Malformed SSE data:`, dataStr.slice(0, 100));
            }
        }
      });

      res.on('end', () => {
        clearTimeout(timeoutHandle);
        if (tokenCount > 0) {
          console.log(`✅ Test ${testNumber}: Completed successfully (stream ended without [DONE])`);
          resolve({
            success: true,
            duration: Date.now() - startTime,
            firstTokenTime: firstTokenTime ? firstTokenTime - startTime : null,
            tokenCount,
            fullResponse: fullResponse.slice(0, 200) + (fullResponse.length > 200 ? '...' : ''),
            note: 'Completed without [DONE] marker'
          });
        } else {
          console.log(`❌ Test ${testNumber}: Stream ended without any content`);
          resolve({
            success: false,
            error: 'Stream ended with no content',
            duration: Date.now() - startTime,
            firstTokenTime: null,
            tokenCount: 0
          });
        }
      });

      res.on('error', (err) => {
        clearTimeout(timeoutHandle);
        console.log(`❌ Test ${testNumber}: Response error:`, err.message);
        resolve({
          success: false,
          error: `Response error: ${err.message}`,
          duration: Date.now() - startTime,
          firstTokenTime: firstTokenTime ? firstTokenTime - startTime : null,
          tokenCount
        });
      });
    });

    req.on('error', (err) => {
      console.log(`❌ Test ${testNumber}: Request error:`, err.message);
      resolve({
        success: false,
        error: `Request error: ${err.message}`,
        duration: Date.now() - startTime,
        firstTokenTime: null,
        tokenCount: 0
      });
    });

    req.write(postData);
    req.end();
  });
}

async function runTests() {
  console.log(`🚀 Starting ${NUM_TESTS} streaming tests with GPT-5...\n`);
  
  const results = [];
  
  for (let i = 1; i <= NUM_TESTS; i++) {
    const result = await makeStreamingRequest(i);
    results.push(result);
    
    // Add a small delay between requests
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  // Summary
  console.log('\n📊 Test Results Summary:');
  console.log('='.repeat(50));
  
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);
  
  console.log(`✅ Successful: ${successful.length}/${NUM_TESTS} (${(successful.length/NUM_TESTS*100).toFixed(1)}%)`);
  console.log(`❌ Failed: ${failed.length}/${NUM_TESTS} (${(failed.length/NUM_TESTS*100).toFixed(1)}%)`);
  
  if (successful.length > 0) {
    const avgFirstToken = successful.reduce((sum, r) => sum + (r.firstTokenTime || 0), 0) / successful.length;
    const avgDuration = successful.reduce((sum, r) => sum + r.duration, 0) / successful.length;
    const avgTokens = successful.reduce((sum, r) => sum + r.tokenCount, 0) / successful.length;
    
    console.log(`\n🎯 Successful Requests Stats:`);
    console.log(`   - Avg first token time: ${avgFirstToken.toFixed(0)}ms`);
    console.log(`   - Avg total duration: ${avgDuration.toFixed(0)}ms`);
    console.log(`   - Avg token count: ${avgTokens.toFixed(1)}`);
  }
  
  if (failed.length > 0) {
    console.log(`\n❌ Failed Requests:`);
    const errorCounts = {};
    failed.forEach(r => {
      errorCounts[r.error] = (errorCounts[r.error] || 0) + 1;
    });
    
    Object.entries(errorCounts).forEach(([error, count]) => {
      console.log(`   - ${error}: ${count} occurrences`);
    });
    
    // Show details of failed requests
    console.log(`\n🔍 Failed Request Details:`);
    failed.forEach((r, idx) => {
      console.log(`   ${idx + 1}. ${r.error} (${r.duration}ms, ${r.tokenCount} tokens${r.stallDuration ? `, stalled ${r.stallDuration}ms` : ''})`);
    });
  }
  
  console.log('\n💡 Recommendations:');
  if (failed.length === 0) {
    console.log('   - All tests passed! GPT-5 streaming appears to be working correctly.');
  } else if (failed.length === NUM_TESTS) {
    console.log('   - All tests failed! Check your API key and network connectivity.');
    console.log('   - Verify that GPT-5 is available in your OpenRouter plan.');
  } else {
    const failRate = (failed.length / NUM_TESTS * 100);
    if (failRate > 30) {
      console.log('   - High failure rate suggests systemic issues.');
      console.log('   - Check OpenRouter status page and GPT-5 availability.');
      console.log('   - Consider implementing retry logic with exponential backoff.');
    } else {
      console.log('   - Intermittent failures detected - likely network or provider issues.');
      console.log('   - The implemented timeout detection and retry logic should help.');
      console.log('   - Consider adjusting timeout values based on first token times.');
    }
  }
}

// Run the tests
runTests().catch(console.error);
