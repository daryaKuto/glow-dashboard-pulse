// Script to clear ThingsBoard authentication tokens
console.log('Clearing ThingsBoard authentication tokens...');

// Clear localStorage tokens
localStorage.removeItem('tb_access');
localStorage.removeItem('tb_refresh');

console.log('Tokens cleared. Please refresh the page.'); 