import { Module } from '@nestjs/common';
import { PlatformModule } from '@ciadelivery/shared';
import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [PlatformModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
