const axios = require('axios');
require('dotenv').config();

// Configuration
const API_URL = process.env.API_URL || 'http://localhost:4000/api/v1';
const DRIVER_COUNT = parseInt(process.env.DRIVER_COUNT) || 50;
const UPDATE_INTERVAL_MS = parseInt(process.env.UPDATE_INTERVAL_MS) || 100;
const CENTER_LAT = parseFloat(process.env.CENTER_LAT) || 19.0760;
const CENTER_LNG = parseFloat(process.env.CENTER_LNG) || 72.8777;
const RADIUS_KM = parseFloat(process.env.RADIUS_KM) || 10;
const MAX_SPEED_KMH = parseFloat(process.env.MAX_SPEED_KMH) || 40;
const MIN_SPEED_KMH = parseFloat(process.env.MIN_SPEED_KMH) || 10;

// Statistics
let stats = {
  totalSent: 0,
  totalSuccess: 0,
  totalFailed: 0,
  startTime: null,
  lastReportTime: null,
};

// Driver class to simulate individual driver movement
class Driver {
  constructor(id, token) {
    this.id = id;
    this.token = token;
    
    // Initialize random position within radius
    const randomAngle = Math.random() * 2 * Math.PI;
    const randomRadius = Math.random() * RADIUS_KM;
    
    this.latitude = CENTER_LAT + (randomRadius / 111) * Math.cos(randomAngle);
    this.longitude = CENTER_LNG + (randomRadius / (111 * Math.cos(CENTER_LAT * Math.PI / 180))) * Math.sin(randomAngle);
    
    // Random initial velocity
    this.velocityLat = (Math.random() - 0.5) * 0.001;
    this.velocityLng = (Math.random() - 0.5) * 0.001;
    
    // Random speed (km/h)
    this.speed = MIN_SPEED_KMH + Math.random() * (MAX_SPEED_KMH - MIN_SPEED_KMH);
    
    // Random heading (0-360 degrees)
    this.heading = Math.random() * 360;
    
    // Accuracy (GPS accuracy in meters)
    this.accuracy = 5 + Math.random() * 15;
  }

  updatePosition() {
    // Update position based on velocity (random walk with momentum)
    this.latitude += this.velocityLat;
    this.longitude += this.velocityLng;
    
    // Add random perturbation (simulate realistic movement)
    this.velocityLat += (Math.random() - 0.5) * 0.0001;
    this.velocityLng += (Math.random() - 0.5) * 0.0001;
    
    // Damping factor (simulate friction/resistance)
    this.velocityLat *= 0.95;
    this.velocityLng *= 0.95;
    
    // Keep within bounds (bounce back if outside radius)
    const distanceFromCenter = this.getDistanceFromCenter();
    if (distanceFromCenter > RADIUS_KM) {
      // Reverse velocity to bounce back
      this.velocityLat *= -0.8;
      this.velocityLng *= -0.8;
    }
    
    // Update heading based on velocity
    if (Math.abs(this.velocityLat) > 0.00001 || Math.abs(this.velocityLng) > 0.00001) {
      this.heading = Math.atan2(this.velocityLng, this.velocityLat) * (180 / Math.PI);
      if (this.heading < 0) this.heading += 360;
    }
    
    // Vary speed slightly
    this.speed += (Math.random() - 0.5) * 2;
    this.speed = Math.max(MIN_SPEED_KMH, Math.min(MAX_SPEED_KMH, this.speed));
    
    // Vary accuracy slightly
    this.accuracy += (Math.random() - 0.5) * 2;
    this.accuracy = Math.max(5, Math.min(20, this.accuracy));
  }

