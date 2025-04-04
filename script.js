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
      .then((response) => response.json())
      .then((data) => {
        if (!data || data.length === 0) {
          alert("⚠️ No data found in the uploaded CSV.");
          return;
        }

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
          <td>${classroomMarks} / 20</td>
          <td>${labMarks} / 60</td>
          <td>${sessionCount} / 60</td>
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
