
import { BaseDb } from './BaseDb';
import bcrypt from 'bcryptjs';

export class AuthDb extends BaseDb {
  async signUp(email: string, password: string, userData?: { full_name?: string }) {
    if (this.db.users.find(u => u.email === email)) {
      throw new Error('User already exists');
    }
    
    const id = `u${Date.now()}`;
    const hash = await bcrypt.hash(password, 10);
    
    this.db.users.push({
      id,
      email,
      pass: hash,
      name: userData?.full_name || '',
      phone: ''
    });
    
    this.persist();
    
    const { pass, ...user } = this.db.users.find(u => u.id === id)!;
    return { user };
  }
  
  async signIn(email: string, password: string) {
    const user = this.db.users.find(u => u.email === email);
    
    if (!user) {
      throw new Error('Invalid email or password');
    }
    
    const isValid = await bcrypt.compare(password, user.pass);
    
    if (!isValid) {
      throw new Error('Invalid email or password');
    }
    
    const { pass, ...userData } = user;
    return { user: userData };
  }
  
  signOut() {
    return;
  }
  
  updateUser(id: string, data: any) {
    const index = this.db.users.findIndex(u => u.id === id);
    if (index === -1) {
      throw new Error('User not found');
    }
    
    this.db.users[index] = { ...this.db.users[index], ...data };
    this.persist();
    
    const { pass, ...userData } = this.db.users[index];
    return { user: userData };
  }
}
