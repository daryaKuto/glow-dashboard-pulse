
import { http, HttpResponse } from 'msw';

// Mock data
const targets = [
  { id: 1, name: "Target 1", roomId: 1, status: "online", battery: 87 },
  { id: 2, name: "Target 2", roomId: 1, status: "online", battery: 62 },
  { id: 3, name: "Target 3", roomId: 2, status: "offline", battery: 24 },
  { id: 4, name: "Target 4", roomId: null, status: "online", battery: 95 }
];

const rooms = [
  { id: 1, name: "Living Room", order: 1, targetCount: 2 },
  { id: 2, name: "Garage", order: 2, targetCount: 1 }
];

const sessions = [
  { 
    id: 1, 
    name: "Morning Practice", 
    date: "2025-04-26T08:30:00", 
    duration: 25, 
    score: 89, 
    accuracy: 78 
  },
  { 
    id: 2, 
    name: "Team Challenge", 
    date: "2025-04-25T14:45:00", 
    duration: 40, 
    score: 95, 
    accuracy: 82 
  },
  { 
    id: 3, 
    name: "Quick Round", 
    date: "2025-04-23T19:20:00", 
    duration: 15, 
    score: 76, 
    accuracy: 68 
  }
];

const scenarios = [
  { id: 1, name: "Standard Target Practice", difficulty: "beginner" },
  { id: 2, name: "Moving Targets", difficulty: "intermediate" },
  { id: 3, name: "Speed Challenge", difficulty: "advanced" },
  { id: 4, name: "Accuracy Test", difficulty: "expert" }
];

export const handlers = [
  // Original handlers
  http.get('https://api.fungun.dev/stats/targets', () => {
    return HttpResponse.json({ online: 4, total: 6 });
  }),

  http.get('https://api.fungun.dev/stats/rooms', () => {
    return HttpResponse.json({ count: 3 });
  }),

  http.get('https://api.fungun.dev/stats/scenarios', () => {
    return HttpResponse.json({ count: 12 });
  }),

  http.get('https://api.fungun.dev/sessions/latest', () => {
    return HttpResponse.json({ score: 91, accuracy: 86 });
  }),

  http.get('https://api.fungun.dev/invites/pending', () => {
    return HttpResponse.json([
      { id: 1, from: "Alex" },
      { id: 2, from: "Sarah" }
    ]);
  }),

  http.get('https://api.fungun.dev/stats/hits', () => {
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    return HttpResponse.json(
      days.map(day => ({
        date: day,
        hits: Math.floor(Math.random() * 100)
      }))
    );
  }),

  // New handlers for Milestone 4
  
  // Targets endpoints
  http.get('https://api.fungun.dev/targets', () => {
    return HttpResponse.json(targets);
  }),

  http.put('https://api.fungun.dev/targets/:id', async ({ params, request }) => {
    const { id } = params;
    const body = await request.json();
    const targetIndex = targets.findIndex(t => t.id === Number(id));
    
    if (targetIndex === -1) {
      return new HttpResponse(null, { status: 404 });
    }
    
    targets[targetIndex] = { ...targets[targetIndex], ...body };
    return HttpResponse.json(targets[targetIndex]);
  }),

  // Rooms endpoints
  http.get('https://api.fungun.dev/rooms', () => {
    return HttpResponse.json(rooms);
  }),

  http.post('https://api.fungun.dev/rooms', async ({ request }) => {
    const body = await request.json();
    const newRoom = {
      id: rooms.length + 1,
      name: body.name,
      order: rooms.length + 1,
      targetCount: 0
    };
    rooms.push(newRoom);
    return HttpResponse.json(newRoom);
  }),

  http.put('https://api.fungun.dev/rooms/:id', async ({ params, request }) => {
    const { id } = params;
    const body = await request.json();
    const roomIndex = rooms.findIndex(r => r.id === Number(id));
    
    if (roomIndex === -1) {
      return new HttpResponse(null, { status: 404 });
    }
    
    rooms[roomIndex] = { ...rooms[roomIndex], ...body };
    return HttpResponse.json(rooms[roomIndex]);
  }),

  http.delete('https://api.fungun.dev/rooms/:id', ({ params }) => {
    const { id } = params;
    const roomIndex = rooms.findIndex(r => r.id === Number(id));
    
    if (roomIndex === -1) {
      return new HttpResponse(null, { status: 404 });
    }
    
    rooms.splice(roomIndex, 1);
    return new HttpResponse(null, { status: 204 });
  }),

  http.put('https://api.fungun.dev/rooms/order', async ({ request }) => {
    const body = await request.json();
    body.forEach(item => {
      const room = rooms.find(r => r.id === item.id);
      if (room) {
        room.order = item.order;
      }
    });
    return HttpResponse.json(rooms);
  }),

  // Sessions endpoints
  http.get('https://api.fungun.dev/sessions', () => {
    return HttpResponse.json(sessions);
  }),

  http.post('https://api.fungun.dev/sessions', async ({ request }) => {
    const body = await request.json();
    const newSession = {
      id: sessions.length + 1,
      name: body.name || `Session ${sessions.length + 1}`,
      date: new Date().toISOString(),
      duration: 0,
      score: 0,
      accuracy: 0
    };
    sessions.push(newSession);
    return HttpResponse.json(newSession);
  }),

  http.post('https://api.fungun.dev/sessions/:id/end', ({ params }) => {
    const { id } = params;
    const sessionIndex = sessions.findIndex(s => s.id === Number(id));
    
    if (sessionIndex === -1) {
      return new HttpResponse(null, { status: 404 });
    }
    
    // Update session with final stats
    sessions[sessionIndex].duration = Math.floor(Math.random() * 40) + 10;
    sessions[sessionIndex].score = Math.floor(Math.random() * 30) + 70;
    sessions[sessionIndex].accuracy = Math.floor(Math.random() * 25) + 65;
    
    return HttpResponse.json(sessions[sessionIndex]);
  }),

  // Invites endpoints
  http.post('https://api.fungun.dev/invites', () => {
    // Generate a random token
    const token = Math.random().toString(36).substring(2, 15);
    return HttpResponse.json({ token });
  }),

  // Scenarios endpoints
  http.get('https://api.fungun.dev/scenarios', () => {
    return HttpResponse.json(scenarios);
  }),
];
