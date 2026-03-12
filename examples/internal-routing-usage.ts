/**
 * Example: Basic usage of the internal routing system with uWebSockets.js
 * 
 * This example demonstrates how to use the new routing system without hyper-express dependency.
 * It shows basic routing, middleware, and uWebSockets.js integration.
 */

import { createApp, cors, logger, json, type UwsRequest, type UwsResponse, type UwsApp } from '../src/__internals/routing';

// Example uWebSockets.js app factory (you would import from 'uws')
function createUwsApp(): UwsApp {
  // This is a mock implementation - in real usage, you would use:
  // import uWS from 'uws';
  // return uWS.App();
  
  const mockApp: UwsApp = {
    get: (pattern: string, handler: any) => {
      console.log(`Registered GET ${pattern}`);
      return mockApp;
    },
    post: (pattern: string, handler: any) => {
      console.log(`Registered POST ${pattern}`);
      return mockApp;
    },
    put: (pattern: string, handler: any) => {
      console.log(`Registered PUT ${pattern}`);
      return mockApp;
    },
    del: (pattern: string, handler: any) => {
      console.log(`Registered DELETE ${pattern}`);
      return mockApp;
    },
    patch: (pattern: string, handler: any) => {
      console.log(`Registered PATCH ${pattern}`);
      return mockApp;
    },
    options: (pattern: string, handler: any) => {
      console.log(`Registered OPTIONS ${pattern}`);
      return mockApp;
    },
    head: (pattern: string, handler: any) => {
      console.log(`Registered HEAD ${pattern}`);
      return mockApp;
    },
    any: (pattern: string, handler: any) => {
      console.log(`Registered ANY ${pattern}`);
      return mockApp;
    },
    listen: (port: number, callback?: (token: any) => void) => {
      console.log(`Server listening on port ${port}`);
      callback?.(true);
    },
    close: () => console.log('Server closed')
  };
  
  return mockApp;
}

// Create the application
const app = createApp({
  prefix: '/api',
  caseSensitive: false
});

// Add global middleware
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true
}));

app.use(logger());
app.use(json());

// Define routes
app.get('/', async (req: UwsRequest, res: UwsResponse) => {
  res.json({ 
    message: 'Welcome to the uWebSockets.js routing system!',
    stats: app.getStats()
  });
});

app.get('/users/:id', async (req: UwsRequest, res: UwsResponse) => {
  const userId = req.params?.id;
  res.json({ 
    userId, 
    message: `User ${userId} details` 
  });
});

app.post('/users', async (req: UwsRequest, res: UwsResponse) => {
  const userData = req.body;
  res.status(201).json({ 
    message: 'User created', 
    data: userData 
  });
});

app.get('/search', async (req: UwsRequest, res: UwsResponse) => {
  const query = req.query;
  res.json({ 
    search: query,
    results: [] 
  });
});

// Route with middleware
app.get('/protected', 
  async (req: UwsRequest, res: UwsResponse, next) => {
    // Auth middleware
    const auth = req.getHeader('authorization');
    if (!auth) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    next();
  },
  async (req: UwsRequest, res: UwsResponse) => {
    res.json({ message: 'Protected resource accessed successfully' });
  }
);

// Error handling route
app.get('/error', async (req: UwsRequest, res: UwsResponse) => {
  throw new Error('Test error');
});

// Create and start the server
const uwsApp = app.createServer(createUwsApp);

// In a real application, you would do:
// uwsApp.listen(3000, (token) => {
//   if (token) {
//     console.log('Listening to port 3000');
//   } else {
//     console.log('Failed to listen to port 3000');
//   }
// });

export { app, uwsApp };