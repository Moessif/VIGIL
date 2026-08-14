import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { env } from './config/env';
import { attachRealtimeGateway } from './modules/ai/realtime.gateway';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');
  app.enableCors({ origin: true, credentials: true });
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: false }),
  );

  // 实时语音 S2S 网关（挂在同一 HTTP Server 上）
  if (env.qwenApiKey) {
    attachRealtimeGateway(app.getHttpServer(), {
      apiKey: env.qwenApiKey,
      model: env.realtimeModel,
      baseUrl: env.qwenBaseUrl,
    });
  }

  await app.listen(env.port);
  // eslint-disable-next-line no-console
  console.log(`[警心护航] 后端已启动: http://localhost:${env.port}/api`);
  // eslint-disable-next-line no-console
  console.log(`[警心护航] AI 模式: ${env.aiMode}`);
  // eslint-disable-next-line no-console
  console.log(
    `[警心护航] 实时语音网关: ${env.qwenApiKey ? '/api/realtime-call（已挂载）' : '未配置 Key，跳过'}`,
  );
}
bootstrap();
