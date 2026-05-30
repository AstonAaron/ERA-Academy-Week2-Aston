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

// GET /tickets/details
app.get("/tickets/details", (req, res) => {
    const sql = `SELECT t.id, t.title, t.status,
        CONCAT(u1.first_name, ' ', u1.last_name) AS submitted_by,
        CONCAT(u2.first_name, ' ', u2.last_name) AS assigned_to,
        d.name AS departments FROM tickets t JOIN users u1 ON t.submitted_by = u1.id
        LEFT JOIN users u2 ON t.assigned_to = u2.id 
        JOIN departments d ON t.department_id = d.id ORDER BY t.created_at DESC`;

    db.query(sql, (err, results) => {
        if (err) {
            console.error("Error getting ticket details:", err);
            return res.status(500).json({ error: "Failed to get ticket details" });
        }
        res.json(results);
    });
});

// GET /tickets/:id/details — returns one ticket with joined names
app.get('/tickets/:id/details', (req, res) => {
  const ticketId = req.params.id;
  const sql = `
    SELECT
      t.id          AS ticket_id,
      t.title,
      t.description,
      t.priority,
      t.status,
      t.created_at,
      CONCAT(u1.first_name, ' ', u1.last_name) AS submitted_by,
      CONCAT(u2.first_name, ' ', u2.last_name) AS assigned_to,
      d.name AS department
    FROM tickets t
    JOIN users u1      ON t.submitted_by  = u1.id
    LEFT JOIN users u2 ON t.assigned_to   = u2.id
    JOIN departments d ON t.department_id = d.id
    WHERE t.id = ?
  `;
  db.query(sql, [ticketId], (error, results) => {
    if (error) {
      console.error('Error getting ticket details:', error);
      return res.status(500).json({ error: 'Failed to get ticket details' });
    }
    if (results.length === 0) {
      return res.status(404).json({ error: 'Ticket not found' });
    }
    res.json(results[0]);
  });
});

//get route /tickets/:id
app.get("/tickets/:id", (req, res) => {
    const ticketId = req.params.id;
    const sql = "SELECT * FROM tickets WHERE id = ?";
    db.query(sql, [ticketId], (err, results) => {
        if (err) {
            console.error("Error getting ticket by ID:", err);
            return res.status(500).json({ error: "Failed to get ticket" });
        }
        if (results.length === 0) {
            return res.status(404).json({ error: "Ticket not found" });
        }
        res.json(results[0]);
    });
});

// GET route /tickets-notes
app.get("/ticket-notes", async (req, res) => {
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
app.get("/ticket-notes/:ticketId", async (req, res) => {
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
app.post("/ticket-notes", async (req, res) => {
    const { ticket_id, note, added_by } = req.body;
    if (!ticket_id || !note || !added_by) {
        return res.status(400).json({ error: "ticket_id, note, and added_by are required!" });
    }
    try {
        const mongoDb = getMongo();
        const result = await mongoDb.collection("ticket_notes").insertOne({
            ticket_id: parseInt(ticket_id),
            note: note,
            added_by: added_by,
            created_at: new Date()
        });
        res.status(201).json({ message: "Note added successfully", noteId: result.insertedId });
    } catch (err) {
        console.error("Error adding notes:", err);
        res.status(500).json({ error: "Failed to add note" });
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

// POST /login
app.post("/login", async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ error: "Email and password are required" });
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

    const sql = "SELECT * FROM users WHERE email = ?";
    db.query(sql, [email], async (err, results) => {
        if (err) {
            console.error("Login query error:", err);
            return res.status(500).json({ error: "OH NO! something went wrong" });
        }
        if (results.length === 0) {
            return res.status(401).json({ error: "Invalid email or password" });
        }
        const user = results[0];
        if (user.password !== password) {
            return res.status(401).json({ error: "Invalid email or password" });
        }
        try {
            const mongoDb = getMongo();
            await mongoDb.collection("activity_logs").insertOne({
                action: "user_login",
                user_id: user.id,
                ticket_id: null,
                details: `${user.first_name} ${user.last_name} logged in as ${user.role}`,
                timestamp: new Date()
            });
        } catch (mongoErr) {
            console.error("Error to log login activity:", mongoErr);
        }
        res.status(200).json({
            message: "Login successful",
            first_name: user.first_name,
            last_name: user.last_name,
            role: user.role,
            user_id: user.id
        });
    });
});

//START SERVER
async function startServer() {
    await connectMongo();
    app.listen(PORT, () => {
        console.log(`Server is running at http://localhost:${PORT}`);
    });
}

startServer();
