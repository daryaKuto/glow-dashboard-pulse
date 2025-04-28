
import { seed } from '../../staticData';

export class BaseDb {
  protected db: any = {};
  private initialized = false;
  
  constructor() {
    this.initializeDb();
  }
  
  // Initialize the database with seed data
  private async initializeDb() {
    try {
      this.db = await seed();
      this.initialized = true;
      console.log("Database initialized with seed data:", this.db);
    } catch (error) {
      console.error("Error initializing database:", error);
    }
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
