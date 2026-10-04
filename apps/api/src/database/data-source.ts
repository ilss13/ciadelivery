import { join } from 'node:path';
import {
  createDataSource,
  loadAppConfig,
  loadEnvFile,
} from '@ciadelivery/shared';

loadEnvFile();

const dataSource = createDataSource(loadAppConfig(), {
  migrations: [join(__dirname, 'migrations', '*.{ts,js}')],
});

export default dataSource;
