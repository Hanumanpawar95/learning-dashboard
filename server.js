const express = require("express");
const multer = require("multer");
const cors = require("cors");  // ✅ Enable CORS
const csv = require("csv-parser");
const fs = require("fs");
const path = require("path");

const app = express();
const port = 5000;

app.use(cors());  // ✅ Allow frontend requests
app.use(express.static("public"));

// ✅ Ensure the "uploads" folder exists
const uploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
}

// ✅ Configure file upload storage
const storage = multer.diskStorage({
    destination: "./uploads/",
    filename: (req, file, cb) => {
        cb(null, "uploaded_data.csv"); // Overwrites previous file
    },
});

const upload = multer({ storage: storage });

// ✅ Updated Eligibility Criteria (Course-wise)
const eligibilityCriteria = {
    "BS-CIT": { classroomMin: 8, labMin: 36, sessionMin: 48, classroomMax: 20, labMax: 60, sessionMax: 60 },
    "BS-CLS": { classroomMin: 8, labMin: 36, sessionMin: 32, classroomMax: 20, labMax: 60, sessionMax: 40 },
    "BS-CSS": { classroomMin: 8, labMin: 36, sessionMin: 16, classroomMax: 20, labMax: 60, sessionMax: 20 },
};

app.post("/upload", upload.single("file"), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
    }
    
    console.log("📂 File uploaded:", req.file.path);

    let learners = [];

    fs.createReadStream(req.file.path)
        .pipe(csv())
        .on("data", (row) => {
            let learner = {
                code: row["Learner Code"],
                name: row["Learner Name"],
                courses: {},
                eligible: "❌ Not Eligible for any course", // Default
            };

            let atLeastOneEligible = false;

            // Process all courses
            Object.keys(eligibilityCriteria).forEach((course) => {
                learner.courses[course] = processCourse(row, course);
                if (learner.courses[course].eligible === "✅ Eligible") {
                    atLeastOneEligible = true;
                }
            });

            // Update overall eligibility
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

    const result = {
        classroomMarks: `${classroom.actual} / ${classroom.max}`,
        labMarks: `${lab.actual} / ${lab.max}`,
        sessionCount: `${session.actual} / ${session.max}`,
        eligible: eligible ? "✅ Eligible" : "❌ Not Eligible",
    };

    console.log(`📊 Processed ${course} ->`, result); // ✅ Check if eligibility is calculated correctly
    return result;
}

app.listen(port, () => {
    console.log(`✅ Server running on port ${port}`);
});