  getDistanceFromCenter() {
    const R = 6371; // Earth's radius in km
    const dLat = (this.latitude - CENTER_LAT) * Math.PI / 180;
    const dLon = (this.longitude - CENTER_LNG) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(CENTER_LAT * Math.PI / 180) * Math.cos(this.latitude * Math.PI / 180) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  getLocationData() {
    return {
      latitude: parseFloat(this.latitude.toFixed(6)),
      longitude: parseFloat(this.longitude.toFixed(6)),
      accuracy: parseFloat(this.accuracy.toFixed(2)),
      heading: parseFloat(this.heading.toFixed(2)),
      speed: parseFloat(this.speed.toFixed(2)),
    };
  }

  async sendLocation() {
    try {
      await axios.post(
        `${API_URL}/driver/location`,
        this.getLocationData(),
        {
          headers: {
            'Authorization': `Bearer ${this.token}`,
            'Content-Type': 'application/json',
          },
          timeout: 5000,
        }
      );
      stats.totalSuccess++;
      return true;
    } catch (error) {
      stats.totalFailed++;
      if (error.response) {
        console.error(`Driver ${this.id}: ${error.response.status} - ${error.response.data?.message || 'Unknown error'}`);
      } else if (error.request) {
        console.error(`Driver ${this.id}: No response from server`);
      } else {
        console.error(`Driver ${this.id}: ${error.message}`);
      }
      return false;
    }
  }
}

// Token management
function loadDriverTokens() {
  const tokensEnv = process.env.DRIVER_TOKENS || '';
  const tokens = tokensEnv.split(',').map(t => t.trim()).filter(t => t.length > 0);
  
  if (tokens.length === 0) {
    console.error('\n❌ ERROR: No driver tokens found!');
    console.error('Please set DRIVER_TOKENS in .env file with comma-separated JWT tokens.\n');
    console.error('To generate tokens:');
    console.error('1. Start the main app: npm run start:dev');
    console.error('2. Login as drivers to get JWT tokens');
    console.error('3. Add tokens to gps-simulator/.env: DRIVER_TOKENS=token1,token2,...\n');
    process.exit(1);
  }
  
  if (tokens.length < DRIVER_COUNT) {
    console.warn(`⚠️  WARNING: Only ${tokens.length} tokens provided, but ${DRIVER_COUNT} drivers requested.`);
    console.warn(`    Using ${tokens.length} drivers instead.\n`);
  }
  
  return tokens.slice(0, DRIVER_COUNT);
}

// Initialize drivers
function initializeDrivers() {
  const tokens = loadDriverTokens();
  const drivers = tokens.map((token, index) => new Driver(index + 1, token));
  
  console.log(`✅ Initialized ${drivers.length} drivers`);
  console.log(`📍 Simulation area: ${CENTER_LAT}, ${CENTER_LNG} (radius: ${RADIUS_KM} km)`);
  console.log(`🚗 Speed range: ${MIN_SPEED_KMH}-${MAX_SPEED_KMH} km/h`);
  console.log(`📡 Target: 10 events/second (100ms interval per driver)\n`);
  
  return drivers;
}

// Report statistics
function reportStats() {
  const now = Date.now();
  const totalRuntime = (now - stats.startTime) / 1000;
  const intervalRuntime = (now - stats.lastReportTime) / 1000;
  
  const avgRate = stats.totalSent / totalRuntime;
  const successRate = stats.totalSent > 0 ? (stats.totalSuccess / stats.totalSent * 100) : 0;
  
  console.log(`📊 Stats [${totalRuntime.toFixed(1)}s]:`,
    `Sent: ${stats.totalSent}`,
    `| Success: ${stats.totalSuccess}`,
    `| Failed: ${stats.totalFailed}`,
    `| Rate: ${avgRate.toFixed(2)} evt/s`,
    `| Success: ${successRate.toFixed(1)}%`
  );
  
  stats.lastReportTime = now;
}

// Main simulation loop
async function startSimulation() {
  console.log('\n🚀 SwiftEats GPS Simulator\n');
  console.log(`API URL: ${API_URL}`);
  console.log(`Driver count: ${DRIVER_COUNT}`);
  console.log(`Update interval: ${UPDATE_INTERVAL_MS}ms\n`);
  
  const drivers = initializeDrivers();
  
  stats.startTime = Date.now();
  stats.lastReportTime = Date.now();
  
  // Report stats every 10 seconds
  setInterval(reportStats, 10000);
  
  console.log('🟢 Simulation started. Press Ctrl+C to stop.\n');
  
  // Simulate each driver at specified interval
  let driverIndex = 0;
  
  setInterval(async () => {
    const driver = drivers[driverIndex];
    
    // Update driver position
    driver.updatePosition();
    
    // Send location update
    stats.totalSent++;
    await driver.sendLocation();
    
    // Move to next driver (round-robin)
    driverIndex = (driverIndex + 1) % drivers.length;
  }, UPDATE_INTERVAL_MS);
}

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n🛑 Stopping simulation...');
  reportStats();
  console.log('\n✅ Simulation stopped.\n');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n\n🛑 Stopping simulation...');
  reportStats();
  console.log('\n✅ Simulation stopped.\n');
  process.exit(0);
});

// Start simulation
startSimulation().catch((error) => {
  console.error('\n❌ Simulation error:', error.message);
  process.exit(1);
});
