import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { HashingService } from './hashing.service';
import { LoginAttemptService } from './login-attempt.service';
import { SessionService } from './session.service';

@Module({
  controllers: [AuthController],
  providers: [AuthService, HashingService, LoginAttemptService, SessionService],
  // `SessionService` y `HashingService` los consumen `users` (revocación y
  // rehash) y los guards; se exportan para no duplicar sus instancias.
  exports: [SessionService, HashingService],
})
export class AuthModule {}
