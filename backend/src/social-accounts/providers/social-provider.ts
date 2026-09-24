import { Injectable } from '@nestjs/common';
import { PostType, SocialPlatform } from '@prisma/client';

export interface PublishRequest {
  /** Platform profile or page id this content goes to. */
  externalId: string;
  /** Decrypted only for the duration of the call. Never log this. */
  accessToken: string;
  caption: string | null;
  postType: PostType;
  mediaUrls: string[];
}

export interface PublishResult {
  /** The id the platform assigned, which is what proves the post exists. */
  platformPostId: string;
  publishedAt: Date;
}

export interface SocialProvider {
  readonly platform: SocialPlatform;
  publish(request: PublishRequest): Promise<PublishResult>;
}

/**
 * The seam real platform integrations plug into.
 *
 * It is empty on purpose. This application ships with no Meta/LinkedIn/X API
 * credentials, and a provider that pretended to publish would produce exactly the
 * lie the product must never tell — a post marked PUBLISHED that nobody can see.
 * Until a real provider is registered here, an API publish fails with a reason and
 * the only way to complete a target is a human recording that they posted it.
 *
 * Adding one is: implement SocialProvider, call register() from a module, done —
 * no changes to the publishing queue, the states, or the audit trail.
 */
@Injectable()
export class SocialProviderRegistry {
  private readonly providers = new Map<SocialPlatform, SocialProvider>();

  register(provider: SocialProvider) {
    this.providers.set(provider.platform, provider);
  }

  get(platform: SocialPlatform): SocialProvider | undefined {
    return this.providers.get(platform);
  }

  supports(platform: SocialPlatform): boolean {
    return this.providers.has(platform);
  }

  /** Which platforms this deployment can actually publish to right now. */
  connectedPlatforms(): SocialPlatform[] {
    return [...this.providers.keys()];
  }
}
