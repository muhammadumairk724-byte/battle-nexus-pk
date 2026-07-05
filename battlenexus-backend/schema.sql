-- ============================================================
-- DATABASE: battlenexus (create if not exists)
-- ============================================================
CREATE DATABASE IF NOT EXISTS battlenexus;
USE battlenexus;

-- ============================================================
-- TABLES (drop existing to start fresh – remove DROP if you want to keep data)
-- ============================================================
DROP TABLE IF EXISTS password_reset_tokens;
DROP TABLE IF EXISTS leaderboard_entries;
DROP TABLE IF EXISTS tournament_participants;
DROP TABLE IF EXISTS notifications;
DROP TABLE IF EXISTS tournaments;
DROP TABLE IF EXISTS users;

-- ============================================================
-- USERS
-- ============================================================
CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    phone VARCHAR(20),
    role ENUM('user', 'admin') DEFAULT 'user',
    status ENUM('pending', 'active', 'blocked') DEFAULT 'pending',
    email_verified BOOLEAN DEFAULT FALSE,
    avatar_url VARCHAR(255),
    prefs JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP NULL,
    INDEX idx_email (email),
    INDEX idx_username (username),
    INDEX idx_status (status)
);

-- ============================================================
-- TOURNAMENTS
-- ============================================================
CREATE TABLE tournaments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    game VARCHAR(50) DEFAULT 'Free Fire',
    description TEXT,
    rules TEXT,
    cover_image VARCHAR(255),
    format ENUM('solo', 'duo', 'squad') NOT NULL,
    map VARCHAR(50),
    date_time TIMESTAMP NOT NULL,
    entry_fee DECIMAL(10,2) DEFAULT 0.00,
    prize_pool DECIMAL(10,2) NOT NULL,
    max_participants INT NOT NULL,
    current_participants INT DEFAULT 0,
    status ENUM('upcoming', 'live', 'completed') DEFAULT 'upcoming',
    winner_id INT NULL,                               -- new column
    created_by INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (winner_id) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_status (status),
    INDEX idx_date (date_time)
);

-- ============================================================
-- TOURNAMENT PARTICIPANTS
-- ============================================================
CREATE TABLE tournament_participants (
    id INT AUTO_INCREMENT PRIMARY KEY,
    tournament_id INT NOT NULL,
    user_id INT NOT NULL,
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status ENUM('registered', 'pending', 'joined', 'dropped', 'completed') DEFAULT 'registered',
    screenshot_url VARCHAR(255) NULL,                  -- new column
    UNIQUE KEY unique_participation (tournament_id, user_id),
    FOREIGN KEY (tournament_id) REFERENCES tournaments(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ============================================================
-- LEADERBOARD ENTRIES
-- ============================================================
CREATE TABLE leaderboard_entries (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL UNIQUE,
    `rank` INT NOT NULL,
    score INT DEFAULT 0,
    kills INT DEFAULT 0,
    wins INT DEFAULT 0,
    losses INT DEFAULT 0,                               -- new column
    total_matches INT DEFAULT 0,
    prize_won DECIMAL(10,2) DEFAULT 0.00,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_rank (`rank`)
);

-- ============================================================
-- NOTIFICATIONS
-- ============================================================
CREATE TABLE notifications (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    `read` BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    related_id INT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_read (user_id, `read`)
);

-- ============================================================
-- PASSWORD RESET TOKENS (also used for email verification)
-- ============================================================
CREATE TABLE password_reset_tokens (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    token VARCHAR(255) NOT NULL UNIQUE,
    expires_at TIMESTAMP NOT NULL,
    type ENUM('reset', 'verify') DEFAULT 'reset',       -- new column to differentiate reset vs verify
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_token (token)
);

-- ============================================================
-- OPTIONAL: Insert admin user (if not already seeded by backend)
-- If you want to manually insert the admin, uncomment the following lines:
-- (The backend seedAdmin will create it automatically, so this is not needed unless you're bypassing seed)
-- ============================================================
-- INSERT INTO users (username, email, password_hash, full_name, role, status, email_verified)
-- VALUES ('admin', 'UmairAdmin@gmail.com', '$2b$10$eT2CnaIOk0A8DKG9r.8faOiPkWpNwW/HqFqeDiM671SG.vjeVWyRm', 'Super Admin', 'admin', 'active', TRUE);

-- ============================================================
-- VERIFICATION
-- ============================================================
SELECT 'All tables created successfully!' AS status;