import { Injectable } from '@nestjs/common';
import { APP_NAME } from '@ciadelivery/shared';

@Injectable()
export class AppService {
  getData(): { name: string } {
    return { name: `${APP_NAME}-worker` };
  }
}
