import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  CurrentUser,
  type CurrentUserPayload,
} from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesService } from './roles.service';

@ApiTags('Admin - Roles')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('roles')
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @ApiOperation({
    summary:
      'List roles assignable to users. SUPER_ADMIN may pass ?companyId; others are scoped to their own company.',
  })
  @Get()
  findAll(
    @CurrentUser() actor: CurrentUserPayload,
    @Query('companyId') companyId?: string,
  ) {
    return this.rolesService.findAll(actor, companyId);
  }
}
