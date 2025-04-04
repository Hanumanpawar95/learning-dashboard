
document.addEventListener("DOMContentLoaded", function () {
  const form = document.getElementById("upload-form");
  const fileInput = document.getElementById("csvFile");
  const batchNameInput = document.getElementById("batchName");
  const uploadedByInput = document.getElementById("uploadBy");

  const tableBody = document.getElementById("table-body");
  const tableHeaderRow = document.getElementById("table-header-row");
  const reportSection = document.getElementById("report-section");
  const batchTitle = document.getElementById("batchTitle");
  const uploadedBySpan = document.getElementById("uploadedBy");
  const uploadDate = document.getElementById("uploadDate");

  // ✅ If report data already exists in sessionStorage, show it
  if (sessionStorage.getItem("reportData")) {
    const learners = JSON.parse(sessionStorage.getItem("reportData"));
    const batchName = sessionStorage.getItem("batchName");
    const uploadedBy = sessionStorage.getItem("uploadedBy");
    showReport(learners, batchName, uploadedBy);
  }

  form.addEventListener("submit", function (event) {
    event.preventDefault();

    if (!fileInput.files.length) {
      alert("❌ Please select a CSV file before uploading.");
      return;
    }

    const batchName = batchNameInput.value.trim();
    const uploadedBy = uploadedByInput.value.trim();

    if (!batchName || !uploadedBy) {
      alert("⚠️ Please enter Batch Name and Uploaded By.");
      return;
    }

    const formData = new FormData();
    formData.append("file", fileInput.files[0]);

    fetch("http://localhost:5000/upload", {
      method: "POST",
      body: formData,
    })
      .then(async (response) => {
        const contentType = response.headers.get("content-type");
        if (!contentType || !contentType.includes("application/json")) {
          throw new Error("❌ Server did not return JSON.");
        }

        const data = await response.json();
        console.log("✅ Response received from backend:", data);

        if (!data || data.length === 0) {
          alert("⚠️ No data found in the uploaded CSV.");
          return;
        }

        // ✅ Save report data in sessionStorage
        sessionStorage.setItem("batchName", batchName);
        sessionStorage.setItem("uploadedBy", uploadedBy);
        sessionStorage.setItem("reportData", JSON.stringify(data));

        showReport(data, batchName, uploadedBy);
      })
      .catch((error) => {
        console.error("❌ Upload Error:", error);
        alert("❌ Failed to upload the file. Please try again.");
      });
  });

  function showReport(learners, batchName, uploadedBy) {
    reportSection.style.display = "block";
    batchTitle.textContent = `📌 Batch: ${batchName}`;
    uploadedBySpan.textContent = uploadedBy;
    uploadDate.textContent = new Date().toLocaleDateString();

    tableBody.innerHTML = "";

    if (learners.length === 0) {
      alert("⚠️ No data available to display.");
      return;
    }

    const courseNames = Object.keys(learners[0].courses || {});
    tableHeaderRow.innerHTML = `
      <th>#</th>
      <th>Learner Code</th>
      <th>Learner Name</th>
      ${courseNames
        .map(
          (course) =>
            `<th>${course} Classroom</th><th>${course} Lab</th><th>${course} Sessions</th><th>${course} Status</th>`
        )
        .join("")}
      <th>Overall Status</th>
    `;

    learners.forEach((learner, index) => {
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${index + 1}</td>
        <td>${learner.code}</td>
        <td>${learner.name}</td>
      `;

      let isEligible = false;

      courseNames.forEach((course) => {
        const data = learner.courses[course] || {};
        const classroomMarks = data.classroomMarks || 0;
        const labMarks = data.labMarks || 0;
        const sessionCount = data.sessionCount || 0;
        const eligible = data.eligible || "❌ Not Eligible";

        if (eligible === "✅ Eligible") isEligible = true;

        row.innerHTML += `
          <td>${classroomMarks}</td>
          <td>${labMarks}</td>
          <td>${sessionCount}</td>
          <td class="${eligible === '✅ Eligible' ? 'eligible badge' : 'not-eligible badge'}">${eligible}</td>
        `;
      });

      row.innerHTML += `
        <td class="${isEligible ? 'eligible badge' : 'not-eligible badge'}">
          ${isEligible ? "✅ Eligible for at least one course" : "❌ Not Eligible for any course"}
        </td>
      `;

      tableBody.appendChild(row);
    });
  }
});
