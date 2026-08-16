import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { HashingService } from './hashing.service';
import { LoginAttemptService } from './login-attempt.service';
import { SessionService } from './session.service';

@Module({
  controllers: [AuthController],
  providers: [AuthService, HashingService, LoginAttemptService, SessionService],
  // Los consumen `users` —revocación de sesiones, rehash y borrado del bloqueo
  // en el restablecimiento— y los guards. Se exportan para no duplicar sus
  // instancias: dos `HashingService` significarían dos señuelos distintos.
  exports: [SessionService, HashingService, LoginAttemptService],
})
export class AuthModule {}
