
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
        name: "Target 1",
        roomId: null,
        status: "online",
        battery: 85
      },
      {
        id: 2,
        name: "Target 2",
        roomId: null,
        status: "online",
        battery: 72
      }
    ],
    rooms: [],
    sessions: [],
    chartLeaderboards: [],
    stats: {
      targets: {
        total: 2,
        online: 2
      },
      rooms: {
        count: 0
      },
      sessions: {
        latest: null
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
