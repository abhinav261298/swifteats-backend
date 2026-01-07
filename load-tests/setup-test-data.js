#!/usr/bin/env node

/**
 * Setup script to fetch real IDs from database for load testing
 * Run before load tests: node setup-test-data.js
 */

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

async function setupTestData() {
  const client = new Client({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'swifteats',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
  });

  try {
    await client.connect();
    console.log('✅ Connected to database');

    // Fetch restaurant IDs
    const restaurantResult = await client.query(`
      SELECT id, name FROM restaurants 
      WHERE status = 'ACTIVE' AND "approvalStatus" = 'APPROVED'
      LIMIT 10
    `);
    
    if (restaurantResult.rows.length === 0) {
      throw new Error('No active restaurants found. Run seed script first.');
    }

    // Fetch menu items for EACH restaurant
    const menuItemsByRestaurant = {};
    for (const restaurant of restaurantResult.rows) {
      const menuResult = await client.query(`
        SELECT id, name, price FROM menu_items 
        WHERE "restaurantId" = $1 AND "isAvailable" = true
        LIMIT 20
      `, [restaurant.id]);
      
      menuItemsByRestaurant[restaurant.id] = menuResult.rows.map(m => ({
        id: m.id,
        name: m.name,
        price: parseFloat(m.price),
      }));
    }
    
    // Flatten all menu items
    const menuResult = { rows: Object.values(menuItemsByRestaurant).flat() };

    if (menuResult.rows.length === 0) {
      throw new Error('No menu items found. Run seed script first.');
    }

    // Fetch customer and their addresses (MUST have address)
    const customerResult = await client.query(`
      SELECT u.id as user_id, u.email, a.id as address_id
      FROM users u
      INNER JOIN addresses a ON a."userId" = u.id
      WHERE u.role = 'CUSTOMER' AND a."isDefault" = true AND u.email = 'customer2@example.com'
      LIMIT 1
    `);

    if (customerResult.rows.length === 0) {
      throw new Error('No customers found. Run seed script first.');
    }

    const testData = {
      restaurants: restaurantResult.rows.map(r => ({
        id: r.id,
        name: r.name,
        menuItems: menuItemsByRestaurant[r.id] || [],
      })),
      customer: {
        userId: customerResult.rows[0].user_id,
        email: customerResult.rows[0].email,
        addressId: customerResult.rows[0].address_id,
      },
    };

    // Write to JSON file
    const outputPath = path.join(__dirname, 'test-data.json');
    fs.writeFileSync(outputPath, JSON.stringify(testData, null, 2));

    const totalMenuItems = testData.restaurants.reduce((sum, r) => sum + r.menuItems.length, 0);
    
    console.log('\n✅ Test data generated successfully!');
    console.log(`📄 Saved to: ${outputPath}`);
    console.log('\n📊 Summary:');
    console.log(`   - Restaurants: ${testData.restaurants.length}`);
    testData.restaurants.forEach(r => {
      console.log(`     • ${r.name}: ${r.menuItems.length} menu items`);
    });
    console.log(`   - Total menu items: ${totalMenuItems}`);
    console.log(`   - Customer: ${testData.customer.email}`);
    console.log(`   - Address ID: ${testData.customer.addressId || 'NONE - CREATE ONE!'}`);

    if (!testData.customer.addressId) {
      console.log('\n⚠️  WARNING: Customer has no address. Create one before running order tests.');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

setupTestData();
