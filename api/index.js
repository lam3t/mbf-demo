// Vercel Serverless Function entry point
let app;

module.exports = (req, res) => {
  if (!app) {
    try {
      // Try compiled dist first
      app = require('../backend/dist/server').default || require('../backend/dist/server');
    } catch (e) {
      try {
        // Fallback to ts-node on-the-fly
        require('ts-node').register({ transpileOnly: true });
        app = require('../backend/src/server').default || require('../backend/src/server');
      } catch (err) {
        console.error('Failed to load backend server in serverless function:', err);
        return res.status(500).json({
          error: 'Serverless Application Initialization Failed',
          distError: e.message,
          srcError: err.message,
          stack: err.stack
        });
      }
    }
  }

  return app(req, res);
};
