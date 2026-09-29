import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PropertyController } from './property.controller';
import { PropertyService } from './property.service';

@Module({
  imports: [AuthModule],
  controllers: [PropertyController],
  providers: [PropertyService],
  exports: [PropertyService],
})
export class PropertyModule {}
