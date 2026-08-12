import { Module } from '@nestjs/common';
import { FilesModule } from '../files/files.module';
import { MailerModule } from '../mailer/mailer.module';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  imports: [FilesModule, MailerModule],
  controllers: [UsersController],
  providers: [UsersService],
})
export class UsersModule {}
