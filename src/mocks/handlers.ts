
import { http, HttpResponse, delay } from 'msw';

// Sample data
let targets = [
  { id: 1, name: 'Target Alpha', status: 'online', battery: 95, roomId: 1 },
  { id: 2, name: 'Target Beta', status: 'online', battery: 78, roomId: 1 },
  { id: 3, name: 'Target Gamma', status: 'offline', battery: 12, roomId: 2 },
  { id: 4, name: 'Target Delta', status: 'online', battery: 65, roomId: null }
];

let rooms = [
  { id: 1, name: 'Living Room', order: 1, targetCount: 2 },
  { id: 2, name: 'Garage', order: 2, targetCount: 1 }
];

let scenarios = [
  { id: 1, name: 'Quick Training', difficulty: 'beginner', duration: 10 },
  { id: 2, name: 'Accuracy Focus', difficulty: 'intermediate', duration: 15 },
  { id: 3, name: 'Speed Run', difficulty: 'advanced', duration: 20 }
];

let sessions = [
  { id: 1, name: 'Morning Practice', date: '2023-04-25T09:00:00Z', duration: 15, score: 87, accuracy: 75 },
  { id: 2, name: 'Evening Challenge', date: '2023-04-22T18:30:00Z', duration: 20, score: 95, accuracy: 88 },
  { id: 3, name: 'Weekend Training', date: '2023-04-18T11:15:00Z', duration: 30, score: 72, accuracy: 65 }
];

let currentSession = null;
let invites = [];

