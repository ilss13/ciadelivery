import { ApiProperty } from '@nestjs/swagger';

export class StoredFileDto {
  @ApiProperty()
  key!: string;

  @ApiProperty()
  url!: string;
}
