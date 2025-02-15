require("dotenv").config();
const express = require("express");
const mysql = require("mysql2");
const cors = require("cors");

const app = express();
app.use(express.json());

// Public CORS settings
const corsOptions = {
  origin: "*", // Allow all origins (public access)
  methods: ["GET", "POST", "PUT", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: false // Change to true if authentication is needed
};
app.use(cors(corsOptions));

const Buffer = require("buffer").Buffer;
const decodeBase64 = (encoded) => Buffer.from(encoded, "base64").toString("utf-8");

const pool = mysql.createPool({
  host: decodeBase64(process.env.DB_HOST),
  user: decodeBase64(process.env.DB_USER),
  password: decodeBase64(process.env.DB_PASSWORD),
  database: decodeBase64(process.env.DB_NAME),
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  port: 3306,
  ssl: {
    rejectUnauthorized: false
  }
});

console.log('Attempting connection with:', {
  host: decodeBase64(process.env.DB_HOST),
  user: decodeBase64(process.env.DB_USER),
  database: decodeBase64(process.env.DB_NAME)
});

pool.on('connection', function (connection) {
  console.log('DB Connection established with thread ID:', connection.threadId);
});

pool.getConnection((err, connection) => {
  if (err) {
    console.error('Connection Error Details:', {
      message: err.message,
      code: err.code,
      state: err.sqlState,
      errno: err.errno,
      fatal: err.fatal,
      host: pool.config.connectionConfig.host,
      user: pool.config.connectionConfig.user,
      database: pool.config.connectionConfig.database
    });
    return;
  }
  console.log('Database connected successfully!');
  connection.release();
});

const promisePool = pool.promise();
app.get("/api/healthcheck", async (req, res) => {
  try {
    await promisePool.query("SELECT 1");
    res.status(200).json({ status: "healthy" });
  } catch (error) {
    console.error("Health check failed:", error);
    res.status(500).json({ status: "unhealthy", error: error.message });
  }
});

const createUsersTable = async () => {
  const createTableQuery = `
    CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      full_name VARCHAR(255) NOT NULL,
      mobile_number VARCHAR(15) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `;
  try {
    await promisePool.query(createTableQuery);
    console.log('Users table created or already exists.');
  } catch (error) {
    console.error('Error creating users table:', error);
  }
};

// Call the function to create the table
createUsersTable();

app.post("/register", async (req, res) => {
  try {
    const { fullName, mobileNumber } = req.body;
    
    if (!fullName || !mobileNumber) {
      return res.status(400).json({ error: "Full name and mobile number are required" });
    }

    const [result] = await promisePool.query(
      "INSERT INTO users (full_name, mobile_number) VALUES (?, ?)",
      [fullName, mobileNumber]
    );

    res.status(201).json({
      message: "Registration successful",
      userId: result.insertId
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: "Registration failed", details: error.message });
  }
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    error: "Something broke!", 
    details: err.message 
  });
});

module.exports = app;
