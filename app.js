import express from "express";
import bcrypt from "bcrypt";
import mysql from "mysql2/promise";
import path from 'path';
import { fileURLToPath } from 'url';
import session from 'express-session';
import cors from 'cors';

// Get the current directory name
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create a connection pool
const pool = mysql.createPool({
    host: 'localhost',
    user: 'root', 
    password: 'Godfrey123', 
    database: 'user_login' 
});

const app = express();
const port = 3000;
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());
app.use(cors()); 

//  session 
app.use(session({
    secret: 'your_secret_key', 
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false } 
}));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(port, () => {
    console.log("Server is started on port 3000");
});

app.post('/register', async (req, res) => {
    try {
        const { email, password } = req.body;
       
        const [rows] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
        if (rows.length > 0) {
            return res.status(400).send("User already exists");
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        await pool.query('INSERT INTO users (email, password) VALUES (?, ?)', [email, hashedPassword]);
        return res.status(201).send("Registered successfully");
    } catch (err) {
        console.error('Error during registration:', err);
        return res.status(500).send({ message: err.message });
    }
});

app.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        console.log(`Login attempt with email: ${email}`); 
        
        const [rows] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
        console.log(`Query result:`, rows); 
        
        if (rows.length === 0) {
            return res.status(400).send("Wrong email or password!");
        }

        const user = rows[0]; 
        console.log(`Retrieved user:`, user); 
        
        const passwordMatch = await bcrypt.compare(password, user.password);
        if (passwordMatch) {
            req.session.userId = user.user_id; 
            console.log(`User ID stored in session: ${req.session.userId}`); 
            return res.status(200).send({ message: "Logged in successfully!", userId: user.user_id });
        } else {
            return res.status(400).send("Wrong email or password!");
        }
    } catch (err) {
        console.error('Error during login:', err);
        return res.status(500).send({ message: err.message });
    }
});



app.post("/addPlanner/:userId", async (req, res) => {
    try {
        const userId = req.session.userId;
        if (!userId) {
            return res.status(401).send("Unauthorized: Please log in first");
        }

        const { planner_name } = req.body;
        if (!planner_name) {
            return res.status(400).send("Planner name is required");
        }

        const query = "INSERT INTO planners (user_id, planner_name) VALUES (?, ?)";
        await pool.query(query, [userId, planner_name]);
        res.status(201).send("Planner added successfully");
    } catch (error) {
        console.error("Error adding planner:", error);
        res.status(500).send("Internal Server Error");
    }
});


app.get("/getPlanners", async (req, res) => {
    try {
        const userId = req.session.userId;
        if (!userId) {
            return res.status(401).send("Unauthorized: Please log in first");
        }

        const [planners] = await pool.query("SELECT * FROM planners WHERE user_id = ?", [userId]);
        res.json(planners);
    } catch (error) {
        console.error("Error fetching planners:", error);
        res.status(500).send("Internal Server Error");
    }
});


app.delete("/deletePlanner/:id", async (req, res) => {
    try {
        const plannerId = req.params.id;
        const userId = req.session.userId;
        if (!userId) {
            return res.status(401).send("Unauthorized: Please log in first");
        }

        const deleteTasksQuery = "DELETE FROM tasks WHERE planner_id = ?";
        await pool.query(deleteTasksQuery, [plannerId]); // Cascade deletion of tasks under the planner

        const deletePlannerQuery = "DELETE FROM planners WHERE id = ? AND user_id = ?";
        const [result] = await pool.query(deletePlannerQuery, [plannerId, userId]);

        if (result.affectedRows === 0) {
            return res.status(404).send("Planner not found or not authorized to delete this planner");
        }

        res.send("Planner and associated tasks deleted successfully");
    } catch (error) {
        console.error("Error deleting planner:", error);
        res.status(500).send("Internal Server Error");
    }
});


app.post("/addTask/:plannerId", async (req, res) => {
    try {
        const userId = req.session.userId;
        const plannerId = req.params.plannerId;
        if (!userId) {
            return res.status(401).send("Unauthorized: Please log in first");
        }

        const { title, description, priority, due_date } = req.body;
        if (!title || !description || !priority || !due_date) {
            return res.status(400).send("All task details are required");
        }

        const query = "INSERT INTO tasks (user_id, planner_id, title, description, priority, due_date) VALUES (?, ?, ?, ?, ?, ?)";
        await pool.query(query, [userId, plannerId, title, description, priority, due_date]);
        res.status(201).send("Task created successfully");
    } catch (error) {
        console.error("Error creating task:", error);
        res.status(500).send("Internal Server Error");
    }
});


app.get("/getTasks/:plannerId", async (req, res) => {
    try {
        const userId = req.session.userId;
        const plannerId = req.params.plannerId;
        if (!userId) {
            return res.status(401).send("Unauthorized: Please log in first");
        }

        const [tasks] = await pool.query("SELECT * FROM tasks WHERE user_id = ? AND planner_id = ?", [userId, plannerId]);
        res.json(tasks);
    } catch (error) {
        console.error("Error fetching tasks:", error);
        res.status(500).send("Internal Server Error");
    }
});


app.delete("/deleteTask/:id", async (req, res) => {
    try {
        const taskId = req.params.id;
        const userId = req.session.userId;
        if (!userId) {
            return res.status(401).send("Unauthorized: Please log in first");
        }

        const query = "DELETE FROM tasks WHERE id = ? AND user_id = ?";
        const [result] = await pool.query(query, [taskId, userId]);

        if (result.affectedRows === 0) {
            return res.status(404).send("Task not found or not authorized to delete this task");
        }

        res.send("Task deleted successfully");
    } catch (error) {
        console.error("Error deleting task:", error);
        res.status(500).send("Internal Server Error");
    }
});
