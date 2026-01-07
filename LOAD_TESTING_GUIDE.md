# Load Testing Guide for SwiftEats

This guide provides step-by-step instructions to run performance and load tests for the SwiftEats platform.

## Table of Contents
1. [Prerequisites](#prerequisites)
2. [Setup Load Testing Environment](#setup-load-testing-environment)
3. [Getting Authentication Tokens](#getting-authentication-tokens)
4. [Running Load Tests](#running-load-tests)
5. [Understanding Test Results](#understanding-test-results)
6. [Performance Targets](#performance-targets)

---

## Prerequisites

Before running load tests, ensure you have:

1. **Node.js** installed (v18 or higher)
2. **SwiftEats application** running locally
3. **Database seeded** with test data
4. **Artillery** installed globally

### Install Artillery

```bash
npm install -g artillery@latest
```

Verify installation:
```bash
artillery --version
```

---

## Setup Load Testing Environment

### Step 1: Run Setup Script

This creates all necessary load test files:

```bash
cd /home/abhinavkumar/Documents/todo/swift-eats
bash scripts/setup-load-testing.sh
```

**Created files:**
- `load-tests/menu-browse.yml` - Menu browsing performance test
- `load-tests/order-creation.yml` - Order creation load test
- `load-tests/gps-updates.yml` - GPS location updates test
- `load-tests/helpers.js` - Helper functions for tests
- `load-tests/README.md` - Test documentation

### Step 2: Start the Application

```bash
npm run start:dev
```

Wait until you see:
```
Application is running on: http://localhost:4000/api/v1
```

### Step 3: Seed Database (if not done)

```bash
npm run seed
```

This creates:
- 2 customers
- 2 restaurant owners with restaurants
- 2 drivers
- Multiple menu items

**All test users have password:** `Password123!`

---

## Getting Authentication Tokens

Some load tests require authentication tokens. Here's how to get them:

### Method 1: Using curl (Recommended)

**Get Customer Token:**

```bash
curl -X POST http://localhost:4000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "customer1@example.com",
    "password": "Password123!"
  }'
```

**Expected response:**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "...",
    "email": "customer1@example.com",
    "name": "John Doe",
    "role": "CUSTOMER"
  }
}
```

**Copy the `accessToken` value.**

**Get Driver Token:**

```bash
curl -X POST http://localhost:4000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "driver1@swifteats.com",
    "password": "Password123!"
  }'
```

**Copy the `accessToken` value from the response.**

### Method 2: Using Postman or Browser

1. Open Postman or your REST client
2. POST to `http://localhost:4000/api/v1/auth/login`
3. Set Content-Type: `application/json`
4. Body (raw JSON):
   ```json
   {
     "email": "customer1@example.com",
     "password": "Password123!"
   }
   ```
5. Copy the `accessToken` from response

Repeat for driver login with `driver1@swifteats.com`.

### Step 4: Export Tokens

**On Linux/Mac:**

```bash
export CUSTOMER_TOKEN="<paste-customer-token-here>"
export DRIVER_TOKEN="<paste-driver-token-here>"
```

**Example:**
```bash
export CUSTOMER_TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c"
export DRIVER_TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI5ODc2NTQzMjEwIiwibmFtZSI6IlJhaiBLdW1hciIsImlhdCI6MTUxNjIzOTAyMn0.dGhpcyBpcyBqdXN0IGEgZHVtbXkgdG9rZW4gZm9yIGRlbW8"
```

**On Windows (PowerShell):**

```powershell
$env:CUSTOMER_TOKEN="<paste-customer-token-here>"
$env:DRIVER_TOKEN="<paste-driver-token-here>"
```

### Verify Tokens

```bash
echo $CUSTOMER_TOKEN
echo $DRIVER_TOKEN
```

Both should display the JWT tokens.

---

## Running Load Tests

Navigate to the load-tests directory:

```bash
cd load-tests
```

### Test 1: Menu Browse Performance Test

**Objective:** Validate P99 response time < 200ms at 50 req/sec

**No authentication required** (public endpoint)

```bash
artillery run menu-browse.yml
```

**What it tests:**
- Fetches list of restaurants (50 req/sec)
- Fetches menu for first restaurant
- Simulates 2-second think time
- Runs for 60 seconds

**Expected output:**
```
Summary report:
  http.codes.200: 3000
  http.request_rate: 50/sec
  http.response_time:
    min: 15
    max: 180
    median: 45
    p95: 120
    p99: 165  ✅ (Target: < 200ms)
```

### Test 2: Order Creation Load Test

**Objective:** Handle 500 orders/minute (8.33 req/sec)

**Requires:** `CUSTOMER_TOKEN`

```bash
artillery run order-creation.yml
```

Or pass token inline:
```bash
CUSTOMER_TOKEN="your-token" artillery run order-creation.yml
```

**What it tests:**
- Creates orders at 8.33 req/sec rate
- Tests order processing throughput
- Runs for 60 seconds
- Simulates 5-second think time

**Expected output:**
```
Summary report:
  http.codes.201: 500
  http.request_rate: 8.33/sec
  http.response_time:
    p95: 1500ms
    p99: 1900ms  ✅ (Target: < 2000ms)
```

### Test 3: GPS Updates Test

**Objective:** Ingest 10 GPS events/second from drivers

**Requires:** `DRIVER_TOKEN`

```bash
artillery run gps-updates.yml
```

Or pass token inline:
```bash
DRIVER_TOKEN="your-token" artillery run gps-updates.yml
```

**What it tests:**
- Sends GPS location updates at 10 events/sec
- Tests location ingestion throughput
- Runs for 60 seconds
- Minimal think time (0.1 second)

**Expected output:**
```
Summary report:
  http.codes.200: 600
  http.request_rate: 10/sec
  http.response_time:
    p95: 320ms
    p99: 450ms  ✅ (Target: < 500ms)
```

---

## Understanding Test Results

Artillery provides comprehensive metrics:

### Response Time Metrics

| Metric | Description | Target |
|--------|-------------|--------|
| **min** | Fastest response | - |
| **max** | Slowest response | Monitor for outliers |
| **median** | 50th percentile | - |
| **p95** | 95th percentile | Most requests under this |
| **p99** | 99th percentile | Performance target |

### Request Metrics

| Metric | Description |
|--------|-------------|
| **http.codes.200** | Successful requests |
| **http.codes.201** | Created (for POST) |
| **http.codes.4xx** | Client errors |
| **http.codes.5xx** | Server errors |
| **http.request_rate** | Requests per second |

### Success Criteria

**Pass:** Success rate > 95%, targets met  
**Fail:** Errors > 5% or performance targets missed

---

## Performance Targets

### Assignment Requirements vs Implementation

| Component | Target | Test Configuration | Status |
|-----------|--------|-------------------|--------|
| **Menu Browse** | P99 < 200ms @ heavy load | 50 req/sec for 60s | ✅ Ready |
| **Order Processing** | 500 orders/min | 8.33 req/sec for 60s | ✅ Ready |
| **GPS Ingestion** | 2,000 events/sec (design)<br>50 drivers @ 10 events/sec (local test) | 10 req/sec for 60s | ✅ Ready |

### Expected Performance

Based on architecture design:

**Menu Browse:**
- ✅ P99: 50-150ms (cached data)
- ✅ Throughput: 50+ req/sec
- ✅ Success rate: >99%

**Order Creation:**
- ✅ P95: <2000ms
- ✅ Throughput: 8.33 req/sec (500/min)
- ✅ Success rate: >95%

**GPS Updates:**
- ✅ P99: <500ms
- ✅ Throughput: 10 req/sec
- ✅ Success rate: >99%
- ✅ Buffer design supports 2,000 events/sec at scale

---

## Advanced Usage

### Generate HTML Report

```bash
artillery run --output results.json menu-browse.yml
artillery report results.json
```

Opens an HTML report with graphs and detailed metrics.

### Run All Tests Sequentially

Create a bash script `run-all-tests.sh`:

```bash
#!/bin/bash
echo "🚀 Running all load tests..."

echo "\n1️⃣ Menu Browse Test"
artillery run menu-browse.yml

echo "\n2️⃣ Order Creation Test"
artillery run order-creation.yml

echo "\n3️⃣ GPS Updates Test"
artillery run gps-updates.yml

echo "\n✅ All tests completed!"
```

Run:
```bash
chmod +x run-all-tests.sh
./run-all-tests.sh
```

### Customize Test Duration

Edit the YAML files and change `duration` value:

```yaml
config:
  phases:
    - duration: 120  # Change from 60 to 120 seconds
      arrivalRate: 50
```

### Increase Load

Edit `arrivalRate` to increase requests per second:

```yaml
config:
  phases:
    - duration: 60
      arrivalRate: 100  # Increased from 50
```

---

## Troubleshooting

### Issue: "artillery: command not found"

**Solution:**
```bash
npm install -g artillery@latest
```

### Issue: "Cannot read environment variable CUSTOMER_TOKEN"

**Solution:** Export the token before running:
```bash
export CUSTOMER_TOKEN="your-token-here"
```

### Issue: "Connection refused"

**Solution:** Ensure the app is running:
```bash
npm run start:dev
```

Check if server is up:
```bash
curl http://localhost:4000/api/v1/health
```

### Issue: "401 Unauthorized"

**Solution:** Token expired or invalid. Get a fresh token:
```bash
curl -X POST http://localhost:4000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "customer1@example.com", "password": "Password123!"}'
```

### Issue: High error rate (>5%)

**Possible causes:**
1. Database not seeded - run `npm run seed`
2. Server overloaded - reduce `arrivalRate`
3. Invalid test data - check `helpers.js` configuration

---

## Available Test Users

From seed data (`npm run seed`):

| Role | Email | Password |
|------|-------|----------|
| Customer 1 | customer1@example.com | Password123! |
| Customer 2 | customer2@example.com | Password123! |
| Driver 1 | driver1@swifteats.com | Password123! |
| Driver 2 | driver2@swifteats.com | Password123! |
| Restaurant Owner 1 | owner1@restaurant.com | Password123! |
| Restaurant Owner 2 | owner2@restaurant.com | Password123! |
| Admin | admin@swifteats.com | Password123! |

**Note:** Only 1 customer and 1 driver token needed for load testing. Artillery reuses the same token for all virtual users.

---

## Quick Start (TL;DR)

```bash
# 1. Setup
cd /home/abhinavkumar/Documents/todo/swift-eats
bash scripts/setup-load-testing.sh
npm run start:dev

# 2. Get tokens (in new terminal)
CUSTOMER_TOKEN=$(curl -s -X POST http://localhost:4000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"customer1@example.com","password":"Password123!"}' \
  | grep -o '"accessToken":"[^"]*' | cut -d'"' -f4)

DRIVER_TOKEN=$(curl -s -X POST http://localhost:4000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"driver1@swifteats.com","password":"Password123!"}' \
  | grep -o '"accessToken":"[^"]*' | cut -d'"' -f4)

export CUSTOMER_TOKEN
export DRIVER_TOKEN

# 3. Run tests
cd load-tests
artillery run menu-browse.yml
artillery run order-creation.yml
artillery run gps-updates.yml
```

---

## Summary

✅ **3 Load Tests** covering critical performance targets  
✅ **Automated test scenarios** with Artillery  
✅ **Performance validation** for assignment requirements  
✅ **Easy token management** with environment variables  
✅ **Comprehensive metrics** for analysis  

For questions or issues, refer to the main [README.md](../README.md) or check the [load-tests/README.md](README.md) file.
