import {
  Body,
  Controller,
  INestApplication,
  Module,
  Post,
} from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { IsEmail, IsString, MinLength } from 'class-validator';
import { json } from 'express';
import request from 'supertest';
import {
  HttpExceptionFilter,
  createValidationPipe,
  requestIdMiddleware,
} from '@ciadelivery/shared';

class SampleDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(100)
  password!: string;

  @IsString()
  @MinLength(100)
  token!: string;
}

@Controller('probe')
class ProbeController {
  @Post()
  create(@Body() _body: SampleDto): { ok: true } {
    return { ok: true };
  }
}

@Module({ controllers: [ProbeController] })
class ProbeModule {}

describe('validation errors', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await NestFactory.create(ProbeModule, { bodyParser: false });
    app.use(json({ limit: '1mb' }));
    app.use(requestIdMiddleware);
    app.useGlobalFilters(new HttpExceptionFilter());
    app.useGlobalPipes(createValidationPipe());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns VALIDATION_ERROR without echoing password or token values', async () => {
    const password = 'pw-should-not-leak';
    const token = 'tok-should-not-leak';
    const response = await request(app.getHttpServer())
      .post('/probe')
      .set('X-Request-Id', 'validation-req')
      .send({ email: 'not-an-email', password, token })
      .expect(400);

    expect(response.body).toEqual({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'The request payload is invalid',
        details: expect.arrayContaining([
          { field: 'email', constraint: 'isEmail' },
          { field: 'password', constraint: 'minLength' },
          { field: 'token', constraint: 'minLength' },
        ]),
        requestId: 'validation-req',
      },
    });
    expect(response.headers['x-request-id']).toBe('validation-req');
    expect(JSON.stringify(response.body)).not.toContain(password);
    expect(JSON.stringify(response.body)).not.toContain(token);
  });

  it('rejects a body larger than 1 MB', async () => {
    const response = await request(app.getHttpServer())
      .post('/probe')
      .send({ email: 'a'.repeat(1_100_000) })
      .expect(413);

    expect(response.body.error.code).toBe('PAYLOAD_TOO_LARGE');
    expect(JSON.stringify(response.body)).not.toContain('aaaa');
  });
});
