import {
  ArgumentsHost,
  Catch,
  ConflictException,
  ExceptionFilter,
  HttpException,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import { Prisma } from '@prisma/client';

/**
 * itsme_users_email_key -> "email". Prisma types `target` as unknown and gives a
 * string on MySQL but an array on some connectors, so both are handled and anything
 * else yields null rather than a stringified object.
 */
function fieldFromTarget(target: unknown): string | null {
  const raw =
    typeof target === 'string'
      ? target
      : Array.isArray(target) && target.every((v) => typeof v === 'string')
        ? target.join(', ')
        : null;
  if (!raw) return null;
  // Only a single-column key yields a field a human would recognise. Composite keys
  // are left unnamed rather than printing the raw constraint at the caller.
  const match = /^itsme_[a-z]+_([a-zA-Z]+)_key$/.exec(raw);
  return match ? match[1] : null;
}

function readable(model: string | undefined) {
  if (!model) return 'record';
  return model.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase();
}

/**
 * Turns Prisma's constraint errors into ordinary HTTP errors. Without this, a
 * duplicate email or a bad foreign key surfaces as a 500 with a stack trace, which
 * is both unhelpful and more than a caller should be told.
 */
@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaExceptionFilter
  extends BaseExceptionFilter
  implements ExceptionFilter
{
  private readonly logger = new Logger(PrismaExceptionFilter.name);

  catch(exception: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost) {
    const model = readable(exception.meta?.modelName as string | undefined);
    const translated = this.translate(exception, model);

    if (!translated) {
      // Anything unmapped stays a 500, but is logged with its Prisma code so it
      // can be mapped later rather than silently swallowed.
      this.logger.error(
        `Unmapped Prisma error ${exception.code}: ${exception.message}`,
      );
      return super.catch(exception, host);
    }

    this.logger.warn(`${exception.code} on ${model}: ${translated.message}`);
    return super.catch(translated, host);
  }

  private translate(
    exception: Prisma.PrismaClientKnownRequestError,
    model: string,
  ): HttpException | null {
    switch (exception.code) {
      case 'P2002': {
        const field = fieldFromTarget(exception.meta?.target);
        return new ConflictException(
          field
            ? `A ${model} with that ${field} already exists.`
            : `That ${model} already exists.`,
        );
      }
      case 'P2003':
        return new BadRequestException(
          `That ${model} refers to something that does not exist.`,
        );
      case 'P2025':
        return new NotFoundException(
          `The ${model} you referred to was not found.`,
        );
      case 'P2014':
        return new BadRequestException(
          `That change would break a required relation on the ${model}.`,
        );
      default:
        return null;
    }
  }
}
