
import { createServer, type Server } from 'http';
import { NextRequest, NextResponse } from 'next/server';
import type { NextApiRequest, NextApiResponse } from 'next';

type RequestHandler = (req: NextRequest, context: { params: Promise<any> }) => Promise<NextResponse | Response>;

/**
* Creates a test server that wraps a Next.js route handler.
* This allows for testing API routes in isolation without running the full Next.js server.
*
* @param handler - The Next.js route handler to be tested.
* @param conversationId - Optional conversation ID for dynamic routes.
* @returns An object containing the server instance and its URL.
*/
export function createTestServer(handler: RequestHandler, conversationId?: string): { server: Server, url: string } {
 const server = createServer(async (req: NextApiRequest, res: NextApiResponse) => {
   try {
     const url = new URL(req.url || '/', 'http://localhost');
     const headers = new Headers();
     Object.entries(req.headers).forEach(([key, value]) => {
       if (value) {
         headers.append(key, Array.isArray(value) ? value.join(',') : value);
       }
     });

     // Read the body for POST/PUT/PATCH requests
     let body: string | null = null;
     if (['POST', 'PUT', 'PATCH'].includes(req.method || '')) {
       const chunks: Buffer[] = [];
       for await (const chunk of req) {
         chunks.push(chunk);
       }
       body = Buffer.concat(chunks).toString();
     }

     // Create a NextRequest object
     const nextRequest = new NextRequest(url, {
       method: req.method,
       headers,
       body,
     });

     // Mock the context for dynamic routes
     const context = {
       params: Promise.resolve({ id: conversationId }),
     };

     // Execute the route handler
     const response = await handler(nextRequest, context);

     // Send the response back to the client
     res.status(response.status);
     Object.entries(response.headers).forEach(([key, value])=> {
        res.setHeader(key, value);
     })
     const responseBody = await response.json();
     res.end(JSON.stringify(responseBody));
   } catch (error: any) {
     // Handle errors gracefully
     console.error('Test server error:', error);
     res.statusCode = error.status || 500;
     res.setHeader('Content-Type', 'application/json');
     res.end(JSON.stringify({ error: error.message || 'Internal Server Error' }));
   }
 });

 const url = `http://localhost:${(server.address() as any)?.port || 0}`;

 return { server, url };
}
