import { http, HttpResponse, delay } from 'msw';
import { DefaultBodyType } from 'msw';

// Reduced delays for better development experience
const FAST_DELAY = 100; // Reduced from 500ms
const MEDIUM_DELAY = 200; // Reduced from 300ms

// Sample data
let targets = [
  { id: 1, name: 'Target Alpha', status: 'online', battery: 95, roomId: 1, backgroundColor: 'bg-blue-100', type: 'standard', hits: 127, accuracy: 89, lastSeen: new Date().toISOString() },
  { id: 2, name: 'Target Beta', status: 'online', battery: 78, roomId: 1, backgroundColor: 'bg-green-100', type: 'moving', hits: 203, accuracy: 92, lastSeen: new Date().toISOString() },
  { id: 3, name: 'Target Gamma', status: 'offline', battery: 12, roomId: 2, backgroundColor: 'bg-purple-100', type: 'precision', hits: 89, accuracy: 95, lastSeen: new Date(Date.now() - 86400000).toISOString() },
  { id: 4, name: 'Target Delta', status: 'online', battery: 65, roomId: null, backgroundColor: 'bg-orange-100', type: 'standard', hits: 45, accuracy: 78, lastSeen: new Date().toISOString() },
  { id: 5, name: 'Target Echo', status: 'online', battery: 92, roomId: 3, backgroundColor: 'bg-pink-100', type: 'moving', hits: 156, accuracy: 88, lastSeen: new Date().toISOString() },
  { id: 6, name: 'Target Foxtrot', status: 'online', battery: 68, roomId: 3, backgroundColor: 'bg-teal-100', type: 'precision', hits: 234, accuracy: 97, lastSeen: new Date().toISOString() }
];

let rooms = [
  { id: 1, name: 'Training Room A', order: 1, targetCount: 2 },
  { id: 2, name: 'Practice Zone B', order: 2, targetCount: 1 },
  { id: 3, name: 'Quick Draw Arena', order: 3, targetCount: 2 },
  { id: 4, name: 'Precision Range', order: 4, targetCount: 0 },
  { id: 5, name: 'Speed Training Bay', order: 5, targetCount: 0 }
];

let scenarios = [
  { id: 1, name: 'Quick Training', difficulty: 'beginner', duration: 10, description: 'Basic target practice for beginners' },
  { id: 2, name: 'Speed Challenge', difficulty: 'intermediate', duration: 15, description: 'Fast-paced target engagement' },
  { id: 3, name: 'Precision Master', difficulty: 'advanced', duration: 20, description: 'High-accuracy target practice' },
  { id: 4, name: 'Moving Targets', difficulty: 'intermediate', duration: 12, description: 'Practice with moving targets' },
  { id: 5, name: 'Multi-Target Rush', difficulty: 'advanced', duration: 18, description: 'Multiple targets in sequence' }
];

let sessions = [
  { id: 1, name: 'Morning Practice', date: new Date().toISOString(), duration: 1200, score: 850, accuracy: 78, scenarioId: 1, roomIds: [1, 2], hits: 42, misses: 12 },
  { id: 2, name: 'Speed Training', date: new Date(Date.now() - 86400000).toISOString(), duration: 1800, score: 920, accuracy: 85, scenarioId: 2, roomIds: [3], hits: 65, misses: 11 },
  { id: 3, name: 'Precision Session', date: new Date(Date.now() - 2 * 86400000).toISOString(), duration: 1500, score: 780, accuracy: 92, scenarioId: 3, roomIds: [2], hits: 38, misses: 3 },
  { id: 4, name: 'Weekend Challenge', date: new Date(Date.now() - 3 * 86400000).toISOString(), duration: 2400, score: 1100, accuracy: 88, scenarioId: 4, roomIds: [1, 3], hits: 89, misses: 12 },
  { id: 5, name: 'Advanced Training', date: new Date(Date.now() - 4 * 86400000).toISOString(), duration: 2000, score: 950, accuracy: 91, scenarioId: 5, roomIds: [1, 2, 3], hits: 72, misses: 7 }
];

let roomLayouts = {
  1: {
    targets: [
      { id: 1, x: 100, y: 100 },
      { id: 2, x: 250, y: 150 }
    ],
    groups: [
      { id: 1, name: 'Enemy 1', targetIds: [1, 2] }
    ]
  },
  2: {
    targets: [
      { id: 3, x: 200, y: 200 }
    ],
    groups: []
  }
};

let currentSession = null;
let invites = [];
let friends = [];

// Generate 200 fake users for search
const mockUsers = Array.from({ length: 200 }, (_, i) => {
  const id = `user-${i + 1}`;
  const firstName = ['Alex', 'Jordan', 'Taylor', 'Casey', 'Morgan', 'Riley', 'Jamie', 'Quinn', 'Avery', 'Cameron'][Math.floor(Math.random() * 10)];
  const lastName = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Miller', 'Davis', 'Garcia', 'Rodriguez', 'Wilson'][Math.floor(Math.random() * 10)];
  const name = `${firstName} ${lastName}`;
  const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}${Math.floor(Math.random() * 100)}@example.com`;
  const phone = `+1${Math.floor(Math.random() * 1000000000).toString().padStart(10, '0')}`;
  const score = Math.floor(Math.random() * 1000);
  
  return {
    id,
    name,
    email,
    phone,
    score,
    avatar: `https://i.pravatar.cc/150?u=${id}`
  };
});

