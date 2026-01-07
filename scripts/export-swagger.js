#!/usr/bin/env node
/**
 * Export Swagger/OpenAPI specification to YAML file
 * Run this after starting the application
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const API_URL = process.env.API_URL || 'http://localhost:4000';
const OUTPUT_FILE_YML = path.join(__dirname, '..', 'API-SPECIFICATION.yml');
const OUTPUT_FILE_JSON = path.join(__dirname, '..', 'API-SPECIFICATION.json');

/**
 * Simple JSON to YAML converter
 * Converts OpenAPI JSON spec to YAML format
 */
function jsonToYaml(obj, indent = 0) {
  const spaces = '  '.repeat(indent);
  let yaml = '';

  if (Array.isArray(obj)) {
    obj.forEach(item => {
      if (typeof item === 'object' && item !== null) {
        yaml += `${spaces}-\n${jsonToYaml(item, indent + 1)}`;
      } else {
        yaml += `${spaces}- ${formatValue(item)}\n`;
      }
    });
  } else if (typeof obj === 'object' && obj !== null) {
    Object.keys(obj).forEach(key => {
      const value = obj[key];
      if (value === null) {
        yaml += `${spaces}${key}: null\n`;
      } else if (Array.isArray(value)) {
        if (value.length === 0) {
          yaml += `${spaces}${key}: []\n`;
        } else {
          yaml += `${spaces}${key}:\n${jsonToYaml(value, indent + 1)}`;
        }
      } else if (typeof value === 'object') {
        yaml += `${spaces}${key}:\n${jsonToYaml(value, indent + 1)}`;
      } else {
        yaml += `${spaces}${key}: ${formatValue(value)}\n`;
      }
    });
  }

  return yaml;
}

function formatValue(value) {
  if (typeof value === 'string') {
    // Escape strings with special characters or multi-line
    if (value.includes('\n') || value.includes(':') || value.includes('#')) {
      return `"${value.replace(/"/g, '\\"')}"`;
    }
    return value;
  }
  return value;
}

console.log('📡 Fetching OpenAPI specification...');
console.log(`URL: ${API_URL}/api-json\n`);

http.get(`${API_URL}/api-json`, (res) => {
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    if (res.statusCode === 200) {
      try {
        const spec = JSON.parse(data);
        
        // Write JSON version (backup)
        fs.writeFileSync(OUTPUT_FILE_JSON, JSON.stringify(spec, null, 2));
        
        // Convert to YAML and write (required by assignment)
        const yaml = jsonToYaml(spec);
        fs.writeFileSync(OUTPUT_FILE_YML, yaml);
        
        console.log('✅ OpenAPI specification exported successfully!');
        console.log(`📄 YAML File: ${OUTPUT_FILE_YML} (Assignment requirement)`);
        console.log(`📄 JSON File: ${OUTPUT_FILE_JSON} (Backup)`);
        console.log(`📊 Endpoints: ${Object.keys(spec.paths).length}`);
        console.log(`🏷️  Tags: ${spec.tags?.length || 0}\n`);
        
        // Summary
        const paths = Object.keys(spec.paths);
        const methods = paths.reduce((acc, path) => {
          const pathMethods = Object.keys(spec.paths[path]);
          return acc + pathMethods.length;
        }, 0);
        
        console.log('Summary:');
        console.log(`  Total Paths: ${paths.length}`);
        console.log(`  Total Operations: ${methods}`);
        console.log(`  OpenAPI Version: ${spec.openapi}`);
        console.log(`  API Title: ${spec.info.title}`);
        console.log(`  API Version: ${spec.info.version}\n`);
        
        process.exit(0);
      } catch (error) {
        console.error('❌ Error parsing JSON:', error.message);
        process.exit(1);
      }
    } else {
      console.error(`❌ HTTP ${res.statusCode}: Failed to fetch specification`);
      console.error('Make sure the application is running on', API_URL);
      process.exit(1);
    }
  });
}).on('error', (error) => {
  console.error('❌ Connection error:', error.message);
  console.error('Make sure the application is running on', API_URL);
  process.exit(1);
});
