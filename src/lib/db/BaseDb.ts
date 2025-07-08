
// BaseDb is deprecated - using API client instead
export class BaseDb {
  protected db: any = {};
  private initialized = false;
  
  constructor() {
    // No longer initializing with seed data
    this.initialized = true;
  }
  
  // Initialize the database with seed data
  private async initializeDb() {
    // No-op since we're using API client
    this.initialized = true;
  }
  
  // Ensure the database is initialized before use
  async ensureInitialized() {
    if (!this.initialized) {
      await this.initializeDb();
    }
    return this.initialized;
  }
  
  // Save the current state of the database to localStorage
  protected persist() {
    try {
      localStorage.setItem('staticDb', JSON.stringify(this.db));
    } catch (error) {
      console.error("Error persisting database:", error);
    }
  }
}
