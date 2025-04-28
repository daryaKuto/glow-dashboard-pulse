
import { seed } from '../staticData';
import { AuthDb } from './db/AuthDb';
import { TargetsDb } from './db/TargetsDb';
import { RoomsDb } from './db/RoomsDb';
import { StatsDb } from './db/StatsDb';
import { SessionsDb } from './db/SessionsDb';
import { WebSocketDb } from './db/WebSocketDb';

class StaticDb extends WebSocketDb {
  private authDb = new AuthDb();
  private targetsDb = new TargetsDb();
  private roomsDb = new RoomsDb();
  private statsDb = new StatsDb();
  private sessionsDb = new SessionsDb();

  // Auth methods
  signUp = this.authDb.signUp.bind(this.authDb);
  signIn = this.authDb.signIn.bind(this.authDb);
  signOut = this.authDb.signOut.bind(this.authDb);
  updateUser = this.authDb.updateUser.bind(this.authDb);

  // Targets methods
  getTargets = this.targetsDb.getTargets.bind(this.targetsDb);
  renameTarget = this.targetsDb.renameTarget.bind(this.targetsDb);
  assignRoom = this.targetsDb.assignRoom.bind(this.targetsDb);
  deleteTarget = this.targetsDb.deleteTarget.bind(this.targetsDb);

  // Rooms methods
  getRooms = this.roomsDb.getRooms.bind(this.roomsDb);
  createRoom = this.roomsDb.createRoom.bind(this.roomsDb);
  updateRoom = this.roomsDb.updateRoom.bind(this.roomsDb);
  deleteRoom = this.roomsDb.deleteRoom.bind(this.roomsDb);
  updateRoomOrder = this.roomsDb.updateRoomOrder.bind(this.roomsDb);
  getRoomLayout = this.roomsDb.getRoomLayout.bind(this.roomsDb);
  saveRoomLayout = this.roomsDb.saveRoomLayout.bind(this.roomsDb);

  // Stats methods
  getStats = this.statsDb.getStats.bind(this.statsDb);
  getHitStats = this.statsDb.getHitStats.bind(this.statsDb);
  getHits7d = this.statsDb.getHits7d.bind(this.statsDb);
  simulateHits = this.statsDb.simulateHits.bind(this.statsDb);

  // Sessions methods
  getScenarios = this.sessionsDb.getScenarios.bind(this.sessionsDb);
  getSessions = this.sessionsDb.getSessions.bind(this.sessionsDb);
  startSession = this.sessionsDb.startSession.bind(this.sessionsDb);
  endSession = this.sessionsDb.endSession.bind(this.sessionsDb);
}

export const staticDb = new StaticDb();
