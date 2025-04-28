
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
    targets: [],
    rooms: [],
    sessions: [],
    stats: {
      targets: {
        total: 0,
        online: 0
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
  
  return JSON.parse(storedDb);
};
