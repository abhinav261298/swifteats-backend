import {
  Controller,
  Get,
  Patch,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { UserService } from './user.service';
import {
  UpdateUserDto,
  CreateAddressDto,
  UpdateAddressDto,
  UserResponseDto,
  AddressResponseDto,
} from './dto';
import { JwtAuthGuard } from '../auth/guards';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Users')
@Controller('users')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
export class UserController {
  private readonly logger = new Logger(UserController.name);

  constructor(private readonly userService: UserService) {}

  @Get('profile')
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiResponse({ status: 200, description: 'User profile retrieved', type: UserResponseDto })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async getProfile(@CurrentUser('userId') userId: string): Promise<UserResponseDto> {
    this.logger.log(`Get profile request for user: ${userId}`);

    const user = await this.userService.getUserProfile(userId);

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      phone: user.phone,
      role: user.role,
      isActive: user.isActive,
      createdAt: user.createdAt,
      lastLoginAt: user.lastLoginAt,
    };
  }

  @Patch('profile')
  @ApiOperation({ summary: 'Update current user profile' })
  @ApiResponse({ status: 200, description: 'Profile updated successfully', type: UserResponseDto })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'User not found' })
  @ApiResponse({ status: 409, description: 'Phone number already in use' })
  async updateProfile(
    @CurrentUser('userId') userId: string,
    @Body() updateUserDto: UpdateUserDto,
  ): Promise<UserResponseDto> {
    this.logger.log(`Update profile request for user: ${userId}`);

    const user = await this.userService.updateUserProfile(userId, updateUserDto);

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      phone: user.phone,
      role: user.role,
      isActive: user.isActive,
      createdAt: user.createdAt,
      lastLoginAt: user.lastLoginAt,
    };
  }

  @Get('addresses')
  @ApiOperation({ summary: 'Get all addresses for current user' })
  @ApiResponse({
    status: 200,
    description: 'Addresses retrieved',
    type: [AddressResponseDto],
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async getAddresses(@CurrentUser('userId') userId: string): Promise<AddressResponseDto[]> {
    this.logger.log(`Get addresses request for user: ${userId}`);

    const addresses = await this.userService.getUserAddresses(userId);

    return addresses.map((address) => ({
      id: address.id,
      userId: address.userId,
      label: address.label,
      street: address.street,
      city: address.city,
      state: address.state,
      postalCode: address.postalCode,
      latitude: address.latitude,
      longitude: address.longitude,
      deliveryInstructions: address.deliveryInstructions,
      isDefault: address.isDefault,
      createdAt: address.createdAt,
      updatedAt: address.updatedAt,
    }));
  }

  @Post('addresses')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new address' })
  @ApiResponse({ status: 201, description: 'Address created', type: AddressResponseDto })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async createAddress(
    @CurrentUser('userId') userId: string,
    @Body() createAddressDto: CreateAddressDto,
  ): Promise<AddressResponseDto> {
    this.logger.log(`Create address request for user: ${userId}`);

    const address = await this.userService.createAddress(userId, createAddressDto);

    return {
      id: address.id,
      userId: address.userId,
      label: address.label,
      street: address.street,
      city: address.city,
      state: address.state,
      postalCode: address.postalCode,
      latitude: address.latitude,
      longitude: address.longitude,
      deliveryInstructions: address.deliveryInstructions,
      isDefault: address.isDefault,
      createdAt: address.createdAt,
      updatedAt: address.updatedAt,
    };
  }

  @Patch('addresses/:id')
  @ApiOperation({ summary: 'Update an address' })
  @ApiParam({ name: 'id', description: 'Address ID', type: 'string' })
  @ApiResponse({ status: 200, description: 'Address updated', type: AddressResponseDto })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Address not found' })
  async updateAddress(
    @CurrentUser('userId') userId: string,
    @Param('id') addressId: string,
    @Body() updateAddressDto: UpdateAddressDto,
  ): Promise<AddressResponseDto> {
    this.logger.log(`Update address ${addressId} request for user: ${userId}`);

    const address = await this.userService.updateAddress(userId, addressId, updateAddressDto);

    return {
      id: address.id,
      userId: address.userId,
      label: address.label,
      street: address.street,
      city: address.city,
      state: address.state,
      postalCode: address.postalCode,
      latitude: address.latitude,
      longitude: address.longitude,
      deliveryInstructions: address.deliveryInstructions,
      isDefault: address.isDefault,
      createdAt: address.createdAt,
      updatedAt: address.updatedAt,
    };
  }

  @Delete('addresses/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete an address' })
  @ApiParam({ name: 'id', description: 'Address ID', type: 'string' })
  @ApiResponse({ status: 204, description: 'Address deleted' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Address not found' })
  async deleteAddress(
    @CurrentUser('userId') userId: string,
    @Param('id') addressId: string,
  ): Promise<void> {
    this.logger.log(`Delete address ${addressId} request for user: ${userId}`);

    await this.userService.deleteAddress(userId, addressId);
  }

  @Post('addresses/:id/set-default')
  @ApiOperation({ summary: 'Set an address as default' })
  @ApiParam({ name: 'id', description: 'Address ID', type: 'string' })
  @ApiResponse({ status: 200, description: 'Default address set', type: AddressResponseDto })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Address not found' })
  async setDefaultAddress(
    @CurrentUser('userId') userId: string,
    @Param('id') addressId: string,
  ): Promise<AddressResponseDto> {
    this.logger.log(`Set default address ${addressId} for user: ${userId}`);

    const address = await this.userService.setDefaultAddress(userId, addressId);

    return {
      id: address.id,
      userId: address.userId,
      label: address.label,
      street: address.street,
      city: address.city,
      state: address.state,
      postalCode: address.postalCode,
      latitude: address.latitude,
      longitude: address.longitude,
      deliveryInstructions: address.deliveryInstructions,
      isDefault: address.isDefault,
      createdAt: address.createdAt,
      updatedAt: address.updatedAt,
    };
  }
}
