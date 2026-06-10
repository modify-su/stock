import { startServer } from '../server';

let cachedApp: any = null;

export default async function handler(req: any, res: any) {
  try {
    if (!cachedApp) {
      cachedApp = await startServer();
    }
    return cachedApp(req, res);
  } catch (err: any) {
    console.error('Vercel Serverless Function error during startServer:', err);
    return res.status(500).json({
      error: 'Vercel Serverless Function Initialization Failed',
      message: err?.message || err,
      stack: err?.stack || ''
    });
  }
}
