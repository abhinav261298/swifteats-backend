# GPS Simulator for SwiftEats

A Node.js service that simulates GPS location updates from multiple drivers for testing the real-time location tracking system.

## Features

- ✅ Simulates 50 concurrent drivers (configurable)
- ✅ Sends 10 GPS events per second (configurable)
- ✅ Realistic movement patterns (random walk with velocity and momentum)
- ✅ Bounded simulation area (stays within radius from center)
- ✅ Realistic speed variation (10-40 km/h)
- ✅ GPS accuracy simulation (5-20 meters)
- ✅ Heading calculation based on movement direction
- ✅ Statistics reporting (success rate, event rate)
- ✅ Graceful shutdown with final stats

## Prerequisites

1. **Main SwiftEats app running** on `http://localhost:4000`
2. **Driver accounts created** in the database
3. **Driver JWT tokens** obtained by logging in

## Setup

### 1. Install Dependencies

```bash
cd gps-simulator
npm install
```

### 2. Configure Environment

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

### 3. Generate Driver Tokens

You need JWT tokens for drivers. Two options:

#### Option A: Use Seed Data Drivers

If you ran the seed script, you have 2 drivers:
- `driver1@swifteats.com` / `Password123!`
- `driver2@swifteats.com` / `Password123!`

Login to get tokens:

```bash
# Login as driver 1
curl -X POST http://localhost:4000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "driver1@swifteats.com",
    "password": "Password123!"
  }'

# Copy the "accessToken" from response
```

Repeat for driver 2, or create more drivers as needed.

#### Option B: Create New Drivers

```bash
# Register new driver
curl -X POST http://localhost:4000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "driver_test@example.com",
    "password": "SecurePass123!",
    "name": "Test Driver",
    "phone": "+919999999999",
    "role": "DRIVER"
  }'

# Then login to get token
```

### 4. Add Tokens to .env

Edit `gps-simulator/.env`:

```env
DRIVER_TOKENS=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...,eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Note:** Separate multiple tokens with commas. You can provide 1-50 tokens. The simulator will use all provided tokens up to `DRIVER_COUNT`.

## Configuration Options

Edit `gps-simulator/.env`:

| Variable | Default | Description |
|----------|---------|-------------|
| `API_URL` | `http://localhost:4000/api/v1` | Main app API URL |
| `DRIVER_COUNT` | `50` | Number of drivers to simulate |
| `UPDATE_INTERVAL_MS` | `100` | Milliseconds between updates (100ms = 10 events/sec) |
| `CENTER_LAT` | `19.0760` | Simulation center latitude (Mumbai) |
| `CENTER_LNG` | `72.8777` | Simulation center longitude (Mumbai) |
| `RADIUS_KM` | `10` | Radius of simulation area (km) |
| `MAX_SPEED_KMH` | `40` | Maximum driver speed (km/h) |
| `MIN_SPEED_KMH` | `10` | Minimum driver speed (km/h) |

## Running the Simulator

### Start Simulation

```bash
cd gps-simulator
npm start
```

### Development Mode (with auto-reload)

```bash
npm run dev
```

### Output

```
🚀 SwiftEats GPS Simulator

API URL: http://localhost:4000/api/v1
Driver count: 50
Update interval: 100ms

✅ Initialized 50 drivers
📍 Simulation area: 19.076, 72.8777 (radius: 10 km)
🚗 Speed range: 10-40 km/h
📡 Target: 10 events/second (100ms interval per driver)

🟢 Simulation started. Press Ctrl+C to stop.

📊 Stats [10.0s]: Sent: 500 | Success: 495 | Failed: 5 | Rate: 50.00 evt/s | Success: 99.0%
📊 Stats [20.0s]: Sent: 1000 | Success: 990 | Failed: 10 | Rate: 50.00 evt/s | Success: 99.0%
```

### Stop Simulation

Press `Ctrl+C` to gracefully stop. Final statistics will be displayed.

## How It Works

### Movement Simulation

Each driver:
1. **Starts** at a random position within the specified radius
2. **Moves** using a random walk algorithm with velocity and momentum
3. **Bounces** back if it reaches the boundary
4. **Varies speed** realistically (10-40 km/h)
5. **Calculates heading** based on direction of movement
6. **Simulates GPS accuracy** (5-20 meters)

### Update Pattern

- Updates are sent in **round-robin** fashion across all drivers
- With 50 drivers and 100ms interval: `1000ms / 100ms = 10 events/second`
- Each driver sends approximately `10 / 50 = 0.2` events/second
- This simulates realistic intermittent GPS updates per driver

### Data Sent

Each location update includes:
```json
{
  "latitude": 19.076234,
  "longitude": 72.877456,
  "accuracy": 12.5,
  "heading": 145.32,
  "speed": 25.67
}
```

## Testing

### Verify Events in Main App

1. Check buffer statistics:
```bash
curl -X GET http://localhost:4000/api/v1/driver/location/stats \
  -H "Authorization: Bearer <driver_token>"
```

2. Check database:
```sql
SELECT COUNT(*) FROM driver_locations WHERE created_at > NOW() - INTERVAL '1 minute';
```

3. Monitor WebSocket updates (if connected):
```javascript
const socket = io('http://localhost:4000/tracking');
socket.on('locationUpdate', (data) => {
  console.log('Location update:', data);
});
```

## Troubleshooting

### Error: No driver tokens found

**Solution:** Add driver JWT tokens to `.env` file. See setup instructions above.

### Error: 401 Unauthorized

**Causes:**
- Token expired (JWT tokens expire after 5 minutes)
- Invalid token format
- Driver not found

**Solution:** Generate fresh tokens by logging in again.

### Error: No response from server

**Cause:** Main app not running.

**Solution:** Start the main app first:
```bash
cd ..
npm run start:dev
```

### High failure rate

**Causes:**
- Main app overloaded
- Database connection issues
- Network issues

**Solution:** 
- Check main app logs
- Reduce `DRIVER_COUNT` or increase `UPDATE_INTERVAL_MS`
- Verify PostgreSQL is running

## Performance Notes

- **Local testing:** 50 drivers, 10 events/sec = 500 location updates/sec total
- **Production target:** 10,000 drivers, 1 event per 5 sec = 2,000 events/sec
- The main app's buffer system can handle the load efficiently

## Docker Usage

When using docker-compose, the simulator runs automatically:

```bash
docker-compose up
```

The simulator will wait for the main app to be healthy before starting.

---

**Happy Testing! 🚀**
