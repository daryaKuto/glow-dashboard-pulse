const newman = require('newman');
const path = require('path');

console.log('🚀 Starting ThingsBoard API tests with Newman...\n');

// Test the ThingsBoard collection
newman.run({
  collection: require('./ThingsBoard_API_Collection.json'),
  environment: require('./ThingsBoard_Environment.json'),
  reporters: ['cli', 'json', 'html'],
  reporter: {
    json: {
      export: './test-results.json'
    },
    html: {
      export: './test-results.html'
    }
  },
  iterationCount: 1,
  delayRequest: 1000, // 1 second delay between requests
  timeout: 10000, // 10 second timeout
  bail: false, // Continue on failures
  verbose: true
}, function (err, summary) {
  if (err) {
    console.error('❌ Collection run failed:', err);
    process.exit(1);
  } else {
    console.log('\n🎉 Collection run completed successfully!');
    console.log('\n📊 Test Summary:');
    console.log(`   Total Requests: ${summary.run.stats.requests.total}`);
    console.log(`   Failed Requests: ${summary.run.stats.requests.failed}`);
    console.log(`   Successful Requests: ${summary.run.stats.requests.passed}`);
    console.log(`   Total Test Scripts: ${summary.run.stats.testScripts.total}`);
    console.log(`   Failed Test Scripts: ${summary.run.stats.testScripts.failed}`);
    console.log(`   Successful Test Scripts: ${summary.run.stats.testScripts.passed}`);
    
    if (summary.run.stats.requests.failed > 0) {
      console.log('\n⚠️  Some requests failed. Check the test results for details.');
      process.exit(1);
    } else {
      console.log('\n✅ All tests passed successfully!');
    }
  }
}); 