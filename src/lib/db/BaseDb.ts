
import { seed } from '../../staticData';

export class BaseDb {
  protected db: any = null;
  private isInitializing = false;
  private isInitialized = false;
  private initPromise: Promise<any> | null = null;
  
  constructor() {
    this.initDb();
  }
  
  private async initDb() {
    if (this.isInitializing || this.isInitialized) {
      return this.initPromise;
    }
    
    this.isInitializing = true;
    
    this.initPromise = new Promise(async (resolve) => {
      try {
        this.db = await seed();
        this.isInitialized = true;
        console.log('Database initialized', this.db);
        resolve(this.db);
      } catch (error) {
        console.error('Database initialization error:', error);
        // Create fallback empty DB
        this.db = {
          users: [],
          targets: [],
          rooms: [],
          sessions: [],
          stats: {
            targets: { total: 0, online: 0 },
            rooms: { count: 0 },
            sessions: { latest: null }
          },
          chartLeaderboards: []
        };
        this.isInitialized = true;
        resolve(this.db);
      } finally {
        this.isInitializing = false;
      }
    });
    
    return this.initPromise;
  }
  
  async ensureInitialized() {
    if (!this.isInitialized) {
      return this.initPromise;
    }
    return this.db;
  }
  
  protected persist() {
    if (this.isInitialized) {
      localStorage.setItem('staticDb', JSON.stringify(this.db));
    }
  }
  
  protected reset() {
    localStorage.removeItem('staticDb');
    this.isInitialized = false;
    this.initDb();
  }
  
  // Allow access to db for testing purposes
  _getDbForTesting() {
    return this.db;
  }
}
