const fs = require('fs');
const path = require('path');

// Load test data
let testData;
try {
  const testDataPath = path.join(__dirname, 'test-data.json');
  testData = JSON.parse(fs.readFileSync(testDataPath, 'utf8'));
} catch (error) {
  console.error('⚠️  WARNING: test-data.json not found. Run: node setup-test-data.js');
  testData = { restaurants: [], menuItems: [], customer: {} };
}

module.exports = {
  /**
   * Generate random GPS coordinates (Mumbai area)
   */
  generateRandomCoords: function(context, events, done) {
    // Mumbai center: 19.0760, 72.8777
    // Generate within ~5km radius
    context.vars.latitude = parseFloat((19.0760 + (Math.random() - 0.5) * 0.1).toFixed(6));
    context.vars.longitude = parseFloat((72.8777 + (Math.random() - 0.5) * 0.1).toFixed(6));
    context.vars.accuracy = parseFloat((Math.random() * 10 + 5).toFixed(1)); // 5-15m
    context.vars.heading = parseFloat((Math.random() * 360).toFixed(1)); // 0-360 degrees
    context.vars.speed = parseFloat((Math.random() * 30 + 10).toFixed(1)); // 10-40 km/h
    return done();
  },
  
  /**
   * Generate valid order data using real database IDs
   */
  generateOrderData: function(context, events, done) {
    if (testData.restaurants.length === 0) {
      console.error('❌ No test data available. Run: node setup-test-data.js');
      return done(new Error('Test data not loaded'));
    }

    // Pick random restaurant
    const restaurant = testData.restaurants[Math.floor(Math.random() * testData.restaurants.length)];
    
    // Ensure restaurant has menu items
    if (!restaurant.menuItems || restaurant.menuItems.length === 0) {
      console.error(`❌ Restaurant ${restaurant.name} has no menu items`);
      return done(new Error('No menu items for restaurant'));
    }

    // Pick menu item from THIS restaurant's menu
    const menuItem = restaurant.menuItems[Math.floor(Math.random() * restaurant.menuItems.length)];

    // Set simple variables for template substitution
    context.vars.restaurantId = restaurant.id;
    context.vars.deliveryAddressId = testData.customer.addressId;
    context.vars.menuItemId = menuItem.id;
    context.vars.quantity = Math.floor(Math.random() * 3) + 1; // 1-3
    context.vars.paymentMethod = Math.random() > 0.5 ? 'CARD' : 'CASH';

    return done();
  },

  /**
   * Set restaurant ID for menu browsing
   */
  setRestaurantId: function(context, events, done) {
    if (testData.restaurants.length > 0) {
      const restaurant = testData.restaurants[Math.floor(Math.random() * testData.restaurants.length)];
      context.vars.restaurantId = restaurant.id;
    }
    return done();
  },

  /**
   * Before request hook to set JSON body properly
   */
  setOrderBody: function(requestParams, context, ee, next) {
    if (requestParams.url === '/api/v1/orders' && context.vars.items) {
      requestParams.json = {
        restaurantId: context.vars.restaurantId,
        deliveryAddressId: context.vars.deliveryAddressId,
        items: context.vars.items,
        paymentMethod: context.vars.paymentMethod,
      };
    }
    return next();
  }
};
