import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CartController } from './cart.controller';
import { CartService } from './cart.service';

/** Carrito del cliente (HU-12). */
@Module({
  imports: [AuthModule],
  controllers: [CartController],
  providers: [CartService],
})
export class CartModule {}
