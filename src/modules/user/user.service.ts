import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { User } from './entities/user.entity';
import { Address } from './entities/address.entity';
import { Order } from '../order/entities/order.entity';
import { UpdateUserDto, CreateAddressDto, UpdateAddressDto } from './dto';
import {
  UserNotFoundException,
  CustomHttpException,
  UserAlreadyExistsException,
} from '../../common/exceptions';
import { OrderStatus } from '../../common/constants';

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Address)
    private readonly addressRepository: Repository<Address>,
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
  ) {}

  /**
   * Get user profile by ID
   */
  async getUserProfile(userId: string): Promise<User> {
    this.logger.log(`Fetching profile for user: ${userId}`);

    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: ['addresses'],
    });

    if (!user) {
      throw new UserNotFoundException(userId);
    }

    return user;
  }

  /**
   * Update user profile
   */
  async updateUserProfile(userId: string, updateUserDto: UpdateUserDto): Promise<User> {
    this.logger.log(`Updating profile for user: ${userId}`);

    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new UserNotFoundException(userId);
    }

    // Check if phone number is being changed and if it's already taken
    if (updateUserDto.phone && updateUserDto.phone !== user.phone) {
      const existingUser = await this.userRepository.findOne({
        where: { phone: updateUserDto.phone },
      });

      if (existingUser) {
        throw new UserAlreadyExistsException('Phone number already in use');
      }
    }

    // Update user fields
    Object.assign(user, updateUserDto);

    const updatedUser = await this.userRepository.save(user);

    this.logger.log(`Profile updated successfully for user: ${userId}`);

    return updatedUser;
  }

  /**
   * Get all addresses for a user
   */
  async getUserAddresses(userId: string): Promise<Address[]> {
    this.logger.log(`Fetching addresses for user: ${userId}`);

    // Verify user exists
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new UserNotFoundException(userId);
    }

    const addresses = await this.addressRepository.find({
      where: { userId },
      order: { isDefault: 'DESC', createdAt: 'DESC' },
    });

    return addresses;
  }

  /**
   * Get a specific address by ID
   */
  async getAddressById(userId: string, addressId: string): Promise<Address> {
    this.logger.log(`Fetching address ${addressId} for user: ${userId}`);

    const address = await this.addressRepository.findOne({
      where: { id: addressId, userId },
    });

    if (!address) {
      throw new CustomHttpException('ADDRESS_NOT_FOUND', 'Address not found', 404);
    }

    return address;
  }

  /**
   * Create a new address for a user
   */
  async createAddress(userId: string, createAddressDto: CreateAddressDto): Promise<Address> {
    this.logger.log(`Creating address for user: ${userId}`);

    // Verify user exists
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new UserNotFoundException(userId);
    }

    // If this is marked as default, unset other default addresses
    if (createAddressDto.isDefault) {
      await this.addressRepository.update({ userId, isDefault: true }, { isDefault: false });
    } else {
      // If no default exists, make this one default
      const existingAddresses = await this.addressRepository.count({
        where: { userId },
      });

      if (existingAddresses === 0) {
        createAddressDto.isDefault = true;
      }
    }

    // Create new address
    const address = this.addressRepository.create({
      ...createAddressDto,
      userId,
    });

    const savedAddress = await this.addressRepository.save(address);

    this.logger.log(`Address created successfully: ${savedAddress.id}`);

    return savedAddress;
  }

  /**
   * Update an existing address
   */
  async updateAddress(
    userId: string,
    addressId: string,
    updateAddressDto: UpdateAddressDto,
  ): Promise<Address> {
    this.logger.log(`Updating address ${addressId} for user: ${userId}`);

    const address = await this.getAddressById(userId, addressId);

    // If setting as default, unset other default addresses
    if (updateAddressDto.isDefault && !address.isDefault) {
      await this.addressRepository.update({ userId, isDefault: true }, { isDefault: false });
    }

    // Update address fields
    Object.assign(address, updateAddressDto);

    const updatedAddress = await this.addressRepository.save(address);

    this.logger.log(`Address updated successfully: ${addressId}`);

    return updatedAddress;
  }

  /**
   * Delete an address
   */
  async deleteAddress(userId: string, addressId: string): Promise<void> {
    this.logger.log(`Deleting address ${addressId} for user: ${userId}`);

    const address = await this.getAddressById(userId, addressId);

    // Check if address is used in any active orders
    const activeOrderStatuses = [
      OrderStatus.PENDING,
      OrderStatus.RESTAURANT_ACCEPTED,
      OrderStatus.PREPARING,
      OrderStatus.READY_FOR_PICKUP,
      OrderStatus.DRIVER_ASSIGNED,
      OrderStatus.PICKED_UP,
      OrderStatus.IN_TRANSIT,
    ];

    const activeOrdersWithAddress = await this.orderRepository.count({
      where: {
        deliveryAddressId: addressId,
        status: In(activeOrderStatuses),
      },
    });

    if (activeOrdersWithAddress > 0) {
      throw new CustomHttpException(
        'ADDRESS_IN_USE',
        `Cannot delete address. It is being used in ${activeOrdersWithAddress} active order(s)`,
        400,
      );
    }

    // If deleting default address, set another address as default
    if (address.isDefault) {
      const otherAddresses = await this.addressRepository.find({
        where: { userId },
        order: { createdAt: 'DESC' },
      });

      // Find another address to make default (excluding the one being deleted)
      const newDefaultAddress = otherAddresses.find((addr) => addr.id !== addressId);

      if (newDefaultAddress) {
        newDefaultAddress.isDefault = true;
        await this.addressRepository.save(newDefaultAddress);
      }
    }

    await this.addressRepository.remove(address);

    this.logger.log(`Address deleted successfully: ${addressId}`);
  }

  /**
   * Set an address as default
   */
  async setDefaultAddress(userId: string, addressId: string): Promise<Address> {
    this.logger.log(`Setting address ${addressId} as default for user: ${userId}`);

    const address = await this.getAddressById(userId, addressId);

    if (!address.isDefault) {
      // Unset other default addresses
      await this.addressRepository.update({ userId, isDefault: true }, { isDefault: false });

      // Set this address as default
      address.isDefault = true;
      await this.addressRepository.save(address);
    }

    this.logger.log(`Default address set successfully: ${addressId}`);

    return address;
  }
}
