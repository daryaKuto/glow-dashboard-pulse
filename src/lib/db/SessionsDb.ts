
import { BaseDb } from './BaseDb';

export class SessionsDb extends BaseDb {
  getScenarios() {
    // Initialize scenarios if they don't exist
    if (!this.db.scenarios) {
      this.db.scenarios = [
        {
          id: 1,
          name: "Quick Training",
          difficulty: "beginner"
        },
        {
          id: 2,
          name: "Speed Challenge",
          difficulty: "intermediate"
        },
        {
          id: 3,
          name: "Precision Master",
          difficulty: "advanced"
        }
      ];
      this.persist();
    }
    return [...this.db.scenarios];
  }
  
  getSessions() {
    return [...this.db.sessions];
  }
  
  startSession(scenarioId: number, includedRoomIds: number[]) {
    const scenario = this.db.scenarios.find(s => s.id === scenarioId);
    if (!scenario) throw new Error('Scenario not found');
    
    const id = this.db.sessions.length > 0 
      ? Math.max(...this.db.sessions.map(s => s.id)) + 1 
      : 1;
      
    const newSession = {
      id,
      name: scenario.name,
      date: new Date().toISOString(),
      duration: 0,
      score: 0,
      accuracy: 0
    };
    
    this.db.sessions.push(newSession);
    this.persist();
    return newSession;
  }
  
  endSession(sessionId: number) {
    const session = this.db.sessions.find(s => s.id === sessionId);
    if (!session) throw new Error('Session not found');
    
    session.duration = Math.floor(Math.random() * 30) + 15;
    session.score = Math.floor(Math.random() * 100) + 50;
    session.accuracy = Math.floor(Math.random() * 40) + 60;
    
    this.persist();
    return session;
  }
}
