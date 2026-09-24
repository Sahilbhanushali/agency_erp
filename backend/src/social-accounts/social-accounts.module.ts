import { Global, Module } from '@nestjs/common';
import { SocialProviderRegistry } from './providers/social-provider';
import { SocialAccountsController } from './social-accounts.controller';
import { SocialAccountsService } from './social-accounts.service';

/** Global so the publishing queue can resolve providers without a circular import. */
@Global()
@Module({
  controllers: [SocialAccountsController],
  providers: [SocialAccountsService, SocialProviderRegistry],
  exports: [SocialAccountsService, SocialProviderRegistry],
})
export class SocialAccountsModule {}
