const express = require("express");
const multer = require("multer");
const cors = require("cors");
const csv = require("csv-parser");
const fs = require("fs");
const path = require("path");

const { google } = require("googleapis");
const dotenv = require("dotenv");
dotenv.config();

const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());
app.use(express.static("public"));

const uploadDir = path.join(__dirname, "uploads");
const reportsDir = path.join(__dirname, "reports");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);
if (!fs.existsSync(reportsDir)) fs.mkdirSync(reportsDir);

// 🔐 Load Google Service Account
const auth = new google.auth.GoogleAuth({
    credentials: require("./google.json"),
    scopes: ["https://www.googleapis.com/auth/drive.file"]
});

const drive = google.drive({ version: "v3", auth });

// 📦 Multer storage config
const storage = multer.diskStorage({
    destination: uploadDir,
    filename: (req, file, cb) => cb(null, "uploaded_data.csv")
});
const upload = multer({ storage });

// ✅ Eligibility Criteria
const eligibilityCriteria = {
    "BS-CIT": { classroomMin: 8, labMin: 36, sessionMin: 48, classroomMax: 20, labMax: 60, sessionMax: 60 },
    "BS-CLS": { classroomMin: 8, labMin: 36, sessionMin: 32, classroomMax: 20, labMax: 60, sessionMax: 40 },
    "BS-CSS": { classroomMin: 8, labMin: 36, sessionMin: 16, classroomMax: 20, labMax: 60, sessionMax: 20 },
};

// 📥 Upload & process CSV
app.post("/upload", upload.single("file"), (req, res) => {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    console.log("📂 File uploaded:", req.file.path);
    let learners = [];

    fs.createReadStream(req.file.path)
        .pipe(csv())
        .on("data", (row) => {
            let learner = {
                code: row["Learner Code"],
                name: row["Learner Name"],
                courses: {},
                eligible: "❌ Not Eligible for any course"
            };

            let atLeastOneEligible = false;

            Object.keys(eligibilityCriteria).forEach((course) => {
                learner.courses[course] = processCourse(row, course);
                if (learner.courses[course].eligible === "✅ Eligible") {
                    atLeastOneEligible = true;
                }
            });

            if (atLeastOneEligible) {
                learner.eligible = "✅ Eligible for at least one course";
            }

            learners.push(learner);
        })
        .on("end", () => {
            console.log("✅ Processing complete:", learners.length, "records processed.");
            res.json(learners);
        })
        .on("error", (err) => {
            console.error("❌ CSV Parsing Error:", err);
            res.status(500).json({ error: "Error parsing CSV file" });
        });
});

// 🔍 Check course eligibility
function processCourse(row, course) {
    const extractMarks = (value, max) => {
        if (!value) return { actual: 0, max: max };
        const parts = value.split("/");
        return {
            actual: parseFloat(parts[0]) || 0,
            max: parts[1] ? parseFloat(parts[1]) : max
        };
    };

    const classroom = extractMarks(row[`${course} Classroom Internal Marks`], eligibilityCriteria[course].classroomMax);
    const lab = extractMarks(row[`${course} Lab Internal Marks`], eligibilityCriteria[course].labMax);
    const session = extractMarks(row[`${course} Completed Session Count`], eligibilityCriteria[course].sessionMax);

    const eligible =
        classroom.actual >= eligibilityCriteria[course].classroomMin &&
        lab.actual >= eligibilityCriteria[course].labMin &&
        session.actual >= eligibilityCriteria[course].sessionMin;

    return {
        classroomMarks: `${classroom.actual} / ${classroom.max}`,
        labMarks: `${lab.actual} / ${lab.max}`,
        sessionCount: `${session.actual} / ${session.max}`,
        eligible: eligible ? "✅ Eligible" : "❌ Not Eligible"
    };
}

// 💾 Save report locally + 📤 Upload to Google Drive
app.post("/save-report", async (req, res) => {
    const { centerCode, batchName, uploadedBy, data } = req.body;

    if (!centerCode || !batchName || !uploadedBy || !data) {
        return res.status(400).json({ error: "Missing required fields" });
    }

    const filename = `${centerCode}_${batchName}.json`;
    const filepath = path.join(reportsDir, filename);

    const reportData = {
        centerCode,
        batchName,
        uploadedBy,
        data,
        uploadDate: new Date().toISOString()
    };

    fs.writeFile(filepath, JSON.stringify(reportData, null, 2), async (err) => {
        if (err) {
            console.error("❌ Failed to save report:", err);
            return res.status(500).send("Failed to save report");
        }

        console.log("✅ Report saved locally:", filename);

        // Upload to Google Drive
        try {
            const response = await drive.files.create({
                requestBody: {
                    name: filename,
                    mimeType: "application/json"
                },
                media: {
                    mimeType: "application/json",
                    body: fs.createReadStream(filepath)
                }
            });

            console.log("✅ Report uploaded to Google Drive:", response.data.id);
            res.status(200).send("Report saved and uploaded to Drive successfully");
        } catch (uploadErr) {
            console.error("❌ Google Drive Upload Error:", uploadErr);
            res.status(500).send("Saved locally but failed to upload to Google Drive");
        }
    });
});

// 📁 Get all reports metadata
app.get("/get-reports-metadata", (req, res) => {
    fs.readdir(reportsDir, (err, files) => {
        if (err) {
            console.error("❌ Failed to read report directory:", err);
            return res.status(500).send("Failed to read reports");
        }

        const metadata = files
            .filter(file => file.endsWith(".json"))
            .map(file => {
                const [centerCode, batchName] = file.replace(".json", "").split("_");
                return { centerCode, batchName };
            });

        res.json(metadata);
    });
});

// 📤 Get specific report
app.get("/get-report", (req, res) => {
    const { center, batch } = req.query;

    if (!center || !batch) {
        return res.status(400).send("Missing center or batch");
    }

    const filename = `${center}_${batch}.json`;
    const filepath = path.join(reportsDir, filename);

    fs.readFile(filepath, "utf8", (err, data) => {
        if (err) {
            console.error("❌ Failed to read report:", err);
            return res.status(404).send("Report not found");
        }

        res.json(JSON.parse(data));
    });
});

app.listen(port, () => {
    console.log(`✅ Server running at http://localhost:${port}`);
});
