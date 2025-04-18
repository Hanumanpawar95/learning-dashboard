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

// 🔐 Google Auth setup
let credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS_JSON);
credentials.private_key = credentials.private_key.replace(/\\n/g, '\n');

const auth = new google.auth.GoogleAuth({
  credentials,
  scopes: ["https://www.googleapis.com/auth/drive.file"],
});

const driveService = google.drive({ version: "v3", auth });
const folderId = "1mo1PJAOEkx_CC9tjACm439rosbk1GkIq"; // 📁 Your Drive folder ID

// 🔁 Retry Logic & Cache Utilities
const cache = new Map();

function setCache(key, data, ttl = 300000) {
  cache.set(key, { data, expiry: Date.now() + ttl });
}

function getCache(key) {
  const entry = cache.get(key);
  if (entry && Date.now() < entry.expiry) return entry.data;
  cache.delete(key);
  return null;
}

async function retryGoogleDriveRequest(fn, retries = 3, delay = 1000) {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (err) {
      if (i === retries - 1) throw err;
      console.warn(`⚠️ Retry ${i + 1} due to error:`, err.message);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

// 🔍 Process Course Logic
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

// 📤 Upload & Process CSV
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
      console.log("✅ CSV processing complete:", learners.length, "records");
      res.json(learners);
    })
    .on("error", (err) => {
      console.error("❌ CSV Parsing Error:", err);
      res.status(500).json({ error: "Error parsing CSV file" });
    });
});

// 📤 Save or Update Report
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
    const listRes = await retryGoogleDriveRequest(() =>
      driveService.files.list({
        q: `name='${filename}' and '${folderId}' in parents and trashed=false`,
        fields: "files(id, name)",
      })
    );

    if (listRes.data.files.length > 0) {
      const fileId = listRes.data.files[0].id;

      await driveService.files.update({
        fileId: fileId,
        media: {
          mimeType: "application/json",
          body: bufferStream,
        },
      });

      console.log("♻️ File updated:", fileId);
      return res.status(200).json({ message: "File updated", fileId });
    } else {
      const createRes = await driveService.files.create({
        resource: {
          name: filename,
          parents: [folderId],
        },
        media: {
          mimeType: "application/json",
          body: bufferStream,
        },
        fields: "id",
      });

      console.log("📤 New file created:", createRes.data.id);
      return res.status(200).json({ message: "Report uploaded", fileId: createRes.data.id });
    }
  } catch (err) {
    console.error("❌ Google Drive error:", err.message);
    res.status(500).json({ error: "Google Drive upload/update failed" });
  }
});

// 📥 Fetch Metadata (Optimized)
app.get("/get-reports-metadata", async (req, res) => {
  const cacheKey = "report_metadata";
  const cached = getCache(cacheKey);

  if (cached) {
    console.log("⚡ Using cached metadata");
    return res.json(cached);
  }

  try {
    const result = await retryGoogleDriveRequest(() =>
      driveService.files.list({
        q: `'${folderId}' in parents and mimeType='application/json' and trashed = false`,
        fields: "files(id, name)",
      })
    );

    const metadata = result.data.files.map(file => {
      const [centerCode, batchNameWithExt] = file.name.split("_");
      const batchName = batchNameWithExt.replace(".json", "");
      return { centerCode, batchName };
    });

    setCache(cacheKey, metadata, 5 * 60 * 1000); // Cache for 5 mins
    res.json(metadata);
  } catch (err) {
    console.error("❌ Metadata fetch failed after retries:", err.message);
    res.status(500).json({ error: "Failed to fetch metadata" });
  }
});

// 📥 Fetch Specific Report (Optimized)
app.get("/get-report", async (req, res) => {
  const { center, batch } = req.query;

  if (!center || !batch) {
    return res.status(400).json({ error: "Missing center or batch" });
  }

  const filename = `${center}_${batch}.json`;

  try {
    const result = await retryGoogleDriveRequest(() =>
      driveService.files.list({
        q: `name='${filename}' and '${folderId}' in parents and trashed=false`,
        fields: "files(id, name)",
      })
    );

    if (result.data.files.length === 0) {
      return res.status(404).json({ error: "Report not found" });
    }

    const fileId = result.data.files[0].id;

    const fileRes = await retryGoogleDriveRequest(() =>
      driveService.files.get({
        fileId,
        alt: "media",
      })
    );

    res.json(fileRes.data);
  } catch (err) {
    console.error("❌ Report fetch failed after retries:", err.message);
    res.status(500).json({ error: "Failed to fetch report" });
  }
});

// 🚀 Start Server
app.listen(port, () => {
  console.log(`✅ Server running at http://localhost:${port}`);
});
