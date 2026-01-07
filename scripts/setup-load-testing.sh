#!/bin/bash
# Setup load testing with Artillery

echo "🔧 Setting up load testing tools..."

# Install Artillery globally if not present
if ! command -v artillery &> /dev/null; then
    echo "📦 Installing Artillery..."
    npm install -g artillery@latest
else
    echo "✅ Artillery already installed"
fi

# Create load-tests directory
mkdir -p load-tests

# Create Artillery test scenarios
cat > load-tests/menu-browse.yml << 'EOF'
config:
  target: "http://localhost:4000"
  phases:
    - duration: 60
      arrivalRate: 50  # 50 requests per second
      name: "Sustained load"
  processor: "./helpers.js"
  
scenarios:
  - name: "Browse restaurant menu"
    flow:
      - get:
          url: "/api/v1/restaurants"
          qs:
            latitude: 19.0760
            longitude: 72.8777
            radius: 5
          capture:
            - json: "$[0].id"
              as: "restaurantId"
      - get:
          url: "/api/v1/restaurants/{{ restaurantId }}/menu"
      - think: 2
EOF

cat > load-tests/order-creation.yml << 'EOF'
config:
  target: "http://localhost:4000"
  phases:
    - duration: 60
      arrivalRate: 8.33  # 500 orders per minute
      name: "Order creation load"
  processor: "./helpers.js"
  variables:
    customerToken: "{{ $env.CUSTOMER_TOKEN }}"
    
scenarios:
  - name: "Create order"
    flow:
      - post:
          url: "/api/v1/orders"
          headers:
            Authorization: "Bearer {{ customerToken }}"
            Content-Type: "application/json"
          json:
            restaurantId: "{{ $randomString() }}"
            deliveryAddressId: "{{ $randomString() }}"
            items:
              - menuItemId: "{{ $randomString() }}"
                quantity: 2
            paymentMethod: "CARD"
      - think: 5
EOF

cat > load-tests/gps-updates.yml << 'EOF'
config:
  target: "http://localhost:4000"
  phases:
    - duration: 60
      arrivalRate: 10  # 10 events per second
      name: "GPS updates"
  processor: "./helpers.js"
  variables:
    driverToken: "{{ $env.DRIVER_TOKEN }}"
    
scenarios:
  - name: "Send GPS location"
    flow:
      - post:
          url: "/api/v1/driver/location"
          headers:
            Authorization: "Bearer {{ driverToken }}"
            Content-Type: "application/json"
          json:
            latitude: "{{ $randomNumber(18.5, 19.5) }}"
            longitude: "{{ $randomNumber(72.5, 73.5) }}"
            accuracy: 10.5
            heading: "{{ $randomNumber(0, 360) }}"
            speed: "{{ $randomNumber(10, 40) }}"
      - think: 0.1
EOF

cat > load-tests/helpers.js << 'EOF'
module.exports = {
  generateRandomCoords: function(context, events, done) {
    context.vars.latitude = 19.0760 + (Math.random() - 0.5) * 0.1;
    context.vars.longitude = 72.8777 + (Math.random() - 0.5) * 0.1;
    return done();
  },
  
  generateOrderData: function(context, events, done) {
    // Generate random but valid order data
    context.vars.orderData = {
      restaurantId: context.vars.restaurantId || 'default-restaurant-id',
      deliveryAddressId: context.vars.addressId || 'default-address-id',
      items: [
        {
          menuItemId: 'menu-item-1',
          quantity: Math.floor(Math.random() * 5) + 1
        }
      ],
      paymentMethod: 'CARD'
    };
    return done();
  }
};
EOF

# Create README for load tests
cat > load-tests/README.md << 'EOF'
# Load Testing

This directory contains Artillery load testing scenarios for SwiftEats.

## Prerequisites

1. Install Artillery:
   ```bash
   npm install -g artillery@latest
   ```

2. Start the application:
   ```bash
   npm run start:dev
   ```

3. Set environment variables:
   ```bash
   export CUSTOMER_TOKEN="your-customer-jwt-token"
   export DRIVER_TOKEN="your-driver-jwt-token"
   ```

## Running Tests

### Menu Browse Performance Test
Target: P99 < 200ms, 50 req/sec

```bash
artillery run menu-browse.yml
```

### Order Creation Load Test
Target: 500 orders/minute (8.33 req/sec)

```bash
CUSTOMER_TOKEN="your-token" artillery run order-creation.yml
```

### GPS Updates Test
Target: 10 events/second

```bash
DRIVER_TOKEN="your-token" artillery run gps-updates.yml
```

## Interpreting Results

Artillery will show:
- **Response times:** min, max, median, p95, p99
- **Request rate:** requests per second
- **Success rate:** percentage of successful requests
- **Errors:** count and types of errors

### Success Criteria

**Menu Browse:**
- P99 < 200ms ✅
- Success rate > 99% ✅

**Order Creation:**
- Throughput: 8.33 req/sec (500/min) ✅
- Success rate > 95% ✅
- P95 < 2000ms ✅

**GPS Updates:**
- Throughput: 10 req/sec ✅
- Success rate > 99% ✅
- P99 < 500ms ✅

## Custom Scenarios

Edit the YAML files to customize:
- Duration (`duration` field)
- Request rate (`arrivalRate` field)
- Think time (pause between requests)
- Request payloads

## Advanced Options

### Run with HTML report:
```bash
artillery run --output results.json menu-browse.yml
artillery report results.json
```

### Run with increased verbosity:
```bash
artillery run -e production menu-browse.yml
```

### Quick smoke test:
```bash
artillery quick --duration 10 --rate 5 http://localhost:4000/api/v1/health
```
EOF

echo ""
echo "✅ Load testing setup complete!"
echo ""
echo "📁 Created:"
echo "  - load-tests/menu-browse.yml"
echo "  - load-tests/order-creation.yml"
echo "  - load-tests/gps-updates.yml"
echo "  - load-tests/helpers.js"
echo "  - load-tests/README.md"
echo ""
echo "📖 Usage:"
echo "  cd load-tests"
echo "  artillery run menu-browse.yml"
echo ""
echo "📝 Note: Remember to set CUSTOMER_TOKEN and DRIVER_TOKEN environment variables"
echo ""
