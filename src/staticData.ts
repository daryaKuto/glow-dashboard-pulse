
import bcrypt from 'bcryptjs';

// Create initial database
export const createDb = async () => {
  // Create a hash for the test user password
  const testPasswordHash = await bcrypt.hash('Test 12345', 10);
  
  return {
    users: [
      {
        id: 'u1',
        email: 'test_user@example.com',
        pass: testPasswordHash,
        name: 'Test User',
        phone: ''
      }
    ],
    targets: [
      {
        id: 1,
        name: "Smart Target Alpha",
        roomId: 1,
        status: "online",
        battery: 95,
        backgroundColor: "bg-blue-100",
        type: "standard",
        hits: 127,
        accuracy: 89,
        lastSeen: new Date().toISOString()
      },
      {
        id: 2,
        name: "Quick Response Beta",
        roomId: 1,
        status: "online",
        battery: 87,
        backgroundColor: "bg-green-100",
        type: "moving",
        hits: 203,
        accuracy: 92,
        lastSeen: new Date().toISOString()
      },
      {
        id: 3,
        name: "Training Target Gamma",
        roomId: 2,
        status: "online",
        battery: 76,
        backgroundColor: "bg-purple-100",
        type: "precision",
        hits: 89,
        accuracy: 95,
        lastSeen: new Date().toISOString()
      },
      {
        id: 4,
        name: "Practice Target Delta",
        roomId: null,
        status: "offline",
        battery: 15,
        backgroundColor: "bg-orange-100",
        type: "standard",
        hits: 45,
        accuracy: 78,
        lastSeen: new Date(Date.now() - 86400000).toISOString()
      },
      {
        id: 5,
        name: "Speed Target Echo",
        roomId: 3,
        status: "online",
        battery: 92,
        backgroundColor: "bg-pink-100",
        type: "moving",
        hits: 156,
        accuracy: 88,
        lastSeen: new Date().toISOString()
      },
      {
        id: 6,
        name: "Accuracy Target Foxtrot",
        roomId: 3,
        status: "online",
        battery: 68,
        backgroundColor: "bg-teal-100",
        type: "precision",
        hits: 234,
        accuracy: 97,
        lastSeen: new Date().toISOString()
      }
    ],
    rooms: [
      {
        id: 1,
        name: "Training Room A",
        order: 1,
        targetCount: 2
      },
      {
        id: 2,
        name: "Practice Zone B",
        order: 2,
        targetCount: 1
      },
      {
        id: 3,
        name: "Quick Draw Arena",
        order: 3,
        targetCount: 2
      },
      {
        id: 4,
        name: "Precision Range",
        order: 4,
        targetCount: 0
      },
      {
        id: 5,
        name: "Speed Training Bay",
        order: 5,
        targetCount: 0
      }
    ],
    scenarios: [
      {
        id: 1,
        name: "Quick Training",
        difficulty: "beginner",
        duration: 10,
        description: "Basic target practice for beginners"
      },
      {
        id: 2,
        name: "Speed Challenge",
        difficulty: "intermediate",
        duration: 15,
        description: "Fast-paced target engagement"
      },
      {
        id: 3,
        name: "Precision Master",
        difficulty: "advanced",
        duration: 20,
        description: "High-accuracy target practice"
      },
      {
        id: 4,
        name: "Moving Targets",
        difficulty: "intermediate",
        duration: 12,
        description: "Practice with moving targets"
      },
      {
        id: 5,
        name: "Multi-Target Rush",
        difficulty: "advanced",
        duration: 18,
        description: "Multiple targets in sequence"
      }
    ],
    sessions: [
      {
        id: 1,
        name: "Morning Practice",
        date: new Date().toISOString(),
        duration: 1200,
        score: 850,
        accuracy: 78,
        scenarioId: 1,
        roomIds: [1, 2],
        hits: 42,
        misses: 12
      },
      {
        id: 2,
        name: "Speed Training",
        date: new Date(Date.now() - 86400000).toISOString(),
        duration: 1800,
        score: 920,
        accuracy: 85,
        scenarioId: 2,
        roomIds: [3],
        hits: 65,
        misses: 11
      },
      {
        id: 3,
        name: "Precision Session",
        date: new Date(Date.now() - 2 * 86400000).toISOString(),
        duration: 1500,
        score: 780,
        accuracy: 92,
        scenarioId: 3,
        roomIds: [2],
        hits: 38,
        misses: 3
      },
      {
        id: 4,
        name: "Weekend Challenge",
        date: new Date(Date.now() - 3 * 86400000).toISOString(),
        duration: 2400,
        score: 1100,
        accuracy: 88,
        scenarioId: 4,
        roomIds: [1, 3],
        hits: 89,
        misses: 12
      },
      {
        id: 5,
        name: "Advanced Training",
        date: new Date(Date.now() - 4 * 86400000).toISOString(),
        duration: 2000,
        score: 950,
        accuracy: 91,
        scenarioId: 5,
        roomIds: [1, 2, 3],
        hits: 72,
        misses: 7
      }
    ],
    chartLeaderboards: [
      {
        day: new Date().toISOString().split('T')[0],
        hits: 42
      },
      {
        day: new Date(Date.now() - 86400000).toISOString().split('T')[0],
        hits: 65
      },
      {
        day: new Date(Date.now() - 2 * 86400000).toISOString().split('T')[0],
        hits: 38
      },
      {
        day: new Date(Date.now() - 3 * 86400000).toISOString().split('T')[0],
        hits: 89
      },
      {
        day: new Date(Date.now() - 4 * 86400000).toISOString().split('T')[0],
        hits: 72
      },
      {
        day: new Date(Date.now() - 5 * 86400000).toISOString().split('T')[0],
        hits: 55
      },
      {
        day: new Date(Date.now() - 6 * 86400000).toISOString().split('T')[0],
        hits: 48
      }
    ],
    friends: [
      {
        id: "friend1",
        name: "Alex Thompson",
        status: "accepted",
        score: 875,
        avatar: "https://i.pravatar.cc/150?u=friend1",
        email: "alex.thompson@example.com"
      },
      {
        id: "friend2",
        name: "Sarah Chen",
        status: "accepted",
        score: 920,
        avatar: "https://i.pravatar.cc/150?u=friend2",
        email: "sarah.chen@example.com"
      },
      {
        id: "friend3",
        name: "Mike Rodriguez",
        status: "pending",
        score: 750,
        avatar: "https://i.pravatar.cc/150?u=friend3",
        email: "mike.rodriguez@example.com"
      },
      {
        id: "friend4",
        name: "Emily Davis",
        status: "accepted",
        score: 890,
        avatar: "https://i.pravatar.cc/150?u=friend4",
        email: "emily.davis@example.com"
      },
      {
        id: "friend5",
        name: "James Wilson",
        status: "accepted",
        score: 945,
        avatar: "https://i.pravatar.cc/150?u=friend5",
        email: "james.wilson@example.com"
      }
    ],
    stats: {
      targets: {
        total: 6,
        online: 5,
        offline: 1
      },
      rooms: {
        count: 5,
        active: 3
      },
      sessions: {
        total: 5,
        latest: {
          id: 1,
          score: 850,
          accuracy: 78
        },
        averageScore: 920,
        averageAccuracy: 86.8
      },
      hits: {
        total: 854,
        today: 42,
        thisWeek: 409,
        averagePerSession: 170.8
      }
    },
    invites: [
      {
        id: 1,
        sessionId: 1,
        token: "invite_abc123",
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      }
    ]
  };
};

// Export the seed function
export const seed = async () => {
  // Initialize the DB if it doesn't exist
  const storedDb = localStorage.getItem('staticDb');
  if (!storedDb) {
    const initialDb = await createDb();
    localStorage.setItem('staticDb', JSON.stringify(initialDb));
    return initialDb;
  }
  
  try {
    const parsedDb = JSON.parse(storedDb);
    
    // Ensure targets array exists
    if (!parsedDb.targets) {
      parsedDb.targets = [];
    }
    
    // Ensure scenarios array exists
    if (!parsedDb.scenarios) {
      parsedDb.scenarios = [
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
    }
    
    // Ensure chartLeaderboards array exists
    if (!parsedDb.chartLeaderboards) {
      parsedDb.chartLeaderboards = [];
    }
    
    return parsedDb;
  } catch (error) {
    console.error('Error parsing stored DB:', error);
    // Return a fresh DB if parsing fails
    return createDb();
  }
};
