const express = require("express");
const multer = require("multer");
const cors = require("cors");
const csv = require("csv-parser");
const path = require("path");
const { google } = require("googleapis");
const stream = require("stream");

const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());
app.use(express.static("public"));

// 📦 Multer setup for CSV upload
const storage = multer.memoryStorage();
const upload = multer({ storage });

// ✅ Eligibility Criteria
const eligibilityCriteria = {
  "BS-CIT": { classroomMin: 8, labMin: 36, sessionMin: 48, classroomMax: 20, labMax: 60, sessionMax: 60 },
  "BS-CLS": { classroomMin: 8, labMin: 36, sessionMin: 32, classroomMax: 20, labMax: 60, sessionMax: 40 },
  "BS-CSS": { classroomMin: 8, labMin: 36, sessionMin: 16, classroomMax: 20, labMax: 60, sessionMax: 20 },
};

// 🔐 Google Auth setup (from env, fix private_key line breaks)
let credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS_JSON);
credentials.private_key = credentials.private_key.replace(/\\n/g, '\n');

const auth = new google.auth.GoogleAuth({
  credentials,
  scopes: ["https://www.googleapis.com/auth/drive.file"],
});
const driveService = google.drive({ version: "v3", auth });

// 🔍 Helper for processing each course
function processCourse(row, course) {
  const extractMarks = (value, max) => {
    if (!value) return { actual: 0, max };
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

// 📤 Endpoint to upload and process CSV file
app.post("/upload", upload.single("file"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });

  console.log("📂 File uploaded in memory");

  const learners = [];
  const bufferStream = new stream.PassThrough();
  bufferStream.end(req.file.buffer);

  bufferStream
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

// 📤 Save report directly to Google Drive
app.post("/save-report", async (req, res) => {
  const { centerCode, batchName, uploadedBy, data } = req.body;

  if (!centerCode || !batchName || !uploadedBy || !data) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  const reportData = {
    centerCode,
    batchName,
    uploadedBy,
    data,
    uploadDate: new Date().toISOString(),
  };

  const fileContent = JSON.stringify(reportData, null, 2);
  const bufferStream = new stream.PassThrough();
  bufferStream.end(Buffer.from(fileContent));

  const filename = `${centerCode}_${batchName}.json`;

  try {
    const driveResponse = await driveService.files.create({
      resource: {
        name: filename,
        parents: ["1mo1PJAOEkx_CC9tjACm439rosbk1GkIq"], // ✅ Your Google Drive folder ID
      },
      media: {
        mimeType: "application/json",
        body: bufferStream,
      },
      fields: "id",
    });

    console.log("📤 Uploaded to Google Drive:", driveResponse.data.id);
    res.status(200).json({ message: "Report uploaded to Google Drive", fileId: driveResponse.data.id });
  } catch (err) {
    console.error("❌ Google Drive upload failed:", err.message);
    res.status(500).send("Google Drive upload failed");
  }
});

// 🚀 Start server
app.listen(port, () => {
  console.log(`✅ Server running at http://localhost:${port}`);
});
