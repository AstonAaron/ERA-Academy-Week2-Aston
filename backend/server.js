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
app.get("/tickets-notes", async (req, res) => {
    try {
        const mongoDb = getMongo();
        const notes = await mongoDb.collection("ticket_notes").find({}).toArray();
        res.json(notes);
    } catch (err) {
        console.error("Error getting ticket notes:", err);
        res.status(500).json({ error: "failed to get notes" });
    }
});

//GET /tickets-notes/:ticketId
app.get("/tickets-notes/:ticketId", async (req, res) => {
    try {
        const ticketId = parseInt(req.params.ticketId);
        const mongoDb = getMongo();
        const notes = await mongoDb
            .collection("ticket_notes")
            .find({ ticket_id: ticketId })
            .toArray();
        res.json(notes);
    } catch (err) {
        console.error("Error getting notes for ticket:", err.message);
        res.status(500).json({ error: err.message });
    }
});

// GET /activity-logs
app.get("/activity-logs", async (req, res) => {
    try {
        const mongoDb = getMongo();
        const logs = await mongoDb
            .collection("activity_logs")
            .find({})
            .sort({ timestamp: -1 })
            .toArray();
        res.json(logs);
    } catch (err) {
        console.error("Error getting activity logs:", err);
        res.status(500).json({ error: "Failed to get activity logs" });
    }
});

//POST /users
app.post("/users", (req, res) => {
    const { first_name, last_name, email, password, role, department_id } = req.body;
    if (!first_name || !last_name || !email || !password) {
        return res
            .status(400)
            .json({ error: "first_name, last_name, email, and password are required" });
    }
    if (password.length < 8) {
        return res.status(400).json({ error: "Password must be at least 8 characters long" });
    }
    const specialChar = /[!@#$%]/;
    if (!specialChar.test(password)) {
        return res
            .status(400)
            .json({ error: "Password must contain at least one special character: !@#$%" });
    }

    const sql =
        "INSERT INTO users (first_name, last_name, email, password, role, department_id) VALUES (?, ?, ?, ?, ?, ?)";
    const userRole = role || "employee";
    const deptId = department_id || null;

    db.query(sql, [first_name, last_name, email, password, userRole, deptId], (err, results) => {
        if (err) {
            console.error("Error creating user:", err);
            return res.status(500).json({ error: "Failed to create user" });
        }
        res.status(201).json({ message: "User created successfully", userId: results.insertId });
    });
});

// POST /tickets
app.post("/tickets", async (req, res) => {
    const { title, description, priority, status, submitted_by, assigned_to, department_id } =
        req.body;
    if (!title || !submitted_by) {
        return res.status(400).json({ error: "Title and submitted_by are required" });
    }
    const ticketPriority = priority || "medium";
    const ticketStatus = status || "open";
    const assignedTo = assigned_to || null;
    const deptId = department_id || null;

    const sql =
        "INSERT INTO tickets (title, description, priority, status, submitted_by, assigned_to, department_id) VALUES (?, ?, ?, ?, ?, ?, ?)";
    db.query(
        sql,
        [title, description, ticketPriority, ticketStatus, submitted_by, assignedTo, deptId],
        async (err, results) => {
            if (err) {
                console.error("Error creating ticket:", err);
                return res.status(500).json({ error: "Failed to create ticket" });
            }
            const newTicketId = results.insertId;
            try {
                const mongoDb = getMongo();
                await mongoDb.collection("activity_logs").insertOne({
                    action: "ticket_created",
                    user_id: submitted_by,
                    ticket_id: newTicketId,
                    details: `ticket created: ${title}`,
                    timestamp: new Date()
                });
            } catch (mongoErr) {
                console.error("Error inserting activity log:", mongoErr);
            }
            res.status(201).json({ message: "Ticket created successfully", ticketId: newTicketId });
        }
    );
});

//POST /tickets-notes
app.post("/tickets-notes", async (req, res) => {
    const { ticket_id, note, added_by } = req.body;
    if (!ticket_id || !note || !added_by) {
        return res.status(400).json({ error: "ticket_id, note, and added_by are required!" });
    }
    try {
        const mongoDb = getMongo();
        const result = await mongoDb.collection("ticket_notes").insertOne({ ticket_id: parseInt(ticket_id), note: note, added_by: added_by, created_at: new Date() });
        res.status(201).json({ message: "Note added successfully", noteId: result.insertedId });
    }
    catch (err) {
        console.error("Error adding notes:", err);
        res.status(500).json({ error: "Failed to add note"});
    }
});

//POST /activity-logs
app.post("/activity-logs", async (req, res) => {
    const { action, user_id, ticket_id, details } = req.body;
    if (!action || !details) {
        return res.status(400).json({ error: "action and details are required" });
    }
    try {
        const mongoDb = getMongo();
        const result = await mongoDb.collection("activity_logs").insertOne({
            action: action,
            user_id: user_id || null,
            ticket_id: ticket_id || null,
            details: details,
            timestamp: new Date()
        });
        res.status(201).json({ message: "Activity log created ", logId: result.insertedId });
    } catch (err) {
        console.error("Error creating activity log:", err);
        res.status(500).json({ error: "Failed to create activity log" });
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
