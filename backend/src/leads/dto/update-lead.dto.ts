import { OmitType, PartialType } from '@nestjs/swagger';
import { CreateLeadDto } from './create-lead.dto';

export class UpdateLeadDto extends PartialType(
  OmitType(CreateLeadDto, ['companyId'] as const),
) {}
