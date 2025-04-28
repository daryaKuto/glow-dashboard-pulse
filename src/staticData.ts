
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
        battery: 95
      },
      {
        id: 2,
        name: "Quick Response Beta",
        roomId: 1,
        status: "online",
        battery: 87
      },
      {
        id: 3,
        name: "Training Target Gamma",
        roomId: 2,
        status: "online",
        battery: 76
      },
      {
        id: 4,
        name: "Practice Target Delta",
        roomId: null,
        status: "offline",
        battery: 15
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
        targetCount: 0
      }
    ],
    scenarios: [
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
    ],
    sessions: [
      {
        id: 1,
        name: "Morning Practice",
        date: new Date().toISOString(),
        duration: 1200,
        score: 850,
        accuracy: 78
      },
      {
        id: 2,
        name: "Speed Training",
        date: new Date(Date.now() - 86400000).toISOString(),
        duration: 1800,
        score: 920,
        accuracy: 85
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
      }
    ],
    friends: [
      {
        id: "friend1",
        name: "Alex Thompson",
        status: "accepted",
        score: 875,
        avatar: "https://i.pravatar.cc/150?u=friend1"
      },
      {
        id: "friend2",
        name: "Sarah Chen",
        status: "accepted",
        score: 920,
        avatar: "https://i.pravatar.cc/150?u=friend2"
      },
      {
        id: "friend3",
        name: "Mike Rodriguez",
        status: "pending",
        score: 750,
        avatar: "https://i.pravatar.cc/150?u=friend3"
      }
    ],
    stats: {
      targets: {
        total: 4,
        online: 3
      },
      rooms: {
        count: 3
      },
      sessions: {
        latest: {
          id: 1,
          score: 850
        }
      }
    }
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
