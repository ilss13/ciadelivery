import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class DatabaseReady {
  private opening: Promise<void> | null = null;

  constructor(private readonly dataSource: DataSource) {}

  async ensure(): Promise<DataSource> {
    if (this.dataSource.isInitialized) {
      return this.dataSource;
    }

    if (this.opening === null) {
      this.opening = this.dataSource.initialize().then(
        () => undefined,
        (error: unknown) => {
          this.opening = null;
          throw error;
        },
      );
    }

    await this.opening;
    return this.dataSource;
  }
}
