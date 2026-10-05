import { Server as HttpServer } from 'node:http';
import { readAccessToken } from '@ciadelivery/auth';
import {
  APP_CONFIG,
  AppConfig,
  isOriginAllowed,
  JsonLogger,
} from '@ciadelivery/shared';
import { Inject, Injectable, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { Server, Socket } from 'socket.io';
import { TRACKING_ORDERS, TrackingOrderLookup } from '../domain/notification';
import {
  decideRoomJoin,
  readRealtimeCredentials,
  RealtimeEnvelope,
  roomsForStaff,
} from '../domain/realtime';
import { RedisRealtimeSubscriber } from '../infrastructure/redis-realtime';

@Injectable()
export class RealtimeGateway implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new JsonLogger();
  private io: Server | null = null;

  constructor(
    private readonly http: HttpAdapterHost,
    private readonly subscriber: RedisRealtimeSubscriber,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    @Inject(TRACKING_ORDERS) private readonly tracking: TrackingOrderLookup,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    const httpServer = this.http.httpAdapter.getHttpServer() as HttpServer;
    const io = new Server(httpServer, {
      cors: {
        credentials: true,
        origin: (origin, callback) => {
          if (!isOriginAllowed(origin, this.config.corsOrigins)) {
            callback(null, false);
            return;
          }
          callback(null, origin ?? true);
        },
      },
    });
    const namespace = io.of('/realtime');
    namespace.use((socket, next) => {
      void this.authorize(socket)
        .then(async (rooms) => {
          if (rooms === null) {
            next(new Error('unauthorized'));
            return;
          }
          const granted = [...rooms];
          socket.data.rooms = granted;
          if (granted.length > 0) {
            await socket.join(granted);
          }
          next();
        })
        .catch(() => {
          next(new Error('unauthorized'));
        });
    });
    namespace.on('connection', (socket) => {
      socket.on('join', (room: unknown) => {
        this.onJoin(socket, room);
      });
    });
    this.io = io;
    await this.subscriber.listen((message) => this.emit(message));
  }

  async onModuleDestroy(): Promise<void> {
    const io = this.io;
    this.io = null;
    if (io !== null) {
      await new Promise<void>((resolve) => {
        io.close(() => resolve());
      });
    }
  }

  private async authorize(socket: Socket): Promise<readonly string[] | null> {
    const credentials = readRealtimeCredentials({
      queryToken: socket.handshake.query['token'],
      authToken: socket.handshake.auth['token'],
      trackingToken: socket.handshake.auth['trackingToken'],
    });
    if (credentials === null) {
      this.logger.warn('Rejected realtime connection', 'RealtimeGateway');
      return null;
    }

    if (credentials.kind === 'staff') {
      try {
        const claims = readAccessToken(
          credentials.token,
          this.config.jwtAccessSecret,
          new Date(),
        );
        return roomsForStaff({
          role: claims.role,
          userId: claims.sub,
          tenantId: claims.tenantId,
          storeId: claims.storeId,
          permissions: claims.permissions,
        });
      } catch {
        this.logger.warn('Rejected realtime connection', 'RealtimeGateway');
        return null;
      }
    }

    const scope = await this.tracking.findByToken(credentials.trackingToken);
    if (scope === null) {
      this.logger.warn('Rejected realtime connection', 'RealtimeGateway');
      return null;
    }
    return [`order:${scope.orderId}`];
  }

  private onJoin(socket: Socket, room: unknown): void {
    const allowed = readAllowedRooms(socket.data.rooms);
    if (typeof room !== 'string' || decideRoomJoin(allowed, room) === 'ignore') {
      this.logger.warn('Rejected realtime room join', 'RealtimeGateway');
      return;
    }
    void socket.join(room);
  }

  private emit(message: RealtimeEnvelope): void {
    const namespace = this.io?.of('/realtime');
    if (namespace === undefined) {
      return;
    }
    for (const room of message.rooms) {
      namespace.to(room).emit(message.event, message.payload);
    }
  }
}

function readAllowedRooms(value: unknown): readonly string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((room): room is string => typeof room === 'string');
}
