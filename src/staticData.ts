export const seed = {
  users: [{
    id: 'u1',
    email: 'demo@fun.com',
    pass: '$2a$10$IoLcGDeGJde.E323dkMcKON6p90I8T3O8XuuMUHWqkjdGKx8GwX72', // "password"
    name: 'Demo User',
    phone: ''
  }],
  targets: [
    { id: 1, name: 'Target 1', roomId: 1, status: 'online', battery: 85 },
    { id: 2, name: 'Target 2', roomId: 1, status: 'online', battery: 92 },
    { id: 3, name: 'Target 3', roomId: 2, status: 'offline', battery: 15 }
  ],
  rooms: [
    { id: 1, name: 'Living Room', order: 1, targetCount: 2 },
    { id: 2, name: 'Bedroom', order: 2, targetCount: 1 },
    { id: 3, name: 'Kitchen', order: 3, targetCount: 0 }
  ],
  layouts: [
    { 
      roomId: 1,
      targets: [
        { id: 1, x: 100, y: 150 },
        { id: 2, x: 300, y: 200 }
      ],
      groups: [
        { id: 1, name: 'Group 1', targetIds: [1, 2] }
      ]
    }
  ],
  groups: [
    { id: 1, roomId: 1, name: 'Group 1', targets: [1, 2] }
  ],
  sessions: [
    { 
      id: 1, 
      name: 'Training Session 1', 
      date: new Date().toISOString(), 
      duration: 30, 
      score: 85, 
      accuracy: 70 
    }
  ],
  players: [
    { userId: 'u1', name: 'Demo User', hits: 42, accuracy: 75 }
  ],
  invites: [],
  scenarios: [
    { id: 1, name: 'Basic Training', difficulty: 'easy' },
    { id: 2, name: 'Advanced Course', difficulty: 'medium' },
    { id: 3, name: 'Expert Challenge', difficulty: 'hard' }
  ],
  hitStats: Array.from({ length: 7 }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - i));
    return { 
      date: date.toISOString().split('T')[0], 
      hits: Math.floor(Math.random() * 100) 
    };
  }),
  friends: [],
  leaderboards: Array.from({ length: 7 }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - i));
    return {
      day: date.toISOString().split('T')[0],
      hits: Math.floor(Math.random() * 100)
    };
  })
};

export type DB = typeof seed;
