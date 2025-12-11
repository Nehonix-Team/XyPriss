# Plugin System - Error Handling Guide

## ⚠️ Important: onError Hook Limitation

The `onError` hook is **deprecated** and not automatically applied due to limitations in how UltraFastApp handles error middleware.

## ✅ Recommended Error Handling Approaches

### Method 1: Try-Catch in Route Handlers (Recommended)

```typescript
{
  name: 'my-plugin',
  version: '1.0.0',
  
  registerRoutes: (app) => {
    app.get('/api/data', async (req, res) => {
      try {
        const data = await fetchData();
        res.json(data);
      } catch (error) {
        console.error('[Plugin] Error:', error);
        res.status(500).json({ 
          error: 'Failed to fetch data',
          message: error.message 
        });
      }
    });
  }
}
```

### Method 2: Error Handling in onRequest Hook

```typescript
{
  name: 'error-handler-plugin',
  version: '1.0.0',
  
  onRequest: (req, res, next) => {
    // Wrap the response methods to catch errors
    const originalJson = res.json.bind(res);
    const originalSend = res.send.bind(res);
    
    res.json = function(data) {
      try {
        return originalJson(data);
      } catch (error) {
        console.error('[Plugin] JSON error:', error);
        return res.status(500).json({ error: 'Internal error' });
      }
    };
    
    next();
  }
}
```

### Method 3: Global Error Handler Route

```typescript
{
  name: 'error-handler',
  version: '1.0.0',
  
  registerRoutes: (app) => {
    // Register a catch-all error route at the end
    app.use((req, res) => {
      res.status(404).json({ error: 'Not found' });
    });
  },
  
  middlewarePriority: 'last' // Ensure it runs last
}
```

## Summary

- ❌ **Don't use** `onError` hook (deprecated)
- ✅ **Do use** try-catch in route handlers
- ✅ **Do use** error handling in `onRequest` hook
- ✅ **Do use** catch-all routes for 404s
