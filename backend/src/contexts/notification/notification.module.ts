import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Notification } from './domain/notification.entity';
import { NotificationController } from './notification.controller';
import { NotificationService } from './notification.service';
import { RenewalNotificationWorker } from './renewal-notification.worker';

@Module({
  imports: [TypeOrmModule.forFeature([Notification])],
  controllers: [NotificationController],
  providers: [NotificationService, RenewalNotificationWorker],
  exports: [NotificationService],
})
export class NotificationModule {}
