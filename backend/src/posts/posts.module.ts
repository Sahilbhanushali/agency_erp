import { Module } from '@nestjs/common';
import { PostsController } from './posts.controller';
import { PostsService } from './posts.service';
import { PublishingService } from './publishing.service';

@Module({
  controllers: [PostsController],
  providers: [PostsService, PublishingService],
})
export class PostsModule {}
