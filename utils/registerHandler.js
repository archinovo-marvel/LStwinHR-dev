const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Replace standard console methods with custom implementation
const originalConsoleLog = console.log;
const originalConsoleError = console.error;

// Custom logging function that also writes to a file
function logToFile(type, args) {
    const timestamp = new Date().toISOString();
    const message = args.map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
    ).join(' ');
    const logLine = `[${timestamp}] [${type.toUpperCase()}] ${message}\n`;
    
    // Write to standard output
    if (type === 'error') {
        originalConsoleError.apply(console, args);
    } else {
        originalConsoleLog.apply(console, args);
    }

    // Append to log file
    try {
        fs.appendFileSync(path.join(__dirname, 'server.log'), logLine);
    } catch (err) {
        // Can't log logging errors to the log file...
        originalConsoleError('Failed to write to log file:', err);
    }
}

// Override console methods
console.log = function(...args) { logToFile('info', args); };
console.error = function(...args) { logToFile('error', args); };
console.debug = function(...args) { logToFile('debug', args); };

// Add this constant for AuthHub configuration
// TODO: Move this to a config file or environment variable in production
const AUTHHUB_URL = process.env.AUTHHUB_API_URL || 'http://localhost:8080';

const USERS_FILE = path.join(__dirname, 'users.json');

// Ensure users file exists
if (!fs.existsSync(USERS_FILE)) {
    console.log('Creating users.json file...');
    fs.writeFileSync(USERS_FILE, JSON.stringify([], null, 2));
}

// Helper to read users
const readUsers = () => {
    try {
        const data = fs.readFileSync(USERS_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Error reading users file:', error);
        return [];
    }
};

// Helper to write users
const writeUsers = (users) => {
    try {
        fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
        return true;
    } catch (error) {
        console.error('Error writing users file:', error);
        return false;
    }
};

/**
 * Handle new user registration
 * 1. Save locally to users.json
 * 2. Sync to AuthHub via /api/system-accounts/register
 */
const handleRegister = async (req, res) => {
    const { username, password, email, role } = req.body;

    if (!username || !password) {
        return res.status(400).json({ success: false, message: '用户名和密码不能为空' });
    }

    console.log(`Processing registration for user: ${username}`);

    try {
        const users = readUsers();

        // 1. Check if user exists locally
        if (users.find(u => u.username === username)) {
            console.log(`Registration failed: User ${username} already exists locally`);
            return res.status(400).json({ success: false, message: '用户名已存在' });
        }

        // 2. Create new user object
        const newUser = {
            id: Date.now().toString(),
            username,
            password, // In a real app, hash this!
            email: email || '',
            role: role || 'user',
            createdAt: new Date().toISOString(),
            source: 'local_register'
        };

        // 3. Save locally
        users.push(newUser);
        if (!writeUsers(users)) {
            throw new Error('Failed to save to local database');
        }
        
        console.log(`User ${username} saved locally. Syncing to AuthHub...`);

        // 4. Sync to AuthHub (Simulating the API from your screenshot)
        // Interface: POST /api/system-accounts/register
        // Body: { systemCode: "zplx", userId: "...", password: "..." }
        try {
           
             // We use a short timeout so the user isn't waiting too long if AuthHub is down
            const authHubResponse = await axios.post(`${AUTHHUB_URL}/api/system-accounts/register`, {
                systemCode: 'zplx',
                userId: newUser.username, // Using username as userId for mapping
                password: newUser.password,
                phone: newUser.email, // Mapping email to phone field just for demo, or handle properly
                accountStatus: 'ACTIVE',
                memberLevel: 'NON_MEMBER'
            }, { timeout: 3000 });

            console.log(`AuthHub Sync Success for ${username}:`, authHubResponse.data);

        } catch (syncError) {
            // Important: We do NOT fail the registration if AuthHub sync fails.
            // We just log it. In a real system, you might add this to a retry queue.
            console.error(`Warning: Failed to sync user ${username} to AuthHub:`, syncError.message);
            if (syncError.response) {
                console.error('AuthHub Response:', syncError.response.data);
            }
        }

        res.json({ 
            success: true, 
            message: '注册成功',
            user: { 
                username: newUser.username, 
                role: newUser.role 
            } 
        });

    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ success: false, message: '注册失败: ' + error.message });
    }
};

module.exports = { handleRegister };