// Define types for request bodies
interface TargetUpdateBody {
  name?: string;
  roomId?: number | null;
  locate?: boolean;
}

interface RoomCreateBody {
  name: string;
}

interface RoomUpdateBody {
  name?: string;
}

interface RoomOrderBody {
  roomIds: number[];
}

interface SessionCreateBody {
  scenarioId: number;
  roomIds: number[];
}

interface InviteCreateBody {
  sessionId: number;
}

interface PhoneVerificationBody {
  phone: string;
}

interface OtpVerifyBody {
  phone: string;
  token: string;
}

interface TargetLayout {
  id: number;
  x: number;
  y: number;
}

interface TargetGroup {
  id: number;
  name: string;
  targetIds: number[];
}

interface RoomLayoutBody {
  targets?: TargetLayout[];
  groups?: TargetGroup[];
}

// Handlers for mock API endpoints
export const handlers = [
  // Stats
  http.get('/stats/targets', async () => {
    await delay(FAST_DELAY);
    return HttpResponse.json({
      total: targets.length,
      online: targets.filter(t => t.status === 'online').length
    });
  }),
  
  http.get('/stats/rooms', async () => {
    await delay(FAST_DELAY);
    return HttpResponse.json({
      count: rooms.length
    });
  }),
  
  http.get('/stats/scenarios', async () => {
    await delay(FAST_DELAY);
    return HttpResponse.json({
      count: scenarios.length
    });
  }),
  
  http.get('/stats/hits', async () => {
    await delay(FAST_DELAY);
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
    await delay(FAST_DELAY);
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
    await delay(FAST_DELAY);
    return HttpResponse.json(targets);
  }),
  
  http.post('/targets', async ({ request }) => {
    await delay(FAST_DELAY);
    try {
      const body = await request.json() as any;
      
      // Generate random pastel background color
      const pastelColors = [
        'bg-pink-100', 'bg-purple-100', 'bg-indigo-100', 'bg-blue-100', 'bg-cyan-100',
        'bg-teal-100', 'bg-emerald-100', 'bg-green-100', 'bg-lime-100', 'bg-yellow-100',
        'bg-orange-100', 'bg-red-100', 'bg-rose-100', 'bg-slate-100', 'bg-gray-100',
        'bg-zinc-100', 'bg-neutral-100', 'bg-stone-100', 'bg-amber-100', 'bg-violet-100'
      ];
      const randomColor = pastelColors[Math.floor(Math.random() * pastelColors.length)];
      
      // Generate random target type
      const targetTypes = ['standard', 'moving', 'precision'];
      const randomType = targetTypes[Math.floor(Math.random() * targetTypes.length)];
      
      const newTarget = {
        id: Math.max(...targets.map(t => t.id), 0) + 1,
        name: body.name || `Target ${Math.max(...targets.map(t => t.id), 0) + 1}`,
        roomId: body.roomId || null,
        status: 'online',
        battery: Math.floor(Math.random() * 100) + 1,
        backgroundColor: randomColor,
        type: randomType,
        hits: 0,
        accuracy: 0,
        lastSeen: new Date().toISOString()
      };
      
      targets = [...targets, newTarget];
      
      // Update room target count if assigned to a room
      if (newTarget.roomId) {
        updateRoomTargetCounts();
      }
      
      return HttpResponse.json(newTarget, { status: 201 });
    } catch (error) {
      return new HttpResponse(null, { status: 400 });
    }
  }),
  
  http.put('/targets/:id', async ({ params, request }) => {
    await delay(FAST_DELAY);
    const { id } = params;
    const targetId = Number(id);
    
    try {
      const body = await request.json() as TargetUpdateBody;
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
    await delay(FAST_DELAY);
    return HttpResponse.json(rooms);
  }),
  
  http.post('/rooms', async ({ request }) => {
    await delay(FAST_DELAY);
    try {
      const body = await request.json() as RoomCreateBody;
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
    await delay(FAST_DELAY);
    const { id } = params;
    const roomId = Number(id);
    
    try {
      const body = await request.json() as RoomUpdateBody;
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
    await delay(FAST_DELAY);
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
    await delay(FAST_DELAY);
    try {
      const body = await request.json() as RoomOrderBody;
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
      const body = await request.json() as SessionCreateBody;
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
      const body = await request.json() as InviteCreateBody;
      
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
  }),
  
  // User Search endpoint
  http.get('/search/users', async ({ request }) => {
    await delay(MEDIUM_DELAY);
    const url = new URL(request.url);
    const query = url.searchParams.get('query')?.toLowerCase() || '';
    
    if (!query || query.length < 3) {
      return HttpResponse.json([], { status: 200 });
    }
    
    const results = mockUsers
      .filter(user => 
        user.name.toLowerCase().includes(query) || 
        user.email.toLowerCase().includes(query) || 
        user.phone.includes(query)
      )
      .slice(0, 10);
    
    return HttpResponse.json(results, { status: 200 });
  }),
  
  // Friends endpoints
  http.get('/friends', async () => {
    await delay(200);
    return HttpResponse.json(friends, { status: 200 });
  }),
  
  http.post('/friends/:id', async ({ params }) => {
    await delay(MEDIUM_DELAY);
    const { id } = params;
    const userId = id.toString();
    
    // Find the user
    const user = mockUsers.find(u => u.id === userId);
    
    if (!user) {
      return new HttpResponse(null, { status: 404 });
    }
    
    // Check if already a friend
    const existingFriend = friends.find(f => f.id === userId);
    
    if (existingFriend) {
      return HttpResponse.json({ status: existingFriend.status }, { status: 200 });
    }
    
    // Add as friend with pending status
    const newFriend = { 
      ...user, 
      status: 'pending',
      addedAt: new Date().toISOString()
    };
    
    friends.push(newFriend);
    
    // Auto-accept after a delay for demo purposes
    setTimeout(() => {
      const friendIndex = friends.findIndex(f => f.id === userId);
      if (friendIndex !== -1) {
        friends[friendIndex].status = 'accepted';
      }
    }, 2000);
    
    return HttpResponse.json({ status: 'pending' }, { status: 200 });
  }),
  
  // Phone verification endpoints
  http.post('/auth/phone/verify', async ({ request }) => {
    await delay(FAST_DELAY);
    try {
      const body = await request.json() as PhoneVerificationBody;
      
      if (!body.phone || !/^\+[1-9]\d{1,14}$/.test(body.phone)) {
        return new HttpResponse(
          JSON.stringify({ error: 'Invalid phone number format. Use E.164 format: +1234567890' }), 
          { status: 400 }
        );
      }
      
      // In a real app, this would trigger an SMS. For mock, we'll just return success
      return HttpResponse.json({ 
        success: true,
        message: 'OTP sent successfully',
        expiry: new Date(Date.now() + 10 * 60 * 1000).toISOString() // 10 minute expiry
      });
    } catch (error) {
      return new HttpResponse(null, { status: 400 });
    }
  }),
  
  http.post('/auth/phone/confirm', async ({ request }) => {
    await delay(FAST_DELAY);
    try {
      const body = await request.json() as OtpVerifyBody;
      
      if (!body.phone || !body.token) {
        return new HttpResponse(
          JSON.stringify({ error: 'Phone number and token are required' }), 
          { status: 400 }
        );
      }
      
      // For mock, any 6-digit code is valid
      if (!/^\d{6}$/.test(body.token)) {
        return new HttpResponse(
          JSON.stringify({ error: 'Invalid OTP format. Must be 6 digits.' }), 
          { status: 400 }
        );
      }
      
      return HttpResponse.json({
        success: true,
        user: {
          phone: body.phone,
          phone_verified: true
        }
      });
    } catch (error) {
      return new HttpResponse(null, { status: 400 });
    }
  }),
  
  // Room Layout endpoints
  http.get('/rooms/:id/layout', async ({ params }) => {
    await delay(MEDIUM_DELAY);
    const { id } = params;
    const roomId = Number(id);
    
    // Return default empty layout if not found
    if (!roomLayouts[roomId]) {
      roomLayouts[roomId] = {
        targets: [],
        groups: []
      };
    }
    
    return HttpResponse.json(roomLayouts[roomId]);
  }),
  
  http.put('/rooms/:id/layout', async ({ params, request }) => {
    await delay(MEDIUM_DELAY);
    const { id } = params;
    const roomId = Number(id);
    
    try {
      const body = await request.json() as RoomLayoutBody;
      
      // Create layout if it doesn't exist
      if (!roomLayouts[roomId]) {
        roomLayouts[roomId] = {
          targets: [],
          groups: []
        };
      }
      
      // Update layout with new data
      if (body.targets) {
        roomLayouts[roomId].targets = body.targets;
      }
      
      if (body.groups) {
        roomLayouts[roomId].groups = body.groups;
      }
      
      return HttpResponse.json(roomLayouts[roomId]);
    } catch (error) {
      return new HttpResponse(null, { status: 400 });
    }
  }),
  
  http.put('/rooms/:id/groups', async ({ params, request }) => {
    await delay(MEDIUM_DELAY);
    const { id } = params;
    const roomId = Number(id);
    
    try {
      const body = await request.json() as { groups: TargetGroup[] };
      
      // Create layout if it doesn't exist
      if (!roomLayouts[roomId]) {
        roomLayouts[roomId] = {
          targets: [],
          groups: []
        };
      }
      
      // Update groups
      roomLayouts[roomId].groups = body.groups;
      
      return HttpResponse.json(roomLayouts[roomId]);
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
