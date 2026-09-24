import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ListCompaniesQueryDto } from './dto/list-companies-query.dto';
import {
  CurrentUser,
  type CurrentUserPayload,
} from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { CompaniesService } from './companies.service';
import { CreateCompanyDto } from './dto/create-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';

@ApiTags('Admin - Companies')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('companies')
export class CompaniesController {
  constructor(private readonly companiesService: CompaniesService) {}

  @ApiOperation({
    summary: 'Create a new company (platform SUPER_ADMIN only).',
  })
  @Roles('SUPER_ADMIN')
  @Post()
  create(@Body() dto: CreateCompanyDto) {
    return this.companiesService.create(dto);
  }

  @ApiOperation({ summary: 'List all companies (platform SUPER_ADMIN only).' })
  @Roles('SUPER_ADMIN')
  @Get()
  findAll(@Query() query: ListCompaniesQueryDto) {
    return this.companiesService.findAll(query);
  }

  @ApiOperation({
    summary:
      'Get a company by id. SUPER_ADMIN can view any company; other users only their own.',
  })
  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: CurrentUserPayload) {
    if (user.roleName !== 'SUPER_ADMIN' && user.companyId !== id) {
      throw new ForbiddenException(
        'You do not have permission to view this company',
      );
    }
    return this.companiesService.findOne(id);
  }

  @ApiOperation({
    summary:
      'Update a company. SUPER_ADMIN can update any company; other users only their own.',
  })
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateCompanyDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    if (user.roleName !== 'SUPER_ADMIN' && user.companyId !== id) {
      throw new ForbiddenException(
        'You do not have permission to update this company',
      );
    }
    return this.companiesService.update(id, dto);
  }

  @ApiOperation({
    summary: 'Soft-delete a company (platform SUPER_ADMIN only).',
  })
  @Roles('SUPER_ADMIN')
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string, @CurrentUser() user: CurrentUserPayload) {
    return this.companiesService.remove(id, user.id);
  }
}