// Handlers for mock API endpoints
export const handlers = [
  // Stats
  http.get('/stats/targets', async () => {
    await delay(500);
    return HttpResponse.json({
      total: targets.length,
      online: targets.filter(t => t.status === 'online').length
    });
  }),
  
  http.get('/stats/rooms', async () => {
    await delay(500);
    return HttpResponse.json({
      count: rooms.length
    });
  }),
  
  http.get('/stats/scenarios', async () => {
    await delay(500);
    return HttpResponse.json({
      count: scenarios.length
    });
  }),
  
  http.get('/stats/hits', async () => {
    await delay(500);
    // Generate 7 days of hit data
    return HttpResponse.json(
      Array.from({ length: 7 }, (_, i) => {
        const date = new Date();
        date.setDate(date.getDate() - (6 - i));
        return { 
          date: date.toISOString().split('T')[0], 
          hits: Math.floor(Math.random() * 100)
        };
      })
    );
  }),
  
  http.get('/sessions/latest', async () => {
    await delay(500);
    const latestSession = sessions[0];
    return HttpResponse.json({
      id: latestSession.id,
      name: latestSession.name,
      date: latestSession.date,
      score: latestSession.score
    });
  }),
  
  // Targets
  http.get('/targets', async () => {
    await delay(500);
    return HttpResponse.json(targets);
  }),
  
  http.put('/targets/:id', async ({ params, request }) => {
    await delay(500);
    const { id } = params;
    const targetId = Number(id);
    
    try {
      const body = await request.json();
      const targetIndex = targets.findIndex(t => t.id === targetId);
      
      if (targetIndex === -1) {
        return new HttpResponse(null, { status: 404 });
      }
      
      if (body.name) {
        targets[targetIndex] = { ...targets[targetIndex], name: body.name };
      }
      
      if (body.roomId !== undefined) {
        targets[targetIndex] = { ...targets[targetIndex], roomId: body.roomId };
        
        // Update room target counts
        updateRoomTargetCounts();
      }
      
      return HttpResponse.json(targets[targetIndex]);
    } catch (error) {
      return new HttpResponse(null, { status: 400 });
    }
  }),
  
  // Rooms
  http.get('/rooms', async () => {
    await delay(500);
    return HttpResponse.json(rooms);
  }),
  
  http.post('/rooms', async ({ request }) => {
    await delay(500);
    try {
      const body = await request.json() as { name: string };
      const newRoom = {
        id: Math.max(...rooms.map(r => r.id), 0) + 1,
        name: body.name,
        order: rooms.length + 1,
        targetCount: 0
      };
      
      rooms = [...rooms, newRoom];
      return HttpResponse.json(newRoom, { status: 201 });
    } catch (error) {
      return new HttpResponse(null, { status: 400 });
    }
  }),
  
  http.put('/rooms/:id', async ({ params, request }) => {
    await delay(500);
    const { id } = params;
    const roomId = Number(id);
    
    try {
      const body = await request.json() as { name?: string };
      const roomIndex = rooms.findIndex(r => r.id === roomId);
      
      if (roomIndex === -1) {
        return new HttpResponse(null, { status: 404 });
      }
      
      rooms[roomIndex] = { ...rooms[roomIndex], ...body };
      return HttpResponse.json(rooms[roomIndex]);
    } catch (error) {
      return new HttpResponse(null, { status: 400 });
    }
  }),
  
  http.delete('/rooms/:id', async ({ params }) => {
    await delay(500);
    const { id } = params;
    const roomId = Number(id);
    
    // Remove room
    rooms = rooms.filter(r => r.id !== roomId);
    
    // Unassign targets in that room
    targets = targets.map(t => t.roomId === roomId ? { ...t, roomId: null } : t);
    
    // Update order of remaining rooms
    rooms = rooms.map((room, i) => ({ ...room, order: i + 1 }));
    
    return new HttpResponse(null, { status: 204 });
  }),
  
  http.put('/rooms/order', async ({ request }) => {
    await delay(500);
    try {
      const body = await request.json() as { roomIds: number[] };
      const { roomIds } = body;
      
      roomIds.forEach((roomId, index) => {
        const room = rooms.find(r => r.id === roomId);
        if (room) {
          room.order = index + 1;
        }
      });
      
      // Sort rooms by their order
      rooms.sort((a, b) => a.order - b.order);
      
      return HttpResponse.json(rooms);
    } catch (error) {
      return new HttpResponse(null, { status: 400 });
    }
  }),
  
  // Sessions
  http.get('/sessions', async () => {
    await delay(500);
    return HttpResponse.json(sessions);
  }),
  
  http.post('/sessions', async ({ request }) => {
    await delay(500);
    try {
      const body = await request.json() as { scenarioId: number, roomIds: number[] };
      const scenario = scenarios.find(s => s.id === body.scenarioId);
      
      if (!scenario) {
        return new HttpResponse(null, { status: 404, statusText: 'Scenario not found' });
      }
      
      const now = new Date();
      const newSession = {
        id: Math.max(...sessions.map(s => s.id), 0) + 1,
        name: scenario.name,
        date: now.toISOString(),
        duration: scenario.duration,
        score: 0,
        accuracy: 0
      };
      
      // Set as current session
      currentSession = { ...newSession };
      
      // Add to sessions list
      sessions = [newSession, ...sessions];
      
      return HttpResponse.json(newSession, { status: 201 });
    } catch (error) {
      return new HttpResponse(null, { status: 400 });
    }
  }),
  
  http.post('/sessions/:id/end', async ({ params }) => {
    await delay(500);
    const { id } = params;
    const sessionId = Number(id);
    
    if (!currentSession || currentSession.id !== sessionId) {
      return new HttpResponse(null, { status: 404, statusText: 'No active session found' });
    }
    
    // Calculate final score and accuracy
    const finalScore = Math.floor(Math.random() * 50) + 50; // 50-100
    const finalAccuracy = Math.floor(Math.random() * 40) + 60; // 60-100
    
    // Update session with final results
    sessions = sessions.map(s => 
      s.id === sessionId
        ? { ...s, score: finalScore, accuracy: finalAccuracy }
        : s
    );
    
    // Clear current session
    const endedSession = { ...currentSession, score: finalScore, accuracy: finalAccuracy };
    currentSession = null;
    
    return HttpResponse.json(endedSession);
  }),
  
  // Invites
  http.get('/invites/pending', async () => {
    await delay(500);
    return HttpResponse.json(invites);
  }),
  
  http.post('/invites', async ({ request }) => {
    await delay(500);
    try {
      const body = await request.json() as { sessionId: number };
      
      if (!currentSession || currentSession.id !== body.sessionId) {
        return new HttpResponse(null, { status: 404, statusText: 'No active session found' });
      }
      
      // Generate a random token
      const token = Math.random().toString(36).substring(2, 10);
      
      // Add to invites
      invites.push({
        id: Math.max(...invites.map(i => i.id || 0), 0) + 1,
        token,
        sessionId: body.sessionId,
        createdAt: new Date().toISOString()
      });
      
      return HttpResponse.json({ token });
    } catch (error) {
      return new HttpResponse(null, { status: 400 });
    }
  })
];

// Helper to update room target counts
function updateRoomTargetCounts() {
  // Reset all counts
  rooms = rooms.map(room => ({ ...room, targetCount: 0 }));
  
  // Count targets in each room
  targets.forEach(target => {
    if (target.roomId) {
      const roomIndex = rooms.findIndex(r => r.id === target.roomId);
      if (roomIndex !== -1) {
        rooms[roomIndex].targetCount += 1;
      }
    }
  });
}
