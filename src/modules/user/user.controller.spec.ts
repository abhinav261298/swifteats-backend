import { Test, TestingModule } from '@nestjs/testing';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { UpdateUserDto, CreateAddressDto, UpdateAddressDto } from './dto';
import { UserRole } from '../../common/constants';
import {
  UserNotFoundException,
  UserAlreadyExistsException,
  CustomHttpException,
} from '../../common/exceptions';

describe('UserController', () => {
  let controller: UserController;
  let userService: jest.Mocked<UserService>;

  const mockUser = {
    id: 'user-uuid-123',
    email: 'test@example.com',
    name: 'Test User',
    phone: '+919876543210',
    role: UserRole.CUSTOMER,
    isActive: true,
    createdAt: new Date('2026-01-04T10:00:00Z'),
    lastLoginAt: new Date('2026-01-04T11:00:00Z'),
    addresses: [],
  };

  const mockAddress = {
    id: 'address-uuid-123',
    userId: 'user-uuid-123',
    label: 'Home',
    street: '123 Main St',
    city: 'Mumbai',
    state: 'Maharashtra',
    postalCode: '400001',
    latitude: 19.076,
    longitude: 72.8777,
    deliveryInstructions: 'Ring doorbell',
    isDefault: true,
    createdAt: new Date('2026-01-04T10:00:00Z'),
    updatedAt: new Date('2026-01-04T10:00:00Z'),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UserController],
      providers: [
        {
          provide: UserService,
          useValue: {
            getUserProfile: jest.fn(),
            updateUserProfile: jest.fn(),
            getUserAddresses: jest.fn(),
            createAddress: jest.fn(),
            updateAddress: jest.fn(),
            deleteAddress: jest.fn(),
            setDefaultAddress: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<UserController>(UserController);
    userService = module.get(UserService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getProfile', () => {
    it('should return user profile', async () => {
      // Arrange
      userService.getUserProfile.mockResolvedValue(mockUser as any);

      // Act
      const result = await controller.getProfile('user-uuid-123');

      // Assert
      expect(result).toEqual({
        id: mockUser.id,
        email: mockUser.email,
        name: mockUser.name,
        phone: mockUser.phone,
        role: mockUser.role,
        isActive: mockUser.isActive,
        createdAt: mockUser.createdAt,
        lastLoginAt: mockUser.lastLoginAt,
      });
      expect(userService.getUserProfile).toHaveBeenCalledWith('user-uuid-123');
    });

    it('should not include password in response', async () => {
      // Arrange
      const userWithPassword = { ...mockUser, password: 'hashedPassword' };
      userService.getUserProfile.mockResolvedValue(userWithPassword as any);

      // Act
      const result = await controller.getProfile('user-uuid-123');

      // Assert
      expect(result).not.toHaveProperty('password');
    });

    it('should throw UserNotFoundException if user not found', async () => {
      // Arrange
      userService.getUserProfile.mockRejectedValue(new UserNotFoundException('user-uuid-123'));

      // Act & Assert
      await expect(controller.getProfile('user-uuid-123')).rejects.toThrow(UserNotFoundException);
    });
  });

  describe('updateProfile', () => {
    const updateDto: UpdateUserDto = {
      name: 'Updated Name',
      phone: '+919999888877',
    };

    it('should update user profile', async () => {
      // Arrange
      const updatedUser = { ...mockUser, ...updateDto };
      userService.updateUserProfile.mockResolvedValue(updatedUser as any);

      // Act
      const result = await controller.updateProfile('user-uuid-123', updateDto);

      // Assert
      expect(result).toEqual({
        id: updatedUser.id,
        email: updatedUser.email,
        name: updatedUser.name,
        phone: updatedUser.phone,
        role: updatedUser.role,
        isActive: updatedUser.isActive,
        createdAt: updatedUser.createdAt,
        lastLoginAt: updatedUser.lastLoginAt,
      });
      expect(userService.updateUserProfile).toHaveBeenCalledWith('user-uuid-123', updateDto);
    });

    it('should throw UserAlreadyExistsException if phone in use', async () => {
      // Arrange
      userService.updateUserProfile.mockRejectedValue(
        new UserAlreadyExistsException('Phone number already in use'),
      );

      // Act & Assert
      await expect(controller.updateProfile('user-uuid-123', updateDto)).rejects.toThrow(
        UserAlreadyExistsException,
      );
    });

    it('should handle partial updates', async () => {
      // Arrange
      const partialDto: UpdateUserDto = { name: 'Only Name' };
      const updatedUser = { ...mockUser, name: 'Only Name' };
      userService.updateUserProfile.mockResolvedValue(updatedUser as any);

      // Act
      const result = await controller.updateProfile('user-uuid-123', partialDto);

      // Assert
      expect(result.name).toBe('Only Name');
      expect(result.phone).toBe(mockUser.phone);
    });
  });

  describe('getAddresses', () => {
    it('should return all user addresses', async () => {
      // Arrange
      const addresses = [mockAddress];
      userService.getUserAddresses.mockResolvedValue(addresses as any);

      // Act
      const result = await controller.getAddresses('user-uuid-123');

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(mockAddress);
      expect(userService.getUserAddresses).toHaveBeenCalledWith('user-uuid-123');
    });

    it('should return empty array if no addresses', async () => {
      // Arrange
      userService.getUserAddresses.mockResolvedValue([]);

      // Act
      const result = await controller.getAddresses('user-uuid-123');

      // Assert
      expect(result).toEqual([]);
    });

    it('should throw UserNotFoundException if user not found', async () => {
      // Arrange
      userService.getUserAddresses.mockRejectedValue(new UserNotFoundException('user-uuid-123'));

      // Act & Assert
      await expect(controller.getAddresses('user-uuid-123')).rejects.toThrow(UserNotFoundException);
    });
  });

  describe('createAddress', () => {
    const createDto: CreateAddressDto = {
      label: 'Work',
      street: '456 Office St',
      city: 'Mumbai',
      state: 'Maharashtra',
      postalCode: '400050',
      latitude: 19.0596,
      longitude: 72.8295,
      isDefault: false,
    };

    it('should create address successfully', async () => {
      // Arrange
      const newAddress = { ...mockAddress, ...createDto, id: 'new-address-uuid' };
      userService.createAddress.mockResolvedValue(newAddress as any);

      // Act
      const result = await controller.createAddress('user-uuid-123', createDto);

      // Assert
      expect(result).toEqual(newAddress);
      expect(userService.createAddress).toHaveBeenCalledWith('user-uuid-123', createDto);
    });

    it('should include delivery instructions if provided', async () => {
      // Arrange
      const dtoWithInstructions = {
        ...createDto,
        deliveryInstructions: 'Leave at reception',
      };
      const newAddress = { ...mockAddress, ...dtoWithInstructions };
      userService.createAddress.mockResolvedValue(newAddress as any);

      // Act
      const result = await controller.createAddress('user-uuid-123', dtoWithInstructions);

      // Assert
      expect(result.deliveryInstructions).toBe('Leave at reception');
    });

    it('should throw UserNotFoundException if user not found', async () => {
      // Arrange
      userService.createAddress.mockRejectedValue(new UserNotFoundException('user-uuid-123'));

      // Act & Assert
      await expect(controller.createAddress('user-uuid-123', createDto)).rejects.toThrow(
        UserNotFoundException,
      );
    });
  });

  describe('updateAddress', () => {
    const updateDto: UpdateAddressDto = {
      label: 'Home (Updated)',
      deliveryInstructions: 'New instructions',
    };

    it('should update address successfully', async () => {
      // Arrange
      const updatedAddress = { ...mockAddress, ...updateDto };
      userService.updateAddress.mockResolvedValue(updatedAddress as any);

      // Act
      const result = await controller.updateAddress('user-uuid-123', 'address-uuid-123', updateDto);

      // Assert
      expect(result).toEqual(updatedAddress);
      expect(userService.updateAddress).toHaveBeenCalledWith(
        'user-uuid-123',
        'address-uuid-123',
        updateDto,
      );
    });

    it('should handle partial updates', async () => {
      // Arrange
      const partialDto: UpdateAddressDto = { label: 'New Label' };
      const updatedAddress = { ...mockAddress, label: 'New Label' };
      userService.updateAddress.mockResolvedValue(updatedAddress as any);

      // Act
      const result = await controller.updateAddress(
        'user-uuid-123',
        'address-uuid-123',
        partialDto,
      );

      // Assert
      expect(result.label).toBe('New Label');
    });

    it('should throw CustomHttpException if address not found', async () => {
      // Arrange
      userService.updateAddress.mockRejectedValue(
        new CustomHttpException('ADDRESS_NOT_FOUND', 'Address not found', 404),
      );

      // Act & Assert
      await expect(
        controller.updateAddress('user-uuid-123', 'invalid-id', updateDto),
      ).rejects.toThrow(CustomHttpException);
    });
  });

  describe('deleteAddress', () => {
    it('should delete address successfully', async () => {
      // Arrange
      userService.deleteAddress.mockResolvedValue();

      // Act
      await controller.deleteAddress('user-uuid-123', 'address-uuid-123');

      // Assert
      expect(userService.deleteAddress).toHaveBeenCalledWith('user-uuid-123', 'address-uuid-123');
    });

    it('should return void', async () => {
      // Arrange
      userService.deleteAddress.mockResolvedValue();

      // Act
      const result = await controller.deleteAddress('user-uuid-123', 'address-uuid-123');

      // Assert
      expect(result).toBeUndefined();
    });

    it('should throw CustomHttpException if address not found', async () => {
      // Arrange
      userService.deleteAddress.mockRejectedValue(
        new CustomHttpException('ADDRESS_NOT_FOUND', 'Address not found', 404),
      );

      // Act & Assert
      await expect(controller.deleteAddress('user-uuid-123', 'invalid-id')).rejects.toThrow(
        CustomHttpException,
      );
    });
  });

  describe('setDefaultAddress', () => {
    it('should set address as default', async () => {
      // Arrange
      const defaultAddress = { ...mockAddress, isDefault: true };
      userService.setDefaultAddress.mockResolvedValue(defaultAddress as any);

      // Act
      const result = await controller.setDefaultAddress('user-uuid-123', 'address-uuid-123');

      // Assert
      expect(result).toEqual(defaultAddress);
      expect(result.isDefault).toBe(true);
      expect(userService.setDefaultAddress).toHaveBeenCalledWith(
        'user-uuid-123',
        'address-uuid-123',
      );
    });

    it('should throw CustomHttpException if address not found', async () => {
      // Arrange
      userService.setDefaultAddress.mockRejectedValue(
        new CustomHttpException('ADDRESS_NOT_FOUND', 'Address not found', 404),
      );

      // Act & Assert
      await expect(controller.setDefaultAddress('user-uuid-123', 'invalid-id')).rejects.toThrow(
        CustomHttpException,
      );
    });
  });

  describe('endpoint decorators and guards', () => {
    it('should have getProfile endpoint', () => {
      expect(controller.getProfile).toBeDefined();
      expect(typeof controller.getProfile).toBe('function');
    });

    it('should have updateProfile endpoint', () => {
      expect(controller.updateProfile).toBeDefined();
      expect(typeof controller.updateProfile).toBe('function');
    });

    it('should have getAddresses endpoint', () => {
      expect(controller.getAddresses).toBeDefined();
      expect(typeof controller.getAddresses).toBe('function');
    });

    it('should have createAddress endpoint', () => {
      expect(controller.createAddress).toBeDefined();
      expect(typeof controller.createAddress).toBe('function');
    });

    it('should have updateAddress endpoint', () => {
      expect(controller.updateAddress).toBeDefined();
      expect(typeof controller.updateAddress).toBe('function');
    });

    it('should have deleteAddress endpoint', () => {
      expect(controller.deleteAddress).toBeDefined();
      expect(typeof controller.deleteAddress).toBe('function');
    });

    it('should have setDefaultAddress endpoint', () => {
      expect(controller.setDefaultAddress).toBeDefined();
      expect(typeof controller.setDefaultAddress).toBe('function');
    });
  });

  describe('response format', () => {
    it('should return UserResponseDto format for profile', async () => {
      // Arrange
      userService.getUserProfile.mockResolvedValue(mockUser as any);

      // Act
      const result = await controller.getProfile('user-uuid-123');

      // Assert
      expect(result).toMatchObject({
        id: expect.any(String),
        email: expect.any(String),
        name: expect.any(String),
        phone: expect.any(String),
        role: expect.any(String),
        isActive: expect.any(Boolean),
        createdAt: expect.any(Date),
      });
    });

    it('should return AddressResponseDto format for address', async () => {
      // Arrange
      userService.getUserAddresses.mockResolvedValue([mockAddress] as any);

      // Act
      const result = await controller.getAddresses('user-uuid-123');

      // Assert
      expect(result[0]).toMatchObject({
        id: expect.any(String),
        userId: expect.any(String),
        label: expect.any(String),
        street: expect.any(String),
        city: expect.any(String),
        state: expect.any(String),
        postalCode: expect.any(String),
        latitude: expect.any(Number),
        longitude: expect.any(Number),
        isDefault: expect.any(Boolean),
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
      });
    });
  });
});
