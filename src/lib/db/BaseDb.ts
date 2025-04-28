
import { seed } from '../../staticData';

export class BaseDb {
  protected db: any;
  private isInitialized = false;
  
  constructor() {
    this.initDb();
  }
  
  private async initDb() {
    this.db = await seed();
    this.isInitialized = true;
    console.log('Database initialized', this.db);
  }
  
  protected persist() {
    if (this.isInitialized) {
      localStorage.setItem('staticDb', JSON.stringify(this.db));
    }
  }
  
  protected reset() {
    localStorage.removeItem('staticDb');
    this.initDb();
  }
}
