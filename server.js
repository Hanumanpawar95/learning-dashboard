const express = require("express");
const multer = require("multer");
const cors = require("cors");
const csv = require("csv-parser");
const fs = require("fs");
const path = require("path");
const { google } = require("googleapis");

const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());
app.use(express.static("public")); // Optional for frontend files

// 📁 Ensure upload directory exists
const uploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

// 📦 Multer setup
const storage = multer.diskStorage({
  destination: uploadDir,
  filename: (req, file, cb) => cb(null, "uploaded_data.csv"),
});
const upload = multer({ storage });

// ✅ Eligibility Criteria
const eligibilityCriteria = {
  "BS-CIT": { classroomMin: 8, labMin: 36, sessionMin: 48, classroomMax: 20, labMax: 60, sessionMax: 60 },
  "BS-CLS": { classroomMin: 8, labMin: 36, sessionMin: 32, classroomMax: 20, labMax: 60, sessionMax: 40 },
  "BS-CSS": { classroomMin: 8, labMin: 36, sessionMin: 16, classroomMax: 20, labMax: 60, sessionMax: 20 },
};

// 📤 Google Drive setup using env var
const auth = new google.auth.GoogleAuth({
  credentials: JSON.parse(process.env.GOOGLE_CREDENTIALS),
  scopes: ["https://www.googleapis.com/auth/drive.file"],
});
const driveService = google.drive({ version: "v3", auth });

// 📄 Upload CSV and process it
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
        eligible: "❌ Not Eligible for any course",
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

// 🔍 Helper for processing course eligibility
function processCourse(row, course) {
  const extractMarks = (value, max) => {
    if (!value) return { actual: 0, max: max };
    const parts = value.split("/");
    return {
      actual: parseFloat(parts[0]) || 0,
      max: parts[1] ? parseFloat(parts[1]) : max,
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
    eligible: eligible ? "✅ Eligible" : "❌ Not Eligible",
  };
}

// ☁️ Save report directly to Google Drive
app.post("/save-report", async (req, res) => {
  const { centerCode, batchName, uploadedBy, data } = req.body;

  if (!centerCode || !batchName || !uploadedBy || !data) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  const filename = `${centerCode}_${batchName}.json`;
  const reportData = {
    centerCode,
    batchName,
    uploadedBy,
    data,
    uploadDate: new Date().toISOString(),
  };

  try {
    const fileMetadata = {
      name: filename,
      parents: ["1mo1PJAOEkx_CC9tjACm439rosbk1GkIq"], // ✅ Your Google Drive folder ID
    };

    const media = {
      mimeType: "application/json",
      body: Buffer.from(JSON.stringify(reportData, null, 2)),
    };

    const driveRes = await driveService.files.create({
      resource: fileMetadata,
      media: media,
      fields: "id",
    });

    console.log("📤 Uploaded to Google Drive:", driveRes.data.id);
    res.status(200).json({ message: "Report uploaded to Drive", fileId: driveRes.data.id });
  } catch (err) {
    console.error("❌ Google Drive upload failed:", err.message);
    res.status(500).send("Google Drive upload failed");
  }
});

// 🚀 Start server
app.listen(port, () => {
  console.log(`✅ Server running at http://localhost:${port}`);
});
