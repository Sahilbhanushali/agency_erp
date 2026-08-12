import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsService } from './permissions.service';

@ApiTags('Admin - Permissions')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('permissions')
export class PermissionsController {
  constructor(private readonly permissionsService: PermissionsService) {}

  @ApiOperation({ summary: 'List the full permission catalog.' })
  @Get()
  findAll() {
    return this.permissionsService.findAll();
  }
}
