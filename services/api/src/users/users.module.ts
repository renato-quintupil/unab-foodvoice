import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  // `AuthModule` aporta `SessionService` —que el guard y la revocación
  // necesitan—, `HashingService` y `LoginAttemptService`.
  imports: [AuthModule, AuditModule],
  controllers: [UsersController],
  providers: [UsersService],
})
export class UsersModule {}
