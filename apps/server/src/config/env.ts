import * as dotenv from 'dotenv';
import * as path from 'path';

// 以服务包根目录（apps/server）为基准，避免依赖启动时的 cwd
// 源码位于 src/config、编译产物位于 dist/config，均两级向上即到 apps/server
const serverRoot = path.resolve(__dirname, '..', '..');

dotenv.config({ path: path.resolve(serverRoot, '.env') });

export const env = {
  port: Number(process.env.PORT || 3000),
  jwtSecret: process.env.JWT_SECRET || 'dev-secret-change-me',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  dbPath: process.env.DB_PATH
    ? path.resolve(serverRoot, process.env.DB_PATH)
    : path.resolve(serverRoot, 'data', 'app.db'),
  aiMode: (process.env.AI_MODE || 'mock') as 'mock' | 'real',

  // 初始管理员（首次启动且无 admin 角色时自动创建）
  adminUsername: process.env.ADMIN_USERNAME || 'admin',
  adminPassword: process.env.ADMIN_PASSWORD || 'admin123456',

  deepseekApiKey: process.env.DEEPSEEK_API_KEY || '',
  deepseekBaseUrl: process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com',
  mainModel: process.env.MAIN_MODEL || 'deepseek-v4-pro',

  qwenApiKey: process.env.QWEN_API_KEY || '',
  qwenBaseUrl: process.env.QWEN_BASE_URL || 'https://dashscope.aliyuncs.com',
  imageModel: process.env.QWEN_IMAGE_MODEL || 'qwen-image-3.0-pro',
  ttsModel: process.env.QWEN_TTS_MODEL || 'qwen-audio-3.0-tts-plus',
  realtimeModel: process.env.QWEN_REALTIME_MODEL || 'qwen-audio-3.0-realtime-plus',
};
