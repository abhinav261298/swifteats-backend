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

## Setup Test Data

**⚠️ IMPORTANT: Run this first!**

Generate test data from your database (restaurant IDs, menu items, customer addresses):

```bash
cd load-tests
node setup-test-data.js
```

This creates `test-data.json` with real database IDs for load testing.

---

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
