import dataSource from '../data-source';
import { User } from '../../modules/user/entities/user.entity';
import { Address } from '../../modules/user/entities/address.entity';
import { Restaurant } from '../../modules/restaurant/entities/restaurant.entity';
import { MenuItem } from '../../modules/restaurant/entities/menu-item.entity';
import { Driver } from '../../modules/driver/entities/driver.entity';
import { UserRole, RestaurantStatus, ApprovalStatus, VehicleType } from '../../common/constants';
import * as bcrypt from 'bcrypt';

async function seed() {
  console.log('🌱 Starting database seed...');

  try {
    await dataSource.initialize();
    console.log('✅ Database connection established');

    const userRepo = dataSource.getRepository(User);
    const addressRepo = dataSource.getRepository(Address);
    const restaurantRepo = dataSource.getRepository(Restaurant);
    const menuItemRepo = dataSource.getRepository(MenuItem);
    const driverRepo = dataSource.getRepository(Driver);

    // Clear existing data (TRUNCATE with CASCADE to handle foreign keys)
    console.log('🗑️  Clearing existing data...');
    await dataSource.query(`
      TRUNCATE TABLE 
        notifications,
        sessions,
        driver_locations,
        deliveries,
        payments,
        order_status_history,
        order_items,
        orders,
        menu_items,
        restaurants,
        drivers,
        addresses,
        users
      RESTART IDENTITY CASCADE
    `);

    const hashedPassword = await bcrypt.hash('Password123!', 10);

    // Seed Admin User
    console.log('👤 Creating admin user...');
    const admin = userRepo.create({
      email: 'admin@swifteats.com',
      password: hashedPassword,
      name: 'Admin User',
      phone: '+919999999999',
      role: UserRole.ADMIN,
    });
    await userRepo.save(admin);

    // Seed Customer Users
    console.log('👤 Creating customer users...');
    const customer1 = userRepo.create({
      email: 'customer1@example.com',
      password: hashedPassword,
      name: 'John Doe',
      phone: '+919876543210',
      role: UserRole.CUSTOMER,
    });
    const customer2 = userRepo.create({
      email: 'customer2@example.com',
      password: hashedPassword,
      name: 'Jane Smith',
      phone: '+919876543211',
      role: UserRole.CUSTOMER,
    });
    await userRepo.save([customer1, customer2]);

    // Seed Addresses for Customers
    try {
      console.log('📍 Creating customer addresses...');
      const address1 = addressRepo.create({
        userId: customer1.id,
        label: 'Home',
        street: '101 Andheri West, Near Metro Station',
        city: 'Mumbai',
        state: 'Maharashtra',
        postalCode: '400058',
        latitude: 19.1334,
        longitude: 72.8667,
        isDefault: true,
      });
      const address2 = addressRepo.create({
        userId: customer2.id,
        label: 'Home',
        street: '202 Bandra Kurla Complex',
        city: 'Mumbai',
        state: 'Maharashtra',
        postalCode: '400051',
        latitude: 19.0596,
        longitude: 72.8656,
        isDefault: true,
      });
      await addressRepo.save([address1, address2]);
      console.log('✅ Addresses created successfully');
    } catch (error) {
      console.error('❌ Failed to create addresses:', error.message);
      throw error;
    }

    // Seed Restaurant Owners
    console.log('🏪 Creating restaurant owners...');
    const owner1 = userRepo.create({
      email: 'owner1@restaurant.com',
      password: hashedPassword,
      name: 'Restaurant Owner 1',
      phone: '+919876543212',
      role: UserRole.RESTAURANT,
    });
    const owner2 = userRepo.create({
      email: 'owner2@restaurant.com',
      password: hashedPassword,
      name: 'Restaurant Owner 2',
      phone: '+919876543213',
      role: UserRole.RESTAURANT,
    });
    await userRepo.save([owner1, owner2]);

    // Seed Restaurants
    console.log('🍽️  Creating restaurants...');
    const restaurant1 = restaurantRepo.create({
      ownerId: owner1.id,
      name: 'Mumbai Delights',
      description: 'Authentic Indian cuisine',
      phone: '+912222222221',
      email: 'info@mumbaidelights.com',
      address: '123 MG Road, Fort',
      city: 'Mumbai',
      state: 'Maharashtra',
      postalCode: '400001',
      latitude: 18.9388, // Mumbai Fort area
      longitude: 72.8354,
      cuisineType: 'Indian',
      isOpen: true,
      status: RestaurantStatus.ACTIVE,
      approvalStatus: ApprovalStatus.APPROVED,
      approvedAt: new Date(),
      openingTime: '09:00',
      closingTime: '23:00',
      averagePreparationTimeMins: 25,
    });

    const restaurant2 = restaurantRepo.create({
      ownerId: owner2.id,
      name: 'Pizza Paradise',
      description: 'Best pizzas in town',
      phone: '+912222222222',
      email: 'info@pizzaparadise.com',
      address: '456 Linking Road, Bandra',
      city: 'Mumbai',
      state: 'Maharashtra',
      postalCode: '400050',
      latitude: 19.0596, // Mumbai Bandra area
      longitude: 72.8295,
      cuisineType: 'Italian',
      isOpen: true,
      status: RestaurantStatus.ACTIVE,
      approvalStatus: ApprovalStatus.APPROVED,
      approvedAt: new Date(),
      openingTime: '11:00',
      closingTime: '23:00',
      averagePreparationTimeMins: 30,
    });

    await restaurantRepo.save([restaurant1, restaurant2]);

    // Seed Menu Items for Restaurant 1
    console.log('📋 Creating menu items...');
    const menuItems1 = [
      menuItemRepo.create({
        restaurantId: restaurant1.id,
        name: 'Butter Chicken',
        description: 'Creamy tomato-based curry with tender chicken',
        price: 350.0,
        category: 'Main Course',
        isAvailable: true,
        isVegetarian: false,
        preparationTimeMins: 20,
      }),
      menuItemRepo.create({
        restaurantId: restaurant1.id,
        name: 'Paneer Tikka',
        description: 'Grilled cottage cheese with spices',
        price: 280.0,
        category: 'Appetizer',
        isAvailable: true,
        isVegetarian: true,
        preparationTimeMins: 15,
      }),
      menuItemRepo.create({
        restaurantId: restaurant1.id,
        name: 'Biryani',
        description: 'Fragrant rice with vegetables and spices',
        price: 320.0,
        category: 'Main Course',
        isAvailable: true,
        isVegetarian: true,
        preparationTimeMins: 25,
      }),
      menuItemRepo.create({
        restaurantId: restaurant1.id,
        name: 'Gulab Jamun',
        description: 'Sweet dumplings in sugar syrup',
        price: 120.0,
        category: 'Dessert',
        isAvailable: true,
        isVegetarian: true,
        preparationTimeMins: 5,
      }),
    ];

    // Seed Menu Items for Restaurant 2
    const menuItems2 = [
      menuItemRepo.create({
        restaurantId: restaurant2.id,
        name: 'Margherita Pizza',
        description: 'Classic tomato, mozzarella, and basil',
        price: 400.0,
        category: 'Main Course',
        isAvailable: true,
        isVegetarian: true,
        preparationTimeMins: 20,
      }),
      menuItemRepo.create({
        restaurantId: restaurant2.id,
        name: 'Pepperoni Pizza',
        description: 'Spicy pepperoni with cheese',
        price: 450.0,
        category: 'Main Course',
        isAvailable: true,
        isVegetarian: false,
        preparationTimeMins: 20,
      }),
      menuItemRepo.create({
        restaurantId: restaurant2.id,
        name: 'Garlic Bread',
        description: 'Toasted bread with garlic butter',
        price: 150.0,
        category: 'Appetizer',
        isAvailable: true,
        isVegetarian: true,
        preparationTimeMins: 10,
      }),
      menuItemRepo.create({
        restaurantId: restaurant2.id,
        name: 'Tiramisu',
        description: 'Classic Italian dessert',
        price: 200.0,
        category: 'Dessert',
        isAvailable: true,
        isVegetarian: true,
        preparationTimeMins: 5,
      }),
    ];

    await menuItemRepo.save([...menuItems1, ...menuItems2]);

    // Seed Driver Users
    console.log('🏍️  Creating drivers...');
    const driverUser1 = userRepo.create({
      email: 'driver1@swifteats.com',
      password: hashedPassword,
      name: 'Raj Kumar',
      phone: '+919876543214',
      role: UserRole.DRIVER,
    });
    const driverUser2 = userRepo.create({
      email: 'driver2@swifteats.com',
      password: hashedPassword,
      name: 'Amit Sharma',
      phone: '+919876543215',
      role: UserRole.DRIVER,
    });
    await userRepo.save([driverUser1, driverUser2]);

    // Seed Drivers
    const driver1 = driverRepo.create({
      userId: driverUser1.id,
      licenseNumber: 'MH01-DL-123456',
      vehicleType: VehicleType.BIKE,
      vehicleNumber: 'MH-01-AB-1234',
      vehicleModel: 'Honda Activa',
      isOnline: true,
      isAvailable: true,
      approvalStatus: ApprovalStatus.APPROVED,
      approvedAt: new Date(),
      currentLatitude: 18.95, // Near Mumbai Fort
      currentLongitude: 72.84,
      lastLocationUpdate: new Date(),
    });

    const driver2 = driverRepo.create({
      userId: driverUser2.id,
      licenseNumber: 'MH01-DL-789012',
      vehicleType: VehicleType.SCOOTER,
      vehicleNumber: 'MH-01-CD-5678',
      vehicleModel: 'Honda Dio',
      isOnline: true,
      isAvailable: true,
      approvalStatus: ApprovalStatus.APPROVED,
      approvedAt: new Date(),
      currentLatitude: 19.06, // Near Mumbai Bandra
      currentLongitude: 72.83,
      lastLocationUpdate: new Date(),
    });

    await driverRepo.save([driver1, driver2]);

    console.log('\n✅ Seed completed successfully!');
    console.log('\n📊 Summary:');
    console.log(`   - Admin users: 1`);
    console.log(`   - Customers: 2`);
    console.log(`   - Customer addresses: 2`);
    console.log(`   - Restaurant owners: 2`);
    console.log(`   - Restaurants: 2`);
    console.log(`   - Menu items: ${menuItems1.length + menuItems2.length}`);
    console.log(`   - Drivers: 2`);
    console.log('\n🔑 Test Credentials (password for all: Password123!):');
    console.log(`   - Admin: admin@swifteats.com`);
    console.log(`   - Customer 1: customer1@example.com`);
    console.log(`   - Customer 2: customer2@example.com`);
    console.log(`   - Restaurant 1: owner1@restaurant.com`);
    console.log(`   - Restaurant 2: owner2@restaurant.com`);
    console.log(`   - Driver 1: driver1@swifteats.com`);
    console.log(`   - Driver 2: driver2@swifteats.com`);

    await dataSource.destroy();
  } catch (error) {
    console.error('❌ Seed failed:', error);
    process.exit(1);
  }
}

seed();
