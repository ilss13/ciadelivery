import { Algorithm, hash, verify } from '@node-rs/argon2';
import { Injectable } from '@nestjs/common';
import { PasswordHasher } from '@ciadelivery/users';

@Injectable()
export class Argon2PasswordHasher implements PasswordHasher {
  hash(password: string): Promise<string> {
    return hash(password, { algorithm: Algorithm.Argon2id });
  }

  verify(password: string, passwordHash: string): Promise<boolean> {
    return verify(passwordHash, password).catch(() => false);
  }
}
