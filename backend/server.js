require("dotenv").config();
const express = require("express");
const cors = require("cors");
const db = require("./db");
const { connectMongo, getMongo } = require("./mongo");

const app = express();
const PORT = 3000;
app.use(cors());
app.use(express.json());

// ROOT Route
app.get("/", (req, res) => {
    res.json({ message: "ERA tech solutions helpdesk API is running." });
});

// GET /departments
app.get("/departments", (req, res) => {
    const sql = "SELECT * FROM departments";
    db.query(sql, (err, results) => {
        if (err) {
            console.error("Error getting departments:", err);
            res.status(500).json({ error: "Internal Server Error" });
        } 
            res.json(results);
    });
});

// GET route /users
app.get("/users", (req, res) => {
    const sql = "SELECT id, first_name, last_name, email, role, department_id FROM users";
    db.query(sql, (err, results) => {
        if (err) {
            console.error("Error getting users:", err);
            return res.status(500).json({ error: "Internal Server Error" });
        } 
            res.json(results);
    });
});

// GET route /tickets
app.get("/tickets", (req, res) => {
    const sql = "SELECT * FROM tickets";
    db.query(sql, (err, results) => {
        if (err) {
            console.error("Error getting tickets:", err);
            return res.status(500).json({ error: "Internal Server Error" });
        }
        res.json(results);
    });
});

// GET route /tickets/open
app.get("/tickets/open", (req, res) => {
    const sql = "SELECT * FROM tickets WHERE status = 'open'";
    db.query(sql, (err, results) => {
        if (err) {
            console.error("Error getting open tickets:", err);
            return res.status(500).json({ error: "Internal Server Error" });
        }
        res.json(results);
    });
});

//get route /tickets/:id
app.get("/tickets/:id", (req, res) => {
    const ticketId = req.params.id;
    const sql = "SELECT * FROM tickets WHERE id = ?";
    db.query(sql, [ticketId], (err, results) => {
        if (err) {
            console.error("Error getting ticket by ID:", err);
            return res.status(500).json({ error: "Internal Server Error" });
        }
        if (results.length === 0) {
            return res.status(404).json({ error: "Ticket not found" });
        }
        res.json(results[0]);
    });
});

// GET route /tickets-notes
app.get('/tickets-notes', async(req, res) => {
    try {
        const mongoDb = getMongo();
        const notes = await mongoDb.collection('ticket_notes').find({}).toArray();
        res.json(notes);
    } 
    catch(err) {
        console.error('Error getting ticket notes:', err);
        res.status(500).json({ error: "failed to get notes" });
    }
});

//GET /tickets-notes/:ticketId
app.get("/tickets-notes/:ticketId", async(req, res) => {
    try {
        const ticketId = parseInt(req.params.ticketId);
        const mongoDb = getMongo();
        const notes = await mongoDb.collection("ticket_notes").find({ ticket_id: ticketId }).toArray(); 
        res.json(notes);
    } catch (err) {
        console.error("Error getting notes for ticket:", err.message);
        res.status(500).json({ error: err.message });
    }
});

// GET /activity-logs
app.get("/activity-logs", async(req, res) => {
    try {
        const mongoDb = getMongo();
        const logs = await mongoDb.collection("activity_logs").find({}).sort({ timestamp: -1 }).toArray();
        res.json(logs);
    }
    catch(err) {
        console.error("Error getting activity logs:", err);
        res.status(500).json({ error: "Failed to get activity logs" });
    }
});

//START SERVER
async function startServer() {
    await connectMongo();
    app.listen(PORT, () => {
        console.log(`Server is running at http://localhost:${PORT}`);
    });
}

startServer();
